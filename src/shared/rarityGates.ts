import type {
  ArmorParams,
  BootsParams,
  GlovesParams,
  HelmetParams,
  PantsParams,
  Rarity,
} from "./types";
import { rarityRank } from "./rng";

/**
 * Nivel de rareza 1-based para los gates de loot procedural:
 *   1 vulgar · 2 common · 3 regular · 4 uncommon · 5 rare
 *   6 exceptional · 7 epic · 8 legendary
 * Mythic (=9) NO entra acá: son ítems fijos / unique / easter eggs.
 */
export type RarityLevel = number;
/** [mínimo, máximo] inclusive, solo 1..8 */
export type RarityRange = readonly [min: RarityLevel, max: RarityLevel];

/** Tope de gates / loot random (legendary). Mythic queda fuera. */
export const RARITY_LEVEL_MAX = 8;

/** vulgar=1 … mythic=9 (mythic solo para display/unique; no para gates). */
export function rarityLevel(rarity: Rarity): RarityLevel {
  return rarityRank(rarity) + 1;
}

/**
 * Esquema de loot por rareza (1–8):
 * - `pickRarity` solo tira hasta legendary.
 * - `pickStyleForRarity` elige styles cuyo [min,max] contenga ese nivel.
 * - Mythic / easter eggs: no usan este filtro (style libre o override fijo).
 */
export function styleAllowed(rarity: Rarity, range: RarityRange): boolean {
  if (rarity === "mythic") return true;
  const lv = rarityLevel(rarity);
  const min = Math.max(1, Math.min(RARITY_LEVEL_MAX, range[0]));
  const max = Math.max(1, Math.min(RARITY_LEVEL_MAX, range[1]));
  return lv >= min && lv <= max;
}

const FULL: RarityRange = [1, RARITY_LEVEL_MAX];

/** Armadura: ropa liviana abajo; metal / placas solo rarezas altas. */
export const ARMOR_RARITY: Partial<Record<ArmorParams["style"], RarityRange>> = {
  shirt: [1, 4],
  hoodie: [1, 5],
  tunic: [2, 5],
  jacket: [2, 6],
  coat: [3, 6],
  duster: [3, 7],
  poncho: [2, 5],
  tabard: [3, 6],
  vest: [4, 7],
  leather: [4, 7],
  padded: [4, 7],
  gambeson: [4, 7],
  brigandine: [5, 8],
  chain: [5, 8],
  hauberk: [5, 8],
  scale: [6, 8],
  lamellar: [6, 8],
  plate: [7, 8],
  cuirass: [7, 8],
  jersey: [1, 5],
  snow: [3, 7],
  leatherJacket: [3, 7],
  swat: [7, 8],
};

/** Botas: crocs/ojotas abajo; plate/greaves solo epic–legendary. */
export const BOOT_RARITY: Partial<Record<BootsParams["style"], RarityRange>> = {
  crocs: [1, 2],
  sandal: [1, 3],
  canvas: [2, 4],
  sport: [2, 5],
  sneaker: [2, 5],
  loafer: [3, 6],
  oxford: [3, 6],
  dress: [4, 7],
  work: [4, 6],
  military: [4, 7],
  combat: [5, 8],
  trail: [5, 8],
  riding: [5, 8],
  ski: [6, 8],
  greaves: [6, 7],
  plate: [7, 8],
  cleats: [2, 6],
};

/** Cascos: tela/gorros abajo; yelmos cerrados epic+; crown/bucket solo legendary. */
export const HELMET_RARITY: Partial<Record<HelmetParams["style"], RarityRange>> = {
  bandana: [1, 3],
  beanie: [1, 4],
  beret: [2, 5],
  cap: [2, 5],
  cowboy: [2, 5],
  ushanka: [3, 6],
  turban: [3, 6],
  coif: [4, 7],
  construction: [4, 6],
  bike: [4, 7],
  moto: [5, 8],
  racing: [5, 8],
  pilot: [5, 8],
  nasal: [4, 7],
  kettle: [4, 7],
  morion: [5, 8],
  sallet: [5, 8],
  barbute: [6, 8],
  bascinet: [6, 8],
  full: [7, 8],
  great: [7, 8],
  horned: [7, 8],
  riot: [7, 8],
  bucket: [8, 8],
  crown: [8, 8],
  earmuffs: [1, 4],
  ballcap: [1, 5],
  gasmask: [4, 7],
  f1: [4, 8],
  nasa: [5, 8],
  swat: [7, 8],
};

/** Pantalones: shorts/tela abajo; plated solo epic–legendary. */
export const PANTS_RARITY: Partial<Record<PantsParams["style"], RarityRange>> = {
  shorts: [1, 3],
  cloth: [1, 4],
  jogger: [2, 5],
  jeans: [2, 5],
  kilt: [2, 5],
  breeches: [3, 6],
  fatigues: [3, 6],
  cargo: [3, 7],
  chaps: [4, 7],
  leather: [4, 7],
  plated: [7, 8],
  football: [2, 5],
  armored: [7, 8],
};

/** Guantes: cloth/wraps abajo; gauntlet rare–legendary. */
export const GLOVE_RARITY: Partial<Record<GlovesParams["style"], RarityRange>> = {
  cloth: [1, 4],
  wraps: [1, 4],
  mittens: [2, 5],
  leather: [2, 6],
  bracers: [4, 7],
  gauntlet: [5, 8],
  boxing: [2, 6],
  keeper: [2, 6],
  rubber: [1, 4],
  claws: [5, 8],
};

/**
 * Filtra `styles` por rareza del ítem (1–8) y elige uno al azar.
 * Mythic: sin filtro (unique / easter egg / override fijo).
 */
export function pickStyleForRarity<T extends string>(
  r: () => number,
  styles: T[],
  rarity: Rarity,
  rangeMap: Partial<Record<T, RarityRange>>,
): T {
  if (rarity === "mythic") {
    return styles[Math.floor(r() * styles.length)]!;
  }
  const ok = styles.filter((s) => styleAllowed(rarity, rangeMap[s] ?? FULL));
  const pool = ok.length ? ok : styles;
  return pool[Math.floor(r() * pool.length)]!;
}
