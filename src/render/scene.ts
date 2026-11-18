import * as THREE from "three";
import type { WorldState } from "../sim/world";
import { getEquipped } from "../sim/world";
import { createHero } from "./loadHero";
import { buildSwordMesh } from "./swordMesh";

export type RenderHandles = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  playerMesh: THREE.Group;
  playerSword: THREE.Group;
  aiMeshes: Map<string, THREE.Mesh>;
  lootMeshes: Map<string, THREE.Mesh>;
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
  // El facing del sim ya incluye el offset hacia el cursor/marcha
  playerMesh.add(hero.root);

  let playerSword = new THREE.Group();
  hero.handGrip.add(playerSword);

  const swingMat = new THREE.MeshBasicMaterial({
    color: 0xf0e0c0,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const swingMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 22, Math.PI / 2 - 0.65, 1.3),
    swingMat,
  );
  swingMesh.rotation.x = -Math.PI / 2;
  swingMesh.position.set(0, 0.75, 0.15);
  swingMesh.visible = false;
  playerMesh.add(swingMesh);

  const SLASH_DURATION = 0.42;
  let shake = 0;
  let lastSync = performance.now();

  const aiMeshes = new Map<string, THREE.Mesh>();
  const lootMeshes = new Map<string, THREE.Mesh>();
  let equippedSeed: number | null = null;

  function resize(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function ensureAiMesh(id: string): THREE.Mesh {
    let m = aiMeshes.get(id);
    if (!m) {
      m = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.32, 0.55, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x6e3b2e, roughness: 0.92 }),
      );
      m.castShadow = true;
      m.position.y = 0.6;
      scene.add(m);
      aiMeshes.set(id, m);
    }
    return m;
  }

  function ensureLootMesh(id: string): THREE.Mesh {
    let m = lootMeshes.get(id);
    if (!m) {
      m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({
          color: 0xffd76a,
          emissive: 0x664400,
          metalness: 0.4,
          roughness: 0.3,
        }),
      );
      m.castShadow = true;
      scene.add(m);
      lootMeshes.set(id, m);
    }
    return m;
  }

  function syncSword(world: WorldState): void {
    const item = getEquipped(world);
    const seed = item?.seed ?? null;
    if (seed === equippedSeed) return;
    equippedSeed = seed;
    hero.handGrip.remove(playerSword);
    playerSword.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    if (item) {
      playerSword = buildSwordMesh(item.params);
      playerSword.scale.setScalar(0.7);
      playerSword.position.set(0, -0.02, 0.04);
      playerSword.rotation.set(Math.PI / 2, 0, 0.05);
    } else {
      playerSword = new THREE.Group();
    }
    hero.handGrip.add(playerSword);
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

    syncSword(world);

    const swinging = p.attackSwing > 0;
    if (swinging) {
      const u = 1 - Math.min(1, p.attackSwing / SLASH_DURATION);
      hero.applySlash(u);
      const mid = u > 0.22 && u < 0.7 ? 1 : 0.25;
      swingMesh.visible = u > 0.18 && u < 0.75;
      swingMat.opacity = 0.15 + mid * 0.55 * Math.sin(Math.min(1, Math.max(0, (u - 0.22) / 0.35)) * Math.PI);
      swingMesh.scale.setScalar(0.95 + u * 0.35);
      swingMesh.rotation.z = -0.4 + u * 1.1;
      if (u > 0.28 && u < 0.45) shake = 0.12;
    } else {
      swingMesh.visible = false;
    }
    hero.update(dt, p.walkPhase, p.moving, swinging);

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
      const mesh = ensureAiMesh(ai.id);
      mesh.visible = ai.alive;
      mesh.position.x = ai.pos.x;
      mesh.position.z = ai.pos.y;
      mesh.rotation.y = ai.facing;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(ai.hurtTimer > 0 ? 0x551111 : 0x000000);
    }
    for (const [id, mesh] of aiMeshes) {
      if (!aliveIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        aiMeshes.delete(id);
      }
    }

    const lootIds = new Set<string>();
    for (const drop of world.loot) {
      lootIds.add(drop.id);
      const mesh = ensureLootMesh(drop.id);
      mesh.position.set(drop.pos.x, 0.45 + Math.sin(world.time * 3 + drop.pos.x) * 0.08, drop.pos.y);
      mesh.rotation.y = world.time * 2;
    }
    for (const [id, mesh] of lootMeshes) {
      if (!lootIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        lootMeshes.delete(id);
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
