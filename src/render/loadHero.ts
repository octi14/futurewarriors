import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CombatAnimKind } from "../shared/types";
import type { AiBodyHandle } from "./aiBody";

export type HeroHandle = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  /** SkinnedMeshes del cuerpo (para cascarones de equipo). */
  bodySkins: THREE.SkinnedMesh[];
  /** Capa de equipo skinned (mismo skeleton, flexiona con el body). */
  skinnedLayer: THREE.Group;
  handGrip: THREE.Group;
  offhandGrip: THREE.Group;
  headGrip: THREE.Group;
  torsoGrip: THREE.Group;
  beltGrip: THREE.Group;
  bootGripL: THREE.Group;
  bootGripR: THREE.Group;
  gloveGripL: THREE.Group;
  gloveGripR: THREE.Group;
  setHurt: (hurt: boolean) => void;
  update: (
    dt: number,
    walkPhase: number,
    moving: boolean,
    swinging: boolean,
    running?: boolean,
    stance?: CombatAnimKind | "idle" | "onehand",
    activelyBlocking?: boolean,
  ) => void;
  /**
   * Animación de combate.
   * u 0..1 progreso del swing; anim = throw/dual/bow/…; blocking = escudo.
   * variant = índice de trayectoria de espadazo (0..n).
   */
  applyCombat: (u: number, anim: CombatAnimKind, blocking?: boolean, variant?: number) => void;
  /** @deprecated usar applyCombat */
  applySlash: (u: number, variant?: number) => void;
};

function findObj(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
  const want = new Set(names.map((n) => n.replace(/\./g, "")));
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && want.has(o.name.replace(/\./g, ""))) found = o;
  });
  return found;
}

/**
 * Héroe = humano CC0 Quaternius (Smooth Male), skinned + animaciones.
 * Procedural/metaballs no dan anatomía creíble; hace falta un mesh real.
 */
let humanGltf: Promise<GLTF> | null = null;
function loadHuman(): Promise<GLTF> {
  if (!humanGltf) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    humanGltf = loader.loadAsync("/models/HumanMale.glb");
  }
  return humanGltf;
}

/** Misma malla y piel que el jugador. Llamar después de createHero. */
export function makeLookalike(): AiBodyHandle {
  if (!styledHuman) throw new Error("makeLookalike antes de createHero");
  const model = cloneSkinned(styledHuman);
  const mats: THREE.MeshStandardMaterial[] = [];
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const cloned = list.map((m) => m.clone());
    o.material = Array.isArray(o.material) ? cloned : cloned[0]!;
    for (const m of cloned) if (m instanceof THREE.MeshStandardMaterial) mats.push(m);
  });
  const root = new THREE.Group();
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const clip = (names: string[]) => {
    const found = humanClips.find((a) => names.includes(a.name)) ?? humanClips[0];
    return mixer.clipAction(found!);
  };
  const idle = clip(["Man_Idle", "Man_Standing"]);
  const walk = clip(["Man_Walk"]);
  idle.play();
  walk.play();
  idle.weight = 1;
  walk.weight = 0;
  return {
    root,
    update(dt, _walkPhase, moving, _swingU, hurt, deathU = 0, fade = 1) {
      walk.weight = THREE.MathUtils.damp(walk.weight, moving ? 1 : 0, 12, dt);
      idle.weight = THREE.MathUtils.damp(idle.weight, moving ? 0 : 1, 12, dt);
      mixer.update(dt);
      root.rotation.x = deathU * 1.35;
      for (const m of mats) {
        m.transparent = fade < 0.99;
        m.opacity = fade;
        m.emissive.setHex(hurt ? 0x3a1010 : 0);
      }
    },
    dispose() {
      mixer.stopAllAction();
      for (const m of mats) m.dispose();
    },
  };
}

let styledHuman: THREE.Object3D | null = null;
let humanClips: THREE.AnimationClip[] = [];

export async function createHero(): Promise<HeroHandle> {
  const gltf = await loadHuman();
  humanClips = gltf.animations;
  const model = gltf.scene;

  // Piel clara + ropa bakeada (Shirt/Pants) al mismo tono → se ve “sin ropa”
  const skinTone = new THREE.Color(0xf2d4b8);
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (m instanceof THREE.MeshStandardMaterial) {
          m.roughness = Math.min(1, m.roughness ?? 0.7);
          m.metalness = 0;
          if (m.name === "Skin" || m.name === "Shirt" || m.name === "Pants") {
            m.color.copy(skinTone);
            m.map = null;
            m.roughness = 0.68;
            m.metalness = 0;
          }
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
  styledHuman = model;

  const root = new THREE.Group();
  root.add(model);

  const bodySkins: THREE.SkinnedMesh[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) bodySkins.push(o);
  });
  const skinnedLayer = new THREE.Group();
  skinnedLayer.name = "skinned-gear";
  model.add(skinnedLayer);

  model.updateMatrixWorld(true);
  const palmR =
    findObj(model, ["MiddleHandR", "PalmR", "FingersR"]) ??
    findObj(model, ["LowerArmR"]) ??
    model;
  const palmL =
    findObj(model, ["MiddleHandL", "PalmL", "FingersL"]) ??
    findObj(model, ["LowerArmL"]) ??
    model;
  const headBone = findObj(model, ["Head"]) ?? model;
  // OJO: traverse encuentra Body antes que Torso — pedir Torso solo
  const torsoBone = findObj(model, ["Torso"]) ?? findObj(model, ["Abdomen"]) ?? model;
  const beltBone = findObj(model, ["Abdomen"]) ?? findObj(model, ["Hips"]) ?? model;
  const footL = findObj(model, ["FootL"]) ?? model;
  const footR = findObj(model, ["FootR"]) ?? model;
  const fingersR = findObj(model, ["FingersR"]);
  const fingersL = findObj(model, ["FingersL"]);
  const thumb1R = findObj(model, ["Thumb1R"]);
  const thumb2R = findObj(model, ["Thumb2R"]);
  const thumb1L = findObj(model, ["Thumb1L"]);
  const thumb2L = findObj(model, ["Thumb2L"]);
  const fingerRest = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const b of [fingersR, fingersL, thumb1R, thumb2R, thumb1L, thumb2L]) {
    if (b) fingerRest.set(b, b.quaternion.clone());
  }
  const _fistAxis = new THREE.Vector3(1, 0, 0);
  function curlFinger(bone: THREE.Object3D | null, angle: number): void {
    if (!bone) return;
    const rest = fingerRest.get(bone);
    if (rest) bone.quaternion.copy(rest);
    bone.rotateOnAxis(_fistAxis, angle);
  }
  /** Puño: dedos hacia la palma. El signo es el mismo en ambos lados (el reposo ya está espejado). */
  function closeFists(both: boolean): void {
    curlFinger(fingersR, -1.35);
    curlFinger(thumb1R, -0.85);
    curlFinger(thumb2R, -0.65);
    if (!both) return;
    curlFinger(fingersL, -1.35);
    curlFinger(thumb1L, -0.85);
    curlFinger(thumb2L, -0.65);
  }

  const upperArmR = findObj(model, ["UpperArmR"]) as THREE.Object3D | null;
  const upperArmL = findObj(model, ["UpperArmL"]) as THREE.Object3D | null;
  const lowerArmR = findObj(model, ["LowerArmR"]) as THREE.Object3D | null;
  const lowerArmL = findObj(model, ["LowerArmL"]) as THREE.Object3D | null;

  // ---------------------------------------------------------------------------
  // ANCLAJES DE EQUIPO (ejes LOCALES del hueso). Editá acá el pivot de cada slot.
  // position = dónde cuelga; rotation = orientación del ítem respecto al hueso.
  // El mesh del ítem tiene OTRO offset fino en scene.ts → syncEquippedVisuals.
  // ---------------------------------------------------------------------------

  /**
   * Arma — PalmR. Tip se orienta en equipAttach (Palm −X ≈ cara/+Z mundo).
   */
  const handGrip = new THREE.Group();
  handGrip.position.set(0, 0.02, 0.02);
  handGrip.rotation.set(0, 0, 0);
  palmR.add(handGrip);
  const handGripRest = {
    px: handGrip.position.x,
    py: handGrip.position.y,
    pz: handGrip.position.z,
    rx: 0,
    ry: 0,
    rz: 0,
  };

  /**
   * Offhand — PalmL. Mismo frame local que handGrip (armas duales).
   * El escudo compensa con offset propio en equipAttach.
   */
  const offhandGrip = new THREE.Group();
  offhandGrip.position.set(0, 0.02, 0.02);
  offhandGrip.rotation.set(0, 0, 0);
  palmL.add(offhandGrip);

  /** Casco — Head (+Y ≈ arriba del cráneo) */
  const headGrip = new THREE.Group();
  headGrip.position.set(0, 0.22, 0.04); // subir/bajar casco: cambiar Y
  headGrip.rotation.set(0, 0, 0);
  headBone.add(headGrip);

  /**
   * Armadura — hueso Torso (scale mundo≈0.368; ARMOR_FIT ya está en espacio hueso).
   * Mundo@1.78m: cuello≈1.49, hombros≈1.40 x±0.17, abdomen≈0.86, grip≈1.25.
   */
  const torsoGrip = new THREE.Group();
  torsoGrip.position.set(0, 0.28, 0.03);
  torsoGrip.rotation.set(0, 0, 0);
  torsoBone.add(torsoGrip);

  /** Cinturón — hueso Abdomen/Hips. */
  const beltGrip = new THREE.Group();
  beltGrip.position.set(0, 0.08, 0.02);
  beltGrip.rotation.set(0, 0, 0);
  beltBone.add(beltGrip);

  /** Bota izquierda — FootL */
  // Foot: +Z≈arriba mundo, +Y≈adelante. Mesh bota: +Y caña, +Z puntera.
  const bootGripL = new THREE.Group();
  bootGripL.position.set(0, 0.08, -0.05);
  bootGripL.rotation.set(Math.PI / 2, Math.PI, 0);
  bootGripL.scale.setScalar(1.3);
  footL.add(bootGripL);

  /** Bota derecha — FootR */
  const bootGripR = new THREE.Group();
  bootGripR.position.set(0, 0.08, -0.05);
  bootGripR.rotation.set(Math.PI / 2, Math.PI, 0);
  bootGripR.scale.setScalar(1.3);
  footR.add(bootGripR);

  /** Guantes — MiddleHand (+Y ≈ dedos; ±X acerca a la palma). */
  const midHandR = findObj(model, ["MiddleHandR"]) ?? palmR;
  const midHandL = findObj(model, ["MiddleHandL"]) ?? palmL;
  const gloveGripR = new THREE.Group();
  gloveGripR.position.set(-0.08, 0.05, 0.04);
  gloveGripR.rotation.set(0.1, 0, 0);
  gloveGripR.scale.setScalar(2.3);
  midHandR.add(gloveGripR);

  const gloveGripL = new THREE.Group();
  gloveGripL.position.set(0.08, 0.05, 0.04);
  gloveGripL.rotation.set(0.1, 0, 0);
  gloveGripL.scale.setScalar(2.3);
  midHandL.add(gloveGripL);

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
  const walk = mk("Man_Walk");
  const run = mk("Man_Run", "Man_Walk");
  const slashA = mk("Man_SwordSlash");
  const slashB = mk("Man_Punch", "Man_SwordSlash");
  const slashC = mk("Man_SwordSlash"); // mismo clip, scrub invertido en applySlash

  for (const a of [idle, walk, run]) {
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.play();
  }
  idle.weight = 1;
  walk.weight = 0;
  run.weight = 0;
  for (const s of [slashA, slashB, slashC]) {
    s.weight = 0;
    s.clampWhenFinished = true;
    s.setLoop(THREE.LoopOnce, 1);
  }
  mixer.update(1 / 30);

  // Pose base de brazos tras primer sample del mixer (overlays suman deltas)
  const armRest = {
    uR: upperArmR ? upperArmR.rotation.clone() : new THREE.Euler(),
    uL: upperArmL ? upperArmL.rotation.clone() : new THREE.Euler(),
    lR: lowerArmR ? lowerArmR.rotation.clone() : new THREE.Euler(),
    lL: lowerArmL ? lowerArmL.rotation.clone() : new THREE.Euler(),
  };

  const slashVariants = [slashA, slashB, slashC];
  let activeSlash = slashA;
  let lastAnim: CombatAnimKind = "slash";
  let lastU = 0;
  let lastVariant = 0;
  let lastBlocking = false;

  function resetHandGrip(): void {
    handGrip.position.set(handGripRest.px, handGripRest.py, handGripRest.pz);
    handGrip.rotation.set(handGripRest.rx, handGripRest.ry, handGripRest.rz);
  }

  /** Progreso de hoja: wind-up más largo → corte → follow-through. */
  function bladeProgress(u: number): number {
    const x = Math.min(1, Math.max(0, u));
    if (x < 0.28) {
      const t = x / 0.28;
      return t * t * 0.18;
    }
    if (x < 0.58) {
      const t = (x - 0.28) / 0.3;
      const e = 1 - Math.pow(1 - t, 2.2);
      return 0.18 + e * 0.62;
    }
    const t = (x - 0.58) / 0.42;
    const e = t * t * (3 - 2 * t);
    return 0.8 + e * 0.2;
  }

  const _ikTarget = new THREE.Vector3();
  const _carry = new THREE.Vector3();
  const _ikJ = new THREE.Vector3();
  const _ikTip = new THREE.Vector3();
  const _ikToTip = new THREE.Vector3();
  const _ikToTgt = new THREE.Vector3();
  const _ikAxis = new THREE.Vector3();
  const _ikQ = new THREE.Quaternion();

  /** Punto de la otra mano en espacio handGrip (lo marca el arma al equiparse). */
  function hiltSupportLocal(out: THREE.Vector3): THREE.Vector3 {
    const weapon = handGrip.children[0];
    const tune = weapon?.userData.twoHandGrip as
      | { hx: number; hy: number; hz: number; ax?: number; ay?: number; az?: number }
      | undefined;
    if (weapon && tune) {
      weapon.updateMatrix();
      return out.set(tune.hx, tune.hy, tune.hz).applyMatrix4(weapon.matrix);
    }
    return out.set(0.1, -0.025, 0.015);
  }

  /** CCD 2 huesos. target en mundo. */
  function placeHand(joints: THREE.Object3D[], tip: THREE.Object3D, target: THREE.Vector3): void {
    for (let iter = 0; iter < 8; iter++) {
      for (let i = joints.length - 1; i >= 0; i--) {
        const j = joints[i]!;
        j.updateWorldMatrix(true, true);
        tip.updateWorldMatrix(true, true);
        _ikJ.setFromMatrixPosition(j.matrixWorld);
        _ikTip.setFromMatrixPosition(tip.matrixWorld);
        _ikToTip.copy(_ikTip).sub(_ikJ).normalize();
        _ikToTgt.copy(target).sub(_ikJ).normalize();
        const dot = THREE.MathUtils.clamp(_ikToTip.dot(_ikToTgt), -1, 1);
        const angle = Math.acos(dot);
        if (angle < 0.002) continue;
        _ikAxis.copy(_ikToTip).cross(_ikToTgt);
        if (_ikAxis.lengthSq() < 1e-8) continue;
        _ikAxis.normalize();
        // Eje en espacio local: rotateOnWorldAxis ignora el yaw del cuerpo y el brazo gira al mover el mouse.
        j.getWorldQuaternion(_ikQ);
        _ikAxis.applyQuaternion(_ikQ.invert());
        j.rotateOnAxis(_ikAxis, angle * 0.85);
      }
    }
  }

  /** Lleva la mano derecha delante del pecho: si no, el arma queda fuera del alcance izquierdo. */
  function placeRightHandForward(): void {
    if (!upperArmR || !lowerArmR) return;
    const aim = handGrip.children[0]?.userData.twoHandGrip as
      | { ax?: number; ay?: number; az?: number }
      | undefined;
    _carry.set(aim?.ax ?? 0, aim?.ay ?? -0.12, aim?.az ?? 0.7);
    torsoBone.localToWorld(_carry);
    placeHand([upperArmR, lowerArmR], palmR, _carry);
  }

  function placeLeftHandOnHilt(): void {
    if (!upperArmL || !lowerArmL) return;
    handGrip.updateWorldMatrix(true, true);
    const target = hiltSupportLocal(_ikTarget);
    handGrip.localToWorld(target);
    placeHand([upperArmL, lowerArmL], palmL, target);
  }

  const actions: Record<string, THREE.AnimationAction> = {
    idle,
    walk,
    run,
    slash: slashA,
    slashA,
    slashB,
    slashC,
  };
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

  function scrubClip(action: THREE.AnimationAction, u: number, reverse = false): void {
    for (const s of slashVariants) {
      if (s !== action) s.weight = 0;
    }
    activeSlash = action;
    activeSlash.enabled = true;
    activeSlash.paused = true;
    activeSlash.weight = 1;
    idle.weight = 0;
    walk.weight = 0;
    run.weight = 0;
    const dur = Math.max(0.01, activeSlash.getClip().duration);
    const t = reverse ? 1 - Math.min(0.999, u) : Math.min(0.999, u);
    activeSlash.time = t * dur;
    activeSlash.play();
  }

  /** Brazo izq suelto (1H sin escudo). Evita pose “escudo” del clip SwordSlash. */
  function relaxLeftArm(): void {
    if (!upperArmL) return;
    upperArmL.rotation.x = armRest.uL.x;
    upperArmL.rotation.y = armRest.uL.y;
    upperArmL.rotation.z = armRest.uL.z;
    if (lowerArmL) {
      lowerArmL.rotation.x = armRest.lL.x;
      lowerArmL.rotation.y = armRest.lL.y;
      lowerArmL.rotation.z = armRest.lL.z;
    }
  }

  /**
   * Overlay procedural en brazos (tras el mixer).
   * AJUSTE MANUAL: números de rotación abajo = pose de cada estilo.
   */
  function applyArmOverlay(anim: CombatAnimKind | "idle" | "onehand", u: number, blocking: boolean): void {
    if (!upperArmR || !upperArmL) return;
    const pulse = Math.sin(Math.min(1, u) * Math.PI);

    if (blocking || anim === "block") {
      // Solo brazos: piernas siguen del mixer (walk/idle)
      const hard = blocking;
      const raise = hard ? 1.05 : 0.7;
      upperArmL.rotation.x = armRest.uL.x - raise;
      upperArmL.rotation.y = armRest.uL.y + (hard ? 0.4 : 0.22);
      upperArmL.rotation.z = armRest.uL.z + (hard ? 0.12 : 0.05);
      if (lowerArmL) lowerArmL.rotation.x = armRest.lL.x - (hard ? 0.45 : 0.22);
      if (hard) {
        upperArmR.rotation.x = armRest.uR.x - 0.28;
      }
      return;
    }

    if (anim === "onehand") {
      relaxLeftArm();
      resetHandGrip();
      return;
    }

    if (anim === "slash" || anim === "dualR") {
      applySwordArc(u, anim, lastVariant);
      return;
    }

    if (anim === "twohand") {
      // Swing a 2H; la guarda idle usa applyTwoHandCarry
      applySwordArc(u, "twohand", lastVariant);
      return;
    }

    if (anim === "throw") {
      relaxLeftArm();
      resetHandGrip();
      const wind = u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65;
      upperArmR.rotation.x = armRest.uR.x - 1.6 * wind + pulse * 0.9;
      upperArmR.rotation.z = armRest.uR.z + 0.5 * wind;
      if (lowerArmR) lowerArmR.rotation.x = armRest.lR.x - 0.6 * wind;
      return;
    }

    if (anim === "bow") {
      upperArmL.rotation.x = armRest.uL.x - 0.85;
      upperArmL.rotation.y = armRest.uL.y + 0.25;
      const draw = Math.min(1, u / 0.45);
      const release = u > 0.45 ? Math.min(1, (u - 0.45) / 0.25) : 0;
      upperArmR.rotation.x = armRest.uR.x - 1.2 * draw + release * 0.9;
      upperArmR.rotation.y = armRest.uR.y - 0.4 * draw;
      if (lowerArmR) lowerArmR.rotation.x = armRest.lR.x - 0.7 * draw;
      return;
    }

    if (anim === "crossbow") {
      upperArmR.rotation.x = armRest.uR.x - 0.95;
      upperArmL.rotation.x = armRest.uL.x - 0.9;
      upperArmL.rotation.y = armRest.uL.y + 0.2;
      if (u > 0.4 && u < 0.65) {
        upperArmR.rotation.x += 0.25;
        upperArmL.rotation.x += 0.2;
      }
      return;
    }

    if (anim === "dualL") {
      upperArmL.rotation.x = armRest.uL.x - 1.4 * pulse;
      upperArmL.rotation.y = armRest.uL.y - 0.35 * pulse;
      if (lowerArmL) lowerArmL.rotation.x = armRest.lL.x - 0.5 * pulse;
    }
  }

  /**
   * Arco de espada creíble: cámara → diagonal de corte → follow-through.
   * variant 0 diagonal, 1 revés, 2 vertical.
   */
  function applySwordArc(u: number, style: "slash" | "twohand" | "dualR", variant: number): void {
    if (!upperArmR) return;
    const a = bladeProgress(u);
    const kind = ((variant % 3) + 3) % 3;
    // start → mid → end (deltas sobre armRest)
    let sUx: number, sUy: number, sUz: number, sLx: number;
    let eUx: number, eUy: number, eUz: number, eLx: number;
    let mUx: number, mUy: number, mUz: number, mLx: number;
    let wSx: number, wSy: number, wSz: number;
    let wEx: number, wEy: number, wEz: number;

    if (kind === 2) {
      // Overhead chop
      sUx = -1.55; sUy = -0.15; sUz = 0.35; sLx = -1.05;
      mUx = -0.55; mUy = 0.05; mUz = -0.1; mLx = -0.25;
      eUx = 0.55; eUy = 0.2; eUz = -0.45; eLx = 0.35;
      wSx = -0.55; wSy = 0.15; wSz = 0.75;
      wEx = 1.15; wEy = -0.25; wEz = -1.05;
    } else if (kind === 1) {
      // Backhand: low-out → high-across
      sUx = -0.35; sUy = 0.75; sUz = -0.55; sLx = -0.55;
      mUx = -0.95; mUy = 0.1; mUz = 0.15; mLx = -0.35;
      eUx = -1.25; eUy = -0.65; eUz = 0.7; eLx = -0.15;
      wSx = 0.35; wSy = -0.45; wSz = -0.55;
      wEx = -0.85; wEy = 0.55; wEz = 1.1;
    } else {
      // Forehand diagonal high → low across
      sUx = -1.4; sUy = -0.65; sUz = 0.85; sLx = -1.0;
      mUx = -0.75; mUy = 0.15; mUz = 0.05; mLx = -0.35;
      eUx = 0.35; eUy = 0.85; eUz = -0.75; eLx = 0.25;
      wSx = -0.35; wSy = 0.45; wSz = 0.95;
      wEx = 0.95; wEy = -0.55; wEz = -1.25;
    }

    const lerp2 = (p0: number, p1: number, p2: number, t: number) => {
      if (t < 0.5) {
        const k = t / 0.5;
        return p0 + (p1 - p0) * k;
      }
      const k = (t - 0.5) / 0.5;
      return p1 + (p2 - p1) * k;
    };

    upperArmR.rotation.x = armRest.uR.x + lerp2(sUx, mUx, eUx, a);
    upperArmR.rotation.y = armRest.uR.y + lerp2(sUy, mUy, eUy, a);
    upperArmR.rotation.z = armRest.uR.z + lerp2(sUz, mUz, eUz, a);
    if (lowerArmR) {
      lowerArmR.rotation.x = armRest.lR.x + lerp2(sLx, mLx, eLx, a);
      lowerArmR.rotation.y = armRest.lR.y;
      lowerArmR.rotation.z = armRest.lR.z;
    }

    // Muñeca: la hoja adelanta el corte (edge lead)
    const wr = a < 0.5 ? a / 0.5 : 1;
    handGrip.rotation.x = handGripRest.rx + wSx + (wEx - wSx) * wr;
    handGrip.rotation.y = handGripRest.ry + wSy + (wEy - wSy) * wr;
    handGrip.rotation.z = handGripRest.rz + wSz + (wEz - wSz) * wr;
    // Ligero avance del grip en el impacto
    const thrust = Math.sin(Math.min(1, Math.max(0, (a - 0.12) / 0.45)) * Math.PI) * 0.03;
    handGrip.position.set(handGripRest.px, handGripRest.py + thrust, handGripRest.pz + thrust * 0.6);

    if (style === "dualR" && upperArmL) {
      const pulse = Math.sin(Math.min(1, a) * Math.PI);
      upperArmL.rotation.x = armRest.uL.x - 1.4 * pulse;
      upperArmL.rotation.y = armRest.uL.y - 0.35 * pulse;
      if (lowerArmL) lowerArmL.rotation.x = armRest.lL.x - 0.5 * pulse;
      offhandGrip.rotation.z = -0.9 * pulse;
    } else if (style === "twohand" && upperArmL) {
      // Semilla: izquierda acompaña; luego IK la pega a la empuñadura
      upperArmL.rotation.x = armRest.uL.x + lerp2(sUx * 0.75, mUx * 0.7, eUx * 0.65, a);
      upperArmL.rotation.y = armRest.uL.y - lerp2(sUy, mUy, eUy, a) * 0.85 - 0.35;
      upperArmL.rotation.z = armRest.uL.z - lerp2(sUz, mUz, eUz, a) * 0.7;
      if (lowerArmL) {
        lowerArmL.rotation.x = armRest.lL.x + lerp2(sLx, mLx, eLx, a) * 0.85 - 0.25;
      }
      placeLeftHandOnHilt();
    } else {
      relaxLeftArm();
      offhandGrip.rotation.set(0, 0, 0);
    }
  }

  /** Portar arma a dos manos: ambas manos en la empuñadura. */
  function applyTwoHandCarry(): void {
    if (!upperArmR || !upperArmL) return;
    upperArmR.rotation.x = armRest.uR.x - 0.72;
    upperArmR.rotation.y = armRest.uR.y + 0.55;
    upperArmR.rotation.z = armRest.uR.z + 0.18;
    if (lowerArmR) {
      lowerArmR.rotation.x = armRest.lR.x - 0.85;
      lowerArmR.rotation.y = armRest.lR.y;
      lowerArmR.rotation.z = armRest.lR.z;
    }

    // Semilla cruzada hacia el arma (IK termina de juntar)
    upperArmL.rotation.x = armRest.uL.x - 0.75;
    upperArmL.rotation.y = armRest.uL.y - 0.7;
    upperArmL.rotation.z = armRest.uL.z - 0.32;
    if (lowerArmL) {
      lowerArmL.rotation.x = armRest.lL.x - 0.95;
      lowerArmL.rotation.y = armRest.lL.y;
      lowerArmL.rotation.z = armRest.lL.z;
    }

    const grip = handGrip.children[0]?.userData.twoHandGrip as
      | { px: number; py: number; pz: number; rx: number; ry: number; rz: number }
      | undefined;
    const px = grip?.px ?? 0.42;
    const py = grip?.py ?? 0.015;
    const pz = grip?.pz ?? 0.05;
    const rx = grip?.rx ?? 0.28;
    const ry = grip?.ry ?? -0.12;
    const rz = grip?.rz ?? 0.5;
    handGrip.position.set(handGripRest.px + px, handGripRest.py + py, handGripRest.pz + pz);
    handGrip.rotation.set(handGripRest.rx + rx, handGripRest.ry + ry, handGripRest.rz + rz);
    placeRightHandForward();
    placeLeftHandOnHilt();
  }

  function applyCombat(u: number, anim: CombatAnimKind, blocking = false, variant = 0): void {
    lastAnim = anim;
    lastU = u;
    lastVariant = variant;
    lastBlocking = blocking;
    if (blocking || anim === "block") {
      for (const s of slashVariants) s.weight = 0;
      resetHandGrip();
      return;
    }
    const usePunch =
      anim === "throw" || anim === "dualL" || anim === "bow" || anim === "crossbow";
    // Un solo clip estable (sin salto a mitad del swing); brazos van procedural
    const clip = usePunch ? slashB : slashA;
    const scrubU =
      anim === "slash" || anim === "twohand" || anim === "dualR" ? bladeProgress(u) : u;
    scrubClip(clip, scrubU, false);
  }

  function applySlash(u: number, variant = 0): void {
    applyCombat(u, variant === 1 ? "dualL" : "slash", false, variant);
  }

  function update(
    dt: number,
    _walkPhase: number,
    moving: boolean,
    swinging: boolean,
    running = false,
    stance: CombatAnimKind | "idle" | "onehand" = "idle",
    activelyBlocking = false,
  ): void {
    if (!activelyBlocking) lastBlocking = false;
    // Locomoción siempre (salvo swing de ataque que usa clips de slash)
    if (!swinging) {
      for (const s of slashVariants) {
        s.weight = THREE.MathUtils.damp(s.weight, 0, 10, dt);
      }
      const wantRun = moving && running ? 1 : 0;
      const wantWalk = moving && !running ? 1 : 0;
      run.weight = THREE.MathUtils.damp(run.weight, wantRun, 14, dt);
      walk.weight = THREE.MathUtils.damp(walk.weight, wantWalk, 12, dt);
      idle.weight = THREE.MathUtils.damp(idle.weight, moving ? 0 : 1, 12, dt);
      idle.paused = false;
      walk.paused = false;
      run.paused = false;
    }
    mixer.update(dt);
    // Overlay de brazos DESPUÉS del mixer (no congela piernas)
    if (swinging) {
      applyArmOverlay(lastAnim, lastU, false);
    } else {
      resetHandGrip();
      if (activelyBlocking || lastBlocking) {
        applyArmOverlay("block", 1, true);
      } else if (stance === "block") {
        applyArmOverlay("block", 1, false);
      } else if (stance === "twohand") {
        applyTwoHandCarry();
      } else if (stance === "bow" || stance === "crossbow") {
        applyArmOverlay(stance, 0.2, false);
      } else if (stance === "onehand" && activeSlash.weight > 0.05) {
        applyArmOverlay("onehand", 0, false);
      }
    }
    const gripping = !!handGrip.children[0]?.userData.twoHandGrip;
    if (gripping) closeFists(stance === "twohand" || (swinging && lastAnim === "twohand"));
  }

  return {
    root,
    mixer,
    actions,
    bodySkins,
    skinnedLayer,
    handGrip,
    offhandGrip,
    headGrip,
    torsoGrip,
    beltGrip,
    bootGripL,
    bootGripR,
    gloveGripL,
    gloveGripR,
    setHurt,
    update,
    applyCombat,
    applySlash,
  };
}
