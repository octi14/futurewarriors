import * as THREE from "three";
import type { SwordParams } from "../shared/types";

function metalColor(hue: number, rarity: SwordParams["rarity"]): THREE.Color {
  const sat = rarity === "epic" ? 0.55 : rarity === "rare" ? 0.42 : rarity === "uncommon" ? 0.32 : 0.22;
  const lit = rarity === "epic" ? 0.58 : rarity === "rare" ? 0.52 : 0.48;
  const base = new THREE.Color().setHSL(hue, sat, lit);
  if (rarity === "uncommon") base.offsetHSL(0.05, 0.05, 0.02);
  if (rarity === "rare") base.offsetHSL(0.02, 0.08, 0.04);
  if (rarity === "epic") base.offsetHSL(-0.02, 0.1, 0.06);
  return base;
}

export function buildSwordMesh(params: SwordParams): THREE.Group {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: metalColor(params.metalHue, params.rarity),
    metalness: 0.85,
    roughness: 0.35,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: params.rarity === "epic" ? 0x4a2a12 : 0x5c3b22,
    roughness: 0.85,
  });
  const guardMat = new THREE.MeshStandardMaterial({
    color: metalColor((params.metalHue + 0.2) % 1, params.rarity),
    metalness: 0.7,
    roughness: 0.4,
  });

  const bladeLen = params.bladeLength;
  const bladeW = params.bladeWidth;
  let bladeGeom: THREE.BufferGeometry;
  if (params.bladeType === "curved") {
    bladeGeom = new THREE.BoxGeometry(bladeW, 0.04, bladeLen, 1, 1, 6);
    const pos = bladeGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const t = (z + bladeLen / 2) / bladeLen;
      pos.setX(i, pos.getX(i) + Math.sin(t * Math.PI) * bladeW * 0.9);
    }
    pos.needsUpdate = true;
    bladeGeom.computeVertexNormals();
  } else if (params.bladeType === "wide") {
    bladeGeom = new THREE.BoxGeometry(bladeW * 1.35, 0.045, bladeLen);
  } else {
    bladeGeom = new THREE.BoxGeometry(bladeW, 0.035, bladeLen);
  }

  const blade = new THREE.Mesh(bladeGeom, metal);
  blade.position.z = bladeLen / 2 + params.gripLength * 0.15;
  group.add(blade);

  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(params.guardSpan, 0.06, 0.06),
    guardMat,
  );
  group.add(guard);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.04, params.gripLength, 8),
    gripMat,
  );
  grip.rotation.x = Math.PI / 2;
  grip.position.z = -params.gripLength / 2;
  group.add(grip);

  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(params.pommelSize, 10, 10),
    guardMat,
  );
  pommel.position.z = -params.gripLength - params.pommelSize * 0.2;
  group.add(pommel);

  group.rotation.x = -Math.PI / 2;
  return group;
}
