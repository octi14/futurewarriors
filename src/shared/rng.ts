import type { Rarity } from "./types";

/** Orden de rareza (bajo → alto). */
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
 * Pesos acumulados — mythic casi nunca.
 * vulgar 18%, common 28%, regular 20%, uncommon 16%, rare 9%,
 * exceptional 5%, epic 2.5%, legendary 1.2%, mythic 0.3%
 */
const RARITY_CDF: { at: number; rarity: Rarity }[] = [
  { at: 0.18, rarity: "vulgar" },
  { at: 0.46, rarity: "common" },
  { at: 0.66, rarity: "regular" },
  { at: 0.82, rarity: "uncommon" },
  { at: 0.91, rarity: "rare" },
  { at: 0.96, rarity: "exceptional" },
  { at: 0.985, rarity: "epic" },
  { at: 0.997, rarity: "legendary" },
  { at: 1, rarity: "mythic" },
];

export function pickRarity(r: () => number): Rarity {
  const n = r();
  for (const row of RARITY_CDF) {
    if (n < row.at) return row.rarity;
  }
  return "mythic";
}

/** Multiplicador de stats — curva suave. */
export function rarityMult(rarity: Rarity): number {
  const table: Record<Rarity, number> = {
    vulgar: 0.85,
    common: 1,
    regular: 1.08,
    uncommon: 1.18,
    rare: 1.32,
    exceptional: 1.45,
    epic: 1.62,
    legendary: 1.85,
    mythic: 2.15,
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
