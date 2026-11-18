import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { WorldState } from "../sim/world";
import { AI_CORPSE_TIME, AI_DEATH_ANIM, isTwoHanded, SLASH_DURATION } from "../sim/world";
import { createAiBody, type AiBodyHandle } from "./aiBody";
import {
  attachEquippedVisuals,
  emptyEquipMeshes,
  equipKey,
  mountEquipMeshes,
  type EquipMeshes,
} from "./equipAttach";
import { buildItemMesh, buildProjectileMesh, disposeObject3D } from "./itemMesh";
import { createHero } from "./loadHero";

export type RenderHandles = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  playerMesh: THREE.Group;
  playerSword: THREE.Group;
  aiMeshes: Map<string, AiBodyHandle>;
  lootMeshes: Map<string, THREE.Group>;
  resize: () => void;
  sync: (world: WorldState) => void;
  dispose: () => void;
};

export async function createRenderer(container: HTMLElement): Promise<RenderHandles> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7a7358);
  scene.fog = new THREE.Fog(0x7a7358, 45, 95);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(12, 15, 12);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  container.prepend(renderer.domElement);

  // Environment para reflejos en metal (filo / brillo)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xcbb892, 0x3a2e1c, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2a8, 1.12);
  sun.position.set(18, 28, 8);
  const rim = new THREE.DirectionalLight(0xb8d0ff, 0.22);
  rim.position.set(-12, 10, -8);
  scene.add(rim);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x5a4a32, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Parches de tierra / hierba seca
  const patchMat = new THREE.MeshStandardMaterial({ color: 0x4a5a30, roughness: 1 });
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x3e3224, roughness: 1 });
  for (let i = 0; i < 28; i++) {
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(1.2 + Math.random() * 2.2, 7),
      Math.random() > 0.45 ? patchMat : dirtMat,
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set((Math.random() - 0.5) * 70, 0.015, (Math.random() - 0.5) * 70);
    scene.add(patch);
  }

  // Rocas toscas
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c574c, roughness: 0.95, metalness: 0.05 });
  for (let i = 0; i < 14; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.7, 0),
      rockMat,
    );
    rock.position.set((Math.random() - 0.5) * 60, 0.25, (Math.random() - 0.5) * 60);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  // Tocones / postes de madera
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.95 });
  for (let i = 0; i < 8; i++) {
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.55, 6), woodMat);
    stump.position.set((Math.random() - 0.5) * 50, 0.28, (Math.random() - 0.5) * 50);
    stump.castShadow = true;
    scene.add(stump);
  }

  const playerMesh = new THREE.Group();
  scene.add(playerMesh);

  const hero = await createHero();
  // El modelo Quaternius mira +Z; el sim usa -Z → girar 180°
  hero.root.rotation.y = Math.PI;
  playerMesh.add(hero.root);

  let equipMeshes: EquipMeshes = emptyEquipMeshes();
  mountEquipMeshes(hero, equipMeshes);

  const swingMat = new THREE.MeshBasicMaterial({
    color: 0xe8dcc8,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const swingMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 18, Math.PI / 2 - 0.45, 0.9),
    swingMat,
  );
  swingMesh.rotation.x = -Math.PI / 2;
  swingMesh.position.set(0, 0.7, 0.12);
  swingMesh.visible = false;
  playerMesh.add(swingMesh);

  let shake = 0;
  let lastSync = performance.now();

  const aiMeshes = new Map<string, AiBodyHandle>();
  const lootMeshes = new Map<string, THREE.Group>();
  const lootItemId = new Map<string, string>();
  const lootPlaceholders = new Map<string, THREE.Mesh>();
  const coinMeshes = new Map<string, THREE.Mesh>();
  const projectileMeshes = new Map<string, THREE.Group>();
  let equippedKey = "";
  const AI_SWING = 0.28;
  /** Máx. meshes de loot nuevos por frame (evita hitch al matar). */
  const LOOT_BUILDS_PER_FRAME = 1;

  const coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12);
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xf0d060,
    metalness: 1,
    roughness: 0.18,
    envMapIntensity: 1.5,
    emissive: 0x664400,
  });
  const lootPlaceholderGeo = new THREE.OctahedronGeometry(0.16, 0);
  const lootPlaceholderMat = new THREE.MeshStandardMaterial({
    color: 0x8ab4c8,
    metalness: 0.55,
    roughness: 0.35,
    emissive: 0x224466,
    emissiveIntensity: 0.8,
  });

  function resize(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function ensureAi(id: string): AiBodyHandle {
    let h = aiMeshes.get(id);
    if (!h) {
      h = createAiBody(0x6e3b2e);
      scene.add(h.root);
      aiMeshes.set(id, h);
    }
    return h;
  }

  function clearLootPlaceholder(dropId: string): void {
    const ph = lootPlaceholders.get(dropId);
    if (!ph) return;
    scene.remove(ph);
    lootPlaceholders.delete(dropId);
  }

  function ensureLootPlaceholder(dropId: string): THREE.Mesh {
    let m = lootPlaceholders.get(dropId);
    if (!m) {
      m = new THREE.Mesh(lootPlaceholderGeo, lootPlaceholderMat);
      scene.add(m);
      lootPlaceholders.set(dropId, m);
    }
    return m;
  }

  function ensureLootMesh(dropId: string, itemId: string, build: () => THREE.Group): THREE.Group {
    let m = lootMeshes.get(dropId);
    if (m && lootItemId.get(dropId) !== itemId) {
      scene.remove(m);
      disposeObject3D(m);
      lootMeshes.delete(dropId);
      m = undefined;
    }
    if (!m) {
      m = build();
      // Sin sombras: barato; el hitch venía de mesh+luz en el frame del kill
      m.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });
      scene.add(m);
      lootMeshes.set(dropId, m);
      lootItemId.set(dropId, itemId);
      clearLootPlaceholder(dropId);
    }
    return m;
  }

  function syncEquippedVisuals(world: WorldState): void {
    const key = equipKey(world.equipment);
    if (key === equippedKey) return;
    equippedKey = key;
    equipMeshes = attachEquippedVisuals(hero, equipMeshes, world.equipment);
  }

  function sync(world: WorldState): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastSync) / 1000);
    lastSync = now;

    const p = world.player;
    playerMesh.position.x = p.pos.x;
    playerMesh.position.z = p.pos.y;
    playerMesh.rotation.y = p.facing;
    playerMesh.visible = p.alive;
    hero.setHurt(p.hurtTimer > 0);

    syncEquippedVisuals(world);

    const swinging = p.attackSwing > 0 && !world.blocking;
    if (swinging) {
      const u = 1 - Math.min(1, p.attackSwing / Math.max(0.05, world.attackSwingMax || SLASH_DURATION));
      hero.applyCombat(u, world.combatAnim, false);
      const showArc =
        world.combatAnim === "slash" ||
        world.combatAnim === "dualR" ||
        world.combatAnim === "dualL" ||
        world.combatAnim === "twohand";
      const mid = u > 0.28 && u < 0.62 ? 1 : 0.2;
      swingMesh.visible = showArc && u > 0.25 && u < 0.68;
      swingMat.opacity = 0.04 + mid * 0.16 * Math.sin(Math.min(1, Math.max(0, (u - 0.28) / 0.28)) * Math.PI);
      swingMesh.scale.setScalar(0.9 + u * 0.12);
      swingMesh.rotation.z = -0.25 + u * 0.7;
      if (u > 0.28 && u < 0.45) shake = 0.12;
    } else if (world.blocking) {
      hero.applyCombat(1, "block", true);
      swingMesh.visible = false;
    } else {
      swingMesh.visible = false;
    }
    const wpn = world.equipment.weapon;
    const off = world.equipment.offhand;
    const stance = world.blocking
      ? "block"
      : wpn?.kind === "bow"
        ? "bow"
        : wpn?.kind === "crossbow"
          ? "crossbow"
          : isTwoHanded(wpn)
            ? "twohand"
            : off?.kind === "shield"
              ? "block"
              : "onehand";
    hero.update(dt, p.walkPhase, p.moving, swinging || world.blocking, p.running, stance);

    shake = Math.max(0, shake - 0.016);
    const camTarget = new THREE.Vector3(p.pos.x, 0.9, p.pos.y);
    const camPos = camTarget.clone().add(new THREE.Vector3(5, 5.5, 6));
    if (shake > 0) {
      camPos.x += (Math.random() - 0.5) * shake * 2;
      camPos.y += (Math.random() - 0.5) * shake * 1.2;
    }
    camera.position.lerp(camPos, 0.14);
    camera.lookAt(camTarget);

    const presentIds = new Set<string>();
    for (const ai of world.ais) {
      const show = ai.alive || ai.deathTimer > 0;
      if (!show) continue;
      presentIds.add(ai.id);
      const body = ensureAi(ai.id);
      body.root.visible = true;
      body.root.position.x = ai.pos.x;
      body.root.position.z = ai.pos.y;
      body.root.rotation.y = ai.facing + Math.PI;
      const swingU = ai.alive && ai.attackSwing > 0 ? 1 - ai.attackSwing / AI_SWING : 0;
      const deathAge = ai.alive ? 0 : AI_CORPSE_TIME - ai.deathTimer;
      const deathU = ai.alive ? 0 : Math.min(1, deathAge / AI_DEATH_ANIM);
      const fade =
        ai.alive || ai.deathTimer > 1.15 ? 1 : Math.max(0, ai.deathTimer / 1.15);
      body.update(dt, ai.walkPhase, ai.moving && ai.alive, swingU, ai.hurtTimer > 0, deathU, fade);
    }
    for (const [id, body] of aiMeshes) {
      if (!presentIds.has(id)) {
        scene.remove(body.root);
        body.dispose();
        aiMeshes.delete(id);
      }
    }

    const lootIds = new Set<string>();
    let lootBuilds = LOOT_BUILDS_PER_FRAME;
    for (const drop of world.loot) {
      lootIds.add(drop.id);
      const y = 0.35 + Math.sin(world.time * 3 + drop.pos.x) * 0.06;
      let mesh = lootMeshes.get(drop.id);
      if (!mesh && lootBuilds > 0) {
        mesh = ensureLootMesh(drop.id, drop.item.id, () =>
          buildItemMesh(drop.item, { lite: true }),
        );
        lootBuilds -= 1;
      }
      if (mesh) {
        mesh.position.set(drop.pos.x, y, drop.pos.y);
        mesh.rotation.y = world.time * 1.4;
      } else {
        const ph = ensureLootPlaceholder(drop.id);
        ph.position.set(drop.pos.x, y, drop.pos.y);
        ph.rotation.y = world.time * 2.2;
      }
    }
    for (const [id, mesh] of lootMeshes) {
      if (!lootIds.has(id)) {
        scene.remove(mesh);
        disposeObject3D(mesh);
        lootMeshes.delete(id);
        lootItemId.delete(id);
        clearLootPlaceholder(id);
      }
    }
    for (const id of [...lootPlaceholders.keys()]) {
      if (!lootIds.has(id)) clearLootPlaceholder(id);
    }

    const coinIds = new Set<string>();
    for (const c of world.coinDrops) {
      coinIds.add(c.id);
      let mesh = coinMeshes.get(c.id);
      if (!mesh) {
        mesh = new THREE.Mesh(coinGeo, coinMat);
        mesh.castShadow = true;
        mesh.rotation.x = Math.PI / 2;
        scene.add(mesh);
        coinMeshes.set(c.id, mesh);
      }
      const bob = 0.22 + Math.sin(world.time * 4 + c.pos.x) * 0.05;
      mesh.position.set(c.pos.x, bob, c.pos.y);
      mesh.rotation.z = world.time * 3;
      mesh.scale.setScalar(0.85 + Math.min(2, c.amount) * 0.12);
    }
    for (const [id, mesh] of coinMeshes) {
      if (!coinIds.has(id)) {
        scene.remove(mesh);
        coinMeshes.delete(id);
      }
    }

    const projIds = new Set<string>();
    for (const proj of world.projectiles) {
      projIds.add(proj.id);
      let mesh = projectileMeshes.get(proj.id);
      if (!mesh) {
        mesh = buildProjectileMesh(proj);
        mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) o.castShadow = true;
        });
        scene.add(mesh);
        projectileMeshes.set(proj.id, mesh);
      }
      const yaw = Math.atan2(proj.dirX, proj.dirY);
      mesh.position.set(proj.pos.x, 0.95, proj.pos.y);
      mesh.rotation.set(0.05, yaw, proj.spin);
      mesh.scale.setScalar(1.15);
    }
    for (const [id, mesh] of projectileMeshes) {
      if (!projIds.has(id)) {
        scene.remove(mesh);
        disposeObject3D(mesh);
        projectileMeshes.delete(id);
      }
    }

    renderer.render(scene, camera);
  }

  function dispose(): void {
    renderer.dispose();
    renderer.domElement.remove();
  }

  resize();
  return {
    renderer,
    scene,
    camera,
    playerMesh,
    get playerSword() {
      return equipMeshes.weapon;
    },
    aiMeshes,
    lootMeshes,
    resize,
    sync,
    dispose,
  };
}
