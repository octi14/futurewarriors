import type { Rarity } from "./types";

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

export function pickRarity(r: () => number): Rarity {
  const n = r();
  if (n < 0.55) return "common";
  if (n < 0.82) return "uncommon";
  if (n < 0.95) return "rare";
  return "epic";
}

export function rarityMult(rarity: Rarity): number {
  switch (rarity) {
    case "common":
      return 1;
    case "uncommon":
      return 1.15;
    case "rare":
      return 1.35;
    case "epic":
      return 1.6;
  }
}
