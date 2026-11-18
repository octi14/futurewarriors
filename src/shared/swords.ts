import { pickRarity, rarityMult, rngFromSeed } from "./rng";
import type { ItemInstance, ItemStats, Rarity, SwordParams } from "./types";

export { rngFromSeed, pickRarity, rarityMult } from "./rng";

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

export function statsFromParams(params: SwordParams): ItemStats {
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
    armor: 0,
    moveSpeedMult: 1,
    maxHpBonus: 0,
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

export function nextItemId(seed: number): string {
  return `item_${itemSeq++}_${seed}`;
}

export function createSwordItem(seed: number): ItemInstance {
  const params = generateSwordParams(seed);
  return {
    id: nextItemId(seed),
    kind: "sword",
    equipSlot: "weapon",
    seed,
    params,
    stats: statsFromParams(params),
    name: nameFromParams(params),
    gridW: params.bladeType === "wide" ? 2 : 1,
    gridH: 3,
  };
}

export function randomSwordSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
