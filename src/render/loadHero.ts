import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { CombatAnimKind } from "../shared/types";

export type HeroHandle = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  handGrip: THREE.Group;
  offhandGrip: THREE.Group;
  headGrip: THREE.Group;
  torsoGrip: THREE.Group;
  beltGrip: THREE.Group;
  bootGripL: THREE.Group;
  bootGripR: THREE.Group;
  setHurt: (hurt: boolean) => void;
  update: (
    dt: number,
    walkPhase: number,
    moving: boolean,
    swinging: boolean,
    running?: boolean,
    stance?: CombatAnimKind | "idle" | "onehand",
  ) => void;
  /**
   * Animación de combate.
   * u 0..1 progreso del swing; anim = throw/dual/bow/…; blocking = escudo.
   */
  applyCombat: (u: number, anim: CombatAnimKind, blocking?: boolean) => void;
  /** @deprecated usar applyCombat */
  applySlash: (u: number, variant?: number) => void;
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

  /** Escudo / offhand (mano izquierda) — PalmL */
  const offhandGrip = new THREE.Group();
  offhandGrip.position.set(0, 0.08, 0.04);
  offhandGrip.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
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
  const bootGripL = new THREE.Group();
  bootGripL.position.set(0, 0.06, 0.02);
  bootGripL.rotation.set(-0.15, 0, 0);
  bootGripL.scale.setScalar(1.35);
  footL.add(bootGripL);

  /** Bota derecha — FootR */
  const bootGripR = new THREE.Group();
  bootGripR.position.set(0, 0.06, 0.02);
  bootGripR.rotation.set(-0.15, 0, 0);
  bootGripR.scale.setScalar(1.35);
  footR.add(bootGripR);

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
  let lastBlocking = false;

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
      // Escudo adelante
      upperArmL.rotation.x = armRest.uL.x - 1.1;
      upperArmL.rotation.y = armRest.uL.y + 0.35;
      if (lowerArmL) lowerArmL.rotation.x = armRest.lL.x - 0.4;
      upperArmR.rotation.x = armRest.uR.x - 0.35;
      return;
    }

    if (anim === "onehand" || anim === "slash") {
      relaxLeftArm();
      return;
    }

    if (anim === "throw") {
      relaxLeftArm();
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
      return;
    }

    if (anim === "dualR") {
      relaxLeftArm();
      upperArmR.rotation.x = armRest.uR.x - 0.3 * pulse;
      return;
    }

    if (anim === "twohand") {
      // Empuñadura a dos manos: izq cerca del arma
      const hold = 0.55 + 0.45 * (1 - pulse);
      upperArmL.rotation.x = armRest.uL.x - 0.75 * hold;
      upperArmL.rotation.y = armRest.uL.y + 0.55 * hold;
      upperArmL.rotation.z = armRest.uL.z - 0.25 * hold;
      if (lowerArmL) lowerArmL.rotation.x = armRest.lL.x - 0.35 * hold;
    }
  }

  function applyCombat(u: number, anim: CombatAnimKind, blocking = false): void {
    lastAnim = anim;
    lastU = u;
    lastBlocking = blocking;
    if (blocking || anim === "block") {
      for (const s of slashVariants) s.weight = 0;
      idle.weight = 0.35;
      return;
    }
    // Clips: Punch para throw/dualL/bow; SwordSlash para el resto
    const usePunch =
      anim === "throw" || anim === "dualL" || anim === "bow" || anim === "crossbow";
    const clip = usePunch ? slashB : anim === "twohand" ? slashA : u > 0.5 ? slashC : slashA;
    const reverse = anim === "dualR" && clip === slashC;
    scrubClip(clip, u, reverse);
  }

  function applySlash(u: number, variant = 0): void {
    applyCombat(u, variant === 1 ? "dualL" : "slash", false);
  }

  function update(
    dt: number,
    _walkPhase: number,
    moving: boolean,
    swinging: boolean,
    running = false,
    stance: CombatAnimKind | "idle" | "onehand" = "idle",
  ): void {
    if (!swinging && !lastBlocking && stance !== "block") {
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
    // Overlay de brazos DESPUÉS del mixer
    if (swinging || lastBlocking) {
      applyArmOverlay(lastAnim, lastU, lastBlocking);
    } else if (stance === "block") {
      applyArmOverlay("block", 1, true);
    } else if (stance === "twohand" || stance === "bow" || stance === "crossbow") {
      applyArmOverlay(stance, 0.2, false);
    } else if (stance === "onehand" && activeSlash.weight > 0.05) {
      // Mientras muere el clip de slash, forzar brazo izq suelto (el clip lo deja “en escudo”)
      applyArmOverlay("onehand", 0, false);
    }
  }

  return {
    root,
    mixer,
    actions,
    handGrip,
    offhandGrip,
    headGrip,
    torsoGrip,
    beltGrip,
    bootGripL,
    bootGripR,
    setHurt,
    update,
    applyCombat,
    applySlash,
  };
}
