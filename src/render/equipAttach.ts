import * as THREE from "three";
import type {
  ArmorParams,
  BeltParams,
  BootsParams,
  Equipment,
  GlovesParams,
  ItemInstance,
  PantsParams,
} from "../shared/types";
import type { HeroHandle } from "./loadHero";
import {
  buildItemMesh,
  buildWornBeltMesh,
  disposeObject3D,
} from "./itemMesh";
import {
  buildSkinnedArmor,
  buildSkinnedBoots,
  buildSkinnedGloves,
  buildSkinnedPants,
} from "./skinnedGear";

export type EquipMeshes = {
  weapon: THREE.Group;
  offhand: THREE.Group;
  helmet: THREE.Group;
  armor: THREE.Group;
  belt: THREE.Group;
  pants: THREE.Group;
  bootL: THREE.Group;
  bootR: THREE.Group;
  gloveL: THREE.Group;
  gloveR: THREE.Group;
};

export function emptyEquipMeshes(): EquipMeshes {
  return {
    weapon: new THREE.Group(),
    offhand: new THREE.Group(),
    helmet: new THREE.Group(),
    armor: new THREE.Group(),
    belt: new THREE.Group(),
    pants: new THREE.Group(),
    bootL: new THREE.Group(),
    bootR: new THREE.Group(),
    gloveL: new THREE.Group(),
    gloveR: new THREE.Group(),
  };
}

export function mountEquipMeshes(hero: HeroHandle, m: EquipMeshes): void {
  hero.handGrip.add(m.weapon);
  hero.offhandGrip.add(m.offhand);
  hero.headGrip.add(m.helmet);
  hero.beltGrip.add(m.belt);
  // Armadura / pantalón / botas / guantes: capa skinned
  hero.skinnedLayer.add(m.armor);
  hero.skinnedLayer.add(m.pants);
  hero.skinnedLayer.add(m.bootL);
  hero.skinnedLayer.add(m.bootR);
  hero.skinnedLayer.add(m.gloveL);
  hero.skinnedLayer.add(m.gloveR);
}

function replaceGripChild(
  parent: THREE.Group,
  prev: THREE.Group,
  next: THREE.Group,
): THREE.Group {
  parent.remove(prev);
  disposeObject3D(prev);
  parent.add(next);
  return next;
}

type WeaponOffsetKey =
  | "sword"
  | "dagger"
  | "axe"
  | "smallAxe"
  | "bow"
  | "crossbow"
  | "throw";

/** Offset local por tipo de arma. */
const weaponOffsets: Record<WeaponOffsetKey, { x: number; y: number; z: number }> = {
  sword: { x: -0.4, y: 0.4, z: -0.115 },
  dagger: { x: -0.4, y: 0.4, z: -0.115 },
  axe: { x: 0.16, y: 0.36, z: -0.1 },
  smallAxe: { x: -0.12, y: 0.36, z: -0.15 },
  bow: { x: -0.26, y: 0.45, z: -0.01 },
  crossbow: { x: -0.4, y: 0.4, z: -0.115 },
  throw: { x: -0.4, y: 0.4, z: -0.1 },
};

function weaponOffsetKey(w: ItemInstance): WeaponOffsetKey {
  if (w.kind === "axe") {
    const haft = (w.params as { haftLength?: number }).haftLength ?? 0.6;
    return haft < 0.545 ? "smallAxe" : "axe";
  }
  if (w.kind === "sword") {
    const len = (w.params as { bladeLength?: number }).bladeLength ?? 1;
    return len < 0.545 ? "dagger" : "sword";
  }
  if (w.kind === "club") return "axe";
  if (w.kind === "bow" || w.kind === "crossbow" || w.kind === "throw") return w.kind;
  return "sword";
}
/** Rotación horneada del hacha y de la hacha chica, en radianes. */
const axeRotation = { x: 3.1384, y: -3.1216, z: -1.4716 };
const smallAxeRotation = { x: 3.1384, y: -3.1416, z: -1.4716 };
/** Rotación horneada del arco, en radianes. */
const bowRotation = { x: -0.0016, y: -0.0016, z: -0.5016 };

/** Offset local del arma / daga de segunda mano. */
export const offhandHandOffset = { x: 0.4, y: 0.355, z: -0.04 };

/** Empuñadura a dos manos, por tipo. hx/hy/hz = mano izquierda en el arma; p/r = pose del arma en la derecha. */
export type TwoHandTune = {
  hx: number;
  hy: number;
  hz: number;
  /** Mano derecha, en espacio del torso. */
  ax: number;
  ay: number;
  az: number;
  px: number;
  py: number;
  pz: number;
  rx: number;
  ry: number;
  rz: number;
};

const twoHandPose = {
  ax: 0,
  ay: -0.12,
  az: 0.7,
  px: 0.42,
  py: 0.015,
  pz: 0.05,
  rx: 0.28,
  ry: -0.12,
  rz: 0.5,
};

const twoHandTunes: Record<WeaponOffsetKey, TwoHandTune> = {
  sword: {
    hx: -0.09,
    hy: 0.17,
    hz: -0.18,
    ax: 0,
    ay: -0.12,
    az: 0.7,
    px: 0.46,
    py: 0.2,
    pz: -0.02,
    rx: 0.16,
    ry: -0.41,
    rz: 0.59,
  },
  dagger: { hx: 0, hy: 0, hz: -0.16, ...twoHandPose },
  axe: {
    hx: 0.07,
    hy: 0.31,
    hz: -0.22,
    ax: -0.28,
    ay: -0.1,
    az: 0.82,
    px: 0.2,
    py: 0.08,
    pz: -0.05,
    rx: 0.28,
    ry: -0.12,
    rz: 0.5,
  },
  smallAxe: { hx: 0, hy: 0.26, hz: 0, ...twoHandPose },
  bow: { hx: 0, hy: 0, hz: -0.16, ...twoHandPose },
  crossbow: { hx: 0, hy: 0, hz: -0.16, ...twoHandPose },
  throw: { hx: 0, hy: 0, hz: -0.16, ...twoHandPose },
};

/**
 * Aplica meshes de equipo a los grips del héroe.
 * AJUSTE MANUAL de offsets: editar SOLO acá (juego + preview).
 */
export function attachEquippedVisuals(
  hero: HeroHandle,
  meshes: EquipMeshes,
  equipment: Pick<
    Equipment,
    "weapon" | "offhand" | "helmet" | "armor" | "belt" | "pants" | "boots" | "gloves"
  >,
): EquipMeshes {
  const w = equipment.weapon;
  const o = equipment.offhand;
  const h = equipment.helmet;
  const a = equipment.armor;
  const belt = equipment.belt;
  const pants = equipment.pants;
  const b = equipment.boots;
  const gloves = equipment.gloves;
  const next = { ...meshes };

  // ARMA → handGrip
  if (
    w &&
    (w.kind === "sword" ||
      w.kind === "axe" ||
      w.kind === "club" ||
      w.kind === "throw" ||
      w.kind === "bow" ||
      w.kind === "crossbow")
  ) {
    const mesh = buildItemMesh(w, { lights: true });
    // Palm bone scale≈0.37: throw/arco/xbow compensan; hacha = mismo frame que throw
    const scale =
      w.kind === "throw" ? 2.6 : w.kind === "bow" ? 2.35 : w.kind === "crossbow" ? 2.15 : 1.15;
    mesh.scale.setScalar(scale);
    const off = weaponOffsets[weaponOffsetKey(w)];
    mesh.position.set(off.x, off.y, off.z);
    if (w.kind === "bow") {
      mesh.rotation.set(bowRotation.x, bowRotation.y, bowRotation.z);
    } else if (w.kind === "axe" || w.kind === "club") {
      const haft = (w.params as { haftLength?: number; length?: number }).haftLength
        ?? (w.params as { length?: number }).length
        ?? 0.6;
      const rot = haft < 0.545 ? smallAxeRotation : axeRotation;
      mesh.rotation.set(rot.x, rot.y, rot.z);
    } else {
      // PalmR −X ≈ cara (+Z). Tip geom espada/throw/xbow = +Z → Ry(-90).
      mesh.rotation.set(0, -Math.PI / 2, 0);
    }
    mesh.userData.twoHandGrip = twoHandTunes[weaponOffsetKey(w)];
    next.weapon = replaceGripChild(hero.handGrip, meshes.weapon, mesh);
  } else {
    next.weapon = replaceGripChild(hero.handGrip, meshes.weapon, new THREE.Group());
  }

  // OFFHAND
  if (o?.kind === "shield") {
    const mesh = buildItemMesh(o, { lights: true });
    mesh.scale.setScalar(1.25);
    // Frame de grip = palm (como mano dcha); offset viejo del grip escudo horneado
    mesh.position.set(0, -0.2, 0.02);
    mesh.rotation.set(-0.0708, 0, Math.PI / 2);
    next.offhand = replaceGripChild(hero.offhandGrip, meshes.offhand, mesh);
  } else if (o && (o.kind === "sword" || o.kind === "axe" || o.kind === "throw")) {
    const mesh = buildItemMesh(o, { lights: true });
    mesh.scale.setScalar(o.kind === "throw" ? 2.4 : 1.05);
    // PalmL espeja: punta al frente = Ry(+90). Hacha: Rx antes, el mango nace en +Y.
    mesh.position.set(offhandHandOffset.x, offhandHandOffset.y, offhandHandOffset.z);
    mesh.rotation.set(o.kind === "axe" ? -Math.PI / 2 : 0, Math.PI / 2, 0);
    next.offhand = replaceGripChild(hero.offhandGrip, meshes.offhand, mesh);
  } else {
    next.offhand = replaceGripChild(hero.offhandGrip, meshes.offhand, new THREE.Group());
  }

  // CASCO
  if (h?.kind === "helmet") {
    const mesh = buildItemMesh(h, { lights: true });
    mesh.scale.setScalar(1.35);
    mesh.position.set(0, 0.1, 0.02);
    mesh.rotation.set(0, 0, 0);
    next.helmet = replaceGripChild(hero.headGrip, meshes.helmet, mesh);
  } else {
    next.helmet = replaceGripChild(hero.headGrip, meshes.helmet, new THREE.Group());
  }

  // ARMADURA / BOTAS / GUANTES → skinnedLayer (misma deformación que el body)
  if (a?.kind === "armor" && hero.bodySkins.length) {
    next.armor = replaceGripChild(
      hero.skinnedLayer,
      meshes.armor,
      buildSkinnedArmor(hero.bodySkins, a.params as ArmorParams),
    );
  } else {
    next.armor = replaceGripChild(hero.skinnedLayer, meshes.armor, new THREE.Group());
  }

  // CINTURÓN (sigue en hueso Abdomen; anillo rígido OK)
  if (belt?.kind === "belt") {
    const mesh = buildWornBeltMesh(belt.params as BeltParams);
    mesh.scale.setScalar(1.15);
    mesh.position.set(0, 0.06, 0);
    mesh.rotation.set(0, 0, 0);
    next.belt = replaceGripChild(hero.beltGrip, meshes.belt, mesh);
  } else {
    next.belt = replaceGripChild(hero.beltGrip, meshes.belt, new THREE.Group());
  }

  if (pants?.kind === "pants" && hero.bodySkins.length) {
    next.pants = replaceGripChild(
      hero.skinnedLayer,
      meshes.pants,
      buildSkinnedPants(hero.bodySkins, pants.params as PantsParams),
    );
  } else {
    next.pants = replaceGripChild(hero.skinnedLayer, meshes.pants, new THREE.Group());
  }

  if (b?.kind === "boots" && hero.bodySkins.length) {
    const shell = buildSkinnedBoots(hero.bodySkins, b.params as BootsParams);
    next.bootL = replaceGripChild(hero.skinnedLayer, meshes.bootL, shell);
    next.bootR = replaceGripChild(hero.skinnedLayer, meshes.bootR, new THREE.Group());
  } else {
    next.bootL = replaceGripChild(hero.skinnedLayer, meshes.bootL, new THREE.Group());
    next.bootR = replaceGripChild(hero.skinnedLayer, meshes.bootR, new THREE.Group());
  }

  if (gloves?.kind === "gloves" && hero.bodySkins.length) {
    const shell = buildSkinnedGloves(hero.bodySkins, gloves.params as GlovesParams);
    next.gloveL = replaceGripChild(hero.skinnedLayer, meshes.gloveL, shell);
    next.gloveR = replaceGripChild(hero.skinnedLayer, meshes.gloveR, new THREE.Group());
  } else {
    next.gloveL = replaceGripChild(hero.skinnedLayer, meshes.gloveL, new THREE.Group());
    next.gloveR = replaceGripChild(hero.skinnedLayer, meshes.gloveR, new THREE.Group());
  }

  return next;
}

export function equipKey(
  equipment: Pick<
    Equipment,
    "weapon" | "offhand" | "helmet" | "armor" | "belt" | "pants" | "boots" | "gloves"
  >,
): string {
  const id = (i: ItemInstance | null | undefined) => i?.id ?? "";
  return `${id(equipment.weapon)}|${id(equipment.offhand)}|${id(equipment.helmet)}|${id(equipment.armor)}|${id(equipment.belt)}|${id(equipment.pants)}|${id(equipment.boots)}|${id(equipment.gloves)}`;
}
