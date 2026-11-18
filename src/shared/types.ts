export type Vec2 = { x: number; y: number };

export type Rarity = "common" | "uncommon" | "rare" | "epic";

export type SwordParams = {
  seed: number;
  bladeType: "straight" | "curved" | "wide";
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
  subtype: "throwingAxe" | "throwingDagger" | "shuriken" | "javelin";
  size: number;
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
  /** light=botas cuero, trail=botas altas, greaves=grebas metal, plate=botas + placa. */
  style: "light" | "trail" | "greaves" | "plate";
  height: number;
  sole: number;
  leatherHue: number;
  rarity: Rarity;
};

export type ShieldParams = {
  seed: number;
  shape: "round" | "heater" | "kite";
  /** Madera, madera con herrajes, o metal macizo. */
  material: "wood" | "reinforced" | "metal";
  width: number;
  height: number;
  boss: number;
  metalHue: number;
  rarity: Rarity;
};

export type HelmetParams = {
  seed: number;
  style: "cap" | "nasal" | "full" | "barbute" | "sallet" | "great" | "horned";
  /** Cuero endurecido, bronce/latón, o acero. */
  material: "leather" | "bronze" | "steel";
  dome: number;
  brim: number;
  metalHue: number;
  rarity: Rarity;
};

export type ArmorParams = {
  seed: number;
  /** Tipo constructivo de la armadura. */
  style: "leather" | "padded" | "chain" | "scale" | "plate";
  /**
   * Acabado (sobre todo metal):
   * bare = acero/hierro sin pintar, painted = lacado de color, polished = pulido,
   * darkened = ennegrecido / brunido.
   */
  finish: "bare" | "painted" | "polished" | "darkened";
  bulk: number;
  hue: number;
  rarity: Rarity;
};

export type PantsParams = {
  seed: number;
  style: "cloth" | "leather" | "plated";
  length: number;
  hue: number;
  rarity: Rarity;
};

export type GlovesParams = {
  seed: number;
  style: "cloth" | "leather" | "gauntlet";
  bulk: number;
  hue: number;
  rarity: Rarity;
};

export type BeltParams = {
  seed: number;
  style: "rope" | "leather" | "plated";
  width: number;
  hue: number;
  rarity: Rarity;
};

/** Stats unificados: armas llenan combate; gear llena bonuses. */
export type ItemStats = {
  damage: number;
  reach: number;
  attackSpeed: number;
  windup: number;
  armor: number;
  moveSpeedMult: number;
  maxHpBonus: number;
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
  | "throw"
  | "bow"
  | "crossbow"
  | "boots"
  | "shield"
  | "helmet"
  | "armor"
  | "pants"
  | "gloves"
  | "belt";

export type ItemParams =
  | SwordParams
  | AxeParams
  | ThrowParams
  | BowParams
  | CrossbowParams
  | BootsParams
  | ShieldParams
  | HelmetParams
  | ArmorParams
  | PantsParams
  | GlovesParams
  | BeltParams;

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
};

export type CoinDrop = {
  id: string;
  pos: Vec2;
  amount: number;
  ttl: number;
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
  aiCount: number;
};
