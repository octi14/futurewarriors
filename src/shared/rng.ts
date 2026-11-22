import type { Rarity } from "./types";

/**
 * Orden de rareza (bajo → alto).
 * Gates/loot random: niveles 1–8 (vulgar…legendary).
 * Mythic (9) = solo ítems fijos / unique / easter eggs — no sale de `pickRarity`.
 */
export const RARITIES: readonly Rarity[] = [
  "vulgar",
  "common",
  "regular",
  "uncommon",
  "rare",
  "exceptional",
  "epic",
  "legendary",
  "mythic",
] as const;

export const RARITY_LABEL_ES: Record<Rarity, string> = {
  vulgar: "Vulgar",
  common: "Común",
  regular: "Regular",
  uncommon: "Poco común",
  rare: "Raro",
  exceptional: "Excepcional",
  epic: "Épico",
  legendary: "Legendario",
  mythic: "Mítico",
};

export function rarityRank(rarity: Rarity): number {
  const i = RARITIES.indexOf(rarity);
  return i < 0 ? 1 : i;
}

/** 0..1 normalizado por el tope (mythic). */
export function rarityT(rarity: Rarity): number {
  return rarityRank(rarity) / (RARITIES.length - 1);
}

/** RNG determinista simple (mulberry32). */
export function rngFromSeed(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pesos acumulados — solo hasta legendary (mythic no entra al loot random).
 * vulgar 18%, common 28%, regular 20%, uncommon 16%, rare 9%,
 * exceptional 5%, epic 2.5%, legendary 1.5%
 */
const RARITY_CDF: { at: number; rarity: Rarity }[] = [
  { at: 0.18, rarity: "vulgar" },
  { at: 0.46, rarity: "common" },
  { at: 0.66, rarity: "regular" },
  { at: 0.82, rarity: "uncommon" },
  { at: 0.91, rarity: "rare" },
  { at: 0.96, rarity: "exceptional" },
  { at: 0.985, rarity: "epic" },
  { at: 1, rarity: "legendary" },
];

/** Rareza procedural del loot (1–8). Nunca mythic. */
export function pickRarity(r: () => number): Rarity {
  const n = r();
  for (const row of RARITY_CDF) {
    if (n < row.at) return row.rarity;
  }
  return "legendary";
}

/**
 * Escala de magnitud de stats/bonus por rareza (create*Item / rollElement).
 * vulgar 0.82 … mythic 4.2 — cuánto “pesa” cada bonus, no cuántos hay.
 */
export function rarityMult(rarity: Rarity): number {
  const table: Record<Rarity, number> = {
    vulgar: 0.55,
    common: 0.72,
    regular: 0.88,
    uncommon: 1.05,
    rare: 1.22,
    exceptional: 1.45,
    epic: 1.85,
    legendary: 2.45,
    mythic: 3.4,
  };
  return table[rarity];
}

/** Completa adjetivos por rareza a partir de 4 bandas (piso / bajo / alto / cima). */
export function fillRarityAdj(
  floor: string[],
  low: string[],
  high: string[],
  peak: string[],
  extras?: Partial<Record<"legendary" | "mythic" | "exceptional" | "vulgar" | "regular", string[]>>,
): Record<Rarity, string[]> {
  return {
    vulgar: extras?.vulgar ?? floor,
    common: floor,
    regular: extras?.regular ?? low,
    uncommon: low,
    rare: high,
    exceptional: extras?.exceptional ?? high,
    epic: peak,
    legendary: extras?.legendary ?? peak,
    mythic: extras?.mythic ?? peak,
  };
}
