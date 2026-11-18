import * as THREE from "three";

export type AiBodyHandle = {
  root: THREE.Group;
  update: (
    dt: number,
    walkPhase: number,
    moving: boolean,
    swingU: number,
    hurt: boolean,
  ) => void;
  dispose: () => void;
};

/** Humanoide mínimo procedural: torso, cabeza, brazos, piernas + puñal. */
export function createAiBody(tint = 0x6e3b2e): AiBodyHandle {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.92 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.9 });
  const blade = new THREE.MeshStandardMaterial({
    color: 0x9aa0a8,
    metalness: 0.7,
    roughness: 0.35,
  });

  const hips = new THREE.Group();
  hips.position.y = 0.72;
  root.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.22), skin);
  torso.position.y = 0.28;
  torso.castShadow = true;
  hips.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skin);
  head.position.y = 0.62;
  head.castShadow = true;
  hips.add(head);

  const shoulderL = new THREE.Group();
  shoulderL.position.set(-0.24, 0.42, 0);
  hips.add(shoulderL);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), skin);
  armL.position.y = -0.2;
  armL.castShadow = true;
  shoulderL.add(armL);

  const shoulderR = new THREE.Group();
  shoulderR.position.set(0.24, 0.42, 0);
  hips.add(shoulderR);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), skin);
  armR.position.y = -0.2;
  armR.castShadow = true;
  shoulderR.add(armR);

  const dagger = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.1, 6), dark);
  grip.rotation.x = Math.PI / 2;
  dagger.add(grip);
  const knife = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.22), blade);
  knife.position.z = 0.14;
  dagger.add(knife);
  dagger.position.set(0, -0.4, 0.06);
  dagger.rotation.set(-0.3, 0, 0.2);
  armR.add(dagger);

  const hipL = new THREE.Group();
  hipL.position.set(-0.1, 0, 0);
  hips.add(hipL);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.14), dark);
  legL.position.y = -0.28;
  legL.castShadow = true;
  hipL.add(legL);

  const hipR = new THREE.Group();
  hipR.position.set(0.1, 0, 0);
  hips.add(hipR);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.14), dark);
  legR.position.y = -0.28;
  legR.castShadow = true;
  hipR.add(legR);

  const mats = [skin, dark, blade];

  function update(
    _dt: number,
    walkPhase: number,
    moving: boolean,
    swingU: number,
    hurt: boolean,
  ): void {
    const amp = moving && swingU <= 0 ? 0.55 : 0.05;
    const s = Math.sin(walkPhase) * amp;
    hipL.rotation.x = s;
    hipR.rotation.x = -s;
    shoulderL.rotation.x = -s * 0.7;

    if (swingU > 0) {
      // 0→1: windup atrás → estocada con puñal
      const punch = Math.sin(Math.min(1, swingU) * Math.PI);
      shoulderR.rotation.x = s * 0.2 - 1.55 * punch;
      shoulderR.rotation.y = -0.45 * punch;
      armR.rotation.x = -0.35 * punch;
      dagger.rotation.x = -0.3 - 0.5 * punch;
    } else {
      shoulderR.rotation.x = s * 0.5;
      shoulderR.rotation.y = 0;
      armR.rotation.x = 0;
      dagger.rotation.x = -0.3;
    }

    for (const m of mats) {
      if (m instanceof THREE.MeshStandardMaterial) {
        m.emissive.setHex(hurt ? 0x551111 : 0x000000);
      }
    }
  }

  function dispose(): void {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
      }
    });
    for (const m of mats) m.dispose();
  }

  return { root, update, dispose };
}
