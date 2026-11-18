import * as THREE from "three";
import type {
  ArmorParams,
  BeltParams,
  BootsParams,
  Equipment,
  ItemInstance,
} from "../shared/types";
import type { HeroHandle } from "./loadHero";
import {
  buildItemMesh,
  buildWornArmorMesh,
  buildWornBeltMesh,
  buildWornBootMesh,
  disposeObject3D,
} from "./itemMesh";

export type EquipMeshes = {
  weapon: THREE.Group;
  offhand: THREE.Group;
  helmet: THREE.Group;
  armor: THREE.Group;
  belt: THREE.Group;
  bootL: THREE.Group;
  bootR: THREE.Group;
};

export function emptyEquipMeshes(): EquipMeshes {
  return {
    weapon: new THREE.Group(),
    offhand: new THREE.Group(),
    helmet: new THREE.Group(),
    armor: new THREE.Group(),
    belt: new THREE.Group(),
    bootL: new THREE.Group(),
    bootR: new THREE.Group(),
  };
}

export function mountEquipMeshes(hero: HeroHandle, m: EquipMeshes): void {
  hero.handGrip.add(m.weapon);
  hero.offhandGrip.add(m.offhand);
  hero.headGrip.add(m.helmet);
  hero.torsoGrip.add(m.armor);
  hero.beltGrip.add(m.belt);
  hero.bootGripL.add(m.bootL);
  hero.bootGripR.add(m.bootR);
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

/**
 * Aplica meshes de equipo a los grips del héroe.
 * AJUSTE MANUAL de offsets: editar SOLO acá (juego + preview).
 */
export function attachEquippedVisuals(
  hero: HeroHandle,
  meshes: EquipMeshes,
  equipment: Pick<Equipment, "weapon" | "offhand" | "helmet" | "armor" | "belt" | "boots">,
): EquipMeshes {
  const w = equipment.weapon;
  const o = equipment.offhand;
  const h = equipment.helmet;
  const a = equipment.armor;
  const belt = equipment.belt;
  const b = equipment.boots;
  const next = { ...meshes };

  // ARMA → handGrip
  if (
    w &&
    (w.kind === "sword" ||
      w.kind === "axe" ||
      w.kind === "throw" ||
      w.kind === "bow" ||
      w.kind === "crossbow")
  ) {
    const mesh = buildItemMesh(w, { lights: true });
    // Palm bone scale≈0.37: arcos/ballestas se autorían chicos → compensar fuerte
    const scale =
      w.kind === "throw" ? 2.6 : w.kind === "bow" ? 5.2 : w.kind === "crossbow" ? 4.2 : 1.15;
    mesh.scale.setScalar(scale);
    if (w.kind === "bow") {
      mesh.position.set(0.05, 0.05, 0.08);
      mesh.rotation.set(0, 0, Math.PI / 2);
    } else {
      // PalmR −X ≈ cara (+Z). Tip geom espada/throw/xbow = +Z → Ry(-90).
      // Hacha: haft +Y + Rx(-90) autor → +Z, luego Ry(+90) → −X palm.
      mesh.position.set(0.06, 0, 0.02);
      if (w.kind === "axe") mesh.rotation.set(-Math.PI / 2, Math.PI / 2, 0);
      else mesh.rotation.set(0, -Math.PI / 2, 0);
    }
    next.weapon = replaceGripChild(hero.handGrip, meshes.weapon, mesh);
  } else {
    next.weapon = replaceGripChild(hero.handGrip, meshes.weapon, new THREE.Group());
  }

  // OFFHAND
  if (o?.kind === "shield") {
    const mesh = buildItemMesh(o, { lights: true });
    mesh.scale.setScalar(1.25);
    mesh.position.set(0, 0, -0.26);
    mesh.rotation.set(0, -1.5, 0);
    next.offhand = replaceGripChild(hero.offhandGrip, meshes.offhand, mesh);
  } else if (o && (o.kind === "sword" || o.kind === "axe")) {
    const mesh = buildItemMesh(o, { lights: true });
    mesh.scale.setScalar(o.kind === "axe" ? 0.95 : 1.05);
    mesh.position.set(0.12, 0.04, 0.02);
    if (o.kind === "axe") mesh.rotation.set(-Math.PI / 2, Math.PI / 2, 0);
    else mesh.rotation.set(0, -Math.PI / 2, 0);
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

  // -------------------------------------------------------------------------
  // ARMADURA → torsoGrip (ARMOR_FIT en espacio hueso). y↑ / z↑ afuera
  // -------------------------------------------------------------------------
  if (a?.kind === "armor") {
    const mesh = buildWornArmorMesh(a.params as ArmorParams);
    mesh.scale.setScalar(1);
    mesh.position.set(0, 0, -0.02);
    mesh.rotation.set(0, 0, 0);
    next.armor = replaceGripChild(hero.torsoGrip, meshes.armor, mesh);
  } else {
    next.armor = replaceGripChild(hero.torsoGrip, meshes.armor, new THREE.Group());
  }

  // CINTURÓN
  if (belt?.kind === "belt") {
    const mesh = buildWornBeltMesh(belt.params as BeltParams);
    mesh.scale.setScalar(1.15);
    mesh.position.set(0, 0.06, 0);
    mesh.rotation.set(0, 0, 0);
    next.belt = replaceGripChild(hero.beltGrip, meshes.belt, mesh);
  } else {
    next.belt = replaceGripChild(hero.beltGrip, meshes.belt, new THREE.Group());
  }

  // BOTAS
  if (b?.kind === "boots") {
    const params = b.params as BootsParams;
    next.bootL = replaceGripChild(hero.bootGripL, meshes.bootL, buildWornBootMesh(params));
    next.bootR = replaceGripChild(hero.bootGripR, meshes.bootR, buildWornBootMesh(params));
  } else {
    next.bootL = replaceGripChild(hero.bootGripL, meshes.bootL, new THREE.Group());
    next.bootR = replaceGripChild(hero.bootGripR, meshes.bootR, new THREE.Group());
  }

  return next;
}

export function equipKey(
  equipment: Pick<Equipment, "weapon" | "offhand" | "helmet" | "armor" | "belt" | "boots">,
): string {
  const id = (i: ItemInstance | null | undefined) => i?.id ?? "";
  return `${id(equipment.weapon)}|${id(equipment.offhand)}|${id(equipment.helmet)}|${id(equipment.armor)}|${id(equipment.belt)}|${id(equipment.boots)}`;
}
