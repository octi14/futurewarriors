import { pickRarity, rarityMult, rngFromSeed } from "./rng";
import { createSwordItem, nextItemId, randomSwordSeed } from "./swords";
import type {
  ArmorParams,
  AxeParams,
  BeltParams,
  BootsParams,
  GlovesParams,
  HelmetParams,
  ItemInstance,
  ItemStats,
  PantsParams,
  Rarity,
  ShieldParams,
  ThrowParams,
} from "./types";

function pickName(
  seed: number,
  rarity: Rarity,
  table: Record<Rarity, string[]>,
  nouns: string[],
): string {
  const r = rngFromSeed(seed ^ 0x51feed);
  const adj = table[rarity];
  return `${adj[Math.floor(r() * adj.length)]} ${nouns[Math.floor(r() * nouns.length)]}`;
}

const emptyCombat = (): Pick<ItemStats, "damage" | "reach" | "attackSpeed" | "windup"> => ({
  damage: 0,
  reach: 0,
  attackSpeed: 0,
  windup: 0,
});

const bootAdj: Record<Rarity, string[]> = {
  common: ["Gastadas", "Rústicas", "Pesadas"],
  uncommon: ["Ágiles", "Firmes", "Ligeras"],
  rare: ["Veloces", "Sombra", "Caminantes"],
  epic: ["Aladas", "Tempestad", "Errantes"],
};
const shieldAdj: Record<Rarity, string[]> = {
  common: ["Rajado", "Tosco", "Viejo"],
  uncommon: ["Firme", "Reforzado", "Sólido"],
  rare: ["Baluarte", "Noble", "Runado"],
  epic: ["Inquebrantable", "Égida", "Ancestral"],
};
const helmAdj: Record<Rarity, string[]> = {
  common: ["Abollado", "Simple", "Oxidado"],
  uncommon: ["Reforzado", "Ajustado", "Firme"],
  rare: ["Barbuta", "Noble", "Runado"],
  epic: ["Yelmo", "Corona", "Ancestral"],
};
const armorAdj: Record<Rarity, string[]> = {
  common: ["Remendada", "Tosca", "Vieja"],
  uncommon: ["Acolchada", "Firme", "Curtida"],
  rare: ["Reforzada", "Noble", "Runada"],
  epic: ["Égida", "Tempestad", "Ancestral"],
};
const pantsAdj: Record<Rarity, string[]> = {
  common: ["Rotos", "Simples", "Gastados"],
  uncommon: ["Firmes", "Ajustados", "Curtidos"],
  rare: ["Reforzados", "Nobles", "Runados"],
  epic: ["Legendarios", "Égida", "Ancestrales"],
};
const gloveAdj: Record<Rarity, string[]> = {
  common: ["Gastados", "Rústicos", "Finos"],
  uncommon: ["Ágiles", "Firmes", "Curtidos"],
  rare: ["Guanteletes", "Nobles", "Runados"],
  epic: ["Tempestad", "Égida", "Ancestrales"],
};
const beltAdj: Record<Rarity, string[]> = {
  common: ["Simple", "Gastado", "Tosco"],
  uncommon: ["Firme", "Ancho", "Curtido"],
  rare: ["Reforzado", "Noble", "Runado"],
  epic: ["Cinto", "Égida", "Ancestral"],
};
const axeAdj: Record<Rarity, string[]> = {
  common: ["Oxidada", "Tosca", "Pesada"],
  uncommon: ["Afilada", "Firme", "Brutal"],
  rare: ["Voraz", "Noble", "Runada"],
  epic: ["Tempestad", "Ancestral", "Devastadora"],
};
const throwAdj: Record<Rarity, string[]> = {
  common: ["Tosco", "Simple", "Oxidado"],
  uncommon: ["Equilibrado", "Afilado", "Ligero"],
  rare: ["Certero", "Noble", "Runado"],
  epic: ["Tempestad", "Ancestral", "Letal"],
};

export function createBootsItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styleRoll = r();
  const style: BootsParams["style"] =
    styleRoll < 0.4 ? "light" : styleRoll < 0.75 ? "trail" : "plate";
  const params: BootsParams = {
    seed,
    style,
    height: 0.22 + r() * 0.28,
    sole: 0.04 + r() * 0.05,
    leatherHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const speed =
    style === "light" ? 1.08 + r() * 0.12 : style === "trail" ? 1.12 + r() * 0.14 : 1.04 + r() * 0.08;
  return {
    id: nextItemId(seed),
    kind: "boots",
    equipSlot: "boots",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: style === "plate" ? Math.round(1.5 * m * 10) / 10 : 0,
      moveSpeedMult: Math.round(speed * m * 100) / 100,
      maxHpBonus: 0,
    },
    name: pickName(seed, rarity, bootAdj, ["Botas", "Grebas", "Botines"]),
    gridW: 2,
    gridH: 2,
  };
}

export function createShieldItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const shapeRoll = r();
  const shape: ShieldParams["shape"] =
    shapeRoll < 0.4 ? "round" : shapeRoll < 0.75 ? "heater" : "kite";
  const params: ShieldParams = {
    seed,
    shape,
    width: 0.35 + r() * 0.35,
    height: 0.4 + r() * 0.45,
    boss: 0.06 + r() * 0.06,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const area = params.width * params.height;
  return {
    id: nextItemId(seed),
    kind: "shield",
    equipSlot: "offhand",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round((3 + area * 8) * m * 10) / 10,
      moveSpeedMult: Math.max(0.92, 1 - area * 0.08),
      maxHpBonus: 0,
    },
    name: pickName(seed, rarity, shieldAdj, ["Escudo", "Broquel", "Rodela"]),
    gridW: 2,
    gridH: shape === "kite" ? 3 : 2,
  };
}

export function createHelmetItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styles: HelmetParams["style"][] = [
    "cap",
    "nasal",
    "full",
    "barbute",
    "sallet",
    "great",
    "horned",
  ];
  const style = styles[Math.floor(r() * styles.length)];
  const params: HelmetParams = {
    seed,
    style,
    dome: 0.16 + r() * 0.14,
    brim: 0.02 + r() * 0.06,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const cover =
    style === "great" || style === "full"
      ? 1.4
      : style === "barbute" || style === "horned"
        ? 1.25
        : style === "nasal" || style === "sallet"
          ? 1.15
          : 1;
  return {
    id: nextItemId(seed),
    kind: "helmet",
    equipSlot: "helmet",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round((2 + params.dome * 10) * cover * m * 10) / 10,
      moveSpeedMult: style === "great" ? 0.96 : 1,
      maxHpBonus: Math.round((8 + params.dome * 40) * m),
    },
    name: pickName(seed, rarity, helmAdj, ["Casco", "Celada", "Yelmo"]),
    gridW: 2,
    gridH: 2,
  };
}

export function createArmorItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styleRoll = r();
  const style: ArmorParams["style"] =
    styleRoll < 0.4 ? "leather" : styleRoll < 0.75 ? "chain" : "plate";
  const params: ArmorParams = {
    seed,
    style,
    bulk: 0.5 + r() * 0.5,
    hue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const armor =
    style === "plate" ? 8 + params.bulk * 6 : style === "chain" ? 5 + params.bulk * 4 : 3 + params.bulk * 2;
  return {
    id: nextItemId(seed),
    kind: "armor",
    equipSlot: "armor",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round(armor * m * 10) / 10,
      moveSpeedMult: style === "plate" ? 0.92 : style === "chain" ? 0.96 : 1,
      maxHpBonus: Math.round((4 + params.bulk * 12) * m),
    },
    name: pickName(seed, rarity, armorAdj, ["Cota", "Armadura", "Coraza"]),
    gridW: 2,
    gridH: 3,
  };
}

export function createPantsItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styleRoll = r();
  const style: PantsParams["style"] =
    styleRoll < 0.4 ? "cloth" : styleRoll < 0.75 ? "leather" : "plated";
  const params: PantsParams = {
    seed,
    style,
    length: 0.5 + r() * 0.5,
    hue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const armor = style === "plated" ? 4 : style === "leather" ? 2 : 0.5;
  return {
    id: nextItemId(seed),
    kind: "pants",
    equipSlot: "pants",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round(armor * m * 10) / 10,
      moveSpeedMult: style === "plated" ? 0.95 : style === "cloth" ? 1.03 : 1,
      maxHpBonus: Math.round(params.length * 6 * m),
    },
    name: pickName(seed, rarity, pantsAdj, ["Pantalones", "Calzas", "Grebas"]),
    gridW: 2,
    gridH: 2,
  };
}

export function createGlovesItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styleRoll = r();
  const style: GlovesParams["style"] =
    styleRoll < 0.4 ? "cloth" : styleRoll < 0.75 ? "leather" : "gauntlet";
  const params: GlovesParams = {
    seed,
    style,
    bulk: 0.3 + r() * 0.7,
    hue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  return {
    id: nextItemId(seed),
    kind: "gloves",
    equipSlot: "gloves",
    seed,
    params,
    stats: {
      damage: style === "gauntlet" ? Math.round(1.5 * m * 10) / 10 : 0,
      reach: 0,
      attackSpeed: style === "cloth" ? 1.06 : style === "leather" ? 1.03 : 0.98,
      windup: 0,
      armor: style === "gauntlet" ? Math.round(2 * m * 10) / 10 : Math.round(0.5 * m * 10) / 10,
      moveSpeedMult: 1,
      maxHpBonus: 0,
    },
    name: pickName(seed, rarity, gloveAdj, ["Guantes", "Mitones", "Guanteletes"]),
    gridW: 2,
    gridH: 2,
  };
}

export function createBeltItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styleRoll = r();
  const style: BeltParams["style"] =
    styleRoll < 0.4 ? "rope" : styleRoll < 0.75 ? "leather" : "plated";
  const params: BeltParams = {
    seed,
    style,
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
    name: pickName(seed, rarity, beltAdj, ["Cinturón", "Faja", "Cinto"]),
    gridW: 2,
    gridH: 1,
  };
}

export function createAxeItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styleRoll = r();
  const headStyle: AxeParams["headStyle"] =
    styleRoll < 0.4 ? "bearded" : styleRoll < 0.75 ? "broad" : "double";
  const params: AxeParams = {
    seed,
    headStyle,
    headSize: 0.18 + r() * 0.2,
    haftLength: 0.55 + r() * 0.55,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const dmg = (14 + params.headSize * 55 + params.haftLength * 10) * m;
  const reach = 0.5 + params.haftLength * 0.85;
  const spd = Math.max(0.5, 1.35 - params.headSize * 2.2);
  return {
    id: nextItemId(seed),
    kind: "axe",
    equipSlot: "weapon",
    seed,
    params,
    stats: {
      damage: Math.round(dmg * 10) / 10,
      reach: Math.round(reach * 100) / 100,
      attackSpeed: Math.round(spd * 100) / 100,
      windup: Math.round((0.18 + params.headSize) * 100) / 100,
      armor: 0,
      moveSpeedMult: 1,
      maxHpBonus: 0,
    },
    name: pickName(seed, rarity, axeAdj, ["Hacha", "Hachuela", "Bipennis"]),
    gridW: 2,
    gridH: 3,
  };
}

export function createThrowItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const subtypes: ThrowParams["subtype"][] = [
    "throwingAxe",
    "throwingDagger",
    "shuriken",
    "javelin",
  ];
  const subtype = subtypes[Math.floor(r() * subtypes.length)];
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
    reach = 1.6 + params.size * 0.4;
    attackSpeed = 1.15;
    gridW = 2;
    gridH = 2;
    nouns = ["Hacha arrojadiza", "Francisca"];
  } else if (subtype === "throwingDagger") {
    damage = (7 + params.size * 10) * m;
    reach = 1.4 + params.size * 0.3;
    attackSpeed = 1.55;
    gridW = 1;
    gridH = 2;
    nouns = ["Puñal arrojadizo", "Kunai"];
  } else if (subtype === "shuriken") {
    damage = (5 + params.size * 8) * m;
    reach = 1.8 + params.size * 0.5;
    attackSpeed = 1.85;
    gridW = 1;
    gridH = 1;
    nouns = ["Shuriken", "Estrella"];
  } else {
    damage = (10 + params.size * 16) * m;
    reach = 2.4 + params.size * 0.7;
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
    stats: {
      damage: Math.round(damage * 10) / 10,
      reach: Math.round(reach * 100) / 100,
      attackSpeed: Math.round(attackSpeed * 100) / 100,
      windup: Math.round((0.1 + (1.2 - attackSpeed) * 0.08) * 100) / 100,
      armor: 0,
      moveSpeedMult: 1,
      maxHpBonus: 0,
    },
    name: pickName(seed, rarity, throwAdj, nouns),
    gridW,
    gridH,
  };
}

export function createRandomLootItem(): ItemInstance {
  const seed = randomSwordSeed();
  const roll = Math.random();
  if (roll < 0.18) return createSwordItem(seed);
  if (roll < 0.28) return createAxeItem(seed);
  if (roll < 0.4) return createThrowItem(seed);
  if (roll < 0.5) return createArmorItem(seed);
  if (roll < 0.58) return createPantsItem(seed);
  if (roll < 0.66) return createHelmetItem(seed);
  if (roll < 0.74) return createBootsItem(seed);
  if (roll < 0.82) return createShieldItem(seed);
  if (roll < 0.9) return createGlovesItem(seed);
  return createBeltItem(seed);
}
