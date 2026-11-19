import * as THREE from "three";
import { rarityT } from "../shared/rng";
import type { SwordParams } from "../shared/types";
import { rarityGlowStrength } from "./itemMesh";

function swordMetalColor(params: SwordParams): THREE.Color {
  const sat = params.metalSat ?? 0.08;
  const lit = params.metalLit ?? 0.48;
  const c = new THREE.Color().setHSL(params.metalHue, sat, lit);
  const t = rarityT(params.rarity);
  if (t >= 0.5) c.offsetHSL(0, 0.03 + t * 0.03, 0.02 + t * 0.03);
  return c;
}

function makeSwordMetal(params: SwordParams, polish = 1): THREE.MeshStandardMaterial {
  const color = swordMetalColor(params);
  const rough = 0.4 - rarityT(params.rarity) * 0.3;
  // Metales oscuros más mates; bronces un poco más brillantes
  const lit = params.metalLit ?? 0.48;
  const sat = params.metalSat ?? 0.08;
  const dark = lit < 0.32;
  return new THREE.MeshStandardMaterial({
    color,
    metalness: dark ? 0.78 : sat > 0.25 ? 0.88 : 0.94,
    roughness: Math.max(0.08, (dark ? rough * 1.25 : rough) / polish),
    envMapIntensity: (dark ? 0.7 : 1.1) + polish * 0.25,
    emissive: color.clone().multiplyScalar(0.02 + rarityGlowStrength(params.rarity) * 0.08),
    emissiveIntensity: 0.35 + rarityGlowStrength(params.rarity) * 0.5,
  });
}

function makeSwordEdge(params: SwordParams): THREE.MeshStandardMaterial {
  const c = swordMetalColor(params).clone().offsetHSL(0, -0.02, 0.14);
  const glow = rarityGlowStrength(params.rarity);
  return new THREE.MeshStandardMaterial({
    color: c,
    metalness: 1,
    roughness: 0.08,
    envMapIntensity: 1.35,
    emissive: c.clone().multiplyScalar(0.05 + glow * 0.22),
    emissiveIntensity: 0.35 + glow * 0.55,
  });
}

function makeGripMat(params: SwordParams): THREE.MeshStandardMaterial {
  const hue = params.gripHue ?? 0.08;
  const style = params.gripStyle ?? "leather";
  if (style === "wood") {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.45, 0.28 + (params.ornament ?? 0) * 0.08),
      roughness: 0.9,
      metalness: 0.02,
    });
  }
  if (style === "wrap") {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.35, 0.38),
      roughness: 0.78,
      metalness: 0.04,
    });
  }
  // leather: negro → marrón → bordeaux
  const lit = hue > 0.9 ? 0.18 : 0.22 + (hue % 0.1) * 1.2;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue % 1, hue > 0.9 ? 0.45 : 0.5, lit),
    roughness: 0.88,
    metalness: 0.03,
  });
}

/** Afina el extremo +Z de la hoja hasta una punta. */
function taperToPoint(
  geom: THREE.BufferGeometry,
  bladeLen: number,
  startT = 0.68,
): void {
  const pos = geom.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const t = (z + bladeLen / 2) / bladeLen;
    if (t <= startT) continue;
    const u = (t - startT) / (1 - startT);
    const scale = Math.max(0.04, 1 - u * u);
    pos.setX(i, pos.getX(i) * scale);
    pos.setY(i, pos.getY(i) * (0.35 + scale * 0.65));
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
}

function addGuard(
  group: THREE.Group,
  params: SwordParams,
  guardMat: THREE.MeshStandardMaterial,
  accent: THREE.MeshStandardMaterial,
): void {
  const span = params.guardSpan;
  const style = params.guardStyle ?? "bar";
  if (style === "disc") {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(span * 0.55, span * 0.55, 0.04, 14), guardMat);
    disc.rotation.x = Math.PI / 2;
    group.add(disc);
    return;
  }
  if (style === "cross") {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(span, 0.05, 0.05), guardMat);
    group.add(bar);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, span * 0.45), guardMat);
    stem.position.z = span * 0.08;
    group.add(stem);
    return;
  }
  if (style === "swept") {
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(span * 0.55, 0.04, 0.05), guardMat);
      arm.position.set(side * span * 0.28, 0, 0.02);
      arm.rotation.z = side * 0.35;
      arm.rotation.y = side * 0.25;
      group.add(arm);
    }
    const knuckle = new THREE.Mesh(new THREE.TorusGeometry(span * 0.22, 0.018, 5, 10, Math.PI), accent);
    knuckle.rotation.y = Math.PI / 2;
    knuckle.position.set(0, -0.02, -0.02);
    group.add(knuckle);
    return;
  }
  // bar
  group.add(new THREE.Mesh(new THREE.BoxGeometry(span, 0.055, 0.055), guardMat));
}

export function buildSwordMesh(params: SwordParams): THREE.Group {
  const group = new THREE.Group();
  const metal = makeSwordMetal(params, 1.1);
  const edgeMat = makeSwordEdge(params);
  const gripMat = makeGripMat(params);
  const guardMat = makeSwordMetal(
    {
      ...params,
      metalHue: (params.metalHue + 0.04) % 1,
      metalLit: Math.min(0.7, (params.metalLit ?? 0.45) + 0.06),
      metalSat: Math.min(0.7, (params.metalSat ?? 0.08) + 0.05),
    },
    0.95,
  );
  const accent = makeSwordMetal(
    {
      ...params,
      metalHue: (params.metalHue + 0.12) % 1,
      metalSat: Math.max(params.metalSat ?? 0.1, 0.2),
      metalLit: 0.42,
    },
    1.05,
  );

  const bladeLen = params.bladeLength;
  const bladeW = params.bladeWidth;
  const segs = 10;
  let bladeGeom: THREE.BufferGeometry;
  if (params.bladeType === "curved") {
    bladeGeom = new THREE.BoxGeometry(bladeW, 0.04, bladeLen, 1, 1, segs);
    const pos = bladeGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const t = (z + bladeLen / 2) / bladeLen;
      pos.setX(i, pos.getX(i) + Math.sin(t * Math.PI) * bladeW * 0.9);
    }
    pos.needsUpdate = true;
  } else if (params.bladeType === "wide") {
    bladeGeom = new THREE.BoxGeometry(bladeW * 1.35, 0.045, bladeLen, 1, 1, segs);
  } else {
    bladeGeom = new THREE.BoxGeometry(bladeW, 0.035, bladeLen, 1, 1, segs);
  }
  taperToPoint(bladeGeom, bladeLen, params.bladeType === "wide" ? 0.74 : 0.66);

  const bladeZ = bladeLen / 2 + params.gripLength * 0.15;
  const blade = new THREE.Mesh(bladeGeom, metal);
  blade.position.z = bladeZ;
  group.add(blade);

  const edgeW = Math.max(0.008, bladeW * 0.12);
  const edgeH = params.bladeType === "wide" ? 0.052 : 0.042;
  for (const side of [-1, 1]) {
    const edgeGeom = new THREE.BoxGeometry(edgeW, edgeH, bladeLen * 0.92, 1, 1, segs);
    taperToPoint(edgeGeom, bladeLen * 0.92, 0.62);
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.position.set(
      side * (bladeW * (params.bladeType === "wide" ? 0.55 : 0.42)),
      0,
      bladeZ - bladeLen * 0.02,
    );
    group.add(edge);
  }

  const tipLen = bladeLen * 0.14;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(0.012, bladeW * 0.42), tipLen, 6),
    edgeMat,
  );
  tip.rotation.x = Math.PI / 2;
  tip.position.z = bladeZ + bladeLen * 0.5 - tipLen * 0.15;
  group.add(tip);

  addGuard(group, params, guardMat, accent);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.04, params.gripLength, 8),
    gripMat,
  );
  grip.rotation.x = Math.PI / 2;
  grip.position.z = -params.gripLength / 2;
  group.add(grip);

  // Anillos / wrapping visible
  const ornament = params.ornament ?? 0;
  const style = params.gripStyle ?? "leather";
  if (style === "wrap" || ornament > 0.2) {
    const rings = style === "wrap" ? 4 + Math.floor(ornament * 3) : 1 + Math.floor(ornament * 2);
    for (let i = 0; i < rings; i++) {
      const t = (i + 0.5) / rings;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.042, style === "wrap" ? 0.008 : 0.01, 5, 10),
        style === "wrap" ? gripMat : accent,
      );
      ring.position.z = -params.gripLength * t;
      group.add(ring);
    }
  }

  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(params.pommelSize, 10, 10),
    ornament > 0.4 ? accent : guardMat,
  );
  pommel.position.z = -params.gripLength - params.pommelSize * 0.2;
  group.add(pommel);

  if (ornament > 0.35) {
    // Virola entre guarda y grip
    const ferrule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.042, 0.04, 8),
      accent,
    );
    ferrule.rotation.x = Math.PI / 2;
    ferrule.position.z = -0.02;
    group.add(ferrule);
  }

  if (rarityT(params.rarity) >= 0.5 || ornament > 0.7) {
    const gemHue = (params.metalHue + 0.35 + ornament * 0.2) % 1;
    const gemCol = new THREE.Color().setHSL(gemHue, 0.55, 0.48);
    const gem = new THREE.Mesh(
      new THREE.SphereGeometry(params.pommelSize * 0.42, 8, 8),
      new THREE.MeshStandardMaterial({
        color: gemCol,
        metalness: 0.25,
        roughness: 0.18,
        emissive: gemCol.clone().multiplyScalar(0.35),
      }),
    );
    gem.position.set(0, 0.035, -params.gripLength * 0.15);
    group.add(gem);
  }

  group.rotation.x = -Math.PI / 2;
  return group;
}
