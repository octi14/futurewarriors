import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export type HeroHandle = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  handGrip: THREE.Group;
  setHurt: (hurt: boolean) => void;
  update: (dt: number, walkPhase: number, moving: boolean, swinging: boolean) => void;
  applySlash: (u: number) => void;
};

function findObj(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && names.includes(o.name)) found = o;
  });
  return found;
}

/**
 * Héroe = humano CC0 Quaternius (Smooth Male), skinned + animaciones.
 * Procedural/metaballs no dan anatomía creíble; hace falta un mesh real.
 */
export async function createHero(): Promise<HeroHandle> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync("/models/HumanMale.glb");
  const model = gltf.scene;

  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (m instanceof THREE.MeshStandardMaterial) {
          m.roughness = Math.min(1, m.roughness ?? 0.7);
          m.metalness = 0;
        }
      }
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0.01) model.scale.setScalar(1.78 / size.y);
  box.setFromObject(model);
  model.position.y = -box.min.y;

  const root = new THREE.Group();
  root.add(model);

  // Actualizar matrices del esqueleto antes de colgar la espada
  model.updateMatrixWorld(true);
  const palm =
    findObj(model, ["MiddleHand.R", "Palm.R", "Fingers.R"]) ??
    findObj(model, ["LowerArm.R"]) ??
    model;
  const handGrip = new THREE.Group();
  handGrip.position.set(0.02, 0.06, 0);
  handGrip.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  palm.add(handGrip);

  const mixer = new THREE.AnimationMixer(model);
  const byName = new Map(gltf.animations.map((c) => [c.name, c]));
  const mk = (...names: string[]) => {
    for (const n of names) {
      const c = byName.get(n);
      if (c) return mixer.clipAction(c);
    }
    return mixer.clipAction(gltf.animations[0]);
  };

  const idle = mk("Man_Idle", "Man_Standing");
  const walk = mk("Man_Walk", "Man_Run");
  const slash = mk("Man_SwordSlash", "Man_Punch");

  for (const a of [idle, walk]) {
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.play();
  }
  idle.weight = 1;
  walk.weight = 0;
  slash.weight = 0;
  slash.clampWhenFinished = true;
  // Un frame para “asentar” el bind pose animado
  mixer.update(1 / 30);

  const actions: Record<string, THREE.AnimationAction> = { idle, walk, slash };
  const mats: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (m instanceof THREE.MeshStandardMaterial) mats.push(m);
      }
    }
  });

  function setHurt(hurt: boolean): void {
    const hex = hurt ? 0x3a1010 : 0x000000;
    for (const m of mats) m.emissive.setHex(hex);
  }

  function applySlash(u: number): void {
    slash.enabled = true;
    slash.paused = true;
    slash.weight = 1;
    idle.weight = 0;
    walk.weight = 0;
    const dur = Math.max(0.01, slash.getClip().duration);
    slash.time = Math.min(0.999, u) * dur;
    slash.play();
  }

  function update(dt: number, _walkPhase: number, moving: boolean, swinging: boolean): void {
    if (!swinging) {
      slash.weight = THREE.MathUtils.damp(slash.weight, 0, 10, dt);
      const tw = moving ? 1 : 0;
      walk.weight = THREE.MathUtils.damp(walk.weight, tw, 12, dt);
      idle.weight = THREE.MathUtils.damp(idle.weight, 1 - tw, 12, dt);
      idle.paused = false;
      walk.paused = false;
    }
    mixer.update(dt);
  }

  return { root, mixer, actions, handGrip, setHurt, update, applySlash };
}
