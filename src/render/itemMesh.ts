import * as THREE from "three";
import type {
  ArmorParams,
  AxeParams,
  BeltParams,
  BootsParams,
  GlovesParams,
  HelmetParams,
  ItemInstance,
  PantsParams,
  Rarity,
  ShieldParams,
  SwordParams,
  ThrowParams,
} from "../shared/types";
import { buildSwordMesh } from "./swordMesh";

export function metalColor(hue: number, rarity: Rarity): THREE.Color {
  // Colores más vivos según rareza
  const sat = rarity === "epic" ? 0.55 : rarity === "rare" ? 0.42 : rarity === "uncommon" ? 0.32 : 0.22;
  const lit = rarity === "epic" ? 0.58 : rarity === "rare" ? 0.52 : 0.48;
  const base = new THREE.Color().setHSL(hue, sat, lit);
  if (rarity === "uncommon") base.offsetHSL(0.05, 0.05, 0.02);
  if (rarity === "rare") base.offsetHSL(0.02, 0.08, 0.04);
  if (rarity === "epic") base.offsetHSL(-0.02, 0.1, 0.06);
  return base;
}

function leatherColor(hue: number): THREE.Color {
  return new THREE.Color().setHSL(0.06 + hue * 0.08, 0.45, 0.28);
}

function makeSingleBoot(
  params: BootsParams,
  leather: THREE.Material,
  soleMat: THREE.Material,
  metal: THREE.Material,
  x = 0,
): THREE.Group {
  const boot = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, params.height, 0.18),
    params.style === "plate" ? metal : leather,
  );
  shaft.position.y = params.height / 2 + params.sole;
  boot.add(shaft);
  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.08, 0.28),
    params.style === "plate" ? metal : leather,
  );
  foot.position.set(0, params.sole + 0.04, 0.06);
  boot.add(foot);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.15, params.sole, 0.3), soleMat);
  sole.position.set(0, params.sole / 2, 0.05);
  boot.add(sole);
  boot.position.x = x;
  return boot;
}

function buildBootsMesh(params: BootsParams): THREE.Group {
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({
    color: leatherColor(params.leatherHue),
    roughness: 0.9,
  });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({
    color: metalColor(params.leatherHue, params.rarity),
    metalness: params.style === "plate" ? 0.7 : 0.15,
    roughness: 0.45,
  });
  g.add(makeSingleBoot(params, leather, soleMat, metal, -0.12));
  g.add(makeSingleBoot(params, leather, soleMat, metal, 0.12));
  return g;
}

export function buildWornBootMesh(params: BootsParams): THREE.Group {
  const leather = new THREE.MeshStandardMaterial({
    color: leatherColor(params.leatherHue),
    roughness: 0.9,
  });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({
    color: metalColor(params.leatherHue, params.rarity),
    metalness: params.style === "plate" ? 0.7 : 0.15,
    roughness: 0.45,
  });
  const boot = makeSingleBoot(params, leather, soleMat, metal, 0);
  boot.scale.setScalar(1.15);
  return boot;
}

export function buildWornArmorMesh(params: ArmorParams): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color:
      params.style === "leather"
        ? leatherColor(params.hue)
        : metalColor(params.hue, params.rarity),
    metalness: params.style === "plate" ? 0.72 : params.style === "chain" ? 0.55 : 0.12,
    roughness: params.style === "leather" ? 0.85 : 0.38,
  });
  const h = 0.55 * params.bulk + 0.42;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, h, 0.28), mat);
  chest.position.y = 0.02;
  g.add(chest);
  for (const x of [-0.28, 0.28]) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), mat);
    pad.position.set(x, h * 0.28, 0);
    g.add(pad);
  }
  if (params.style !== "leather") {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.24), mat);
    skirt.position.y = -h * 0.42;
    g.add(skirt);
  }
  g.scale.setScalar(1.05);
  return g;
}

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
  const tube = Math.max(0.035, params.width * 0.55);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.22, tube, 8, 20), mat);
  belt.rotation.x = Math.PI / 2;
  g.add(belt);
  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, tube * 2.2, 0.06),
    new THREE.MeshStandardMaterial({
      color: metalColor(params.hue, params.rarity),
      metalness: 0.8,
      roughness: 0.3,
    }),
  );
  buckle.position.set(0, 0, 0.22);
  g.add(buckle);
  return g;
}

function buildShieldMesh(params: ShieldParams): THREE.Group {
  const g = new THREE.Group();
  const face = new THREE.MeshStandardMaterial({
    color: metalColor(params.metalHue, params.rarity),
    metalness: 0.55,
    roughness: 0.4,
  });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
  let body: THREE.Mesh;
  if (params.shape === "round") {
    body = new THREE.Mesh(
      new THREE.CylinderGeometry(params.width * 0.55, params.width * 0.55, 0.06, 20),
      face,
    );
    body.rotation.x = Math.PI / 2;
  } else if (params.shape === "kite") {
    body = new THREE.Mesh(new THREE.BoxGeometry(params.width * 0.7, params.height, 0.06), wood);
  } else {
    body = new THREE.Mesh(new THREE.BoxGeometry(params.width, params.height * 0.85, 0.06), face);
  }
  g.add(body);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(params.boss, 10, 10), face);
  boss.position.z = 0.05;
  g.add(boss);
  return g;
}

function buildHelmetMesh(params: HelmetParams): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: metalColor(params.metalHue, params.rarity),
    metalness: 0.75,
    roughness: 0.35,
  });
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
  const metal = new THREE.MeshStandardMaterial({
    color: metalColor(params.metalHue, params.rarity),
    metalness: 0.8,
    roughness: 0.32,
  });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c3b22, roughness: 0.85 });
  const haft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, params.haftLength, 8),
    wood,
  );
  haft.position.y = params.haftLength / 2;
  g.add(haft);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(
      params.headStyle === "double" ? params.headSize * 2.2 : params.headSize * 1.4,
      params.headSize * 0.9,
      params.headSize * 0.35,
    ),
    metal,
  );
  head.position.y = params.haftLength * 0.92;
  g.add(head);
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
  const metal = new THREE.MeshStandardMaterial({
    color: metalColor(params.metalHue, params.rarity),
    metalness: 0.85,
    roughness: 0.3,
  });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c3b22, roughness: 0.85 });
  const s = 0.15 + params.size * 0.2;
  if (params.subtype === "shuriken") {
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(s * 2.2, 0.03, s * 0.45), metal);
      blade.rotation.y = (i * Math.PI) / 2;
      g.add(blade);
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.25, 8, 8), metal));
  } else if (params.subtype === "javelin") {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.9 + s, 6), wood);
    shaft.rotation.x = Math.PI / 2;
    g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 6), metal);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.5 + s * 0.4;
    g.add(tip);
  } else if (params.subtype === "throwingDagger") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.35 + s * 0.2), metal);
    blade.position.z = 0.15;
    g.add(blade);
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
  }
  return g;
}

function buildArmorMesh(params: ArmorParams): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color:
      params.style === "leather"
        ? leatherColor(params.hue)
        : metalColor(params.hue, params.rarity),
    metalness: params.style === "plate" ? 0.7 : params.style === "chain" ? 0.5 : 0.1,
    roughness: params.style === "leather" ? 0.85 : 0.4,
  });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55 * params.bulk + 0.35, 0.22), mat);
  g.add(chest);
  return g;
}

function buildPantsMesh(params: PantsParams): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color:
      params.style === "cloth"
        ? new THREE.Color().setHSL(0.6, 0.15, 0.35)
        : params.style === "leather"
          ? leatherColor(params.hue)
          : metalColor(params.hue, params.rarity),
    metalness: params.style === "plated" ? 0.55 : 0.05,
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
  const mat = new THREE.MeshStandardMaterial({
    color:
      params.style === "cloth"
        ? new THREE.Color().setHSL(0.1, 0.2, 0.4)
        : params.style === "leather"
          ? leatherColor(params.hue)
          : metalColor(params.hue, params.rarity),
    metalness: params.style === "gauntlet" ? 0.65 : 0.05,
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
  const mat = new THREE.MeshStandardMaterial({
    color:
      params.style === "rope"
        ? new THREE.Color().setHSL(0.12, 0.35, 0.45)
        : params.style === "leather"
          ? leatherColor(params.hue)
          : metalColor(params.hue, params.rarity),
    metalness: params.style === "plated" ? 0.6 : 0.05,
    roughness: 0.7,
  });
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.18, params.width * 0.35, 6, 16), mat);
  belt.rotation.x = Math.PI / 2;
  g.add(belt);
  return g;
}

export function buildItemMesh(item: ItemInstance): THREE.Group {
  if (item.kind === "sword") {
    const m = buildSwordMesh(item.params as SwordParams);
    m.scale.setScalar(0.7);
    return m;
  }
  if (item.kind === "axe") {
    const m = buildAxeMesh(item.params as AxeParams);
    m.scale.setScalar(0.65);
    return m;
  }
  if (item.kind === "throw") {
    const m = buildThrowMesh(item.params as ThrowParams);
    m.scale.setScalar(0.85);
    return m;
  }
  if (item.kind === "boots") {
    const m = buildBootsMesh(item.params as BootsParams);
    m.scale.setScalar(1.1);
    return m;
  }
  if (item.kind === "shield") {
    const m = buildShieldMesh(item.params as ShieldParams);
    m.scale.setScalar(0.85);
    return m;
  }
  if (item.kind === "helmet") {
    const m = buildHelmetMesh(item.params as HelmetParams);
    m.scale.setScalar(1.15);
    return m;
  }
  if (item.kind === "armor") {
    const m = buildArmorMesh(item.params as ArmorParams);
    m.scale.setScalar(0.9);
    return m;
  }
  if (item.kind === "pants") {
    const m = buildPantsMesh(item.params as PantsParams);
    m.scale.setScalar(1);
    return m;
  }
  if (item.kind === "gloves") {
    const m = buildGlovesMesh(item.params as GlovesParams);
    m.scale.setScalar(1);
    return m;
  }
  const m = buildBeltMesh(item.params as BeltParams);
  m.scale.setScalar(1.1);
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
