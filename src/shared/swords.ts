import type { ItemInstance, Rarity, SwordParams, SwordStats } from "./types";

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

function pickRarity(r: () => number): Rarity {
  const n = r();
  if (n < 0.55) return "common";
  if (n < 0.82) return "uncommon";
  if (n < 0.95) return "rare";
  return "epic";
}

function rarityMult(rarity: Rarity): number {
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

export function generateSwordParams(seed: number): SwordParams {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const bladeRoll = r();
  const bladeType: SwordParams["bladeType"] =
    bladeRoll < 0.45 ? "straight" : bladeRoll < 0.75 ? "curved" : "wide";

  const lengthBase = 0.55 + r() * 0.85;
  const widthBase =
    bladeType === "wide" ? 0.12 + r() * 0.1 : 0.06 + r() * 0.08;

  return {
    seed,
    bladeType,
    bladeLength: lengthBase * (rarity === "epic" ? 1.1 : 1),
    bladeWidth: widthBase,
    guardSpan: 0.18 + r() * 0.28,
    gripLength: 0.18 + r() * 0.16,
    pommelSize: 0.05 + r() * 0.06,
    metalHue: r(),
    rarity,
  };
}

export function statsFromParams(params: SwordParams): SwordStats {
  const m = rarityMult(params.rarity);
  const length = params.bladeLength;
  const width = params.bladeWidth;
  const weightProxy = length * width * 12 + params.guardSpan * 2;

  const damage = (10 + length * 18 + width * 40) * m;
  const reach = 0.55 + length * 0.95;
  const attackSpeed = Math.max(0.55, 1.55 - weightProxy * 0.35);
  const windup = Math.max(0.08, 0.28 - attackSpeed * 0.08 + weightProxy * 0.02);

  return {
    damage: Math.round(damage * 10) / 10,
    reach: Math.round(reach * 100) / 100,
    attackSpeed: Math.round(attackSpeed * 100) / 100,
    windup: Math.round(windup * 100) / 100,
  };
}

const adjectives: Record<Rarity, string[]> = {
  common: ["Oxidada", "Simple", "Tosca"],
  uncommon: ["Afilada", "Firme", "Equilibrada"],
  rare: ["Runada", "Noble", "Voraz"],
  epic: ["Legendaria", "Tempestad", "Ancestral"],
};

const nouns = ["Hoja", "Espada", "Sable", "Tizona"];

export function nameFromParams(params: SwordParams): string {
  const r = rngFromSeed(params.seed ^ 0xabc123);
  const adj = adjectives[params.rarity];
  return `${adj[Math.floor(r() * adj.length)]} ${nouns[Math.floor(r() * nouns.length)]}`;
}

let itemSeq = 1;

export function createSwordItem(seed: number): ItemInstance {
  const params = generateSwordParams(seed);
  return {
    id: `item_${itemSeq++}_${seed}`,
    kind: "sword",
    equipSlot: "weapon",
    seed,
    params,
    stats: statsFromParams(params),
    name: nameFromParams(params),
  };
}

export function randomSwordSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
