import * as THREE from "three";
import type { ArmorParams, BeltParams, BootsParams } from "../shared/types";
import type { WorldState } from "../sim/world";
import { SLASH_DURATION } from "../sim/world";
import { createAiBody, type AiBodyHandle } from "./aiBody";
import {
  buildItemMesh,
  buildWornArmorMesh,
  buildWornBeltMesh,
  buildWornBootMesh,
  disposeObject3D,
} from "./itemMesh";
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
  renderer.toneMappingExposure = 0.92;
  container.prepend(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xcbb892, 0x3a2e1c, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xe6c58a, 1.05);
  sun.position.set(18, 28, 8);
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

  let playerSword = new THREE.Group();
  let playerShield = new THREE.Group();
  let playerHelmet = new THREE.Group();
  let playerArmor = new THREE.Group();
  let playerBelt = new THREE.Group();
  let playerBootL = new THREE.Group();
  let playerBootR = new THREE.Group();
  hero.handGrip.add(playerSword);
  hero.offhandGrip.add(playerShield);
  hero.headGrip.add(playerHelmet);
  hero.torsoGrip.add(playerArmor);
  hero.beltGrip.add(playerBelt);
  hero.bootGripL.add(playerBootL);
  hero.bootGripR.add(playerBootR);

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
  const coinMeshes = new Map<string, THREE.Mesh>();
  let equippedKey = "";
  const AI_SWING = 0.28;

  const coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12);
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xe8c44a,
    metalness: 0.85,
    roughness: 0.35,
    emissive: 0x553300,
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
      m.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      scene.add(m);
      lootMeshes.set(dropId, m);
      lootItemId.set(dropId, itemId);
    }
    return m;
  }

  function replaceGripChild(
    parent: THREE.Group,
    prev: THREE.Group,
    next: THREE.Group,
  ): THREE.Group {
    parent.remove(prev);
    disposeObject3D(prev);
    parent.add(next);
    return next;
  }

  function syncEquippedVisuals(world: WorldState): void {
    const w = world.equipment.weapon;
    const o = world.equipment.offhand;
    const h = world.equipment.helmet;
    const a = world.equipment.armor;
    const belt = world.equipment.belt;
    const b = world.equipment.boots;
    const key = `${w?.id ?? ""}|${o?.id ?? ""}|${h?.id ?? ""}|${a?.id ?? ""}|${belt?.id ?? ""}|${b?.id ?? ""}`;
    if (key === equippedKey) return;
    equippedKey = key;

    // -------------------------------------------------------------------------
    // OFFSET FINO DEL MESH respecto al ancla (loadHero.ts → *Grip).
    // position / rotation / scale = ajuste visual del ítem ya colgado del hueso.
    // Anclas: handGrip, offhandGrip, headGrip, torsoGrip, beltGrip, bootGripL/R
    // -------------------------------------------------------------------------

    // ARMA (espada / hacha / arrojadiza) → hero.handGrip
    if (w && (w.kind === "sword" || w.kind === "axe" || w.kind === "throw")) {
      const mesh = buildItemMesh(w);
      mesh.scale.setScalar(w.kind === "throw" ? 0.9 : 1.15);
      mesh.position.set(0.15, 0.05, 0);
      mesh.rotation.set(0, 0, 0);
      playerSword = replaceGripChild(hero.handGrip, playerSword, mesh);
    } else {
      playerSword = replaceGripChild(hero.handGrip, playerSword, new THREE.Group());
    }

    // ESCUDO → hero.offhandGrip
    if (o?.kind === "shield") {
      const mesh = buildItemMesh(o);
      mesh.scale.setScalar(1.25);
      mesh.position.set(0, 0, 0.06);
      mesh.rotation.set(0, 0, 0);
      playerShield = replaceGripChild(hero.offhandGrip, playerShield, mesh);
    } else {
      playerShield = replaceGripChild(hero.offhandGrip, playerShield, new THREE.Group());
    }

    // CASCO → hero.headGrip
    if (h?.kind === "helmet") {
      const mesh = buildItemMesh(h);
      mesh.scale.setScalar(1.35);
      mesh.position.set(0, 0.1, 0.02);
      mesh.rotation.set(0, 0, 0);
      playerHelmet = replaceGripChild(hero.headGrip, playerHelmet, mesh);
    } else {
      playerHelmet = replaceGripChild(hero.headGrip, playerHelmet, new THREE.Group());
    }

    // ARMADURA → hero.torsoGrip
    if (a?.kind === "armor") {
      const mesh = buildWornArmorMesh(a.params as ArmorParams);
      mesh.position.set(0, 0, 0);
      playerArmor = replaceGripChild(hero.torsoGrip, playerArmor, mesh);
    } else {
      playerArmor = replaceGripChild(hero.torsoGrip, playerArmor, new THREE.Group());
    }

    // CINTURÓN → hero.beltGrip
    if (belt?.kind === "belt") {
      const mesh = buildWornBeltMesh(belt.params as BeltParams);
      mesh.position.set(0, 0, 0);
      playerBelt = replaceGripChild(hero.beltGrip, playerBelt, mesh);
    } else {
      playerBelt = replaceGripChild(hero.beltGrip, playerBelt, new THREE.Group());
    }

    // BOTAS → hero.bootGripL / bootGripR
    if (b?.kind === "boots") {
      const params = b.params as BootsParams;
      playerBootL = replaceGripChild(hero.bootGripL, playerBootL, buildWornBootMesh(params));
      playerBootR = replaceGripChild(hero.bootGripR, playerBootR, buildWornBootMesh(params));
    } else {
      playerBootL = replaceGripChild(hero.bootGripL, playerBootL, new THREE.Group());
      playerBootR = replaceGripChild(hero.bootGripR, playerBootR, new THREE.Group());
    }
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

    const swinging = p.attackSwing > 0;
    if (swinging) {
      const u = 1 - Math.min(1, p.attackSwing / SLASH_DURATION);
      hero.applySlash(u, world.slashVariant);
      const mid = u > 0.28 && u < 0.62 ? 1 : 0.2;
      swingMesh.visible = u > 0.25 && u < 0.68;
      swingMat.opacity = 0.04 + mid * 0.16 * Math.sin(Math.min(1, Math.max(0, (u - 0.28) / 0.28)) * Math.PI);
      swingMesh.scale.setScalar(0.9 + u * 0.12);
      swingMesh.rotation.z = -0.25 + u * 0.7;
      if (u > 0.28 && u < 0.45) shake = 0.12;
    } else {
      swingMesh.visible = false;
    }
    hero.update(dt, p.walkPhase, p.moving, swinging, p.running);

    shake = Math.max(0, shake - 0.016);
    const camTarget = new THREE.Vector3(p.pos.x, 0.9, p.pos.y);
    const camPos = camTarget.clone().add(new THREE.Vector3(5, 5.5, 6));
    if (shake > 0) {
      camPos.x += (Math.random() - 0.5) * shake * 2;
      camPos.y += (Math.random() - 0.5) * shake * 1.2;
    }
    camera.position.lerp(camPos, 0.14);
    camera.lookAt(camTarget);

    const aliveIds = new Set<string>();
    for (const ai of world.ais) {
      aliveIds.add(ai.id);
      const body = ensureAi(ai.id);
      body.root.visible = ai.alive;
      body.root.position.x = ai.pos.x;
      body.root.position.z = ai.pos.y;
      body.root.rotation.y = ai.facing + Math.PI;
      const swingU = ai.attackSwing > 0 ? 1 - ai.attackSwing / AI_SWING : 0;
      body.update(dt, ai.walkPhase, ai.moving, swingU, ai.hurtTimer > 0);
    }
    for (const [id, body] of aiMeshes) {
      if (!aliveIds.has(id)) {
        scene.remove(body.root);
        body.dispose();
        aiMeshes.delete(id);
      }
    }

    const lootIds = new Set<string>();
    for (const drop of world.loot) {
      lootIds.add(drop.id);
      const mesh = ensureLootMesh(drop.id, drop.item.id, () => buildItemMesh(drop.item));
      mesh.position.set(
        drop.pos.x,
        0.35 + Math.sin(world.time * 3 + drop.pos.x) * 0.06,
        drop.pos.y,
      );
      mesh.rotation.y = world.time * 1.4;
    }
    for (const [id, mesh] of lootMeshes) {
      if (!lootIds.has(id)) {
        scene.remove(mesh);
        disposeObject3D(mesh);
        lootMeshes.delete(id);
        lootItemId.delete(id);
      }
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

    renderer.render(scene, camera);
  }

  function dispose(): void {
    renderer.dispose();
    renderer.domElement.remove();
  }

  resize();
  return { renderer, scene, camera, playerMesh, playerSword, aiMeshes, lootMeshes, resize, sync, dispose };
}
