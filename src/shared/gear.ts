import { rollElement, withElementStats } from "./elements";
import { fillRarityAdj, pickRarity, rarityMult, rngFromSeed } from "./rng";
import {
  ARMOR_RARITY,
  BOOT_RARITY,
  HELMET_RARITY,
  PANTS_RARITY,
  GLOVE_RARITY,
  pickStyleForRarity,
} from "./rarityGates";
import { EASTER_EGGS } from "./uniqueCatalog";
import { createDaggerItem, createSwordItem, nextItemId, randomSwordSeed } from "./swords";
import {
  ARMOR_VISUAL,
  BELT_VISUAL,
  BOOT_VISUAL,
  GLOVE_VISUAL,
  PANTS_VISUAL,
  SHIELD_VISUAL,
  armorVisual,
  beltVisual,
  bootVisual,
  gloveVisual,
  pantsVisual,
  pickStyle,
  shieldVisual,
} from "./presets";
import type {
  AmuletParams,
  ArmorParams,
  AxeParams,
  BeltParams,
  BootsParams,
  BowParams,
  ClubParams,
  CrossbowParams,
  GlovesParams,
  HelmetParams,
  ItemInstance,
  ItemStats,
  PantsParams,
  Rarity,
  RingParams,
  ShieldParams,
  SwordParams,
  ThrowParams,
} from "./types";

function pickName(
  seed: number,
  rarity: Rarity,
  table: Record<Rarity, string[]>,
  nouns: string[],
): string {
  const r = rngFromSeed(seed ^ 0x51feed);
  if (rarity === "mythic") return table.mythic[Math.floor(r() * table.mythic.length)]!;
  const adj = table[rarity];
  return `${adj[Math.floor(r() * adj.length)]} ${nouns[0]}`;
}

const emptyCombat = (): Pick<ItemStats, "damage" | "reach" | "attackSpeed" | "windup"> => ({
  damage: 0,
  reach: 0,
  attackSpeed: 0,
  windup: 0,
});

const bootAdj = fillRarityAdj(
  ["Gastadas", "Rústicas", "Pesadas"],
  ["Ágiles", "Firmes", "Ligeras"],
  ["Veloces", "Sombra", "Caminantes"],
  ["Aladas", "Tempestad", "Errantes"],
  { legendary: ["Aladas", "Etéreas", "Errantes"], mythic: ["Celestes", "Infinitas", "Umbrales"] },
);
const shieldAdj = fillRarityAdj(
  ["Rajado", "Tosco", "Viejo"],
  ["Firme", "Reforzado", "Sólido"],
  ["Baluarte", "Noble", "Runado"],
  ["Inquebrantable", "Égida", "Ancestral"],
  { legendary: ["Égida", "Bastión", "Eterno"], mythic: ["Cósmico", "Primordial", "Absoluto"] },
);
const helmAdj = fillRarityAdj(
  ["Abollado", "Simple", "Oxidado"],
  ["Reforzado", "Ajustado", "Firme"],
  ["Barbuta", "Noble", "Runado"],
  ["Yelmo", "Corona", "Ancestral"],
  { legendary: ["Corona", "Diadema", "Soberano"], mythic: ["Tiara", "Oráculo", "Primordial"] },
);
const armorAdj = fillRarityAdj(
  ["Remendada", "Tosca", "Vieja", "Oxidada"],
  ["Acolchada", "Firme", "Curtida", "Anillada"],
  ["Reforzada", "Noble", "Runada", "Pulida"],
  ["Égida", "Tempestad", "Ancestral", "Imperial"],
  { legendary: ["Imperial", "Sagrada", "Eterna"], mythic: ["Primordial", "Cósmica", "Absoluta"] },
);
const pantsAdj = fillRarityAdj(
  ["Rotos", "Simples", "Gastados"],
  ["Firmes", "Ajustados", "Curtidos"],
  ["Reforzados", "Nobles", "Runados"],
  ["Legendarios", "Égida", "Ancestrales"],
  { legendary: ["Égida", "Eternos", "Sagrados"], mythic: ["Primordiales", "Cósmicos", "Absolutos"] },
);
const gloveAdj = fillRarityAdj(
  ["Gastados", "Rústicos", "Finos"],
  ["Ágiles", "Firmes", "Curtidos"],
  ["Guanteletes", "Nobles", "Runados"],
  ["Tempestad", "Égida", "Ancestrales"],
  { legendary: ["Égida", "Soberanos", "Eternos"], mythic: ["Primordiales", "Cósmicos", "Absolutos"] },
);
const beltAdj = fillRarityAdj(
  ["Simple", "Gastado", "Tosco"],
  ["Firme", "Ancho", "Curtido"],
  ["Reforzado", "Noble", "Runado"],
  ["Cinto", "Égida", "Ancestral"],
  { legendary: ["Égida", "Soberano", "Eterno"], mythic: ["Primordial", "Cósmico", "Absoluto"] },
);
const axeAdj = fillRarityAdj(
  ["Oxidada", "Tosca", "Pesada"],
  ["Afilada", "Firme", "Brutal"],
  ["Voraz", "Noble", "Runada"],
  ["Tempestad", "Ancestral", "Devastadora"],
  { legendary: ["Devastadora", "Titánica", "Eterna"], mythic: ["Primordial", "Cósmica", "Absoluta"] },
);
const throwAdj = fillRarityAdj(
  ["Tosco", "Simple", "Oxidado"],
  ["Equilibrado", "Afilado", "Ligero"],
  ["Certero", "Noble", "Runado"],
  ["Tempestad", "Ancestral", "Letal"],
  { legendary: ["Letal", "Eterno", "Sombra"], mythic: ["Primordial", "Cósmico", "Absoluto"] },
);
const bowAdj = fillRarityAdj(
  ["Tosco", "Simple", "Viejo"],
  ["Ágil", "Tenso", "Ligero"],
  ["Certero", "Noble", "Runado"],
  ["Tempestad", "Ancestral", "Letal"],
  { legendary: ["Eterno", "Sagitario", "Lunar"], mythic: ["Primordial", "Cósmico", "Absoluto"] },
);
const crossbowAdj = fillRarityAdj(
  ["Tosca", "Simple", "Oxidada"],
  ["Firme", "Pesada", "Tensa"],
  ["Certera", "Noble", "Runada"],
  ["Tempestad", "Ancestral", "Letal"],
  { legendary: ["Eterna", "Asedio", "Titánica"], mythic: ["Primordial", "Cósmica", "Absoluta"] },
);

export function createBootsItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const genre: BootsParams["style"] = pickStyleForRarity(
    r,
    Object.keys(BOOT_VISUAL) as BootsParams["style"][],
    rarity,
    BOOT_RARITY,
  );
  const style = bootVisual(genre);
  const metalRoll = r();
  const metalTone: BootsParams["metalTone"] =
    style === "plate" || style === "greaves"
      ? metalRoll < 0.45
        ? "steel"
        : metalRoll < 0.72
          ? "copper"
          : "gold"
      : "none";
  const params: BootsParams = {
    seed,
    style: genre,
    metalTone,
    height:
      style === "greaves" || style === "trail" || style === "combat" || style === "riding" || style === "ski"
        ? 0.34 + r() * 0.2
        : style === "military" || style === "dress" || style === "work"
          ? 0.26 + r() * 0.12
          : style === "crocs" || style === "sandal"
            ? 0.12 + r() * 0.05
            : style === "canvas"
            ? 0.05 + r() * 0.02
            : style === "cleats" || style === "sport" || style === "sneaker"
              ? 0.18 + r() * 0.08
              : 0.16 + r() * 0.08,
    sole:
      style === "crocs"
        ? 0.07 + r() * 0.04
        : style === "cleats"
          ? 0.07 + r() * 0.04
          : style === "sport" || style === "sneaker"
            ? 0.06 + r() * 0.05
            : style === "canvas" || style === "sandal"
              ? 0.04 + r() * 0.03
              : 0.045 + r() * 0.05,
    // Lona: negro / rojo Chuck / navy (como las refs)
    leatherHue:
      style === "canvas"
        ? (() => {
            const c = r();
            if (c < 0.34) return 0.01; // negro
            if (c < 0.62) return 0.04; // rojo
            if (c < 0.88) return 0.6; // navy
            return 0.12 + r() * 0.5;
          })()
        : r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const speed =
    genre === "crocs"
      ? 0.92 + r() * 0.04
      : style === "cleats"
        ? 1.12 + r() * 0.1
        : style === "canvas" || style === "sport"
          ? 1.1 + r() * 0.12
          : style === "combat" || style === "military"
            ? 1.05 + r() * 0.08
          : style === "trail"
            ? 1.08 + r() * 0.1
            : 1.02 + r() * 0.06;
  const extraNouns: Partial<Record<BootsParams["style"], string[]>> = {
    sneaker: ["Sneakers", "Zapatillas urbanas"],
    sandal: ["Sandalias", "Ojotas"],
    loafer: ["Mocasines", "Zapatos de vestir"],
    oxford: ["Oxfords", "Zapatos de cuero"],
    riding: ["Botas de montar", "Botas de equitación"],
    dress: ["Botines", "Botas de gala"],
    work: ["Botas de trabajo", "Botas de obra"],
    ski: ["Botas de nieve", "Botas de ski"],
    crocs: ["Crocs"],
    cleats: ["Botines", "Botines de fútbol"],
  };
  const nouns =
    extraNouns[genre] ??
    style === "canvas"
      ? ["Zapatillas de lona", "Lonas", "Zapatillas"]
      : style === "sport"
        ? ["Zapatillas deportivas", "Runners", "Trainers"]
        : style === "military"
          ? ["Botas militares", "Zapatos tácticos", "Botas de campaña"]
          : style === "combat"
            ? ["Borcegos", "Botas de combate", "Combat boots"]
            : style === "trail"
              ? ["Botas de trekking", "Botas altas", "Caña alta"]
              : style === "greaves"
                ? ["Grebas", "Canilleras", "Grebas"]
                : metalTone === "gold"
                  ? ["Escarpes dorados", "Botas de placas", "Botas reales"]
                  : metalTone === "copper"
                    ? ["Escarpes cobrizos", "Botas de bronce", "Botas herradas"]
                    : ["Botas de placa", "Escarpes de acero", "Botas blindadas"];
  return {
    id: nextItemId(seed),
    kind: "boots",
    equipSlot: "boots",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor:
        style === "greaves" || style === "plate" ? Math.round((style === "greaves" ? 2 : 1.5) * m * 10) / 10 : 0,
      moveSpeedMult: Math.round(speed * m * 100) / 100,
      maxHpBonus: 0,
    },
    name: pickName(seed, rarity, bootAdj, nouns),
    gridW: 2,
    gridH: 2,
  };
}

export function createShieldItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const genre = pickStyle(r, SHIELD_VISUAL);
  const shape = shieldVisual(genre);
  const matRoll = r();
  const material: ShieldParams["material"] =
    matRoll < 0.28
      ? "wood"
      : matRoll < 0.48
        ? "reinforced"
        : matRoll < 0.62
          ? "metal"
          : matRoll < 0.74
            ? "sheet"
            : matRoll < 0.84
              ? "plastic"
              : matRoll < 0.92
                ? "steel"
                : matRoll < 0.97
                  ? "obsidian"
                  : "adamantium";
  const params: ShieldParams = {
    seed,
    shape: genre,
    material,
    width: 0.35 + r() * 0.35,
    height: 0.4 + r() * 0.45,
    boss: 0.06 + r() * 0.06,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const area = params.width * params.height;
  const matArmor =
    material === "adamantium"
      ? 1.7
      : material === "obsidian"
        ? 1.45
        : material === "steel" || material === "metal"
          ? 1.35
          : material === "sheet"
            ? 1.2
            : material === "reinforced"
              ? 1.15
              : material === "plastic"
                ? 0.85
                : 1;
  const shapeNouns: Partial<Record<ShieldParams["shape"], string[]>> = {
    buckler: ["Buckler", "Broquel chico"],
    targe: ["Targe", "Rodela"],
    tower: ["Escudo torre", "Escudo de infantería"],
    pavise: ["Pavés", "Escudo de asedio"],
    lid: ["Tapa de cubo", "Tapa de basura"],
    door: ["Puerta chica", "Puertita de metal"],
    shutter: ["Postigo", "Postigo de madera"],
  };
  const nouns =
    shapeNouns[genre] ??
    (material === "plastic"
      ? ["Escudo de plástico", "Broquel plástico"]
      : material === "sheet"
        ? ["Escudo de chapa", "Broquel de chapa"]
        : material === "adamantium"
          ? ["Escudo de adamantium"]
          : material === "obsidian"
            ? ["Escudo de obsidiana"]
            : material === "steel" || material === "metal"
              ? ["Escudo de acero", "Broquel metálico"]
              : material === "reinforced"
                ? ["Escudo reforzado", "Broquel herrado"]
                : ["Escudo de madera", "Broquel"]);
  return {
    id: nextItemId(seed),
    kind: "shield",
    equipSlot: "offhand",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round((3 + area * 8) * matArmor * m * 10) / 10,
      moveSpeedMult: Math.max(
        0.88,
        1 -
          area * 0.08 -
          (material === "metal" || material === "steel" || material === "adamantium" ? 0.03 : 0),
      ),
      maxHpBonus: 0,
    },
    name: pickName(seed, rarity, shieldAdj, nouns),
    gridW: 2,
    gridH: shape === "kite" || shape === "door" ? 3 : 2,
  };
}

const HELMET_GENRE: Record<
  HelmetParams["style"],
  { nouns: string[]; cover: number; cloth?: boolean; hard?: boolean; slow?: boolean }
> = {
  cap: { nouns: ["Gorra", "Casquete"], cover: 0.85 },
  beret: { nouns: ["Boina", "Boina militar"], cover: 0.55, cloth: true },
  bandana: { nouns: ["Pañuelo", "Bandana"], cover: 0.4, cloth: true },
  beanie: { nouns: ["Gorro", "Beanie"], cover: 0.5, cloth: true },
  cowboy: { nouns: ["Sombrero", "Sombrero de ala"], cover: 0.6, cloth: true },
  ushanka: { nouns: ["Ushanka", "Gorro de orejeras"], cover: 0.7, cloth: true },
  turban: { nouns: ["Turbante", "Tocado"], cover: 0.55, cloth: true },
  moto: { nouns: ["Casco de moto", "Casco integral"], cover: 1.35, hard: true },
  bike: { nouns: ["Casco de bici", "Casco de ciclismo"], cover: 0.9, hard: true },
  racing: { nouns: ["Casco de carreras", "Casco de piloto"], cover: 1.3, hard: true, slow: true },
  construction: { nouns: ["Casco de obra", "Casco de construcción"], cover: 1.05, hard: true },
  riot: { nouns: ["Casco antidisturbios", "Casco táctico"], cover: 1.35, hard: true },
  pilot: { nouns: ["Casco de aviador", "Casco de vuelo"], cover: 1.2, hard: true },
  nasal: { nouns: ["Casco nasal", "Yelmo nasal"], cover: 1.15 },
  full: { nouns: ["Yelmo cerrado", "Casco completo"], cover: 1.4, slow: true },
  barbute: { nouns: ["Barbuta", "Celada barbuta"], cover: 1.25 },
  sallet: { nouns: ["Sallet", "Celada sallet"], cover: 1.15 },
  great: { nouns: ["Gran yelmo", "Yelmo de torneo"], cover: 1.5, slow: true },
  horned: { nouns: ["Yelmo astado", "Casco con cuernos"], cover: 1.25 },
  kettle: { nouns: ["Capelina", "Kettle hat"], cover: 1.1 },
  morion: { nouns: ["Morrión", "Celada morrión"], cover: 1.15 },
  bascinet: { nouns: ["Bacinete", "Bascinet"], cover: 1.3 },
  coif: { nouns: ["Cofia", "Almófar"], cover: 0.8, cloth: true },
  crown: { nouns: ["Corona", "Diadema"], cover: 0.45 },
  bucket: { nouns: ["Yelmo de cubo", "Casco de cubo"], cover: 1.45, slow: true },
  swat: { nouns: ["Casco SWAT", "Casco táctico"], cover: 1.4, hard: true, slow: true },
  gasmask: { nouns: ["Máscara de gas", "Respirador"], cover: 1.1, hard: true },
  nasa: { nouns: ["Casco espacial", "Casco NASA"], cover: 1.45, hard: true, slow: true },
  f1: { nouns: ["Casco de F1", "Casco de motorsport"], cover: 1.35, hard: true },
  earmuffs: { nouns: ["Orejeras", "Protectores auditivos"], cover: 0.45, cloth: true },
  ballcap: { nouns: ["Gorra", "Gorra deportiva"], cover: 0.5, cloth: true },
};

export function createHelmetItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styles = Object.keys(HELMET_GENRE) as HelmetParams["style"][];
  const style = pickStyleForRarity(r, styles, rarity, HELMET_RARITY);
  const genre = HELMET_GENRE[style];
  const matRoll = r();
  const material: HelmetParams["material"] = genre.cloth
    ? "leather"
    : style === "moto" || style === "bike" || style === "racing" || style === "f1"
      ? matRoll < 0.55
        ? "polycarb"
        : "composite"
      : style === "nasa" || style === "swat"
        ? "composite"
        : genre.hard
          ? "steel"
          : matRoll < 0.22
            ? "bronze"
            : matRoll < 0.4
              ? "leather"
              : "steel";
  const params: HelmetParams = {
    seed,
    style,
    material,
    dome: 0.16 + r() * 0.14,
    brim: 0.02 + r() * 0.06,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const matMul =
    material === "steel" || material === "composite"
      ? 1.2
      : material === "polycarb"
        ? 1.1
        : material === "bronze"
          ? 1.05
          : 0.85;
  const nouns = genre.nouns;
  return {
    id: nextItemId(seed),
    kind: "helmet",
    equipSlot: "helmet",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round((2 + params.dome * 10) * genre.cover * matMul * m * 10) / 10,
      moveSpeedMult: genre.slow ? 0.96 : 1,
      maxHpBonus: Math.round((8 + params.dome * 40) * m),
    },
    name: pickName(seed, rarity, helmAdj, nouns),
    gridW: 2,
    gridH: 2,
  };
}

export function createArmorItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const genre = pickStyleForRarity(
    r,
    Object.keys(ARMOR_VISUAL) as ArmorParams["style"][],
    rarity,
    ARMOR_RARITY,
  );
  const style = armorVisual(genre);
  const sleeves: ArmorParams["sleeves"] =
    style === "vest" ? "none" : r() < 0.42 ? "short" : "long";
  const finishRoll = r();
  let finish: ArmorParams["finish"] = "bare";
  if (
    style === "hoodie" ||
    style === "jacket" ||
    style === "leatherJacket" ||
    style === "leather" ||
    style === "padded"
  ) {
    finish = finishRoll < 0.7 ? "painted" : "darkened";
  } else if (style === "vest") {
    finish = finishRoll < 0.5 ? "darkened" : "bare";
  } else if (style === "plate" || style === "scale") {
    finish =
      finishRoll < 0.35
        ? "bare"
        : finishRoll < 0.55
          ? "polished"
          : finishRoll < 0.8
            ? "painted"
            : "darkened";
  } else {
    finish = finishRoll < 0.55 ? "bare" : finishRoll < 0.8 ? "darkened" : "polished";
  }
  const casual =
    style === "hoodie" ||
    style === "jacket" ||
    style === "leatherJacket" ||
    style === "snow" ||
    style === "jersey";
  const hue = r();
  // --- Variedad de LOOT (solo probs / flags). El mesh se ajusta en skinnedGear.ts → armorClothesDecors / ARMOR_DECOR.
  // Subí el número de `r() < X` para que salga MÁS seguido; bajalo para que sea más raro.
  const hasAccent = casual ? r() < 0.22 : style === "vest" ? r() < 0.12 : r() < 0.08;
  const accentHue = hasAccent ? (hue + 0.18 + r() * 0.55) % 1 : undefined;
  // CAPUCHA: % de chance. Buzo 0.88 = casi siempre; campera 0.18 = raro. `false` = nunca.
  const hood =
    style === "hoodie" || style === "snow"
      ? r() < 0.88
      : style === "jacket"
        ? r() < 0.18
        : false;
  const zipRoll = r();
  // CIERRE: umbrales acumulativos 0..1 → "none" | "half" | "full".
  // Ej. jacket: <0.08 none, <0.35 half, resto full. Subí el primer corte → más sin cierre.
  const zipper: ArmorParams["zipper"] =
    style === "jacket" || style === "leatherJacket"
      ? zipRoll < 0.08
        ? "none"
        : zipRoll < 0.35
          ? "half"
          : "full"
      : style === "hoodie"
        ? zipRoll < 0.45
          ? "none"
          : zipRoll < 0.75
            ? "half"
            : "full"
        : style === "leather" || style === "padded"
          ? zipRoll < 0.55
            ? "none"
            : "full"
          : "none";
  // BOLSILLOS: cantidad 0..4. Buzo: 1=canguro, 2=laterales. Jacket/vest: 1+floor(r()*N).
  const pockets =
    style === "hoodie"
      ? r() < 0.7
        ? 1
        : r() < 0.85
          ? 2
          : 0
      : style === "jacket"
        ? 1 + Math.floor(r() * 4)
        : style === "vest"
          ? 2 + Math.floor(r() * 3)
          : style === "leather"
            ? Math.floor(r() * 3)
            : 0;
  // FRANJAS / LOGO / COLORBLOCK / PUÑOS / CORDONES: mismas reglas (r()<X = % de aparición).
  const stripeRoll = r();
  const stripe: ArmorParams["stripe"] =
    !casual && style !== "padded"
      ? "none"
      : stripeRoll < 0.55
        ? "none"
        : stripeRoll < 0.7
          ? "chest"
          : stripeRoll < 0.82
            ? "sleeve"
            : stripeRoll < 0.92
              ? "side"
              : "hem";
  // logo 0 = sin logo; 1..64 = id del glifo. Chance: casual 32%, resto 6%.
  const logo = casual && r() < 0.32 ? 1 + Math.floor(r() * 64) : r() < 0.06 ? 1 + Math.floor(r() * 64) : 0;
  const params: ArmorParams = {
    seed,
    style: genre,
    sleeves,
    finish,
    bulk: casual ? 0.25 + r() * 0.35 : 0.35 + r() * 0.45,
    hue,
    rarity,
    accentHue,
    hood,
    zipper,
    pockets,
    stripe,
    stripeHue: stripe !== "none" ? (accentHue ?? (hue + 0.4 + r() * 0.3) % 1) : undefined,
    logo,
    colorBlock: !!(accentHue && casual && r() < 0.45),
    cuffs: casual ? r() < 0.75 : style === "padded" && r() < 0.4,
    cords: hood && r() < 0.7, // cordones solo si hay capucha
  };
  const m = rarityMult(rarity);
  const armorBase =
    style === "plate" || style === "swat"
      ? 9 + params.bulk * 6
      : style === "scale"
        ? 7 + params.bulk * 5
        : style === "chain"
          ? 5.5 + params.bulk * 4
          : style === "vest"
            ? 5 + params.bulk * 3
            : style === "padded"
              ? 3.5 + params.bulk * 2.5
              : style === "leather"
                ? 3 + params.bulk * 2
                : style === "snow"
                  ? 2 + params.bulk
                  : style === "leatherJacket"
                  ? 2.8 + params.bulk * 1.6
                  : style === "jacket"
                    ? 1.5 + params.bulk
                    : style === "jersey"
                      ? 0.6 + params.bulk * 0.5
                      : 0.8 + params.bulk * 0.8;
  const extraNouns: Partial<Record<ArmorParams["style"], string[]>> = {
    shirt: ["Remera", "Camisa"],
    tunic: ["Túnica", "Sayo"],
    coat: ["Abrigo", "Sobretodo"],
    duster: ["Duster", "Guardapolvo"],
    poncho: ["Poncho", "Manta"],
    tabard: ["Tabardo", "Sobrevesta"],
    brigandine: ["Brigantina", "Jaco de placas"],
    gambeson: ["Gambesón", "Acolchado"],
    hauberk: ["Hauberk", "Cota larga"],
    lamellar: ["Laminar", "Armadura laminar"],
    cuirass: ["Coraza", "Peto"],
    swat: ["Traje SWAT", "Equipo táctico"],
    snow: ["Campera de nieve", "Anorak"],
    jersey: ["Remera", "Camiseta", "Jersey"],
    leatherJacket: ["Campera de cuero", "Chaqueta de cuero"],
  };
  const nouns =
    extraNouns[genre] ??
    style === "hoodie"
      ? ["Buzo", "Hoodie", "Canguro"]
      : style === "jacket"
        ? ["Campera", "Chaqueta", "Campera con cierre"]
        : style === "vest"
          ? ["Chaleco antibalas", "Chaleco táctico", "Plate carrier"]
          : style === "plate"
            ? ["Coraza", "Placas", "Armadura de placas"]
            : style === "scale"
              ? ["Escamas", "Lorica", "Cota de escamas"]
              : style === "chain"
                ? ["Cota de malla", "Anillas", "Hauberk"]
                : style === "padded"
                  ? ["Gambesón", "Acolchado", "Jubón"]
                  : ["Cuero", "Peto de cuero", "Jaco"];
  return {
    id: nextItemId(seed),
    kind: "armor",
    equipSlot: "armor",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round(armorBase * m * 10) / 10,
      moveSpeedMult:
        style === "plate" || style === "swat"
          ? 0.9
          : style === "scale"
            ? 0.94
            : style === "chain" || style === "vest"
              ? 0.97
              : 1,
      maxHpBonus: Math.round((4 + params.bulk * 12) * m),
    },
    name: pickName(seed, rarity, armorAdj, nouns),
    gridW: 2,
    gridH: 3,
  };
}

export function createPantsItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const genre = pickStyleForRarity(
    r,
    Object.keys(PANTS_VISUAL) as PantsParams["style"][],
    rarity,
    PANTS_RARITY,
  );
  const style = pantsVisual(genre);
  const pockets =
    style === "cargo"
      ? r() < 0.45
        ? 6
        : 4
      : style === "jeans"
        ? r() < 0.35
          ? 5
          : 4
        : style === "leather" || style === "cloth"
          ? r() < 0.55
            ? 2
            : r() < 0.75
              ? 4
              : 0
          : style === "jogger"
            ? r() < 0.4
              ? 2
              : 0
            : 0;
  const params: PantsParams = {
    seed,
    style: genre,
    length: style === "jogger" ? 0.55 + r() * 0.25 : 0.5 + r() * 0.5,
    // jeans: tintes índigo
    hue: style === "jeans" ? 0.55 + r() * 0.12 : r(),
    rarity,
    pockets,
    shellScale: 0.52,
    waistRise: 1,
  };
  const m = rarityMult(rarity);
  const armor =
    style === "plated" || style === "armored"
      ? 4
      : style === "leather"
        ? 2
        : style === "cargo"
          ? 1
          : style === "football"
            ? 0.7
            : style === "jeans"
              ? 0.8
              : 0.5;
  const extraNouns: Partial<Record<PantsParams["style"], string[]>> = {
    shorts: ["Shorts", "Bermudas"],
    chaps: ["Chaparreras", "Polainas"],
    kilt: ["Kilt", "Falda"],
    breeches: ["Calzones", "Bombachas"],
    fatigues: ["Fatigas", "Pantalón de faena"],
    football: ["Pantalón de fútbol", "Shorts largos"],
    armored: ["Pantalón de armadura", "Calzas blindadas"],
  };
  const nouns =
    extraNouns[genre] ??
    style === "jeans"
      ? ["Jeans", "Denim", "Vaqueros"]
      : style === "jogger"
        ? ["Joggers", "Pantalón suelto", "Pants"]
        : style === "cargo"
          ? ["Cargo", "Pantalón militar", "Táctico"]
          : style === "plated"
            ? ["Calzas blindadas", "Pantalón de placas", "Grebas largas"]
            : style === "leather"
              ? ["Calzas de cuero", "Pantalón de cuero", "Bragas"]
              : ["Pantalones", "Calzas", "Pantalón de tela"];
  return {
    id: nextItemId(seed),
    kind: "pants",
    equipSlot: "pants",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round(armor * m * 10) / 10,
      moveSpeedMult:
        style === "plated" || style === "armored"
          ? 0.95
          : style === "jogger" || style === "football"
            ? 1.05
            : style === "cloth" || style === "jeans"
              ? 1.02
              : 1,
      maxHpBonus: Math.round(params.length * 6 * m),
    },
    name: pickName(seed, rarity, pantsAdj, nouns),
    gridW: 2,
    gridH: 2,
  };
}

export function createGlovesItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const genre = pickStyleForRarity(
    r,
    Object.keys(GLOVE_VISUAL) as GlovesParams["style"][],
    rarity,
    GLOVE_RARITY,
  );
  const style = gloveVisual(genre);
  const params: GlovesParams = {
    seed,
    style: genre,
    // cloth/gauntlet un poco más abultados; leather más fino
    bulk:
      style === "claws"
        ? 0.2 + r() * 0.25
        : style === "leather"
          ? 0.12 + r() * 0.35
          : style === "cloth"
            ? 0.25 + r() * 0.4
            : 0.35 + r() * 0.45,
    hue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const claws = style === "claws";
  return {
    id: nextItemId(seed),
    kind: "gloves",
    equipSlot: "gloves",
    seed,
    params,
    stats: {
      damage: claws
        ? Math.round((4 + m * 3) * 10) / 10
        : style === "gauntlet"
          ? Math.round(1.5 * m * 10) / 10
          : 0,
      reach: claws ? 0.15 : 0,
      attackSpeed: claws ? 1.25 : style === "cloth" ? 1.06 : style === "leather" ? 1.03 : 0.98,
      windup: 0,
      armor: style === "gauntlet" ? Math.round(2 * m * 10) / 10 : Math.round(0.5 * m * 10) / 10,
      moveSpeedMult: 1,
      maxHpBonus: 0,
      // Garras: alta chance de herida abierta (solo se aplica en combate desarmado)
      woundChance: claws ? Math.min(0.72, 0.42 + m * 0.08) : undefined,
    },
    name: pickName(
      seed,
      rarity,
      gloveAdj,
      genre === "wraps"
        ? ["Vendas", "Wraps"]
        : genre === "mittens"
          ? ["Mitones", "Manoplas"]
          : genre === "bracers"
            ? ["Brazales", "Muñequeras"]
            : genre === "gauntlet"
              ? ["Guanteletes", "Manoplas de placas"]
              : genre === "boxing"
                ? ["Guantes de boxeo", "Guantes de combate"]
                : genre === "keeper"
                  ? ["Guantes de arquero", "Guantes de portero"]
                  : genre === "rubber"
                    ? ["Guantes de goma", "Guantes de limpieza"]
                    : genre === "claws"
                      ? ["Garras", "Garras afiladas"]
                      : ["Guantes", "Guantes de cuero"],
    ),
    gridW: 2,
    gridH: 2,
  };
}

export function createBeltItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const genre = pickStyle(r, BELT_VISUAL);
  const style = beltVisual(genre);
  const params: BeltParams = {
    seed,
    style: genre,
    width: 0.08 + r() * 0.1,
    hue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  return {
    id: nextItemId(seed),
    kind: "belt",
    equipSlot: "belt",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: style === "plated" ? Math.round(1.8 * m * 10) / 10 : Math.round(0.4 * m * 10) / 10,
      moveSpeedMult: 1,
      maxHpBonus: Math.round((2 + params.width * 40) * m),
    },
    name: pickName(
      seed,
      rarity,
      beltAdj,
      genre === "sash"
        ? ["Faja", "Banda"]
        : genre === "chainbelt"
          ? ["Cinto de cadena", "Cinturón de eslabones"]
          : genre === "utility"
            ? ["Cinto táctico", "Cinturón de faena"]
            : ["Cinturón", "Cinto"],
    ),
    gridW: 2,
    gridH: 1,
  };
}

export function createAxeItem(seed: number, small = false, twoHand?: boolean): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const want2h = !small && (twoHand ?? r() < 0.4);
  const styleRoll = r();
  const headStyle: AxeParams["headStyle"] = small
    ? styleRoll < 0.6
      ? "bearded"
      : "broad"
    : styleRoll < 0.4
      ? "bearded"
      : styleRoll < 0.75
        ? "broad"
        : "double";
  const params: AxeParams = {
    seed,
    headStyle,
    headSize: small ? 0.1 + r() * 0.1 : want2h ? 0.36 + r() * 0.16 : 0.16 + r() * 0.12,
    haftLength: small ? 0.32 + r() * 0.22 : want2h ? 1.05 + r() * 0.45 : 0.5 + r() * 0.18,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const dmg = (small ? 9 : 14) + params.headSize * (small ? 40 : 55) + params.haftLength * (small ? 6 : 10);
  const reach = 0.4 + params.haftLength * (small ? 0.7 : 0.85);
  const spd = Math.max(0.55, (small ? 1.55 : 1.35) - params.headSize * (small ? 1.6 : 2.2));
  return {
    id: nextItemId(seed),
    kind: "axe",
    equipSlot: "weapon",
    seed,
    params,
    stats: withElementStats(
      {
        damage: Math.round(dmg * m * 10) / 10,
        reach: Math.round(reach * 100) / 100,
        attackSpeed: Math.round(spd * 100) / 100,
        windup: Math.round((0.12 + params.headSize * (small ? 0.6 : 1)) * 100) / 100,
        armor: 0,
        moveSpeedMult: 1,
        maxHpBonus: 0,
      },
      rollElement(r, rarity, true),
    ),
    name: pickName(
      seed,
      rarity,
      axeAdj,
      small ? ["Hacha chica"] : ["Hacha"],
    ),
    gridW: small ? 1 : 2,
    gridH: small ? 2 : 3,
  };
}

export function createSmallAxeItem(seed: number): ItemInstance {
  return createAxeItem(seed, true);
}

const clubAdj = fillRarityAdj(
  ["Astillado", "Torcido", "Oxidado"],
  ["Sólido", "Pesado", "Reforzado"],
  ["Templado", "Balanceado", "Letal"],
  ["Destructor", "Colosal", "Infernal"],
  { legendary: ["Titánico", "Cataclísmico"], mythic: ["Primordial", "Absoluto"] },
);

export function createClubItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const subtypes: ClubParams["subtype"][] = [
    "bat",
    "stick",
    "pipe",
    "crowbar",
    "nunchaku",
    "scissors",
    "pan",
  ];
  const subtype = subtypes[Math.floor(r() * subtypes.length)]!;
  const params: ClubParams = {
    seed,
    subtype,
    length:
      subtype === "scissors"
        ? 0.22 + r() * 0.08
        : subtype === "pan"
          ? 0.45 + r() * 0.12
          : subtype === "nunchaku"
            ? 0.55 + r() * 0.2
            : subtype === "crowbar"
              ? 0.7 + r() * 0.25
              : 0.75 + r() * 0.45,
    thickness:
      subtype === "scissors"
        ? 0.018 + r() * 0.01
        : subtype === "pan"
          ? 0.06 + r() * 0.03
          : subtype === "pipe" || subtype === "crowbar"
            ? 0.04 + r() * 0.025
            : 0.035 + r() * 0.03,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const nouns: Record<ClubParams["subtype"], string[]> = {
    bat: ["Bate", "Bate de béisbol"],
    stick: ["Palo", "Garrote de madera"],
    pipe: ["Caño", "Tubo de metal"],
    crowbar: ["Gancho", "Palanca"],
    nunchaku: ["Nunchaku", "Nunchakus"],
    scissors: ["Tijeras", "Tijera"],
    pan: ["Sartén", "Sartén de hierro"],
  };
  const dmgBase =
    subtype === "scissors"
      ? 3.5
      : subtype === "pan"
        ? 10
        : subtype === "nunchaku"
          ? 9
          : subtype === "stick"
            ? 8
            : subtype === "bat"
              ? 11
              : 12;
  const spd =
    subtype === "scissors"
      ? 1.85
      : subtype === "pan"
        ? 1.05
        : subtype === "nunchaku"
          ? 1.55
          : subtype === "stick"
            ? 1.35
            : subtype === "bat"
              ? 1.15
              : 1.05;
  const reach =
    subtype === "scissors"
      ? 0.42 + params.length * 0.35
      : subtype === "pan"
        ? 0.7 + params.length * 0.35
        : 0.55 + params.length * 0.85;
  return {
    id: nextItemId(seed),
    kind: "club",
    equipSlot: "weapon",
    seed,
    params,
    stats: withElementStats(
      {
        damage: Math.round((dmgBase + params.length * (subtype === "scissors" ? 4 : 10) + params.thickness * 40) * m * 10) / 10,
        reach: Math.round(reach * 100) / 100,
        attackSpeed: Math.round(spd * 100) / 100,
        windup: Math.round((subtype === "scissors" ? 0.06 : 0.1 + params.length * 0.08) * 100) / 100,
        armor: 0,
        moveSpeedMult: 1,
        maxHpBonus: 0,
      },
      rollElement(r, rarity, true),
    ),
    name: pickName(seed, rarity, clubAdj, nouns[subtype]),
    gridW: 1,
    gridH: subtype === "nunchaku" || subtype === "scissors" ? 2 : 3,
  };
}

/** Armas cuerpo a cuerpo pequeñas (puñal / hacha corta), no arrojadizas ni a distancia. */
export function isDualWieldable(item: ItemInstance): boolean {
  if (item.kind === "sword") {
    const p = item.params as SwordParams;
    return p.bladeType !== "wide" && p.bladeLength <= 0.58 && item.gridH <= 2;
  }
  if (item.kind === "axe") {
    const p = item.params as AxeParams;
    return p.haftLength <= 0.58 && p.headSize <= 0.22 && item.gridH <= 2;
  }
  if (item.kind === "club") {
    const sub = (item.params as ClubParams).subtype;
    return sub === "nunchaku" || sub === "scissors";
  }
  return false;
}

export function createThrowItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const subtypes: ThrowParams["subtype"][] = [
    "throwingAxe",
    "throwingDagger",
    "shuriken",
    "javelin",
    "slingshot",
    "boleadora",
    "molotov",
    "tearGas",
  ];
  // Bazooka solo legendary (nivel 8)
  let subtype = subtypes[Math.floor(r() * subtypes.length)]!;
  if (rarity === "legendary" && r() < 0.35) subtype = "bazooka";
  const params: ThrowParams = {
    seed,
    subtype,
    size: 0.5 + r() * 0.5,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  let damage = 8;
  let reach = 1.2;
  let attackSpeed = 1.4;
  let gridW = 1;
  let gridH = 2;
  let nouns = ["Arrojo"];
  if (subtype === "throwingAxe") {
    damage = (9 + params.size * 14) * m;
    reach = 5.5 + params.size * 1.2;
    attackSpeed = 1.15;
    gridW = 2;
    gridH = 2;
    nouns = ["Hacha arrojadiza", "Francisca"];
  } else if (subtype === "throwingDagger") {
    damage = (7 + params.size * 10) * m;
    reach = 6 + params.size * 1.4;
    attackSpeed = 1.55;
    gridW = 1;
    gridH = 2;
    nouns = ["Puñal arrojadizo", "Kunai"];
  } else if (subtype === "shuriken") {
    damage = (5 + params.size * 8) * m;
    reach = 7 + params.size * 1.6;
    attackSpeed = 1.85;
    gridW = 1;
    gridH = 1;
    nouns = ["Shuriken", "Estrella"];
  } else if (subtype === "slingshot") {
    damage = (6 + params.size * 9) * m;
    reach = 8 + params.size * 1.5;
    attackSpeed = 1.7;
    gridW = 1;
    gridH = 2;
    nouns = ["Gomera", "Resortera"];
  } else if (subtype === "boleadora") {
    damage = (8 + params.size * 12) * m;
    reach = 6.5 + params.size * 1.3;
    attackSpeed = 1.05;
    gridW = 2;
    gridH = 2;
    nouns = ["Boleadora", "Boleadoras"];
  } else if (subtype === "molotov") {
    damage = (11 + params.size * 14) * m;
    reach = 5.5 + params.size;
    attackSpeed = 1.1;
    gridW = 1;
    gridH = 2;
    nouns = ["Molotov", "Cóctel molotov"];
  } else if (subtype === "tearGas") {
    damage = (4 + params.size * 6) * m;
    reach = 6 + params.size * 1.2;
    attackSpeed = 1.2;
    gridW = 1;
    gridH = 2;
    nouns = ["Gas lacrimógeno", "Granada de gas"];
  } else if (subtype === "bazooka") {
    damage = (28 + params.size * 22) * m;
    reach = 14 + params.size * 3;
    attackSpeed = 0.35;
    gridW = 2;
    gridH = 4;
    nouns = ["Bazuca", "Lanzacohetes"];
  } else {
    damage = (10 + params.size * 16) * m;
    reach = 9 + params.size * 2;
    attackSpeed = 0.95;
    gridW = 1;
    gridH = 3;
    nouns = ["Jabalina", "Venablo"];
  }
  return {
    id: nextItemId(seed),
    kind: "throw",
    equipSlot: "weapon",
    seed,
    params,
    stats: withElementStats(
      {
        damage: Math.round(damage * 10) / 10,
        reach: Math.round(reach * 100) / 100,
        attackSpeed: Math.round(attackSpeed * 100) / 100,
        windup: Math.round((0.1 + (1.2 - attackSpeed) * 0.08) * 100) / 100,
        armor: 0,
        moveSpeedMult: 1,
        maxHpBonus: 0,
      },
      rollElement(r, rarity, true),
    ),
    name: pickName(seed, rarity, throwAdj, nouns),
    gridW,
    gridH,
  };
}

export function createBowItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const params: BowParams = {
    seed,
    draw: 0.55 + r() * 0.45,
    limbCurve: 0.35 + r() * 0.5,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const damage = (7 + params.draw * 14) * m;
  const reach = 10 + params.draw * 4;
  const attackSpeed = Math.max(0.7, 1.35 - params.draw * 0.35);
  return {
    id: nextItemId(seed),
    kind: "bow",
    equipSlot: "weapon",
    seed,
    params,
    stats: withElementStats(
      {
        damage: Math.round(damage * 10) / 10,
        reach: Math.round(reach * 100) / 100,
        attackSpeed: Math.round(attackSpeed * 100) / 100,
        windup: Math.round((0.16 + params.draw * 0.12) * 100) / 100,
        armor: 0,
        moveSpeedMult: 1,
        maxHpBonus: 0,
      },
      rollElement(r, rarity, true),
    ),
    name: pickName(seed, rarity, bowAdj, ["Arco", "Arco largo", "Arco de caza"]),
    gridW: 1,
    gridH: 4,
  };
}

export function createCrossbowItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const params: CrossbowParams = {
    seed,
    power: 0.5 + r() * 0.5,
    stockLength: 0.45 + r() * 0.35,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const damage = (12 + params.power * 18) * m;
  const reach = 8.5 + params.power * 3;
  const attackSpeed = Math.max(0.45, 0.85 - params.power * 0.25);
  return {
    id: nextItemId(seed),
    kind: "crossbow",
    equipSlot: "weapon",
    seed,
    params,
    stats: withElementStats(
      {
        damage: Math.round(damage * 10) / 10,
        reach: Math.round(reach * 100) / 100,
        attackSpeed: Math.round(attackSpeed * 100) / 100,
        windup: Math.round((0.22 + params.power * 0.15) * 100) / 100,
        armor: 0,
        moveSpeedMult: 0.98,
        maxHpBonus: 0,
      },
      rollElement(r, rarity, true),
    ),
    name: pickName(seed, rarity, crossbowAdj, ["Ballesta", "Ballesta pesada", "Ballesta de asedio"]),
    gridW: 2,
    gridH: 2,
  };
}

const ringAdj = fillRarityAdj(
  ["Simple", "Opaco", "Gastado"],
  ["Pulido", "Fino", "Grabado"],
  ["Rúnico", "Noble", "Sellado"],
  ["Ancestral", "Estelar", "Maldito"],
  { legendary: ["Estelar", "Eterno", "Arcano"], mythic: ["Primordial", "Cósmico", "Absoluto"] },
);

export function createRingItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styles: RingParams["style"][] = ["band", "signet", "gem", "skull", "braided"];
  const gems: RingParams["gem"][] = [
    "none",
    "ruby",
    "sapphire",
    "emerald",
    "diamond",
    "topaz",
    "amethyst",
    "obsidian",
    "jade",
    "jet",
  ];
  const metals: RingParams["metalKind"][] = ["silver", "gold", "platinum", "bright"];
  const style = styles[Math.floor(r() * styles.length)]!;
  const gem =
    style === "gem" || style === "signet"
      ? gems[1 + Math.floor(r() * (gems.length - 1))]!
      : r() < 0.3
        ? gems[1 + Math.floor(r() * (gems.length - 1))]!
        : "none";
  const metalKind = metals[Math.floor(r() * metals.length)]!;
  const params: RingParams = { seed, style, gem, metalKind, metalHue: r(), rarity };
  const m = rarityMult(rarity);
  const nouns =
    style === "signet"
      ? ["Sello", "Anillo de sello"]
      : style === "skull"
        ? ["Anillo calavera", "Sortija de hueso"]
        : style === "braided"
          ? ["Anillo trenzado", "Sortija de lazo"]
          : style === "gem"
            ? ["Anillo de gema", "Sortija"]
            : ["Anillo", "Banda", "Aro"];
  return {
    id: nextItemId(seed),
    kind: "ring",
    equipSlot: "ring1",
    seed,
    params,
    stats: withElementStats(
      {
        ...emptyCombat(),
        damage: style === "skull" ? Math.round(0.4 * m * 10) / 10 : 0,
        armor: style === "band" || style === "braided" ? Math.round(0.4 * m * 10) / 10 : 0,
        attackSpeed: style === "signet" ? 1.04 : 1,
        moveSpeedMult: 1,
        maxHpBonus: gem === "none" ? Math.round(4 * m) : Math.round(10 * m),
      },
      rollElement(r, rarity, false),
    ),
    name: pickName(seed, rarity, ringAdj, nouns),
    gridW: 1,
    gridH: 1,
  };
}

export function createAmuletItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styles: AmuletParams["style"][] = ["pendant", "relic", "tooth", "medallion", "charm"];
  const style = styles[Math.floor(r() * styles.length)]!;
  const params: AmuletParams = { seed, style, metalHue: r(), rarity };
  const m = rarityMult(rarity);
  const nouns =
    style === "relic"
      ? ["Reliquia", "Amuleto sagrado"]
      : style === "tooth"
        ? ["Colmillo", "Diente de bestia"]
        : style === "medallion"
          ? ["Medallón", "Medalla"]
          : style === "charm"
            ? ["Dije", "Talismán"]
            : ["Amuleto", "Colgante", "Pendiente"];
  return {
    id: nextItemId(seed),
    kind: "amulet",
    equipSlot: "amulet",
    seed,
    params,
    stats: withElementStats(
      {
        ...emptyCombat(),
        armor: style === "medallion" ? Math.round(0.6 * m * 10) / 10 : 0,
        moveSpeedMult: 1,
        maxHpBonus: Math.round((12 + (style === "relic" ? 10 : 0)) * m),
      },
      rollElement(r, rarity, false),
    ),
    name: pickName(seed, rarity, ringAdj, nouns),
    gridW: 1,
    gridH: 1,
  };
}

function tryEasterEggLoot(): ItemInstance | null {
  const n = Math.random();
  let acc = 0;
  for (const egg of EASTER_EGGS) {
    acc += egg.weight;
    if (n >= acc) continue;
    const seed = randomSwordSeed();
    let item: ItemInstance;
    if (egg.kind === "helmet") {
      item = createHelmetItem(seed);
      (item.params as HelmetParams).style = egg.style as HelmetParams["style"];
      (item.params as HelmetParams).rarity = egg.rarity;
    } else if (egg.kind === "boots") {
      item = createBootsItem(seed);
      (item.params as BootsParams).style = egg.style as BootsParams["style"];
      (item.params as BootsParams).rarity = egg.rarity;
    } else if (egg.kind === "armor") {
      item = createArmorItem(seed);
      (item.params as ArmorParams).style = egg.style as ArmorParams["style"];
      (item.params as ArmorParams).rarity = egg.rarity;
    } else if (egg.kind === "pants") {
      item = createPantsItem(seed);
      (item.params as PantsParams).style = egg.style as PantsParams["style"];
      (item.params as PantsParams).rarity = egg.rarity;
    } else {
      item = createGlovesItem(seed);
      (item.params as GlovesParams).style = egg.style as GlovesParams["style"];
      (item.params as GlovesParams).rarity = egg.rarity;
    }
    item.name = egg.name;
    item.easterEgg = true;
    item.uniqueKey = egg.key;
    return item;
  }
  return null;
}

export function createRandomLootItem(): ItemInstance {
  const egg = tryEasterEggLoot();
  if (egg) return egg;
  const seed = randomSwordSeed();
  const roll = Math.random();
  if (roll < 0.09) return createSwordItem(seed);
  if (roll < 0.15) return createDaggerItem(seed);
  if (roll < 0.2) return createAxeItem(seed);
  if (roll < 0.26) return createSmallAxeItem(seed);
  if (roll < 0.34) return createClubItem(seed);
  if (roll < 0.42) return createThrowItem(seed);
  if (roll < 0.47) return createBowItem(seed);
  if (roll < 0.52) return createCrossbowItem(seed);
  if (roll < 0.6) return createArmorItem(seed);
  if (roll < 0.67) return createPantsItem(seed);
  if (roll < 0.74) return createHelmetItem(seed);
  if (roll < 0.8) return createBootsItem(seed);
  if (roll < 0.86) return createShieldItem(seed);
  if (roll < 0.9) return createGlovesItem(seed);
  if (roll < 0.94) return createBeltItem(seed);
  if (roll < 0.97) return createRingItem(seed);
  return createAmuletItem(seed);
}
