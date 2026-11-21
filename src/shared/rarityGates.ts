import type {
  ArmorParams,
  AxeParams,
  BootsParams,
  ClubParams,
  GlovesParams,
  HelmetParams,
  PantsParams,
  ShieldParams,
  SwordParams,
  ThrowParams,
  BowParams,
  CrossbowParams,
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
  shirt: [1, 4], // remera
  hoodie: [1, 3], // buzo con capucha
  tunic: [3, 4], // túnica
  jacket: [2, 4], // campera
  coat: [2, 4], // sobretodo
  duster: [1, 3], // guardapolvo
  poncho: [2, 4], // poncho
  tabard: [3, 6], // tabardo
  vest: [4, 7], // chaleco
  leather: [3, 5], // cuero
  padded: [4, 7], // acolchada
  gambeson: [4, 7], // gambesón
  brigandine: [5, 8], // brigantina
  chain: [6, 8], // cota de malla
  hauberk: [7, 8], // cota larga de malla
  scale: [6, 8], // escamas
  lamellar: [6, 8], // lamelar
  plate: [7, 8], // placas
  cuirass: [7, 8], // coraza
  jersey: [1, 2], // camiseta
  snow: [3, 6], // campera de nieve
  leatherJacket: [3, 5], // campera de cuero
  swat: [7, 8], // chaleco táctico
};

/** Espadas: hoja común abajo; ancha / katana / sable arriba. */
export const SWORD_RARITY: Partial<Record<SwordParams["bladeType"], RarityRange>> = {
  straight: [4, 8], // recta
  curved: [4, 6], // curva
  foil: [3, 5], // florete
  wide: [6, 8], // ancha
  katana: [5, 8], // katana
  saber: [6, 8], // sable
};

/** Hachas: barba abajo; doble filo arriba. */
export const AXE_RARITY: Partial<Record<AxeParams["headStyle"], RarityRange>> = {
  bearded: [5, 8], // de barba
  broad: [4, 7], // ancha
  double: [5, 8], // doble filo
};

/** Arcos: arco abajo; ballesta arriba. */
export const BOW_RARITY: Partial<Record<BowParams["subtype"], RarityRange>> = {
  bow: [5, 8], // arco
};

/** Ballistas: ballesta abajo. */
export const CROSSBOW_RARITY: Partial<Record<CrossbowParams["subtype"], RarityRange>> = {
  crossbow: [6, 8], // ballesta
};

/** Contundentes: palo / sartén abajo; palanca y nunchaku arriba. */
export const CLUB_RARITY: Partial<Record<ClubParams["subtype"], RarityRange>> = {
  stick: [2, 4], // palo
  bat: [2, 4], // bate
  pan: [1, 2], // sartén
  pipe: [2, 4], // caño
  scissors: [1, 2], // tijera
  crowbar: [3, 4], // palanca
  nunchaku: [4, 6], // nunchaku
};

/** Arrojadizas: honda y daga abajo; bazooka solo legendary. */
export const THROW_RARITY: Partial<Record<ThrowParams["subtype"], RarityRange>> = {
  slingshot: [1, 1], // honda
  throwingDagger: [3, 5], // daga arrojadiza
  throwingAxe: [3, 6], // hacha arrojadiza
  boleadora: [3, 6], // boleadora
  shuriken: [4, 7], // shuriken
  javelin: [4, 7], // jabalina
  molotov: [2, 3], // molotov
  tearGas: [3, 4], // gas lacrimógeno
  bazooka: [8, 8], // bazooka
};

/** Escudos: tapa / postigo abajo; torre y pavés arriba. */
export const SHIELD_RARITY: Partial<Record<ShieldParams["shape"], RarityRange>> = {
  lid: [1, 3], // tapa
  shutter: [1, 4], // postigo
  door: [1, 3], // puerta
  buckler: [2, 5], // broquel
  round: [3, 6], // redondo
  targe: [3, 6], // tarja
  heater: [4, 7], // de corazón
  kite: [4, 7], // de cometa
  tower: [6, 8], // torre
  pavise: [7, 8], // pavés
};

/** Botas: crocs/ojotas abajo; plate/greaves solo epic–legendary. */
export const BOOT_RARITY: Partial<Record<BootsParams["style"], RarityRange>> = {
  crocs: [1, 1], // crocs
  sandal: [1, 2], // ojota
  canvas: [1, 3], // zapatillas de lona
  sport: [3, 3], // deportivas
  sneaker: [2, 3], // zapatillas
  loafer: [2, 4], // mocasín
  oxford: [3, 6], // oxford
  dress: [4, 7], // de vestir
  work: [2, 5], // de trabajo
  military: [4, 7], // militares
  combat: [5, 8], // de combate
  trail: [5, 8], // de trekking
  riding: [5, 8], // de montar
  ski: [6, 8], // de esquí
  greaves: [6, 7], // grebas
  plate: [7, 8], // de placa
  cleats: [2, 6], // botines
};

/** Cascos: tela/gorros abajo; yelmos cerrados epic+; crown/bucket solo legendary. */
export const HELMET_RARITY: Partial<Record<HelmetParams["style"], RarityRange>> = {
  bandana: [1, 2], // bandana
  beanie: [1, 2], // gorro de lana
  beret: [1, 2], // boina
  cap: [1, 1], // gorra
  cowboy: [2, 3], // sombrero de vaquero
  ushanka: [2, 5], // gorro ruso
  turban: [2, 3], // turbante
  coif: [4, 7], // cofia de malla
  construction: [3, 4], // casco de obra
  bike: [3, 5], // casco de bici
  moto: [4, 6], // casco de moto
  racing: [4, 6], // casco de carreras
  pilot: [4, 6], // casco de piloto
  nasal: [4, 7], // yelmo nasal
  kettle: [2, 4], // capelina
  morion: [5, 8], // morrión
  sallet: [5, 8], // celada
  barbute: [6, 8], // barbuta
  bascinet: [6, 8], // bacinete
  full: [7, 8], // yelmo cerrado
  great: [8, 8], // gran yelmo
  horned: [7, 8], // yelmo con cuernos
  riot: [6, 8], // casco antidisturbios
  bucket: [5, 7], // yelmo de cubo
  crown: [8, 8], // corona
  earmuffs: [1, 1], // orejeras
  ballcap: [1, 2], // gorra de béisbol
  gasmask: [5, 7], // máscara de gas
  f1: [5, 7], // casco de Fórmula 1
  nasa: [5, 7], // casco de astronauta
  swat: [7, 8], // casco táctico
};

/** Pantalones: shorts/tela abajo; plated solo epic–legendary. */
export const PANTS_RARITY: Partial<Record<PantsParams["style"], RarityRange>> = {
  shorts: [1, 2], // shorts
  cloth: [1, 3], // de tela
  jogger: [1, 2], // jogging
  jeans: [2, 4], // jeans
  kilt: [1, 2], // falda escocesa
  breeches: [1, 3], // calzas
  fatigues: [4, 7], // pantalón militar
  cargo: [3, 7], // cargo
  chaps: [2, 3], // chaparreras
  leather: [4, 6], // de cuero
  plated: [7, 8], // con placas
  football: [2, 4], // de fútbol americano
  armored: [7, 8], // blindados
};

/** Guantes: cloth/wraps abajo; gauntlet rare–legendary. */
export const GLOVE_RARITY: Partial<Record<GlovesParams["style"], RarityRange>> = {
  cloth: [1, 3], // de tela
  wraps: [1, 3], // vendas
  mittens: [1, 3], // manoplas
  leather: [2, 4], // de cuero
  bracers: [4, 7], // brazales
  gauntlet: [5, 8], // guantelete
  boxing: [3, 5], // de boxeo
  keeper: [2, 3], // de arquero
  rubber: [1, 1], // de goma
  claws: [2, 3], // garras
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
