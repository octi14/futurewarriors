import * as THREE from "three";
import type {
  ArmorParams,
  AxeParams,
  BeltParams,
  BootsParams,
  BowParams,
  CrossbowParams,
  GlovesParams,
  HelmetParams,
  ItemInstance,
  PantsParams,
  Projectile,
  Rarity,
  ShieldParams,
  SwordParams,
  ThrowParams,
} from "../shared/types";
import { buildSwordMesh } from "./swordMesh";

export function metalColor(hue: number, rarity: Rarity): THREE.Color {
  // Acero pulido: más luminoso y saturado según rareza
  const sat = rarity === "epic" ? 0.48 : rarity === "rare" ? 0.36 : rarity === "uncommon" ? 0.26 : 0.12;
  const lit = rarity === "epic" ? 0.72 : rarity === "rare" ? 0.66 : rarity === "uncommon" ? 0.6 : 0.56;
  const base = new THREE.Color().setHSL(hue, sat, lit);
  if (rarity === "uncommon") base.offsetHSL(0.04, 0.04, 0.03);
  if (rarity === "rare") base.offsetHSL(0.02, 0.06, 0.05);
  if (rarity === "epic") base.offsetHSL(-0.02, 0.08, 0.07);
  return base;
}

/** Metal con filo/brillo: alta metalness, baja roughness, leve emisión. */
export function makeMetalMat(
  hue: number,
  rarity: Rarity,
  opts?: { polish?: number },
): THREE.MeshStandardMaterial {
  const polish = opts?.polish ?? 1;
  const rough =
    rarity === "epic" ? 0.1 : rarity === "rare" ? 0.14 : rarity === "uncommon" ? 0.2 : 0.26;
  const color = metalColor(hue, rarity);
  const emissive = color.clone().multiplyScalar(
    rarity === "epic" ? 0.12 : rarity === "rare" ? 0.07 : rarity === "uncommon" ? 0.035 : 0.015,
  );
  return new THREE.MeshStandardMaterial({
    color,
    metalness: Math.min(1, 0.92 + polish * 0.06),
    roughness: Math.max(0.06, rough / polish),
    envMapIntensity: 1.15 + polish * 0.35,
    emissive,
    emissiveIntensity: 1,
  });
}

/** Filo brillante: franja fina más clara sobre el metal. */
export function makeEdgeMat(hue: number, rarity: Rarity): THREE.MeshStandardMaterial {
  const c = metalColor(hue, rarity).clone().offsetHSL(0, -0.05, 0.18);
  const glow = rarityGlowStrength(rarity);
  return new THREE.MeshStandardMaterial({
    color: c,
    metalness: 1,
    roughness: 0.06,
    envMapIntensity: 1.8,
    emissive: c.clone().multiplyScalar(0.12 + glow * 0.55),
    emissiveIntensity: 0.8 + glow * 1.2,
  });
}

/** 0..1 intensidad de aura por rareza. */
export function rarityGlowStrength(rarity: Rarity): number {
  if (rarity === "epic") return 1;
  if (rarity === "rare") return 0.58;
  if (rarity === "uncommon") return 0.28;
  return 0.06;
}

export function itemHue(item: ItemInstance): number {
  const p = item.params as { metalHue?: number; hue?: number; leatherHue?: number };
  return p.metalHue ?? p.hue ?? p.leatherHue ?? 0.5;
}

export function itemRarity(item: ItemInstance): Rarity {
  return (item.params as { rarity: Rarity }).rarity;
}

/**
 * Glow de rareza: el ítem mismo emite (emissive), sin burbuja.
 * PointLight opcional y tenue solo si `lights` (equipado); nunca en loot.
 */
export function applyItemGlow(
  root: THREE.Group,
  hue: number,
  rarity: Rarity,
  opts?: { lights?: boolean },
): void {
  const strength = rarityGlowStrength(rarity);
  if (strength < 0.05) return;
  const color = metalColor(hue, rarity);

  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      const metalish = mat.metalness > 0.25;
      // Filo/metal brilla más; cuero/tela apenas tiñe
      const glowAmt = metalish ? 0.22 + strength * 0.85 : 0.04 + strength * 0.28;
      mat.emissive.copy(color).multiplyScalar(glowAmt);
      mat.emissiveIntensity = 0.55 + strength * 1.8;
      if (metalish) mat.envMapIntensity = Math.min(2.2, (mat.envMapIntensity || 1) + strength * 0.6);
    }
  });

  // Halo de luz real muy suave (ilumina el piso cerca), no esfera visible
  if (opts?.lights && strength >= 0.28) {
    const light = new THREE.PointLight(
      color,
      0.12 + strength * 0.45,
      0.9 + strength * 1.1,
      2,
    );
    light.position.set(0, 0.06, 0);
    root.add(light);
  }
}

function leatherColor(hue: number): THREE.Color {
  // Cuero cálido (marrón/rojizo), no gris plano
  return new THREE.Color().setHSL(0.055 + hue * 0.06, 0.52, 0.32);
}

function makeLeatherMat(hue: number, darker = false): THREE.MeshStandardMaterial {
  const c = leatherColor(hue);
  if (darker) c.offsetHSL(0, 0.02, -0.08);
  return new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.72,
    metalness: 0.04,
    // leve brillo de cuero engrasado
    envMapIntensity: 0.45,
  });
}

function makeWoodMat(hue = 0.08, lit = 0.28): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.06 + hue * 0.05, 0.45, lit),
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.35,
  });
}

/** Hira-shuriken (placa fina + orificio central), silueta tipo senban/juji. */
function buildShurikenMesh(params: ThrowParams): THREE.Group {
  const g = new THREE.Group();
  const s = 0.16 + params.size * 0.22;
  const steel = makeMetalMat(params.metalHue, params.rarity, { polish: 1.15 });
  steel.color.offsetHSL(0, -0.02, -0.12);
  steel.roughness = 0.32;
  const edge = makeEdgeMat(params.metalHue, params.rarity);

  const shape = new THREE.Shape();
  const tips = 4;
  const outer = s;
  const waist = s * 0.22;
  for (let i = 0; i < tips; i++) {
    const aTip = (i / tips) * Math.PI * 2 - Math.PI / 2;
    const aWaist = ((i + 0.5) / tips) * Math.PI * 2 - Math.PI / 2;
    const tx = Math.cos(aTip) * outer;
    const ty = Math.sin(aTip) * outer;
    const wx = Math.cos(aWaist) * waist;
    const wy = Math.sin(aWaist) * waist;
    // Puntas ligeramente “boomerang” (borde cóncavo suave)
    const aPre = aTip - 0.18;
    const aPost = aTip + 0.18;
    const preX = Math.cos(aPre) * outer * 0.72;
    const preY = Math.sin(aPre) * outer * 0.72;
    const postX = Math.cos(aPost) * outer * 0.72;
    const postY = Math.sin(aPost) * outer * 0.72;
    if (i === 0) shape.moveTo(wx, wy);
    else shape.lineTo(wx, wy);
    shape.lineTo(preX, preY);
    shape.lineTo(tx, ty);
    shape.lineTo(postX, postY);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, s * 0.11, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false, curveSegments: 4 }),
    steel,
  );
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = 0.006;
  g.add(plate);

  // Filo fino en el perímetro (anillo visual)
  for (let i = 0; i < tips; i++) {
    const a = (i / tips) * Math.PI * 2 - Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(s * 0.035, s * 0.12, 3), edge);
    tip.rotation.z = -a + Math.PI;
    tip.position.set(Math.cos(a) * outer * 0.92, 0.006, Math.sin(a) * outer * 0.92);
    g.add(tip);
  }
  return g;
}

/**
 * Bota individual (forma redondeada, no cajas).
 * AJUSTE: height/sole vienen de BootsParams; radio del caña ≈ 0.07.
 */
function makeSingleBoot(
  params: BootsParams,
  leather: THREE.Material,
  leatherDark: THREE.Material,
  soleMat: THREE.Material,
  metal: THREE.Material,
  x = 0,
): THREE.Group {
  const boot = new THREE.Group();
  const usePlate = params.style === "plate" || params.style === "greaves";
  const greaves = params.style === "greaves";
  const shaftMat = usePlate ? metal : leather;
  const footMat = greaves ? leather : usePlate ? metal : leather;
  const cuffMat = usePlate ? metal : leatherDark;

  const soleH = Math.max(0.03, params.sole);
  const shaftH = Math.max(0.18, params.height);
  const rTop = params.style === "light" ? 0.055 : greaves ? 0.07 : 0.065;
  const rBot = params.style === "trail" ? 0.075 : greaves ? 0.08 : 0.07;

  // Caña cónica (cilindro ahusado)
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, shaftH, 12),
    shaftMat,
  );
  shaft.position.y = soleH + 0.06 + shaftH / 2;
  shaft.castShadow = true;
  boot.add(shaft);

  // Puño / doblez superior de cuero
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(rTop * 1.05, 0.018, 6, 14), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = soleH + 0.06 + shaftH - 0.01;
  boot.add(cuff);

  // Empeine redondeado (cápsula aplastada)
  const vamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), footMat);
  vamp.scale.set(0.95, 0.55, 1.35);
  vamp.position.set(0, soleH + 0.07, 0.06);
  vamp.castShadow = true;
  boot.add(vamp);

  // Puntera
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), footMat);
  toe.scale.set(0.95, 0.65, 1.1);
  toe.position.set(0, soleH + 0.055, 0.16);
  boot.add(toe);

  // Talón
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), leatherDark);
  heel.scale.set(1, 0.7, 0.85);
  heel.position.set(0, soleH + 0.05, -0.04);
  boot.add(heel);

  // Suela curvada (cilindro aplastado)
  const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.095, soleH, 12), soleMat);
  sole.scale.set(1, 1, 1.55);
  sole.position.set(0, soleH / 2, 0.05);
  boot.add(sole);

  // Costura / ribete lateral (detalle cuero)
  if (!usePlate) {
    const stitch = new THREE.Mesh(
      new THREE.TorusGeometry(0.072, 0.008, 5, 16, Math.PI * 1.2),
      leatherDark,
    );
    stitch.rotation.y = Math.PI / 2;
    stitch.position.set(0.02, soleH + 0.08, 0.05);
    boot.add(stitch);
  } else {
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), metal);
    stud.position.set(0.06, soleH + 0.12, 0.02);
    boot.add(stud);
  }

  if (greaves) {
    // Placa frontal de greba (espinillera)
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(rBot * 1.6, shaftH * 0.85, 0.035),
      metal,
    );
    plate.position.set(0, soleH + 0.06 + shaftH * 0.55, rBot * 0.7);
    boot.add(plate);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, shaftH * 0.7, 0.04), metal);
    ridge.position.set(0, soleH + 0.06 + shaftH * 0.55, rBot * 0.85);
    boot.add(ridge);
  }

  boot.position.x = x;
  return boot;
}

function buildBootsMesh(params: BootsParams): THREE.Group {
  const g = new THREE.Group();
  const leather = makeLeatherMat(params.leatherHue);
  const leatherDark = makeLeatherMat(params.leatherHue, true);
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x1e1812,
    roughness: 0.92,
    metalness: 0.02,
  });
  const metal =
    params.style === "plate" || params.style === "greaves"
      ? makeMetalMat(params.leatherHue, params.rarity)
      : new THREE.MeshStandardMaterial({
          color: metalColor(params.leatherHue, params.rarity),
          metalness: 0.28,
          roughness: 0.55,
        });
  g.add(makeSingleBoot(params, leather, leatherDark, soleMat, metal, -0.12));
  g.add(makeSingleBoot(params, leather, leatherDark, soleMat, metal, 0.12));
  return g;
}

export function buildWornBootMesh(params: BootsParams): THREE.Group {
  const leather = makeLeatherMat(params.leatherHue);
  const leatherDark = makeLeatherMat(params.leatherHue, true);
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x1e1812,
    roughness: 0.92,
    metalness: 0.02,
  });
  const metal =
    params.style === "plate" || params.style === "greaves"
      ? makeMetalMat(params.leatherHue, params.rarity)
      : new THREE.MeshStandardMaterial({
          color: metalColor(params.leatherHue, params.rarity),
          metalness: 0.28,
          roughness: 0.55,
        });
  const boot = makeSingleBoot(params, leather, leatherDark, soleMat, metal, 0);
  boot.scale.setScalar(1.2);
  applyItemGlow(boot, params.leatherHue, params.rarity);
  return boot;
}

/** Material de armadura según estilo + acabado (bare/painted/polished/darkened). */
function makeArmorSurfaceMat(params: ArmorParams): THREE.MeshStandardMaterial {
  const { style, finish, hue, rarity } = params;
  if (style === "leather") {
    return makeLeatherMat(hue, finish === "darkened");
  }
  if (style === "padded") {
    // Tela acolchada / gambesón
    const c = new THREE.Color().setHSL(0.08 + hue * 0.15, 0.35, finish === "darkened" ? 0.28 : 0.42);
    return new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.25,
    });
  }
  // Metales: chain / scale / plate
  if (finish === "bare") {
    // Acero/hierro sin pintar — poco saturado, gris frío
    const c = new THREE.Color().setHSL(0.58, rarity === "epic" ? 0.1 : 0.04, 0.52);
    return new THREE.MeshStandardMaterial({
      color: c,
      metalness: 0.92,
      roughness: style === "chain" ? 0.38 : 0.28,
      envMapIntensity: 1.1,
      emissive: c.clone().multiplyScalar(0.02),
    });
  }
  if (finish === "darkened") {
    const c = new THREE.Color().setHSL(0.6 + hue * 0.05, 0.08, 0.22);
    return new THREE.MeshStandardMaterial({
      color: c,
      metalness: 0.88,
      roughness: 0.42,
      envMapIntensity: 0.85,
    });
  }
  if (finish === "polished") {
    return makeMetalMat(hue * 0.15 + 0.55, rarity, { polish: 1.25 });
  }
  // painted — metal lacado con color del hue
  const painted = metalColor(hue, rarity);
  painted.offsetHSL(0, 0.15, finish === "painted" ? 0.05 : 0);
  return new THREE.MeshStandardMaterial({
    color: painted,
    metalness: 0.7,
    roughness: 0.32,
    envMapIntensity: 1.05,
    emissive: painted.clone().multiplyScalar(0.04),
  });
}

/**
 * Fit HumanMale@1.78m en ESPACIO HUESO (worldScale≈0.368).
 * Mundo: grip≈1.25, cuello+0.24, hombro+0.16/±0.17, cover ropa−0.48
 * → local = mundo / 0.368
 */
const BONE_S = 0.368;
const U = 1 / BONE_S; // 1m mundo → unidades hueso
const ARMOR_FIT = {
  yTop: 0.26 / BONE_S,
  yShoulder: 0.18 / BONE_S,
  xShoulder: 0.17 / BONE_S,
  yBottom: -0.4 / BONE_S,
  chestRx: 0.175 / BONE_S,
  waistRx: 0.145 / BONE_S,
  depth: 0.9,
};

function armorY(t: number): number {
  // t 0..1 bottom→top
  return ARMOR_FIT.yBottom + t * (ARMOR_FIT.yTop - ARMOR_FIT.yBottom);
}

function armorRadius(t: number, bulk: number): number {
  const chest = Math.sin(Math.pow(Math.min(1, Math.max(0, t)), 0.55) * Math.PI);
  const base = ARMOR_FIT.waistRx + (ARMOR_FIT.chestRx - ARMOR_FIT.waistRx) * chest;
  const neck = t > 0.85 ? (t - 0.85) * 0.9 : 0;
  const bellySlim = (1 - t) * (1 - t) * 0.08 * U;
  return Math.max(ARMOR_FIT.waistRx * 0.92, base + bulk * 0.045 - neck - bellySlim);
}

function makeTorsoCuirass(
  bulk: number,
  mat: THREE.Material,
  opts?: { depth?: number; segments?: number },
): THREE.Mesh {
  const depth = opts?.depth ?? ARMOR_FIT.depth;
  const segs = opts?.segments ?? 20;
  const pts: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector2(Math.max(0.12, armorRadius(t, bulk)), armorY(t)));
  }
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, segs), mat);
  mesh.scale.z = depth;
  return mesh;
}

/** Hombreras a altura de UpperArm/cuello, unidas al peto. */
function addArmorPauldrons(
  g: THREE.Group,
  mat: THREE.Material,
  bulk: number,
  heavy: boolean,
): void {
  const y = ARMOR_FIT.yShoulder;
  const reach = ARMOR_FIT.xShoulder + bulk * 0.05 * U;
  const s = heavy ? 1.1 : 1;
  for (const side of [-1, 1]) {
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.11 * U * s, 0.04 * U, 0.08 * U),
      mat,
    );
    bridge.position.set(side * reach * 0.4, y + 0.03 * U, 0.02 * U);
    bridge.rotation.z = side * 0.1;
    g.add(bridge);

    const pad = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 * U * s, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.6),
      mat,
    );
    pad.scale.set(1.25, 0.72, 1.05);
    pad.position.set(side * reach, y, 0.01 * U);
    pad.rotation.z = side * 0.18;
    g.add(pad);

    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.07 * U * s, 0.045 * U, 0.06 * U), mat);
    rear.position.set(side * (reach * 0.65), y - 0.02 * U, -0.05 * U);
    rear.rotation.z = side * 0.12;
    g.add(rear);

    if (heavy) {
      for (let i = 0; i < 2; i++) {
        const lame = new THREE.Mesh(
          new THREE.BoxGeometry(0.08 * U * s, 0.032 * U, 0.09 * U),
          mat,
        );
        lame.position.set(side * (reach + 0.01 * U), y - (0.07 + i * 0.05) * U, 0.025 * U);
        lame.rotation.z = side * (0.12 - i * 0.02);
        g.add(lame);
      }
    }
  }
}

function addFauld(g: THREE.Group, mat: THREE.Material, bulk: number): void {
  for (let i = 0; i < 3; i++) {
    const t = 0.08 + i * 0.07;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(armorRadius(t, bulk) * 0.98, 0.014 * U, 5, 18),
      mat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.scale.z = ARMOR_FIT.depth;
    ring.position.y = armorY(t);
    g.add(ring);
  }
  for (const side of [-1, 1]) {
    const tasset = new THREE.Mesh(new THREE.BoxGeometry(0.08 * U, 0.1 * U, 0.035 * U), mat);
    tasset.position.set(side * 0.13 * U, armorY(0.12), 0.04 * U);
    tasset.rotation.z = side * 0.15;
    g.add(tasset);
  }
}

function addBreastPlate(g: THREE.Group, mat: THREE.Material, bulk: number): void {
  const breast = new THREE.Mesh(
    new THREE.SphereGeometry((0.15 + bulk * 0.02) * U, 14, 11, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mat,
  );
  breast.scale.set(1.2, 0.9, 0.52);
  breast.position.set(0, 0.05 * U, 0.09 * U);
  g.add(breast);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.025 * U, 0.28 * U, 0.03 * U), mat);
  ridge.position.set(0, 0.04 * U, 0.16 * U);
  g.add(ridge);
  for (const side of [-1, 1]) {
    const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.065 * U, 0.2 * U, 0.03 * U), mat);
    sidePlate.position.set(side * 0.13 * U, 0.03 * U, 0.09 * U);
    sidePlate.rotation.y = side * -0.35;
    g.add(sidePlate);
  }
}

function addGorget(g: THREE.Group, mat: THREE.Material, bulk: number): void {
  const gorget = new THREE.Mesh(
    new THREE.TorusGeometry((0.1 + bulk * 0.012) * U, 0.028 * U, 6, 16),
    mat,
  );
  gorget.rotation.x = Math.PI / 2;
  gorget.scale.z = 0.78;
  gorget.position.y = ARMOR_FIT.yTop - 0.02 * U;
  g.add(gorget);
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09 * U, 0.11 * U, 0.045 * U, 14),
    mat,
  );
  collar.position.y = ARMOR_FIT.yTop + 0.015 * U;
  collar.scale.z = 0.75;
  g.add(collar);
}

function addBackPlate(g: THREE.Group, mat: THREE.Material, bulk: number): void {
  // Media cáscara dorsal que cierra el lathe (evita “aros” huecos de espaldas)
  const back = new THREE.Mesh(
    new THREE.SphereGeometry((0.16 + bulk * 0.02) * U, 14, 12, 0, Math.PI, 0, Math.PI * 0.62),
    mat,
  );
  back.scale.set(1.05, 1.15, 0.7);
  back.position.set(0, 0.0, -0.02 * U);
  back.rotation.y = Math.PI / 2;
  g.add(back);
}

/**
 * Armadura en metros mundo (cubre ropa del HumanMale).
 * Ajuste fino: equipAttach.ts
 */
export function buildWornArmorMesh(params: ArmorParams): THREE.Group {
  const g = new THREE.Group();
  const mat = makeArmorSurfaceMat(params);
  const under = makeLeatherMat(params.hue, true);
  const trim = makeMetalMat(params.hue, params.rarity, { polish: 1.05 });
  const bulk = params.bulk;
  const style = params.style;
  const edge = makeEdgeMat(params.hue, params.rarity);

  const shellMat = style === "scale" ? under : mat;
  g.add(makeTorsoCuirass(bulk, shellMat, { depth: ARMOR_FIT.depth, segments: 22 }));
  addBackPlate(g, style === "leather" ? under : mat, bulk);
  addGorget(g, style === "padded" || style === "leather" ? under : mat, bulk);
  addArmorPauldrons(g, mat, bulk, style === "plate" || style === "scale");

  if (style === "plate") {
    addBreastPlate(g, mat, bulk);
    addFauld(g, mat, bulk);
    for (const x of [-0.08, 0.08, -0.04, 0.04]) {
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.011 * U, 6, 6), edge);
      rivet.position.set(x * U, (0.07 + Math.abs(x) * 0.15) * U, 0.16 * U);
      g.add(rivet);
    }
    const waist = new THREE.Mesh(
      new THREE.TorusGeometry(armorRadius(0.22, bulk), 0.018 * U, 5, 16),
      trim,
    );
    waist.rotation.x = Math.PI / 2;
    waist.scale.z = ARMOR_FIT.depth;
    waist.position.y = armorY(0.22);
    g.add(waist);
  } else if (style === "scale") {
    const rows = 8;
    const cols = 9;
    for (let row = 0; row < rows; row++) {
      const t = 0.18 + (row / (rows - 1)) * 0.68;
      const y = armorY(t);
      const r = armorRadius(t, bulk);
      for (let col = 0; col < cols; col++) {
        const a = -1.05 + (col / (cols - 1)) * 2.1 + (row % 2) * 0.07;
        const sc = new THREE.Mesh(new THREE.CircleGeometry(0.035 * U, 5), mat);
        sc.position.set(Math.sin(a) * r, y, Math.cos(a) * r * ARMOR_FIT.depth);
        sc.lookAt(0, y, 0);
        g.add(sc);
      }
    }
    addFauld(g, mat, bulk * 0.8);
  } else if (style === "chain") {
    for (let i = 0; i < 9; i++) {
      const t = 0.12 + i * 0.085;
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(armorRadius(t, bulk), 0.01 * U, 4, 18),
        under,
      );
      band.rotation.x = Math.PI / 2;
      band.scale.z = ARMOR_FIT.depth;
      band.position.y = armorY(t);
      g.add(band);
    }
    const chestBand = new THREE.Mesh(
      new THREE.TorusGeometry(armorRadius(0.62, bulk), 0.016 * U, 5, 16),
      trim,
    );
    chestBand.rotation.x = Math.PI / 2;
    chestBand.scale.z = ARMOR_FIT.depth;
    chestBand.position.y = armorY(0.62);
    g.add(chestBand);
  } else if (style === "padded") {
    for (let i = 0; i < 7; i++) {
      const t = 0.14 + i * 0.1;
      const quilt = new THREE.Mesh(
        new THREE.TorusGeometry(armorRadius(t, bulk), 0.014 * U, 4, 16),
        under,
      );
      quilt.rotation.x = Math.PI / 2;
      quilt.scale.z = ARMOR_FIT.depth;
      quilt.position.y = armorY(t);
      g.add(quilt);
    }
    for (const x of [-0.07, 0, 0.07]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012 * U, 0.45 * U, 0.018 * U), under);
      seam.position.set(x * U, 0.02 * U, 0.13 * U);
      g.add(seam);
    }
  } else {
    addBreastPlate(g, under, bulk * 0.85);
    for (let i = 0; i < 4; i++) {
      const t = 0.25 + i * 0.14;
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(armorRadius(t, bulk), 0.014 * U, 5, 16),
        under,
      );
      strap.rotation.x = Math.PI / 2;
      strap.scale.z = ARMOR_FIT.depth;
      strap.position.y = armorY(t);
      g.add(strap);
    }
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.055 * U, 0.04 * U, 0.028 * U), trim);
    buckle.position.set(0, 0.04 * U, 0.16 * U);
    g.add(buckle);
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035 * U, 0.26 * U, 0.018 * U), under);
      strap.position.set(side * 0.09 * U, 0.1 * U, 0.07 * U);
      strap.rotation.z = side * 0.18;
      g.add(strap);
    }
  }

  applyItemGlow(g, params.hue, params.rarity);
  return g;
}

/**
 * Mesh de cinturón equipado.
 * AJUSTE MANUAL: TorusGeometry(radio, grosorTubo, …)
 * Ancla/offset: loadHero beltGrip + scene syncEquippedVisuals.
 */
export function buildWornBeltMesh(params: BeltParams): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color:
      params.style === "rope"
        ? new THREE.Color().setHSL(0.12, 0.35, 0.45)
        : params.style === "leather"
          ? leatherColor(params.hue)
          : metalColor(params.hue, params.rarity),
    metalness: params.style === "plated" ? 0.65 : 0.08,
    roughness: 0.65,
  });
  // Abdomen bone scale≈0.37
  const radius = 0.155 * U;
  const tube = Math.max(0.018 * U, params.width * 0.12 * U); // antes quedaba “donut” hinchado
  const belt = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 20), mat);
  belt.rotation.x = Math.PI / 2;
  belt.scale.z = 0.82;
  g.add(belt);
  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.055 * U, Math.max(0.04 * U, tube * 2.4), 0.04 * U),
    makeMetalMat(params.hue, params.rarity, { polish: 1.2 }),
  );
  buckle.position.set(0, 0, radius);
  g.add(buckle);
  applyItemGlow(g, params.hue, params.rarity);
  return g;
}

function buildShieldMesh(params: ShieldParams): THREE.Group {
  const g = new THREE.Group();
  const mat = params.material ?? "reinforced";
  const wood = makeWoodMat(params.metalHue, mat === "wood" ? 0.32 : 0.26);
  const metal = makeMetalMat(params.metalHue, params.rarity, { polish: mat === "metal" ? 1.05 : 0.9 });
  const face = mat === "metal" ? metal : wood;
  let body: THREE.Mesh;
  if (params.shape === "round") {
    body = new THREE.Mesh(
      new THREE.CylinderGeometry(params.width * 0.55, params.width * 0.55, 0.06, 20),
      face,
    );
    body.rotation.x = Math.PI / 2;
  } else if (params.shape === "kite") {
    body = new THREE.Mesh(new THREE.BoxGeometry(params.width * 0.7, params.height, 0.06), face);
  } else {
    body = new THREE.Mesh(new THREE.BoxGeometry(params.width, params.height * 0.85, 0.06), face);
  }
  g.add(body);

  if (mat !== "metal") {
    // Tablas / veta
    for (const ox of [-0.22, 0, 0.22]) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, params.height * (params.shape === "round" ? 0.7 : 0.75), 0.008),
        makeWoodMat(params.metalHue + 0.02, 0.22),
      );
      plank.position.set(ox * params.width, 0, 0.035);
      g.add(plank);
    }
  }

  if (mat === "reinforced" || mat === "metal") {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(params.width * 0.42, mat === "metal" ? 0.016 : 0.012, 6, 20),
      makeEdgeMat(params.metalHue, params.rarity),
    );
    rim.position.z = 0.03;
    g.add(rim);
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), metal);
      rivet.position.set(Math.cos(ang) * params.width * 0.32, Math.sin(ang) * params.height * 0.28, 0.04);
      g.add(rivet);
    }
  }

  const boss = new THREE.Mesh(new THREE.SphereGeometry(params.boss, 10, 10), metal);
  boss.position.z = 0.05;
  g.add(boss);
  return g;
}

function buildHelmetMesh(params: HelmetParams): THREE.Group {
  const g = new THREE.Group();
  const material = params.material ?? "steel";
  const metal =
    material === "leather"
      ? makeLeatherMat(params.metalHue)
      : material === "bronze"
        ? (() => {
            const m = makeMetalMat(0.08 + params.metalHue * 0.04, params.rarity, { polish: 0.95 });
            m.color.setHSL(0.09, 0.55, 0.42);
            return m;
          })()
        : makeMetalMat(params.metalHue, params.rarity);
  const r = 0.14 + params.dome * 0.55;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    metal,
  );
  dome.position.y = r * 0.08;
  g.add(dome);

  if (params.style === "nasal" || params.style === "barbute" || params.style === "full") {
    const nasal = new THREE.Mesh(new THREE.BoxGeometry(0.035, r * 0.85, 0.045), metal);
    nasal.position.set(0, -r * 0.05, r * 0.82);
    g.add(nasal);
  }
  if (params.style === "full" || params.style === "great" || params.style === "barbute") {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(r * 1.55, r * 0.65, 0.06), metal);
    cheek.position.set(0, -r * 0.15, r * 0.4);
    g.add(cheek);
  }
  if (params.style === "sallet") {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, r * 0.35, r * 0.7), metal);
    tail.position.set(0, -r * 0.05, -r * 0.35);
    g.add(tail);
  }
  if (params.style === "great") {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, r * 0.35, 0.08), metal);
    visor.position.set(0, r * 0.05, r * 0.7);
    g.add(visor);
  }
  if (params.style === "horned") {
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, r * 0.9, 6), metal);
      horn.position.set(sx * r * 0.7, r * 0.55, 0);
      horn.rotation.z = sx * 0.6;
      g.add(horn);
    }
  }
  if (params.brim > 0.03 && params.style !== "great") {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.2, r * 1.28, Math.max(0.03, params.brim), 16),
      metal,
    );
    brim.position.y = -r * 0.02;
    g.add(brim);
  }
  return g;
}

function buildAxeMesh(params: AxeParams): THREE.Group {
  const g = new THREE.Group();
  const metal = makeMetalMat(params.metalHue, params.rarity, { polish: 1.1 });
  const edge = makeEdgeMat(params.metalHue, params.rarity);
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c3b22, roughness: 0.85 });
  const haft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, params.haftLength, 8),
    wood,
  );
  haft.position.y = params.haftLength / 2;
  g.add(haft);
  const headW = params.headStyle === "double" ? params.headSize * 2.2 : params.headSize * 1.4;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(headW, params.headSize * 0.9, params.headSize * 0.35),
    metal,
  );
  head.position.y = params.haftLength * 0.92;
  g.add(head);
  // Filo del hacha
  const bladeEdge = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, params.headSize * 0.85, params.headSize * 0.42),
    edge,
  );
  bladeEdge.position.set(headW * 0.48, params.haftLength * 0.92, 0);
  g.add(bladeEdge);
  if (params.headStyle === "double") {
    const bladeEdge2 = bladeEdge.clone();
    bladeEdge2.position.x = -headW * 0.48;
    g.add(bladeEdge2);
  }
  if (params.headStyle === "bearded") {
    const beard = new THREE.Mesh(
      new THREE.BoxGeometry(params.headSize * 0.5, params.headSize * 0.7, 0.04),
      metal,
    );
    beard.position.set(params.headSize * 0.45, params.haftLength * 0.75, 0);
    g.add(beard);
  }
  g.rotation.x = -Math.PI / 2;
  return g;
}

function buildThrowMesh(params: ThrowParams): THREE.Group {
  const g = new THREE.Group();
  const metal = makeMetalMat(params.metalHue, params.rarity, { polish: 1.2 });
  const edge = makeEdgeMat(params.metalHue, params.rarity);
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c3b22, roughness: 0.85 });
  const s = 0.15 + params.size * 0.2;
  if (params.subtype === "shuriken") {
    return buildShurikenMesh(params);
  } else if (params.subtype === "javelin") {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.9 + s, 6), wood);
    shaft.rotation.x = Math.PI / 2;
    g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 6), edge);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.5 + s * 0.4;
    g.add(tip);
  } else if (params.subtype === "throwingDagger") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.35 + s * 0.2), metal);
    blade.position.z = 0.15;
    g.add(blade);
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.036, 0.32 + s * 0.2), edge);
      e.position.set(side * 0.028, 0, 0.15);
      g.add(e);
    }
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.14), wood);
    grip.position.z = -0.12;
    g.add(grip);
  } else {
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.35, 6), wood);
    haft.rotation.x = Math.PI / 2;
    g.add(haft);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.05), metal);
    head.position.z = 0.12;
    g.add(head);
    const axeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.13, 0.06), edge);
    axeEdge.position.set(0.12, 0, 0.12);
    g.add(axeEdge);
  }
  return g;
}

function buildBowMesh(params: BowParams): THREE.Group {
  const g = new THREE.Group();
  const wood = makeWoodMat(params.metalHue, 0.3);
  const woodDark = makeWoodMat(params.metalHue + 0.03, 0.22);
  const wrap = makeLeatherMat(params.metalHue);
  const stringMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.55, metalness: 0.05 });
  const tipMat = makeMetalMat(params.metalHue, params.rarity, { polish: 0.85 });
  const curve = 0.2 + params.limbCurve * 0.24;
  const h = 0.62 + params.draw * 0.38;

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.15, 8), wrap);
  g.add(grip);
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.048), woodDark);
  riser.position.x = 0.012;
  g.add(riser);

  // Limbs como tubo continuo (recurvo)
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = (t - 0.5) * h;
    const u = Math.abs(t - 0.5) * 2;
    const x = curve * u * u * (0.35 + 0.65 * u);
    pts.push(new THREE.Vector3(x, y, 0));
  }
  const path = new THREE.CatmullRomCurve3(pts);
  const limbs = new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.016, 6, false), wood);
  g.add(limbs);

  const up = pts[pts.length - 1];
  const dn = pts[0];
  for (const p of [up, dn]) {
    const nock = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), tipMat);
    nock.position.copy(p);
    g.add(nock);
  }

  const strH = Math.abs(up.y - dn.y);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, strH, 4), stringMat);
  string.position.set(-0.015, 0, 0);
  g.add(string);

  g.rotation.y = Math.PI / 2;
  return g;
}

function buildCrossbowMesh(params: CrossbowParams): THREE.Group {
  const g = new THREE.Group();
  const wood = makeWoodMat(params.metalHue, 0.28);
  const woodDark = makeWoodMat(params.metalHue + 0.04, 0.2);
  const metal = makeMetalMat(params.metalHue, params.rarity);
  const stringMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.55 });
  const stockLen = 0.42 + params.stockLength * 0.38;

  // Culata + caña
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.065, stockLen), wood);
  stock.position.z = 0.02;
  g.add(stock);
  const butt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.12), woodDark);
  butt.position.set(0, 0.02, -stockLen * 0.42);
  g.add(butt);
  const groove = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, stockLen * 0.7), woodDark);
  groove.position.set(0, 0.04, 0.06);
  g.add(groove);

  // Prod (arco) con limbs
  const prodW = 0.5 + params.power * 0.28;
  const prodZ = stockLen * 0.28;
  for (const side of [-1, 1]) {
    const limb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.014, prodW * 0.48, 6),
      wood,
    );
    limb.rotation.z = side * (Math.PI / 2 - 0.25);
    limb.position.set(side * prodW * 0.22, 0.02, prodZ);
    g.add(limb);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), metal);
    tip.position.set(side * prodW * 0.45, 0.05, prodZ - 0.02);
    g.add(tip);
  }
  const prodCenter = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.05), metal);
  prodCenter.position.set(0, 0.02, prodZ);
  g.add(prodCenter);

  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, prodW * 0.85, 4), stringMat);
  string.rotation.z = Math.PI / 2;
  string.position.set(0, 0.06, prodZ - 0.06);
  g.add(string);

  // Estribo, tuerca y gatillo
  const stirrup = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 12), metal);
  stirrup.position.set(0, -0.02, stockLen * 0.42);
  stirrup.rotation.x = Math.PI / 2;
  g.add(stirrup);
  const nut = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.045), metal);
  nut.position.set(0, 0.045, 0.02);
  g.add(nut);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.015), metal);
  trigger.position.set(0, -0.05, 0.0);
  trigger.rotation.x = 0.35;
  g.add(trigger);

  return g;
}

function buildArrowMesh(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a32, roughness: 0.85 });
  const tip = makeMetalMat(0.55, "common", { polish: 1.35 });
  tip.color.setHex(0xd0d0d8);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.7, 5), wood);
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), tip);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.4;
  g.add(head);
  const fletch = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.02, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xc45a3a, roughness: 0.7 }),
  );
  fletch.position.z = -0.32;
  g.add(fletch);
  return g;
}

function buildBoltMesh(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c4030, roughness: 0.85 });
  const tip = makeMetalMat(0.55, "uncommon", { polish: 1.3 });
  tip.color.setHex(0xa8a8b2);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.42, 5), wood);
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 5), tip);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.26;
  g.add(head);
  return g;
}

export function buildProjectileMesh(p: Projectile): THREE.Group {
  if (p.visual === "arrow") return buildArrowMesh();
  if (p.visual === "bolt") return buildBoltMesh();
  if (p.sourceItem) {
    const m = buildItemMesh(p.sourceItem, { lite: true });
    m.scale.setScalar(1.05);
    return m;
  }
  return buildArrowMesh();
}

/** Versión compacta para loot / icono 3D (mismas tipologías). */
function buildArmorMesh(params: ArmorParams): THREE.Group {
  const g = new THREE.Group();
  const mat = makeArmorSurfaceMat(params);
  const h = 0.45 + params.bulk * 0.25;
  if (params.style === "chain") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, h, 10), mat);
    g.add(body);
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 4, 10), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -h * 0.35 + i * 0.1;
      g.add(ring);
    }
  } else if (params.style === "scale") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, h, 8), mat);
    g.add(body);
    for (let i = 0; i < 8; i++) {
      const sc = new THREE.Mesh(new THREE.CircleGeometry(0.05, 5), mat);
      const a = (i / 8) * Math.PI * 2;
      sc.position.set(Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2);
      sc.lookAt(0, 0.05, 0);
      g.add(sc);
    }
  } else if (params.style === "plate") {
    const chest = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.7),
      mat,
    );
    chest.scale.set(1.05, 1.15, 0.85);
    g.add(chest);
  } else if (params.style === "padded") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, h, 8), mat);
    g.add(body);
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 4, 10), mat);
      rib.rotation.x = Math.PI / 2;
      rib.position.y = -h * 0.3 + i * 0.12;
      g.add(rib);
    }
  } else {
    const chest = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.7),
      mat,
    );
    chest.scale.set(1.1, 1.1, 0.8);
    g.add(chest);
  }
  return g;
}

function buildPantsMesh(params: PantsParams): THREE.Group {
  const g = new THREE.Group();
  const mat =
    params.style === "plated"
      ? makeMetalMat(params.hue, params.rarity, { polish: 0.9 })
      : new THREE.MeshStandardMaterial({
          color:
            params.style === "cloth"
              ? new THREE.Color().setHSL(0.6, 0.15, 0.35)
              : leatherColor(params.hue),
          metalness: 0.05,
          roughness: 0.8,
        });
  for (const x of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35 + params.length * 0.25, 0.14), mat);
    leg.position.set(x, -0.15, 0);
    g.add(leg);
  }
  return g;
}

function buildGlovesMesh(params: GlovesParams): THREE.Group {
  const g = new THREE.Group();
  const mat =
    params.style === "gauntlet"
      ? makeMetalMat(params.hue, params.rarity)
      : new THREE.MeshStandardMaterial({
          color:
            params.style === "cloth"
              ? new THREE.Color().setHSL(0.1, 0.2, 0.4)
              : leatherColor(params.hue),
          metalness: 0.05,
          roughness: 0.75,
        });
  for (const x of [-0.12, 0.12]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.14), mat);
    hand.position.set(x, 0, 0);
    g.add(hand);
  }
  return g;
}

function buildBeltMesh(params: BeltParams): THREE.Group {
  const g = new THREE.Group();
  const mat =
    params.style === "plated"
      ? makeMetalMat(params.hue, params.rarity)
      : new THREE.MeshStandardMaterial({
          color:
            params.style === "rope"
              ? new THREE.Color().setHSL(0.12, 0.35, 0.45)
              : leatherColor(params.hue),
          metalness: 0.05,
          roughness: 0.7,
        });
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.18, params.width * 0.35, 6, 16), mat);
  belt.rotation.x = Math.PI / 2;
  g.add(belt);
  return g;
}

/** `lite`: loot. `lights`: PointLight tenue (solo equipado en escena). */
export function buildItemMesh(
  item: ItemInstance,
  opts?: { lite?: boolean; lights?: boolean },
): THREE.Group {
  let m: THREE.Group;
  if (item.kind === "sword") {
    m = buildSwordMesh(item.params as SwordParams);
    m.scale.setScalar(0.7);
  } else if (item.kind === "axe") {
    m = buildAxeMesh(item.params as AxeParams);
    m.scale.setScalar(0.65);
  } else if (item.kind === "throw") {
    m = buildThrowMesh(item.params as ThrowParams);
    m.scale.setScalar(0.85);
  } else if (item.kind === "bow") {
    m = buildBowMesh(item.params as BowParams);
    m.scale.setScalar(1.05);
  } else if (item.kind === "crossbow") {
    m = buildCrossbowMesh(item.params as CrossbowParams);
    m.scale.setScalar(0.95);
  } else if (item.kind === "boots") {
    m = buildBootsMesh(item.params as BootsParams);
    m.scale.setScalar(1.1);
  } else if (item.kind === "shield") {
    m = buildShieldMesh(item.params as ShieldParams);
    m.scale.setScalar(0.85);
  } else if (item.kind === "helmet") {
    m = buildHelmetMesh(item.params as HelmetParams);
    m.scale.setScalar(1.15);
  } else if (item.kind === "armor") {
    m = buildArmorMesh(item.params as ArmorParams);
    m.scale.setScalar(0.9);
  } else if (item.kind === "pants") {
    m = buildPantsMesh(item.params as PantsParams);
    m.scale.setScalar(1);
  } else if (item.kind === "gloves") {
    m = buildGlovesMesh(item.params as GlovesParams);
    m.scale.setScalar(1);
  } else {
    m = buildBeltMesh(item.params as BeltParams);
    m.scale.setScalar(1.1);
  }
  applyItemGlow(m, itemHue(item), itemRarity(item), {
    lights: !!opts?.lights && !opts?.lite,
  });
  return m;
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}
