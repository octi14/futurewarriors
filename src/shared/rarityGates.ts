import type {
  AmuletParams,
  ArmorParams,
  AxeParams,
  BeltParams,
  BootsParams,
  ClubParams,
  GlovesParams,
  HelmetParams,
  PantsParams,
  RingParams,
  ShieldParams,
  SwordParams,
  ThrowParams,
  BowParams,
  CrossbowParams,
  Rarity,
} from "./types";
import { pickRarity, RARITIES, rarityRank } from "./rng";

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

/** La daga es un ítem propio, no una espada corta. */
export const DAGGER_RARITY: RarityRange = [2, 5];

/** Espadas: cada hoja es un ítem (recta, cimitarra, florete, mandoble, katana, sable). */
export const SWORD_RARITY: Partial<Record<SwordParams["bladeType"], RarityRange>> = {
  straight: [4, 8], // Espada
  curved: [4, 6], // Cimitarra
  foil: [3, 5], // Florete
  wide: [6, 8], // Mandoble
  katana: [5, 8], // Katana
  saber: [6, 8], // Sable
};

/** Hachas: barba abajo; doble filo arriba. */
export const AXE_RARITY: Partial<Record<AxeParams["headStyle"], RarityRange>> = {
  bearded: [5, 8], // Hacha de barba
  broad: [4, 7], // Hacha ancha
  double: [5, 8], // Hacha doble
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
  cleaver: [2, 5], // cuchilla de cocina
  umbrella: [1, 3], // paraguas
  bottle: [1, 3], // botella de vidrio
  extinguisher: [3, 6], // matafuegos
  rollingPin: [1, 4], // palo de amasar
  chain: [2, 5], // cadena
  skateboard: [2, 5], // tabla de skate
  golf: [3, 6], // palo de golf
  racket: [2, 5], // raqueta de tenis
  hammer: [3, 6], // martillo
  wrench: [2, 5], // llave
  machete: [3, 6], // machete
  pickaxe: [4, 7], // pico
  shovel: [3, 6], // pala
  bone: [4, 7], // hueso
  selfie: [1, 3], // palo de selfie
  gpu: [7, 8], // GeForce RTX 5090
  barreta: [3, 6], // barreta
  rake: [2, 5], // rastrillo
  o2tank: [4, 7], // tubo de oxígeno
  anchor: [5, 8], // ancla
  cricket: [2, 5], // bate de cricket
  morningstar: [5, 8], // estrella del alba
  whip: [5, 8], // látigo
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
  cymbal: [1, 4], // platillo de batería
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
  diving: [5, 8], // casco de buzo
  football: [3, 6], // casco de fútbol americano
  mask: [1, 3], // barbijo
  chef: [1, 4], // gorro de cocina
  tophat: [3, 6], // galera
  mortar: [2, 5], // birrete
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

/** Cintos. */
export const BELT_RARITY: Partial<Record<BeltParams["style"], RarityRange>> = {
  rope: [1, 4], // soga
  leather: [2, 6], // cuero
  sash: [2, 5], // faja
  utility: [4, 7], // táctico
  chainbelt: [5, 8], // cadena
  plated: [6, 8], // placas
};

/** Anillos. */
export const RING_RARITY: Partial<Record<RingParams["style"], RarityRange>> = {
  band: [1, 5], // banda
  braided: [2, 6], // trenzado
  signet: [4, 7], // sello
  gem: [5, 8], // gema
  skull: [6, 8], // calavera
};

/** Amuletos. */
export const AMULET_RARITY: Partial<Record<AmuletParams["style"], RarityRange>> = {
  charm: [1, 4], // dije
  pendant: [2, 6], // colgante
  tooth: [3, 7], // colmillo
  medallion: [4, 8], // medallón
  relic: [6, 8], // reliquia
};

/**
 * Cada clave de estas tablas es un ítem distinto (cimitarra, florete, hacha de barba…),
 * no una variante de otro. La rareza es del ítem: solo puede salir dentro de su rango.
 */
export function stylesAt<T extends string>(
  rarity: Rarity,
  styles: readonly T[],
  rangeMap: Partial<Record<T, RarityRange>>,
): T[] {
  if (rarity === "mythic") return [...styles];
  return styles.filter((s) => styleAllowed(rarity, rangeMap[s] ?? FULL));
}

export function hasItemAt<T extends string>(
  rarity: Rarity,
  styles: readonly T[],
  rangeMap: Partial<Record<T, RarityRange>>,
): boolean {
  return stylesAt(rarity, styles, rangeMap).length > 0;
}

/** Rareza del ítem, siempre dentro de su rango. */
export function rollRarityInRange(r: () => number, range: RarityRange): Rarity {
  for (let i = 0; i < 30; i++) {
    const rolled = pickRarity(r);
    if (styleAllowed(rolled, range)) return rolled;
  }
  const lv = Math.max(1, Math.min(RARITY_LEVEL_MAX, range[0]));
  return RARITIES[lv - 1] ?? "common";
}

/**
 * Elige el ítem. Si `rarityIn` viene del loot, solo entran los que caben en esa rareza
 * (si no hay ninguno, null). Si no viene, se elige el ítem y su rareza queda dentro de su rango.
 */
export function resolveItem<T extends string>(
  r: () => number,
  styles: readonly T[],
  rangeMap: Partial<Record<T, RarityRange>>,
  rarityIn?: Rarity,
): { item: T; rarity: Rarity } | null {
  if (!styles.length) return null;
  if (rarityIn) {
    const ok = stylesAt(rarityIn, styles, rangeMap);
    if (!ok.length) return null;
    return { item: ok[Math.floor(r() * ok.length)]!, rarity: rarityIn };
  }
  const item = styles[Math.floor(r() * styles.length)]!;
  return { item, rarity: rollRarityInRange(r, rangeMap[item] ?? FULL) };
}

export function pickStyleForRarity<T extends string>(
  r: () => number,
  styles: T[],
  rarity: Rarity,
  rangeMap: Partial<Record<T, RarityRange>>,
): T | null {
  return resolveItem(r, styles, rangeMap, rarity)?.item ?? null;
}
