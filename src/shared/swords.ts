import { rollElement, withElementStats } from "./elements";
import { fillRarityAdj, pickRarity, rarityMult, rarityT, rngFromSeed } from "./rng";
import type { ItemInstance, ItemStats, Rarity, SwordParams } from "./types";

export { rngFromSeed, pickRarity, rarityMult } from "./rng";

/** Paleta de metal: mayormente grises/hierros; bronce y tintes raros. */
function rollMetalTone(r: () => number, rarity: Rarity): {
  metalHue: number;
  metalSat: number;
  metalLit: number;
} {
  const tone = r();
  const t = rarityT(rarity);
  // vulgar: casi solo acero; mythic: más chance de tinte
  const tintChance = 0.02 + t * 0.4;

  if (tone < 0.42) {
    // Acero frío gris-azulado
    return {
      metalHue: 0.55 + r() * 0.1,
      metalSat: 0.02 + r() * 0.07,
      metalLit: 0.32 + r() * 0.28,
    };
  }
  if (tone < 0.68) {
    // Hierro oscuro / pavonado
    return {
      metalHue: 0.02 + r() * 0.08,
      metalSat: 0.03 + r() * 0.09,
      metalLit: 0.18 + r() * 0.22,
    };
  }
  if (tone < 0.68 + (1 - tintChance) * 0.22) {
    // Bronce / latón / cobre
    return {
      metalHue: 0.06 + r() * 0.07,
      metalSat: 0.32 + r() * 0.4,
      metalLit: 0.32 + r() * 0.28,
    };
  }
  // Tinte fantasía (poco frecuente)
  return {
    metalHue: r(),
    metalSat: 0.22 + r() * 0.4,
    metalLit: 0.38 + r() * 0.28,
  };
}

function rollGrip(r: () => number): Pick<SwordParams, "gripHue" | "gripStyle"> {
  const styleRoll = r();
  const gripStyle: SwordParams["gripStyle"] =
    styleRoll < 0.5 ? "leather" : styleRoll < 0.78 ? "wrap" : "wood";
  // Cueros: marrón, negro, bordeaux; wraps: oliva/crudo; madera: ámbar
  let gripHue: number;
  if (gripStyle === "leather") {
    gripHue = r() < 0.35 ? 0.02 + r() * 0.04 : r() < 0.7 ? 0.06 + r() * 0.05 : 0.95 + r() * 0.04;
  } else if (gripStyle === "wrap") {
    gripHue = 0.1 + r() * 0.12;
  } else {
    gripHue = 0.07 + r() * 0.06;
  }
  return { gripHue, gripStyle };
}

function rollGuard(r: () => number): SwordParams["guardStyle"] {
  const g = r();
  if (g < 0.35) return "bar";
  if (g < 0.6) return "cross";
  if (g < 0.8) return "disc";
  return "swept";
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

  const metal = rollMetalTone(r, rarity);
  const grip = rollGrip(r);
  const t = rarityT(rarity);
  const ornamentBase = 0.05 + t * 0.75;

  return {
    seed,
    bladeType,
    bladeLength: lengthBase * (1 + t * 0.12),
    bladeWidth: widthBase,
    guardSpan: 0.18 + r() * 0.28,
    gripLength: 0.18 + r() * 0.16,
    pommelSize: 0.05 + r() * 0.06,
    ...metal,
    ...grip,
    guardStyle: rollGuard(r),
    ornament: Math.min(1, ornamentBase + r() * 0.35),
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

const adjectives = fillRarityAdj(
  ["Oxidada", "Simple", "Tosca"],
  ["Afilada", "Firme", "Equilibrada"],
  ["Runada", "Noble", "Voraz"],
  ["Tempestad", "Ancestral", "Radiante"],
  {
    vulgar: ["Oxidada", "Mellada", "Torcida"],
    regular: ["Servible", "Pulida", "Correcta"],
    exceptional: ["Magistral", "Excelsa", "Voraz"],
    legendary: ["Legendaria", "Eterna", "Soberana"],
    mythic: ["Mítica", "Primordial", "Absoluta"],
  },
);

export function nameFromParams(params: SwordParams): string {
  const r = rngFromSeed(params.seed ^ 0xabc123);
  if (params.rarity === "mythic") {
    const names = adjectives.mythic;
    return names[Math.floor(r() * names.length)]!;
  }
  const adj = adjectives[params.rarity];
  return `${adj[Math.floor(r() * adj.length)]} Espada`;
}

let itemSeq = 1;

export function nextItemId(seed: number): string {
  return `item_${itemSeq++}_${seed}`;
}

export function createSwordItem(seed: number): ItemInstance {
  const params = generateSwordParams(seed);
  const r = rngFromSeed(seed ^ 0xe1e3);
  return {
    id: nextItemId(seed),
    kind: "sword",
    equipSlot: "weapon",
    seed,
    params,
    stats: withElementStats(statsFromParams(params), rollElement(r, params.rarity, true)),
    name: nameFromParams(params),
    gridW: params.bladeType === "wide" ? 2 : 1,
    gridH: 3,
  };
}

/** Puñal / daga corta — dual wieldable. */
export function createDaggerItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const metal = rollMetalTone(r, rarity);
  const grip = rollGrip(r);
  const params: SwordParams = {
    seed,
    bladeType: r() < 0.55 ? "straight" : "curved",
    bladeLength: 0.32 + r() * 0.22,
    bladeWidth: 0.045 + r() * 0.04,
    guardSpan: 0.1 + r() * 0.1,
    gripLength: 0.12 + r() * 0.08,
    pommelSize: 0.035 + r() * 0.03,
    ...metal,
    ...grip,
    guardStyle: rollGuard(r),
    ornament: Math.min(1, 0.08 + rarityT(rarity) * 0.7 + r() * 0.25),
    rarity,
  };
  const adj = adjectives[rarity];
  const name =
    rarity === "mythic"
      ? adjectives.mythic[Math.floor(r() * adjectives.mythic.length)]!
      : `${adj[Math.floor(r() * adj.length)]} Daga`;
  return {
    id: nextItemId(seed),
    kind: "sword",
    equipSlot: "weapon",
    seed,
    params,
    stats: withElementStats(statsFromParams(params), rollElement(r, rarity, true)),
    name,
    gridW: 1,
    gridH: 2,
  };
}

export function randomSwordSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
