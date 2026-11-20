import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ELEMENT_COLORS } from "../shared/elements";
import type { WorldState } from "../sim/world";
import {
  AI_CORPSE_TIME,
  AI_DEATH_ANIM,
  getCombatWeaponStats,
  getHitDamageBreakdown,
  isTwoHanded,
  SLASH_DURATION,
} from "../sim/world";
import { createAiBody, type AiBodyHandle } from "./aiBody";
import {
  attachEquippedVisuals,
  emptyEquipMeshes,
  equipKey,
  mountEquipMeshes,
  type EquipMeshes,
} from "./equipAttach";
import { buildItemMesh, buildProjectileMesh, disposeObject3D } from "./itemMesh";
import { createHero, makeLookalike } from "./loadHero";

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

/** Caída al suelo con rebote corto. startY → groundY. */
function dropFallY(age: number, startY: number, groundY: number): { y: number; airborne: boolean } {
  const fallT = 0.42;
  if (age < fallT) {
    const u = age / fallT;
    // Aceleración (ease-in): empieza alto y cae
    const y = startY + (groundY - startY) * (u * u);
    return { y, airborne: true };
  }
  const b = age - fallT;
  if (b < 0.2) {
    const u = b / 0.2;
    const bounce = 0.2 * (1 - u) * Math.sin(u * Math.PI);
    return { y: groundY + bounce * (startY - groundY) * 0.35, airborne: true };
  }
  return { y: groundY, airborne: false };
}

export async function createRenderer(container: HTMLElement, mapSize = 180): Promise<RenderHandles> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7a7358);
  scene.fog = new THREE.Fog(0x7a7358, 45, 95);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 420);
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
  // Menos acne / bandas negras en uniones de shells del héroe
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);

  const n2 = (ix: number, iy: number) => {
    const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const vnoise = (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = n2(x0, y0);
    const n10 = n2(x0 + 1, y0);
    const n01 = n2(x0, y0 + 1);
    const n11 = n2(x0 + 1, y0 + 1);
    return n00 + (n10 - n00) * sx + (n01 - n00) * sy + (n00 - n10 - n01 + n11) * sx * sy;
  };
  const fbm = (x: number, y: number) => vnoise(x, y) * 0.65 + vnoise(x * 2.1, y * 2.1) * 0.35;
  const groundGeo = new THREE.PlaneGeometry(mapSize, mapSize, 72, 72);
  groundGeo.rotateX(-Math.PI / 2);
  const gPos = groundGeo.attributes.position;
  const gCol = new Float32Array(gPos.count * 3);
  const dirt = new THREE.Color(0x5a4a32);
  const grassC = new THREE.Color(0x4c6b30);
  const tint = new THREE.Color();
  for (let i = 0; i < gPos.count; i++) {
    const n = fbm(gPos.getX(i) * 0.045, gPos.getZ(i) * 0.045);
    gPos.setY(i, (n - 0.5) * 0.7);
    tint.copy(dirt).lerp(grassC, Math.min(1, Math.max(0, (n - 0.38) * 2.4)));
    gCol[i * 3] = tint.r;
    gCol[i * 3 + 1] = tint.g;
    gCol[i * 3 + 2] = tint.b;
  }
  groundGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  const spread = mapSize * 0.92;
  const grass = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.07, 0.42, 3),
    new THREE.MeshStandardMaterial({ color: 0x3f6a28, roughness: 1 }),
    480,
  );
  grass.castShadow = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 480; i++) {
    const x = (Math.random() - 0.5) * spread;
    const z = (Math.random() - 0.5) * spread;
    dummy.position.set(x, (fbm(x * 0.045, z * 0.045) - 0.5) * 0.7, z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.setScalar(0.7 + Math.random() * 1.1);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grass);

  // Rocas toscas
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c574c, roughness: 0.95, metalness: 0.05 });
  for (let i = 0; i < Math.round(14 * (mapSize / 40)); i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.7, 0),
      rockMat,
    );
    const rx = (Math.random() - 0.5) * spread;
    const rz = (Math.random() - 0.5) * spread;
    rock.position.set(rx, 0.25 + (fbm(rx * 0.045, rz * 0.045) - 0.5) * 0.7, rz);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  // Tocones / postes de madera
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.95 });
  for (let i = 0; i < Math.round(8 * (mapSize / 40)); i++) {
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.55, 6), woodMat);
    const sx = (Math.random() - 0.5) * spread;
    const sz = (Math.random() - 0.5) * spread;
    stump.position.set(sx, 0.28 + (fbm(sx * 0.045, sz * 0.045) - 0.5) * 0.7, sz);
    stump.castShadow = true;
    scene.add(stump);
  }

  const playerMesh = new THREE.Group();
  scene.add(playerMesh);

  const hero = await createHero();
  // El modelo Quaternius mira +Z; el sim usa -Z → girar 180°
  hero.root.rotation.y = Math.PI;
  playerMesh.add(hero.root);

  // Pool de cazadores lookalike: cloneSkinned es caro; reciclar evita hitch al matar/respawn.
  const lookalikePool: AiBodyHandle[] = [];
  for (let i = 0; i < 10; i++) {
    const h = makeLookalike();
    h.root.visible = false;
    lookalikePool.push(h);
  }
  function acquireLookalike(): AiBodyHandle {
    // Preferir pool; cloneSkinned síncrono solo si se agotó (raro).
    const h = lookalikePool.pop() ?? makeLookalike();
    h.root.visible = true;
    h.root.rotation.x = 0;
    h.update(0, 0, false, 0, false, 0, 1);
    return h;
  }
  function releaseLookalike(h: AiBodyHandle): void {
    scene.remove(h.root);
    h.root.visible = false;
    h.root.rotation.x = 0;
    h.update(0, 0, false, 0, false, 0, 1);
    lookalikePool.push(h);
  }

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

  // FX elemental en el arco de corte
  const elemParts: { mesh: THREE.Mesh; life: number; vx: number; vy: number; vz: number }[] = [];
  const elemGeo = new THREE.SphereGeometry(0.05, 6, 6);
  function spawnElemBurst(color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(elemGeo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 0.6,
        0.55 + Math.random() * 0.5,
        0.2 + Math.random() * 0.5,
      );
      playerMesh.add(mesh);
      elemParts.push({
        mesh,
        life: 0.28 + Math.random() * 0.22,
        vx: (Math.random() - 0.5) * 2.2,
        vy: 0.6 + Math.random() * 1.4,
        vz: 0.4 + Math.random() * 1.6,
      });
    }
  }

  let shake = 0;
  let lastElemBurst = false;
  let lastSync = performance.now();

  const aiMeshes = new Map<string, AiBodyHandle>();
  const lootMeshes = new Map<string, THREE.Group>();
  const lootItemId = new Map<string, string>();
  const lootPlaceholders = new Map<string, THREE.Mesh>();
  const coinMeshes = new Map<string, THREE.Mesh>();
  const projectileMeshes = new Map<string, THREE.Group>();
  let equippedKey = "";
  const AI_SWING = 0.28;
  /** Máx. meshes de loot nuevos por frame (evita hitch al matar: buildItemMesh+canvas). */
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

  const aiIsBug = new Map<string, boolean>();

  function ensureAi(id: string, bug: boolean): AiBodyHandle {
    let h = aiMeshes.get(id);
    if (!h) {
      if (bug) {
        h = createAiBody(0x3d6b32);
        h.root.scale.setScalar(0.62);
      } else {
        h = acquireLookalike();
      }
      scene.add(h.root);
      aiMeshes.set(id, h);
      aiIsBug.set(id, bug);
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
    playerMesh.position.y = p.height + (p.crouching ? -0.32 : 0);
    playerMesh.position.z = p.pos.y;
    playerMesh.rotation.y = p.facing;
    playerMesh.scale.y = p.crouching ? 0.72 : 1;
    playerMesh.visible = p.alive;
    hero.setHurt(p.hurtTimer > 0);

    syncEquippedVisuals(world);

    const swinging = p.attackSwing > 0 && !world.blocking;
    if (swinging) {
      const u = 1 - Math.min(1, p.attackSwing / Math.max(0.05, world.attackSwingMax || SLASH_DURATION));
      hero.applyCombat(u, world.combatAnim, false, world.slashVariant);
      const showArc =
        world.combatAnim === "slash" ||
        world.combatAnim === "dualR" ||
        world.combatAnim === "dualL" ||
        world.combatAnim === "twohand";
      const cut = u > 0.2 && u < 0.58;
      const mid = cut ? 1 : 0.15;
      const arcT = Math.min(1, Math.max(0, (u - 0.18) / 0.42));
      swingMesh.visible = showArc && u > 0.16 && u < 0.72;
      const trailEl = getHitDamageBreakdown(world).trailElement;
      swingMat.color.setHex(trailEl ? ELEMENT_COLORS[trailEl] : 0xe8dcc8);
      swingMat.opacity = 0.04 + mid * (trailEl ? 0.55 : 0.2) * Math.sin(arcT * Math.PI);
      // Escala del arco ≈ alcance real del golpe (stats.reach)
      const hitReach = Math.max(0.55, getCombatWeaponStats(world).reach);
      swingMesh.scale.setScalar(hitReach * ((trailEl ? 1.05 : 0.92) + arcT * 0.12));
      const v = world.slashVariant % 4;
      const baseZ = v === 1 ? 0.55 : v === 2 ? -0.1 : -0.55;
      const sweep = v === 1 ? -1.15 : v === 2 ? 0.35 : 1.2;
      swingMesh.rotation.z = baseZ + arcT * sweep;
      if (trailEl && cut && !lastElemBurst) {
        spawnElemBurst(ELEMENT_COLORS[trailEl], 7);
        lastElemBurst = true;
      }
      if (!cut) lastElemBurst = false;
      // Sin sacudida en especial (evita salto de cámara); normal muy suave
      if (u > 0.28 && u < 0.42 && world.chargeKind === "none") shake = 0.045;
    } else {
      swingMesh.visible = false;
      lastElemBurst = false;
    }
    for (let i = elemParts.length - 1; i >= 0; i--) {
      const pfx = elemParts[i]!;
      pfx.life -= dt;
      pfx.mesh.position.x += pfx.vx * dt;
      pfx.mesh.position.y += pfx.vy * dt;
      pfx.mesh.position.z += pfx.vz * dt;
      pfx.vy -= 2.5 * dt;
      const mat = pfx.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, pfx.life * 2.5);
      if (pfx.life <= 0) {
        playerMesh.remove(pfx.mesh);
        mat.dispose();
        elemParts.splice(i, 1);
      }
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
    // Escala anim walk/run: 1 ≈ speed base ~3.1 m/s (10 * MOVE_SPEED_PER_STAT).
    const locoScale = Math.max(0.55, Math.min(1.35, p.speed / 3.1));
    hero.update(dt, p.walkPhase, p.moving, swinging, p.running, stance, world.blocking, locoScale);

    shake = Math.max(0, shake - 0.016);
    const camTarget = new THREE.Vector3(p.pos.x, 0.9 + p.height * 0.45, p.pos.y);
    const camPos = camTarget.clone().add(new THREE.Vector3(5.4, 5.95, 6.5));
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
      const body = ensureAi(ai.id, ai.role !== "hunter");
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
        if (aiIsBug.get(id)) {
          scene.remove(body.root);
          body.dispose();
        } else {
          // Cazador: devolver al pool (no dispose/clone en el kill/respawn)
          releaseLookalike(body);
        }
        aiMeshes.delete(id);
        aiIsBug.delete(id);
      }
    }

    const lootIds = new Set<string>();
    let lootBuilds = LOOT_BUILDS_PER_FRAME;
    for (const drop of world.loot) {
      lootIds.add(drop.id);
      const fall = dropFallY(drop.age, 1.25, 0.14);
      let mesh = lootMeshes.get(drop.id);
      if (!mesh && lootBuilds > 0) {
        mesh = ensureLootMesh(drop.id, drop.item.id, () =>
          buildItemMesh(drop.item, { lite: true }),
        );
        lootBuilds -= 1;
      }
      if (mesh) {
        mesh.position.set(drop.pos.x, fall.y, drop.pos.y);
        mesh.rotation.y = fall.airborne
          ? drop.age * 6.5 + drop.pos.x
          : drop.pos.x * 2.1;
        mesh.rotation.x = fall.airborne ? drop.age * 3.2 : 0.35;
        mesh.rotation.z = fall.airborne ? Math.sin(drop.age * 8) * 0.4 : 0.15;
      } else {
        const ph = ensureLootPlaceholder(drop.id);
        ph.position.set(drop.pos.x, fall.y, drop.pos.y);
        ph.rotation.y = fall.airborne ? drop.age * 8 : drop.pos.x;
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
      const fall = dropFallY(c.age, 0.95, 0.06);
      mesh.position.set(c.pos.x, fall.y, c.pos.y);
      mesh.rotation.z = fall.airborne ? c.age * 10 : c.pos.x * 3;
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
