import * as THREE from "three";

/**
 * Humano simple: cánon 8 cabezas + lathe (torso) + tubos cónicos (miembros).
 * Sin metaballs. Ver docs/research-human-body.md.
 */

export type PlayerBody = {
  root: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  handGrip: THREE.Group;
  torso: THREE.Group;
  setHurt: (hurt: boolean) => void;
  updateAnim: (walkPhase: number, moving: boolean, swinging: boolean) => void;
  applySlash: (u: number) => void;
};

const H = 0.22;
const HEIGHT = H * 8;
const RAD = 10; // segmentos radiales (suave pero liviano)

type BoneDef = { name: string; parent: string | null; pos: [number, number, number] };

const BONE_DEFS: BoneDef[] = [
  { name: "hips", parent: null, pos: [0, 4 * H, 0] },
  { name: "spine", parent: "hips", pos: [0, 0.55 * H, 0.01] },
  { name: "chest", parent: "spine", pos: [0, 0.85 * H, 0.02] },
  { name: "neck", parent: "chest", pos: [0, 0.48 * H, 0] },
  { name: "head", parent: "neck", pos: [0, 0.2 * H, 0.02] },
  { name: "shoulder.l", parent: "chest", pos: [-1.05 * H, 0.32 * H, 0] },
  { name: "upperarm.l", parent: "shoulder.l", pos: [-0.12 * H, -0.08 * H, 0] },
  { name: "forearm.l", parent: "upperarm.l", pos: [0, -1.35 * H, 0] },
  { name: "hand.l", parent: "forearm.l", pos: [0, -1.15 * H, 0] },
  { name: "shoulder.r", parent: "chest", pos: [1.05 * H, 0.32 * H, 0] },
  { name: "upperarm.r", parent: "shoulder.r", pos: [0.12 * H, -0.08 * H, 0] },
  { name: "forearm.r", parent: "upperarm.r", pos: [0, -1.35 * H, 0] },
  { name: "hand.r", parent: "forearm.r", pos: [0, -1.15 * H, 0] },
  { name: "upleg.l", parent: "hips", pos: [-0.52 * H, -0.04 * H, 0] },
  { name: "leg.l", parent: "upleg.l", pos: [0, -2 * H, 0] },
  { name: "foot.l", parent: "leg.l", pos: [0, -1.85 * H, 0.06 * H] },
  { name: "upleg.r", parent: "hips", pos: [0.52 * H, -0.04 * H, 0] },
  { name: "leg.r", parent: "upleg.r", pos: [0, -2 * H, 0] },
  { name: "foot.r", parent: "leg.r", pos: [0, -1.85 * H, 0.06 * H] },
];

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  scale?: [number, number, number],
  rot?: [number, number, number],
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function ball(parent: THREE.Object3D, r: number, mat: THREE.Material, pos: [number, number, number], scale?: [number, number, number]): void {
  add(parent, new THREE.SphereGeometry(r, RAD, RAD - 2), mat, pos, scale);
}

/** Perfil torso (radio, y local desde cadera): lathe = silueta humana continua. */
function createTorsoLathe(mat: THREE.Material): THREE.Mesh {
  const p = [
    new THREE.Vector2(0.22 * H, -0.1 * H),
    new THREE.Vector2(0.5 * H, 0.1 * H), // cadera
    new THREE.Vector2(0.44 * H, 0.45 * H),
    new THREE.Vector2(0.36 * H, 0.8 * H), // cintura
    new THREE.Vector2(0.48 * H, 1.15 * H),
    new THREE.Vector2(0.62 * H, 1.42 * H), // pecho
    new THREE.Vector2(0.72 * H, 1.6 * H), // hombros (ancho real)
    new THREE.Vector2(0.28 * H, 1.75 * H),
    new THREE.Vector2(0.18 * H, 1.98 * H),
    new THREE.Vector2(0.16 * H, 2.1 * H),
  ];
  const geo = new THREE.LatheGeometry(p, 24);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.scale.set(1, 1, 0.85);
  return m;
}

function buildHead(head: THREE.Bone, skin: THREE.Material): THREE.Material[] {
  const mats: THREE.Material[] = [];
  // Cráneo elipsoide con profundidad
  ball(head, 0.48 * H, skin, [0, 0.48 * H, 0.05 * H], [0.84, 1.02, 0.98]);
  ball(head, 0.28 * H, skin, [0, 0.18 * H, 0.12 * H], [0.88, 0.72, 0.9]); // mandíbula
  // Nariz en el molde
  add(head, new THREE.CapsuleGeometry(0.04 * H, 0.11 * H, 4, 8), skin, [0, 0.4 * H, 0.48 * H], undefined, [0.45, 0, 0]);
  ball(head, 0.055 * H, skin, [0, 0.3 * H, 0.54 * H], [1.15, 0.75, 1]);
  for (const s of [-1, 1]) {
    ball(head, 0.1 * H, skin, [s * 0.43 * H, 0.45 * H, 0.02 * H], [0.32, 1.15, 0.72]);
  }

  const white = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.35 });
  const iris = new THREE.MeshStandardMaterial({ color: 0x3a5a72, roughness: 0.2 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.05 });
  const lip = new THREE.MeshStandardMaterial({ color: 0xa86868, roughness: 0.55 });
  const brow = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.9 });
  const mouthIn = new THREE.MeshStandardMaterial({ color: 0x2a1010, roughness: 0.95 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.9 });
  mats.push(white, iris, pupil, lip, brow, mouthIn, hair);

  for (const s of [-1, 1]) {
    // cuenca leve (piel hundida) + ojo
    ball(head, 0.09 * H, skin, [s * 0.15 * H, 0.5 * H, 0.38 * H], [1.05, 0.8, 0.35]);
    ball(head, 0.07 * H, white, [s * 0.15 * H, 0.5 * H, 0.44 * H], [1.15, 0.9, 0.4]);
    ball(head, 0.038 * H, iris, [s * 0.15 * H, 0.5 * H, 0.5 * H]);
    ball(head, 0.018 * H, pupil, [s * 0.15 * H, 0.5 * H, 0.53 * H]);
    add(head, new THREE.BoxGeometry(0.15 * H, 0.02 * H, 0.028 * H), brow, [s * 0.15 * H, 0.6 * H, 0.42 * H], undefined, [0, 0, s * -0.12]);
  }
  add(head, new THREE.CapsuleGeometry(0.02 * H, 0.11 * H, 4, 8), lip, [0, 0.22 * H, 0.46 * H], undefined, [0, 0, Math.PI / 2]);
  add(head, new THREE.CapsuleGeometry(0.022 * H, 0.1 * H, 4, 8), lip, [0, 0.16 * H, 0.45 * H], undefined, [0, 0, Math.PI / 2]);
  add(head, new THREE.BoxGeometry(0.09 * H, 0.018 * H, 0.03 * H), mouthIn, [0, 0.19 * H, 0.48 * H]);
  ball(head, 0.5 * H, hair, [0, 0.58 * H, -0.02 * H], [0.9, 0.68, 0.95]);
  return mats;
}

function buildHand(hand: THREE.Bone, skin: THREE.Material, mir: number): void {
  add(hand, new THREE.BoxGeometry(0.26 * H, 0.2 * H, 0.09 * H), skin, [0, -0.07 * H, 0.02 * H]);
  for (let i = 0; i < 4; i++) {
    add(hand, new THREE.CapsuleGeometry(0.025 * H, 0.11 * H, 4, 8), skin, [(-0.09 + i * 0.065) * H, -0.26 * H, 0.03 * H]);
  }
  add(hand, new THREE.CapsuleGeometry(0.028 * H, 0.07 * H, 4, 8), skin, [mir * -0.14 * H, -0.1 * H, 0.05 * H], undefined, [0.4, 0, mir * 1.05]);
}

function createBriefs(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.48 * H, 0.5 * H, 0.18 * H, 20, 1, true), mat);
  band.position.set(0, 0.08 * H, 0);
  band.castShadow = true;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.48 * H, 0.36 * H, 0.35 * H, 20, 1, true), mat);
  shell.position.set(0, -0.15 * H, 0);
  shell.castShadow = true;
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.16 * H, 12, 10), mat);
  pouch.scale.set(1.1, 0.75, 0.65);
  pouch.position.set(0, -0.2 * H, 0.25 * H);
  pouch.castShadow = true;
  g.add(band, shell, pouch);
  return g;
}

export function createPlayerBody(): PlayerBody {
  const root = new THREE.Group();
  root.userData.height = HEIGHT;

  const boneByName = new Map<string, THREE.Bone>();
  for (const def of BONE_DEFS) {
    const b = new THREE.Bone();
    b.name = def.name;
    b.position.set(...def.pos);
    boneByName.set(def.name, b);
  }
  for (const def of BONE_DEFS) {
    const b = boneByName.get(def.name)!;
    if (def.parent) boneByName.get(def.parent)!.add(b);
    else root.add(b);
  }

  const skin = new THREE.MeshStandardMaterial({ color: 0xd4b090, roughness: 0.62, metalness: 0.04 });
  const briefMat = new THREE.MeshStandardMaterial({ color: 0x1a1520, roughness: 0.88, metalness: 0.05 });
  const mats: THREE.Material[] = [skin, briefMat];

  const hips = boneByName.get("hips")!;
  const spine = boneByName.get("spine")!;
  const chest = boneByName.get("chest")!;
  const neck = boneByName.get("neck")!;
  const head = boneByName.get("head")!;

  // —— torso continuo (lathe) anclado en cadera ——
  const torsoMesh = createTorsoLathe(skin);
  hips.add(torsoMesh);
  add(neck, new THREE.CapsuleGeometry(0.17 * H, 0.32 * H, 6, 12), skin, [0, 0.22 * H, 0]);
  ball(neck, 0.18 * H, skin, [0, 0.38 * H, 0]);

  mats.push(...buildHead(head, skin));

  // —— brazos: tubos cónicos + bolas de junta ——
  for (const side of ["l", "r"] as const) {
    const mir = side === "l" ? -1 : 1;
    const sh = boneByName.get(`shoulder.${side}`)!;
    const ua = boneByName.get(`upperarm.${side}`)!;
    const fa = boneByName.get(`forearm.${side}`)!;
    const hd = boneByName.get(`hand.${side}`)!;

    // radios en metros (~brazo humano), no fracciones mínimas de H
    ball(sh, 0.07, skin, [mir * 0.01, -0.01, 0], [1.25, 1.15, 1.2]);
    add(ua, new THREE.CapsuleGeometry(0.055, 0.2, 6, 12), skin, [0, -0.12, 0.01]);
    add(ua, new THREE.CapsuleGeometry(0.05, 0.08, 5, 10), skin, [0, -0.18, 0.025]);
    ball(ua, 0.042, skin, [0, -0.29, 0]);
    add(fa, new THREE.CapsuleGeometry(0.04, 0.18, 6, 12), skin, [0, -0.12, 0]);
    ball(fa, 0.032, skin, [0, -0.25, 0]);
    buildHand(hd, skin, mir);
  }

  // —— piernas ——
  for (const side of ["l", "r"] as const) {
    const ul = boneByName.get(`upleg.${side}`)!;
    const ll = boneByName.get(`leg.${side}`)!;
    const ft = boneByName.get(`foot.${side}`)!;

    ball(ul, 0.08, skin, [0, 0.01, 0], [1.3, 1.05, 1.15]);
    add(ul, new THREE.CapsuleGeometry(0.085, 0.3, 6, 12), skin, [0, -0.2, 0.01]);
    add(ul, new THREE.CapsuleGeometry(0.08, 0.1, 5, 10), skin, [0, -0.14, 0.03]);
    ball(ll, 0.05, skin, [0, 0.01, 0.025], [1.1, 0.9, 0.85]);
    add(ll, new THREE.CapsuleGeometry(0.05, 0.28, 6, 12), skin, [0, -0.2, 0]);
    add(ll, new THREE.CapsuleGeometry(0.052, 0.1, 5, 10), skin, [0, -0.15, 0.03]);
    ball(ll, 0.035, skin, [0, -0.4, 0]);
    add(ft, new THREE.BoxGeometry(0.07, 0.04, 0.16), skin, [0, -0.015, 0.05]);
  }

  hips.add(createBriefs(briefMat));

  const handL = boneByName.get("hand.l")!;
  const handR = boneByName.get("hand.r")!;
  const handGrip = new THREE.Group();
  handGrip.position.set(0.02, -0.1 * H, 0.04);
  handGrip.rotation.set(0.2, 0.1, 0.05);
  handR.add(handGrip);

  const upR = boneByName.get("upperarm.r")!;
  const upL = boneByName.get("upperarm.l")!;
  const foR = boneByName.get("forearm.r")!;
  const foL = boneByName.get("forearm.l")!;
  const ulL = boneByName.get("upleg.l")!;
  const ulR = boneByName.get("upleg.r")!;
  const llL = boneByName.get("leg.l")!;
  const llR = boneByName.get("leg.r")!;
  const ftL = boneByName.get("foot.l")!;
  const ftR = boneByName.get("foot.r")!;
  const rightArmRest = { x: 0.2, y: 0.08, z: -0.12 };

  function setHurt(hurt: boolean): void {
    const hex = hurt ? 0x3a1010 : 0x000000;
    for (const m of mats) {
      if ("emissive" in m) (m as THREE.MeshStandardMaterial).emissive.setHex(hex);
    }
  }

  function poseIdle(): void {
    ulL.rotation.set(0.04, 0, 0.04);
    llL.rotation.set(0.06, 0, 0);
    ftL.rotation.set(-0.08, 0, 0);
    ulR.rotation.set(0.04, 0, -0.04);
    llR.rotation.set(0.06, 0, 0);
    ftR.rotation.set(-0.08, 0, 0);
    hips.rotation.set(0, 0, 0);
    spine.rotation.set(0.02, 0, 0);
    chest.rotation.set(0.02, 0, 0);
    neck.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    upL.rotation.set(0.15, -0.05, 0.28);
    foL.rotation.set(0.12, 0, 0.08);
    upR.rotation.set(rightArmRest.x, rightArmRest.y, rightArmRest.z);
    foR.rotation.set(0.15, 0, -0.08);
    handL.rotation.set(0.1, 0.15, 0.4);
    handR.rotation.set(0.1, -0.15, -0.4);
    root.position.y = 0;
  }

  function poseWalk(phase: number): void {
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const s2 = Math.sin(phase * 2);
    const amp = 0.5;
    ulL.rotation.set(s * amp, 0, 0.04);
    llL.rotation.set(0.06 + Math.max(0, -s) * 1.1, 0, 0);
    ftL.rotation.set(-Math.max(0, -s) * 0.5 - s * amp * 0.1 + 0.06, 0, 0);
    ulR.rotation.set(-s * amp, 0, -0.04);
    llR.rotation.set(0.06 + Math.max(0, s) * 1.1, 0, 0);
    ftR.rotation.set(-Math.max(0, s) * 0.5 + s * amp * 0.1 + 0.06, 0, 0);
    hips.rotation.set(0.04, -s * 0.1, c * 0.04);
    root.position.y = Math.abs(s2) * 0.03;
    spine.rotation.set(0.03, -s * 0.06, c * 0.02);
    chest.rotation.set(0.04 + Math.abs(s) * 0.02, -s * 0.08, c * 0.03);
    neck.rotation.set(-0.03, s * 0.05, 0);
    head.rotation.set(-0.04, -s * 0.04, 0);
    upL.rotation.set(-s * 0.5, 0, 0.28);
    foL.rotation.set(0.15 + Math.max(0, -s) * 0.35, 0, 0.08);
    upR.rotation.set(rightArmRest.x + s * 0.4, rightArmRest.y, rightArmRest.z);
    foR.rotation.set(0.18 + Math.max(0, s) * 0.28, 0, -0.08);
    handL.rotation.set(0.1, 0.15, 0.4);
    handR.rotation.set(0.1, -0.15, -0.4);
  }

  function updateAnim(walkPhase: number, moving: boolean, swinging: boolean): void {
    if (swinging) return;
    if (moving) poseWalk(walkPhase);
    else poseIdle();
  }

  function applySlash(u: number): void {
    const ease = u * u * (3 - 2 * u);
    let armX: number;
    let armY: number;
    let armZ: number;
    let twist: number;
    let lean: number;
    let bob: number;
    if (u < 0.22) {
      const t = u / 0.22;
      armX = rightArmRest.x + t * 0.7;
      armY = rightArmRest.y + t * 1.0;
      armZ = rightArmRest.z - t * 0.2;
      twist = -t * 0.4;
      lean = t * 0.1;
      bob = t * 0.02;
    } else if (u < 0.55) {
      const t = (u - 0.22) / 0.33;
      const s = t * t * (3 - 2 * t);
      armX = rightArmRest.x + 0.7 - s * 1.5;
      armY = rightArmRest.y + 1.0 - s * 2.1;
      armZ = rightArmRest.z - 0.2 + s * 0.75;
      twist = -0.4 + s * 1.05;
      lean = 0.1 + s * 0.14;
      bob = 0.02 + Math.sin(s * Math.PI) * 0.07;
    } else {
      const t = (u - 0.55) / 0.45;
      const s = 1 - Math.pow(1 - t, 2);
      armX = rightArmRest.x - 0.8 + s * (rightArmRest.x + 0.8);
      armY = rightArmRest.y - 1.1 + s * (rightArmRest.y + 1.1);
      armZ = rightArmRest.z + 0.55 + s * (rightArmRest.z - 0.55);
      twist = 0.65 - s * 0.65;
      lean = 0.24 - s * 0.24;
      bob = 0.04 * (1 - s);
    }
    upR.rotation.set(armX, armY, armZ);
    foR.rotation.set(0.15 + ease * 0.4, 0, 0);
    upL.rotation.set(0.15 + ease * 0.25, 0, 0.3);
    hips.rotation.set(lean * 0.35, twist * 0.35, 0);
    spine.rotation.set(lean * 0.25, twist * 0.3, 0);
    chest.rotation.set(lean * 0.45, twist, 0);
    ulL.rotation.set(lean * 0.25, 0, 0);
    ulR.rotation.set(-lean * 0.15, 0, 0);
    head.rotation.set(-lean * 0.2, -twist * 0.25, 0);
    root.position.y = bob;
  }

  poseIdle();

  return {
    root,
    rightArm: upR as unknown as THREE.Group,
    leftArm: upL as unknown as THREE.Group,
    handGrip,
    torso: chest as unknown as THREE.Group,
    setHurt,
    updateAnim,
    applySlash,
  };
}
