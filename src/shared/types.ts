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
  rarity: Rarity;
};

export type SwordStats = {
  damage: number;
  reach: number;
  attackSpeed: number;
  windup: number;
};

/** Slots de equipo estilo Diablo (paper doll). */
export type EquipSlotId =
  | "helmet"
  | "amulet"
  | "armor"
  | "weapon"
  | "offhand"
  | "gloves"
  | "belt"
  | "boots"
  | "ring1"
  | "ring2";

export type Equipment = Record<EquipSlotId, ItemInstance | null>;

export type ItemKind = "sword";

export type ItemInstance = {
  id: string;
  kind: ItemKind;
  /** Slot de paper doll donde puede equiparse */
  equipSlot: EquipSlotId;
  seed: number;
  params: SwordParams;
  stats: SwordStats;
  name: string;
};

export type EntityId = string;

export type Actor = {
  id: EntityId;
  kind: "player" | "ai";
  pos: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  facing: number;
  attackCooldown: number;
  attackSwing: number;
  hurtTimer: number;
  alive: boolean;
  moving: boolean;
  /** Fase de marcha (rad); avanza con la distancia recorrida */
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

export type LootDrop = {
  id: string;
  pos: Vec2;
  item: ItemInstance;
};

export type WorldConfig = {
  mapSize: number;
  aiCount: number;
};
