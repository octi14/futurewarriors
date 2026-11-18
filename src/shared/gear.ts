import { pickRarity, rarityMult, rngFromSeed } from "./rng";
import { createDaggerItem, createSwordItem, nextItemId, randomSwordSeed } from "./swords";
import type {
  ArmorParams,
  AxeParams,
  BeltParams,
  BootsParams,
  BowParams,
  CrossbowParams,
  GlovesParams,
  HelmetParams,
  ItemInstance,
  ItemStats,
  PantsParams,
  Rarity,
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
  common: ["Remendada", "Tosca", "Vieja", "Oxidada"],
  uncommon: ["Acolchada", "Firme", "Curtida", "Anillada"],
  rare: ["Reforzada", "Noble", "Runada", "Pulida"],
  epic: ["Égida", "Tempestad", "Ancestral", "Imperial"],
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
const bowAdj: Record<Rarity, string[]> = {
  common: ["Tosco", "Simple", "Viejo"],
  uncommon: ["Ágil", "Tenso", "Ligero"],
  rare: ["Certero", "Noble", "Runado"],
  epic: ["Tempestad", "Ancestral", "Letal"],
};
const crossbowAdj: Record<Rarity, string[]> = {
  common: ["Tosca", "Simple", "Oxidada"],
  uncommon: ["Firme", "Pesada", "Tensa"],
  rare: ["Certera", "Noble", "Runada"],
  epic: ["Tempestad", "Ancestral", "Letal"],
};

export function createBootsItem(seed: number): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
  const styleRoll = r();
  const style: BootsParams["style"] =
    styleRoll < 0.35 ? "light" : styleRoll < 0.6 ? "trail" : styleRoll < 0.82 ? "greaves" : "plate";
  const params: BootsParams = {
    seed,
    style,
    height: style === "greaves" ? 0.38 + r() * 0.2 : 0.22 + r() * 0.28,
    sole: 0.04 + r() * 0.05,
    leatherHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const speed =
    style === "light"
      ? 1.08 + r() * 0.12
      : style === "trail"
        ? 1.12 + r() * 0.14
        : style === "greaves"
          ? 1.02 + r() * 0.06
          : 1.04 + r() * 0.08;
  const nouns =
    style === "greaves" ? ["Grebas", "Canilleras", "Grebas"] : style === "plate" ? ["Botas de placa", "Botas blindadas", "Escarpes"] : ["Botas", "Botines", "Botas de cuero"];
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
  const shapeRoll = r();
  const shape: ShieldParams["shape"] =
    shapeRoll < 0.4 ? "round" : shapeRoll < 0.75 ? "heater" : "kite";
  const matRoll = r();
  const material: ShieldParams["material"] =
    matRoll < 0.4 ? "wood" : matRoll < 0.75 ? "reinforced" : "metal";
  const params: ShieldParams = {
    seed,
    shape,
    material,
    width: 0.35 + r() * 0.35,
    height: 0.4 + r() * 0.45,
    boss: 0.06 + r() * 0.06,
    metalHue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const area = params.width * params.height;
  const matArmor = material === "metal" ? 1.35 : material === "reinforced" ? 1.15 : 1;
  const nouns =
    material === "metal"
      ? ["Escudo de acero", "Broquel metálico", "Rodela de hierro"]
      : material === "reinforced"
        ? ["Escudo reforzado", "Broquel herrado", "Rodela claveteada"]
        : ["Escudo de madera", "Broquel", "Rodela"];
  return {
    id: nextItemId(seed),
    kind: "shield",
    equipSlot: "offhand",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round((3 + area * 8) * matArmor * m * 10) / 10,
      moveSpeedMult: Math.max(0.9, 1 - area * 0.08 - (material === "metal" ? 0.03 : 0)),
      maxHpBonus: 0,
    },
    name: pickName(seed, rarity, shieldAdj, nouns),
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
  const matRoll = r();
  const material: HelmetParams["material"] =
    style === "cap" && matRoll < 0.55
      ? "leather"
      : matRoll < 0.22
        ? "bronze"
        : matRoll < 0.35
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
  const cover =
    style === "great" || style === "full"
      ? 1.4
      : style === "barbute" || style === "horned"
        ? 1.25
        : style === "nasal" || style === "sallet"
          ? 1.15
          : 1;
  const matMul = material === "steel" ? 1.2 : material === "bronze" ? 1.05 : 0.85;
  const nouns =
    material === "leather"
      ? ["Capacete de cuero", "Casco de cuero", "Capucha endurecida"]
      : material === "bronze"
        ? ["Casco de bronce", "Celada de bronce", "Yelmo bronceado"]
        : ["Casco", "Celada", "Yelmo de acero"];
  return {
    id: nextItemId(seed),
    kind: "helmet",
    equipSlot: "helmet",
    seed,
    params,
    stats: {
      ...emptyCombat(),
      armor: Math.round((2 + params.dome * 10) * cover * matMul * m * 10) / 10,
      moveSpeedMult: style === "great" ? 0.96 : 1,
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
  const styleRoll = r();
  const style: ArmorParams["style"] =
    styleRoll < 0.18
      ? "leather"
      : styleRoll < 0.36
        ? "padded"
        : styleRoll < 0.58
          ? "chain"
          : styleRoll < 0.76
            ? "scale"
            : "plate";
  const finishRoll = r();
  let finish: ArmorParams["finish"] = "bare";
  if (style === "leather" || style === "padded") {
    finish = finishRoll < 0.7 ? "painted" : "darkened";
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
    // chain: suele ser metal sin pintar o brunido
    finish = finishRoll < 0.55 ? "bare" : finishRoll < 0.8 ? "darkened" : "polished";
  }
  const params: ArmorParams = {
    seed,
    style,
    finish,
    bulk: 0.45 + r() * 0.55,
    hue: r(),
    rarity,
  };
  const m = rarityMult(rarity);
  const armorBase =
    style === "plate"
      ? 9 + params.bulk * 6
      : style === "scale"
        ? 7 + params.bulk * 5
        : style === "chain"
          ? 5.5 + params.bulk * 4
          : style === "padded"
            ? 3.5 + params.bulk * 2.5
            : 3 + params.bulk * 2;
  const nouns =
    style === "plate"
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
        style === "plate" ? 0.9 : style === "scale" ? 0.94 : style === "chain" ? 0.96 : 1,
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

export function createAxeItem(seed: number, small = false): ItemInstance {
  const r = rngFromSeed(seed);
  const rarity = pickRarity(r);
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
    headSize: small ? 0.1 + r() * 0.1 : 0.18 + r() * 0.2,
    haftLength: small ? 0.32 + r() * 0.22 : 0.55 + r() * 0.55,
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
    stats: {
      damage: Math.round(dmg * m * 10) / 10,
      reach: Math.round(reach * 100) / 100,
      attackSpeed: Math.round(spd * 100) / 100,
      windup: Math.round((0.12 + params.headSize * (small ? 0.6 : 1)) * 100) / 100,
      armor: 0,
      moveSpeedMult: 1,
      maxHpBonus: 0,
    },
    name: pickName(
      seed,
      rarity,
      axeAdj,
      small ? ["Hachuela", "Hacha de mano", "Hacha corta"] : ["Hacha", "Hachuela", "Bipennis"],
    ),
    gridW: small ? 1 : 2,
    gridH: small ? 2 : 3,
  };
}

export function createSmallAxeItem(seed: number): ItemInstance {
  return createAxeItem(seed, true);
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
    stats: {
      damage: Math.round(damage * 10) / 10,
      reach: Math.round(reach * 100) / 100,
      attackSpeed: Math.round(attackSpeed * 100) / 100,
      windup: Math.round((0.16 + params.draw * 0.12) * 100) / 100,
      armor: 0,
      moveSpeedMult: 1,
      maxHpBonus: 0,
    },
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
    stats: {
      damage: Math.round(damage * 10) / 10,
      reach: Math.round(reach * 100) / 100,
      attackSpeed: Math.round(attackSpeed * 100) / 100,
      windup: Math.round((0.22 + params.power * 0.15) * 100) / 100,
      armor: 0,
      moveSpeedMult: 0.98,
      maxHpBonus: 0,
    },
    name: pickName(seed, rarity, crossbowAdj, ["Ballesta", "Ballesta pesada", "Ballesta de asedio"]),
    gridW: 2,
    gridH: 2,
  };
}

export function createRandomLootItem(): ItemInstance {
  const seed = randomSwordSeed();
  const roll = Math.random();
  if (roll < 0.1) return createSwordItem(seed);
  if (roll < 0.18) return createDaggerItem(seed);
  if (roll < 0.24) return createAxeItem(seed);
  if (roll < 0.32) return createSmallAxeItem(seed);
  if (roll < 0.4) return createThrowItem(seed);
  if (roll < 0.46) return createBowItem(seed);
  if (roll < 0.52) return createCrossbowItem(seed);
  if (roll < 0.6) return createArmorItem(seed);
  if (roll < 0.67) return createPantsItem(seed);
  if (roll < 0.74) return createHelmetItem(seed);
  if (roll < 0.8) return createBootsItem(seed);
  if (roll < 0.86) return createShieldItem(seed);
  if (roll < 0.92) return createGlovesItem(seed);
  return createBeltItem(seed);
}
