export type Vec2 = { x: number; y: number };

export type Rarity = "vulgar" | "common" | "regular" | "uncommon" | "rare" | "exceptional" | "epic" | "legendary" | "mythic";

export type SwordParams = {
  seed: number;
  /** katana=curva fina, saber=hoja de energía, foil=florete de esgrima. */
  bladeType: "straight" | "curved" | "wide" | "katana" | "saber" | "foil";
  bladeLength: number;
  bladeWidth: number;
  guardSpan: number;
  gripLength: number;
  pommelSize: number;
  metalHue: number;
  /** Saturación del metal (bajo = acero gris). */
  metalSat: number;
  /** Luminosidad del metal (bajo = hierro oscuro). */
  metalLit: number;
  gripHue: number;
  gripStyle: "leather" | "wrap" | "wood";
  guardStyle: "bar" | "cross" | "disc" | "swept";
  /** 0..1 cantidad de adornos. */
  ornament: number;
  rarity: Rarity;
};

export type AxeParams = {
  seed: number;
  headStyle: "bearded" | "double" | "broad";
  headSize: number;
  haftLength: number;
  metalHue: number;
  rarity: Rarity;
};

export type ThrowParams = {
  seed: number;
  subtype:
    | "throwingAxe"
    | "throwingDagger"
    | "shuriken"
    | "javelin"
    | "slingshot"
    | "boleadora"
    | "molotov"
    | "tearGas"
    | "bazooka";
  size: number;
  metalHue: number;
  rarity: Rarity;
};

/** Armas improvisadas / cuerpo a cuerpo no-filo. */
export type ClubParams = {
  seed: number;
  subtype: "bat" | "stick" | "pipe" | "crowbar" | "nunchaku" | "scissors" | "pan";
  length: number;
  thickness: number;
  metalHue: number;
  rarity: Rarity;
};

export type BowParams = {
  seed: number;
  draw: number;
  limbCurve: number;
  metalHue: number;
  rarity: Rarity;
};

export type CrossbowParams = {
  seed: number;
  power: number;
  stockLength: number;
  metalHue: number;
  rarity: Rarity;
};

export type BootsParams = {
  seed: number;
  /**
   * canvas=lona, sport=deportiva, military/combat/trail=botas,
   * greaves/plate=metal, crocs/sandal/loafer/oxford/riding/dress/work/ski=variantes.
   */
  style:
    | "canvas"
    | "sport"
    | "military"
    | "combat"
    | "trail"
    | "greaves"
    | "plate"
    | "sneaker"
    | "sandal"
    | "loafer"
    | "oxford"
    | "riding"
    | "dress"
    | "work"
    | "ski"
    | "crocs"
    | "cleats";
  /** Tono del metal (plate/greaves); none en tela/cuero. */
  metalTone: "none" | "steel" | "gold" | "copper";
  height: number;
  sole: number;
  leatherHue: number;
  rarity: Rarity;
};

export type ShieldParams = {
  seed: number;
  /** lid=tapa de cubo, door=puerta chica, shutter=postigo. */
  shape:
    | "round"
    | "heater"
    | "kite"
    | "buckler"
    | "targe"
    | "tower"
    | "pavise"
    | "lid"
    | "door"
    | "shutter";
  /** sheet=chapa, steel/adamantium/obsidian=metales especiales. */
  material:
    | "wood"
    | "reinforced"
    | "metal"
    | "plastic"
    | "sheet"
    | "steel"
    | "adamantium"
    | "obsidian";
  width: number;
  height: number;
  boss: number;
  metalHue: number;
  rarity: Rarity;
};

export type HelmetParams = {
  seed: number;
  style:
    | "cap"
    | "beret"
    | "bandana"
    | "beanie"
    | "cowboy"
    | "ushanka"
    | "turban"
    | "moto"
    | "bike"
    | "racing"
    | "construction"
    | "riot"
    | "pilot"
    | "nasal"
    | "full"
    | "barbute"
    | "sallet"
    | "great"
    | "horned"
    | "kettle"
    | "morion"
    | "bascinet"
    | "coif"
    | "crown"
    | "bucket"
    | "swat"
    | "gasmask"
    | "nasa"
    | "f1"
    | "earmuffs"
    | "ballcap";
  /** composite/polycarb = moto/racing/f1; easter eggs usan beret/cowboy/ballcap. */
  material: "leather" | "bronze" | "steel" | "composite" | "polycarb";
  dome: number;
  brim: number;
  metalHue: number;
  rarity: Rarity;
};

export type ArmorParams = {
  seed: number;
  /**
   * Ropa común + armaduras:
   * hoodie=buzo, jacket=campera, vest=chaleco (antibalas/táctico),
   * leather/padded/chain/scale/plate = protección clásica.
   */
  style:
    | "hoodie"
    | "jacket"
    | "vest"
    | "leather"
    | "padded"
    | "chain"
    | "scale"
    | "plate"
    | "shirt"
    | "tunic"
    | "coat"
    | "duster"
    | "poncho"
    | "tabard"
    | "brigandine"
    | "gambeson"
    | "hauberk"
    | "lamellar"
    | "cuirass"
    | "swat"
    | "snow"
    | "jersey"
    | "leatherJacket";
  /** leatherJacket=campera de cuero; swat=epic+; snow=nieve; jersey=remera. */
  /** Manga: none=chaleco, short, long. */
  sleeves: "none" | "short" | "long";
  /**
   * Acabado (sobre todo metal):
   * bare = acero/hierro sin pintar, painted = lacado de color, polished = pulido,
   * darkened = ennegrecido / brunido.
   */
  finish: "bare" | "painted" | "polished" | "darkened";
  bulk: number;
  hue: number;
  rarity: Rarity;
  /** Segundo tono (0..1). Sin esto = un color. */
  accentHue?: number;
  /** Capucha (buzo/campera). */
  hood?: boolean;
  /** Cierre frontal visible. */
  zipper?: "none" | "half" | "full";
  /** Bolsillos 0..4 (canguro cuenta como 1 en buzo). */
  pockets?: number;
  /** Franjas decorativas. */
  stripe?: "none" | "chest" | "sleeve" | "side" | "hem";
  stripeHue?: number;
  /** 0=sin logo; 1..64 glifo procedural inventado. */
  logo?: number;
  /** Panel pecho en accentHue (colorblock). */
  colorBlock?: boolean;
  /** Puños / pretina acanalada. */
  cuffs?: boolean;
  /** Cordones de capucha / drawstring. */
  cords?: boolean;
};

export type PantsParams = {
  seed: number;
  /**
   * cloth=tela, jeans=denim, jogger=suelto con puño, cargo=militar,
   * leather=cuero, plated=placas/rodilleras.
   */
  style:
    | "cloth"
    | "jeans"
    | "jogger"
    | "cargo"
    | "leather"
    | "plated"
    | "shorts"
    | "chaps"
    | "kilt"
    | "breeches"
    | "fatigues"
    | "football"
    | "armored";
  length: number;
  hue: number;
  rarity: Rarity;
  /** Grosor/anchura del shell (preview slider). Default 1. */
  shellScale?: number;
  /** Altura de cintura 0=baja … 1=alta (preview slider). Default 0.4. */
  waistRise?: number;
  /**
   * Bolsillos visibles 0..6 (pares L/R cuando aplica).
   * 2=delanteros, 4=+traseros, 5=+monedero, 6=+cargo muslo.
   */
  pockets?: number;
}

export type GlovesParams = {
  seed: number;
  style:
    | "cloth"
    | "leather"
    | "gauntlet"
    | "wraps"
    | "mittens"
    | "bracers"
    | "boxing"
    | "keeper"
    | "rubber"
    | "claws";
  /** claws: sin arma permiten pelear con garras + alta woundChance. */
  bulk: number;
  hue: number;
  rarity: Rarity;
};

export type BeltParams = {
  seed: number;
  style: "rope" | "leather" | "plated" | "sash" | "chainbelt" | "utility";
  /* estilo: rope=cordón, leather=cuero, plated=placas, sash=cinturón, chainbelt=cinturón de cadena, utility=utilidad */
  width: number;
  hue: number;
  rarity: Rarity;
};

/** Stats unificados: armas llenan combate; gear llena bonuses. */
export type RingParams = {
  seed: number;
  style: "band" | "signet" | "gem" | "skull" | "braided";
  gem:
    | "none"
    | "ruby"
    | "sapphire"
    | "emerald"
    | "diamond"
    | "topaz"
    | "amethyst"
    | "obsidian"
    | "jade"
    | "jet";
  /** Tono del metal del aro (además de metalHue). */
  metalKind: "silver" | "gold" | "platinum" | "bright";
  metalHue: number;
  rarity: Rarity;
};

export type AmuletParams = {
  seed: number;
  style: "pendant" | "relic" | "tooth" | "medallion" | "charm";
  metalHue: number;
  rarity: Rarity;
};

/** Un solo elemento por arma; gear no-arma puede sumar el mismo u otro. */
export type ElementKind = "fire" | "ice" | "lightning" | "poison";

export type ItemStats = {
  damage: number;
  reach: number;
  attackSpeed: number;
  windup: number;
  armor: number;
  moveSpeedMult: number;
  maxHpBonus: number;
  /** Elemento del ítem (armas: a lo sumo uno). */
  element?: ElementKind | null;
  /** Daño extra de ese elemento. */
  elementDamage?: number;
  critChance?: number;
  blockChance?: number;
  /** >1 = más pesada (ralentiza); <1 = más ligera. */
  weightMult?: number;
  lifeRegenMult?: number;
  energyRegenMult?: number;
  /** Resistencias 0..1 (reducción). */
  resistFire?: number;
  resistIce?: number;
  resistLightning?: number;
  resistPoison?: number;
  /** Proc chances 0..1 (se aplican en combate más adelante). */
  chillChance?: number;
  poisonChance?: number;
  woundChance?: number;
  immuneWounds?: boolean;
  /** TODO futuro: freeze duration reduce, poison duration reduce. */
};

export type EquipSlotId =
  | "helmet"
  | "amulet"
  | "armor"
  | "weapon"
  | "offhand"
  | "gloves"
  | "belt"
  | "pants"
  | "boots"
  | "ring1"
  | "ring2";

export type Equipment = Record<EquipSlotId, ItemInstance | null>;

export type ItemKind =
  | "sword"
  | "axe"
  | "club"
  | "throw"
  | "bow"
  | "crossbow"
  | "boots"
  | "shield"
  | "helmet"
  | "armor"
  | "pants"
  | "gloves"
  | "belt"
  | "ring"
  | "amulet";

export type ItemParams =
  | SwordParams
  | AxeParams
  | ClubParams
  | ThrowParams
  | BowParams
  | CrossbowParams
  | BootsParams
  | ShieldParams
  | HelmetParams
  | ArmorParams
  | PantsParams
  | GlovesParams
  | BeltParams
  | RingParams
  | AmuletParams;

export type ItemInstance = {
  id: string;
  kind: ItemKind;
  equipSlot: EquipSlotId;
  seed: number;
  params: ItemParams;
  stats: ItemStats;
  name: string;
  /** Celdas de inventario (Diablo/MU) */
  gridW: number;
  gridH: number;
  /** Easter egg: drop ultra-bajo aunque sea common/vulgar. */
  easterEgg?: boolean;
  /**
   * Clave de único nombrado (mythic/legendary especiales).
   * El cupo global vive en WorldState.uniqueDropCounts.
   */
  uniqueKey?: string;
};

/** Ítem colocado en la grilla de la mochila. */
export type BagPlacement = {
  item: ItemInstance;
  x: number;
  y: number;
};

export type EntityId = string;

export type CoreStats = {
  strength: number;
  speed: number;
  defense: number;
};

export type Actor = {
  id: EntityId;
  kind: "player" | "ai";
  /** Cazador (como el jugador) o bicho. */
  role?: "hunter" | "bug";
  /** Segundos hasta elegir otra dirección de paseo. */
  wander?: number;
  pos: Vec2;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  core: CoreStats;
  speed: number;
  facing: number;
  attackCooldown: number;
  attackSwing: number;
  hurtTimer: number;
  stunTimer: number;
  alive: boolean;
  /** Segundos restantes de cadáver / anim de muerte (0 si vivo). */
  deathTimer: number;
  moving: boolean;
  running: boolean;
  lastMoveX: number;
  lastMoveY: number;
  walkPhase: number;
  /** Altura vertical (salto). */
  height: number;
  velY: number;
  crouching: boolean;
  /** Segundos restantes de sangrado (herida abierta). */
  bleedTimer: number;
  /** Daño por segundo mientras sangra. */
  bleedDps: number;
};

export type DamagePopup = {
  id: string;
  pos: Vec2;
  rise: number;
  amount: number;
  life: number;
  maxLife: number;
};

export type LootSource = "player" | "corpse";

export type LootDrop = {
  id: string;
  pos: Vec2;
  item: ItemInstance;
  ttl: number;
  source: LootSource;
  /** Segundos desde que spawneó (para caída al suelo). */
  age: number;
};

export type CoinDrop = {
  id: string;
  pos: Vec2;
  amount: number;
  ttl: number;
  age: number;
};

export type ProjectileVisual = "weapon" | "arrow" | "bolt";

/** Proyectil en vuelo (arrojadiza / flecha / dardo). */
export type Projectile = {
  id: string;
  pos: Vec2;
  dirX: number;
  dirY: number;
  speed: number;
  life: number;
  damage: number;
  radius: number;
  spin: number;
  spinRate: number;
  knock: number;
  stun: number;
  visual: ProjectileVisual;
  sourceItem: ItemInstance | null;
};

export type CoreStatId = keyof CoreStats;

export type ChargeKind = "none" | "thrust" | "arc" | "slam" | "punch" | "throw" | "shot";

/** Animación de combate del jugador (clips + poses procedurales). */
export type CombatAnimKind =
  | "slash"
  | "throw"
  | "dualR"
  | "dualL"
  | "twohand"
  | "bow"
  | "crossbow"
  | "block";

export type WorldConfig = {
  mapSize: number;
  /** Cazadores vivos a la vez. */
  aiCount: number;
  /** Bichos vivos a la vez. */
  bugCount: number;
};
