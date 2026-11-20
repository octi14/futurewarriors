import type { ElementKind, ItemInstance, ItemStats, Rarity } from "./types";
import { rarityMult, rarityT } from "./rng";

export const ELEMENT_COLORS: Record<ElementKind, number> = {
  fire: 0xff6a2a,
  ice: 0x7ec8ff,
  lightning: 0xf5e06b,
  poison: 0x6ddf4a,
};

export const ELEMENT_LABEL_ES: Record<ElementKind, string> = {
  fire: "Fuego",
  ice: "Hielo",
  lightning: "Rayo",
  poison: "Veneno",
};

const ELEMENTS: ElementKind[] = ["fire", "ice", "lightning", "poison"];

/** Chance de que un arma/gear saque elemento según rareza. */
export function rollElement(
  r: () => number,
  rarity: Rarity,
  forWeapon: boolean,
): { element: ElementKind; elementDamage: number } | null {
  const t = rarityT(rarity);
  const chance = forWeapon ? 0.04 + t * 0.35 : 0.02 + t * 0.22;
  if (r() > chance) return null;
  const element = ELEMENTS[Math.floor(r() * ELEMENTS.length)]!;
  const elementDamage = Math.round((2 + r() * 3) * rarityMult(rarity) * 10) / 10;
  return { element, elementDamage };
}

/** Arma: un solo elemento. Suma elementDamage de todo el gear del mismo tipo + otros tipos aparte. */
export function aggregateCombatElements(
  weapon: ItemInstance | null,
  gear: (ItemInstance | null)[],
): {
  /** Elemento que pinta la estela (el del arma, si hay). */
  trailElement: ElementKind | null;
  /** Daño por elemento (arma + bonuses de gear). */
  byElement: Partial<Record<ElementKind, number>>;
  totalElementDamage: number;
} {
  const byElement: Partial<Record<ElementKind, number>> = {};
  const add = (el: ElementKind | null | undefined, dmg: number | undefined) => {
    if (!el || !dmg) return;
    byElement[el] = (byElement[el] ?? 0) + dmg;
  };

  let trailElement: ElementKind | null = null;
  if (weapon?.stats.element) {
    trailElement = weapon.stats.element;
    add(weapon.stats.element, weapon.stats.elementDamage);
  }

  for (const item of gear) {
    if (!item || item === weapon) continue;
    // Offhand arma: no pisa el trail del main; suma daño
    add(item.stats.element, item.stats.elementDamage);
  }

  let totalElementDamage = 0;
  for (const v of Object.values(byElement)) totalElementDamage += v ?? 0;

  return { trailElement, byElement, totalElementDamage };
}

export function withElementStats(
  stats: ItemStats,
  rolled: { element: ElementKind; elementDamage: number } | null,
): ItemStats {
  if (!rolled) return { ...stats, element: null, elementDamage: 0 };
  return {
    ...stats,
    element: rolled.element,
    elementDamage: rolled.elementDamage,
  };
}
