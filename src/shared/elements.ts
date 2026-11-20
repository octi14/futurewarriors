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

/**
 * Bonus elemental procedural (hoy: 0 o 1 bonus por ítem).
 *
 * Cuántos: a lo sumo UN elemento; si falla el roll → sin bonus.
 * Chance (sube con rareza, t=0 vulgar … t=1 mythic):
 *   - arma:  4% + t*35%   → ~4% vulgar … ~39% mythic
 *   - gear:  2% + t*22%   → ~2% vulgar … ~24% mythic
 * Magnitud (puntos % de daño físico, se SUMAN entre ítems):
 *   (2..6) * rarityMult(rarity)  → ~1.6% vulgar … ~25% mythic
 *
 * Otros bonus (armor, speed%, HP, woundChance, etc.) se eligen en create*Item
 * según style/tipo; rarityMult escala esos valores base.
 */
export function rollElement(
  r: () => number,
  rarity: Rarity,
  forWeapon: boolean,
): { element: ElementKind; elementDamage: number } | null {
  const t = rarityT(rarity);
  // Chance de que el ítem traiga bonus elemental
  const chance = forWeapon ? 0.04 + t * 0.35 : 0.02 + t * 0.22;
  if (r() > chance) return null;
  const element = ELEMENTS[Math.floor(r() * ELEMENTS.length)]!;
  // Magnitud del bonus en % (aditivo entre piezas)
  const elementDamage = Math.round((2 + r() * 4) * rarityMult(rarity) * 10) / 10;
  return { element, elementDamage };
}

/**
 * Arma: un solo elemento (trail). Los % elementales se SUMAN por tipo
 * y luego se aplican al daño físico: dmgElem = physical * (pctSum/100).
 */
export function aggregateCombatElements(
  weapon: ItemInstance | null,
  gear: (ItemInstance | null)[],
  physicalDamage = 0,
): {
  trailElement: ElementKind | null;
  /** % sumados por elemento. */
  byElementPct: Partial<Record<ElementKind, number>>;
  /** Daño absoluto por elemento (sobre physical). */
  byElement: Partial<Record<ElementKind, number>>;
  totalElementDamage: number;
} {
  const byElementPct: Partial<Record<ElementKind, number>> = {};
  const add = (el: ElementKind | null | undefined, pct: number | undefined) => {
    if (!el || !pct) return;
    byElementPct[el] = (byElementPct[el] ?? 0) + pct;
  };

  let trailElement: ElementKind | null = null;
  if (weapon?.stats.element) {
    trailElement = weapon.stats.element;
    add(weapon.stats.element, weapon.stats.elementDamage);
  }

  for (const item of gear) {
    if (!item || item === weapon) continue;
    add(item.stats.element, item.stats.elementDamage);
  }

  const byElement: Partial<Record<ElementKind, number>> = {};
  let totalElementDamage = 0;
  for (const [el, pct] of Object.entries(byElementPct) as [ElementKind, number][]) {
    const dmg = Math.round(physicalDamage * (pct / 100) * 10) / 10;
    byElement[el] = dmg;
    totalElementDamage += dmg;
  }

  return { trailElement, byElementPct, byElement, totalElementDamage };
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
