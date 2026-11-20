import { aggregateCombatElements } from "../shared/elements";
import { createRandomLootItem, isDualWieldable } from "../shared/gear";
import { getBagItem, moveBagItem, removeBagItem, tryPlaceItem } from "./bag";
import type {
  Actor,
  AxeParams,
  BagPlacement,
  ChargeKind,
  ClubParams,
  CoinDrop,
  CombatAnimKind,
  CoreStatId,
  CoreStats,
  DamagePopup,
  ElementKind,
  Equipment,
  EquipSlotId,
  ItemInstance,
  ItemStats,
  LootDrop,
  Projectile,
  SwordParams,
  ThrowParams,
  Vec2,
  WorldConfig,
} from "../shared/types";

export { BAG_COLS, BAG_ROWS } from "./bag";

/**
 * Velocidad base del personaje (m/s por punto de stat `core.speed`).
 * Con speed=10 → ~3.1 m/s; luego se multiplica por el % aditivo de equipo y se capea.
 */
const MOVE_SPEED_PER_STAT = 0.3;
const BASE_PLAYER_MAX_HP = 100;
const BASE_PLAYER_MAX_ENERGY = 100;

export const DEFAULT_PLAYER_CORE: CoreStats = {
  strength: 10,
  speed: 10,
  defense: 5,
};
/** Regen muy lenta (unidades / s) */
const HP_REGEN = 0.35;
const ENERGY_REGEN = 4.5;
/** Sprint: gasto muy bajo */
const ENERGY_SPRINT_DRAIN = 6;
/** Especial (embestida / arc / slam): un poco más */
const ENERGY_CHARGE_COST = 16;
const LOOT_TTL_PLAYER = 30;
const LOOT_TTL_CORPSE = 60;
const COIN_TTL = 60;
/** Chance muy baja de monedas al matar IA */
const COIN_DROP_CHANCE = 0.04;
const COIN_DROP_MIN = 1;
const COIN_DROP_MAX = 3;
/** Coste base del primer +1 a cada stat; sube exponencialmente */
const STAT_COST_BASE = 12;
const STAT_COST_GROWTH = 1.55;
/** Duración visual/lógica del swing (s). */
export const SLASH_DURATION = 0.52;
/** Cuántas variantes de animación de espadazo ciclan. */
export const SLASH_VARIANT_COUNT = 4;
const AI_STUN_ON_HIT = 0.55;
/** Caída / animación de muerte. */
export const AI_DEATH_ANIM = 0.9;
/** Tiempo total de cadáver antes de desaparecer (incluye anim). */
export const AI_CORPSE_TIME = 3.2;
const AI_KNOCKBACK = 1.35;
const AI_RESPAWN_INTERVAL = 1;

/** Metros de juego por paso (una pierna). Un ciclo completo ≈ 2 zancadas. */
export const STRIDE_LENGTH = 0.62;

export const EQUIP_SLOT_LABELS: Record<EquipSlotId, string> = {
  helmet: "Casco",
  amulet: "Amuleto",
  armor: "Armadura",
  weapon: "Arma",
  offhand: "Escudo/Arma",
  gloves: "Guantes",
  belt: "Cinturón",
  pants: "Pantalones",
  boots: "Botas",
  ring1: "Anillo",
  ring2: "Anillo",
};

export function emptyEquipment(): Equipment {
  return {
    helmet: null,
    amulet: null,
    armor: null,
    weapon: null,
    offhand: null,
    gloves: null,
    belt: null,
    pants: null,
    boots: null,
    ring1: null,
    ring2: null,
  };
}

export type WorldState = {
  config: WorldConfig;
  time: number;
  player: Actor;
  ais: Actor[];
  equipment: Equipment;
  bag: BagPlacement[];
  inventoryOpen: boolean;
  /** Panel de personaje / compra de stats (tecla C) */
  characterOpen: boolean;
  loot: LootDrop[];
  coinDrops: CoinDrop[];
  projectiles: Projectile[];
  /** Monedas del jugador */
  coins: number;
  /** Cuántas veces se compró cada stat (para el precio) */
  statPurchases: Record<CoreStatId, number>;
  damagePopups: DamagePopup[];
  aimPos: Vec2 | null;
  toast: string | null;
  toastTimer: number;
  /** Evita aplicar el daño del slash más de una vez */
  slashHitApplied: boolean;
  /** Variante de animación del golpe actual (0..n-1) */
  slashVariant: number;
  /** Próximo índice de variante al atacar */
  slashVariantNext: number;
  /** Animación de combate actual (throw / dual / bow / …) */
  combatAnim: CombatAnimKind;
  /** Alterna mano en dual wield: 0 = derecha, 1 = izquierda */
  dualHandNext: 0 | 1;
  /** Jugador cubriéndose con escudo */
  blocking: boolean;
  /** Proyectil pendiente (se dispara a mitad del swing) */
  pendingShot: { weapon: ItemInstance; charged: boolean } | null;
  pendingShotFired: boolean;
  /** Duración del swing actual (para progreso u). */
  attackSwingMax: number;
  /** Cuenta atrás para spawnear otra IA si faltan */
  aiSpawnTimer: number;
  /** Golpe especial activo (atacar corriendo con energía) */
  chargeAttack: boolean;
  chargeKind: ChargeKind;
  /** Cupos de únicos nombrados (mythic/legendary especiales). */
  uniqueDropCounts: Record<string, number>;
};

function vec(x: number, y: number): Vec2 {
  return { x, y };
}

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function clampToMap(pos: Vec2, mapSize: number): void {
  const half = mapSize * 0.5;
  pos.x = Math.max(-half, Math.min(half, pos.x));
  pos.y = Math.max(-half, Math.min(half, pos.y));
}

let idSeq = 1;
function nextId(prefix: string): string {
  return `${prefix}_${idSeq++}`;
}

/** Tope duro de velocidad de movimiento (m/s), pase lo que pase el gear. */
const MAX_MOVE_SPEED = 6.2;

/** m/s final = core.speed * MOVE_SPEED_PER_STAT * moveMult (1 + Σ% equipo), capped. */
function moveSpeedFromCore(core: CoreStats, moveMult = 1): number {
  return Math.min(MAX_MOVE_SPEED, core.speed * MOVE_SPEED_PER_STAT * moveMult);
}

function makeAi(pos: Vec2, tier = 0, role: "hunter" | "bug" = "bug"): Actor {
  const bug = role === "bug";
  const core: CoreStats = {
    strength: bug ? 3 + tier : 8 + tier,
    speed: bug ? 5 + (tier % 2) : 7 + (tier % 3),
    defense: bug ? 1 : 3 + Math.floor(tier / 2),
  };
  return {
    id: nextId("ai"),
    kind: "ai",
    role,
    pos: { x: pos.x, y: pos.y },
    hp: bug ? 28 + tier * 4 : 70 + tier * 8,
    maxHp: bug ? 28 + tier * 4 : 70 + tier * 8,
    energy: 0,
    maxEnergy: 0,
    core,
    speed: moveSpeedFromCore(core),
    facing: 0,
    attackCooldown: 0.4 + Math.random() * 0.4,
    attackSwing: 0,
    hurtTimer: 0,
    stunTimer: 0,
    alive: true,
    deathTimer: 0,
    moving: false,
    running: false,
    lastMoveX: Math.cos(Math.random() * Math.PI * 2),
    lastMoveY: Math.sin(Math.random() * Math.PI * 2),
    walkPhase: 0,
    wander: 1 + Math.random() * 2,
    height: 0,
    velY: 0,
    crouching: false,
    bleedTimer: 0,
    bleedDps: 0,
  };
}

export function createWorld(config: WorldConfig = { mapSize: 180, aiCount: 8, bugCount: 22 }): WorldState {
  const bag: BagPlacement[] = [];

  const playerCore = { ...DEFAULT_PLAYER_CORE };
  const player: Actor = {
    id: nextId("player"),
    kind: "player",
    pos: vec(0, 0),
    hp: 100,
    maxHp: 100,
    energy: BASE_PLAYER_MAX_ENERGY,
    maxEnergy: BASE_PLAYER_MAX_ENERGY,
    core: playerCore,
    speed: moveSpeedFromCore(playerCore),
    facing: 0,
    attackCooldown: 0,
    attackSwing: 0,
    hurtTimer: 0,
    stunTimer: 0,
    alive: true,
    deathTimer: 0,
    moving: false,
    running: false,
    lastMoveX: 0,
    lastMoveY: 1,
    walkPhase: 0,
    height: 0,
    velY: 0,
    crouching: false,
    bleedTimer: 0,
    bleedDps: 0,
  };

  const ais: Actor[] = [];
  const scatter = (n: number, role: "hunter" | "bug") => {
    const half = config.mapSize * 0.42;
    for (let i = 0; i < n; i++) {
      let x = 0;
      let y = 0;
      for (let k = 0; k < 6; k++) {
        x = (Math.random() * 2 - 1) * half;
        y = (Math.random() * 2 - 1) * half;
        if (Math.hypot(x, y) > 8) break;
      }
      ais.push(makeAi(vec(x, y), i % 5, role));
    }
  };
  scatter(config.aiCount, "hunter");
  scatter(config.bugCount, "bug");

  const equipment = emptyEquipment();

  return {
    config,
    time: 0,
    player,
    ais,
    equipment,
    bag,
    inventoryOpen: false,
    characterOpen: false,
    loot: [],
    coinDrops: [],
    projectiles: [],
    coins: 8,
    statPurchases: { strength: 0, speed: 0, defense: 0 },
    damagePopups: [],
    aimPos: null,
    toast: null,
    toastTimer: 0,
    slashHitApplied: true,
    slashVariant: 0,
    slashVariantNext: 0,
    combatAnim: "slash",
    dualHandNext: 0,
    blocking: false,
    pendingShot: null,
    pendingShotFired: true,
    attackSwingMax: SLASH_DURATION,
    aiSpawnTimer: AI_RESPAWN_INTERVAL,
    chargeAttack: false,
    chargeKind: "none",
    uniqueDropCounts: {},
  };
}

export function getEquipped(world: WorldState): ItemInstance | null {
  return world.equipment.weapon;
}

export function getOffhandWeapon(world: WorldState): ItemInstance | null {
  const o = world.equipment.offhand;
  return o && isDualWieldable(o) ? o : null;
}

/** Puños desarmados. */
function fistStats(): ItemStats {
  return {
    damage: 5,
    reach: 0.72,
    attackSpeed: 1.35,
    windup: 0.1,
    armor: 0,
    moveSpeedMult: 1,
    maxHpBonus: 0,
    element: null,
    elementDamage: 0,
  };
}

/** Desarmado: puños, o garras si hay gloves claws. */
function unarmedCombatStats(world: WorldState): ItemStats {
  const g = world.equipment.gloves;
  const claws = g && (g.params as { style?: string }).style === "claws";
  const base = fistStats();
  if (!claws || !g) return base;
  return {
    ...base,
    damage: Math.round((base.damage + (g.stats.damage || 4)) * 10) / 10,
    reach: Math.max(base.reach, 0.85 + (g.stats.reach || 0)),
    attackSpeed: Math.max(base.attackSpeed, g.stats.attackSpeed || 1.25),
    woundChance: g.stats.woundChance ?? 0.45,
  };
}

/** Stats de combate: arma principal + bonus de doble arma si aplica. Sin arma → puños/garras. */
export function getCombatWeaponStats(world: WorldState): ItemStats {
  const main = getEquipped(world);
  if (!main) return unarmedCombatStats(world);
  const off = getOffhandWeapon(world);
  const base = main.stats;
  if (!off) return { ...base };
  return {
    ...base,
    damage: Math.round((base.damage + off.stats.damage * 0.6) * 10) / 10,
    reach: Math.max(base.reach, off.stats.reach),
    attackSpeed: Math.round(Math.max(base.attackSpeed, off.stats.attackSpeed) * 1.08 * 100) / 100,
    windup: Math.min(base.windup, off.stats.windup),
  };
}

/** Daño total del golpe (físico + elemental de arma + gear). */
export function getHitDamageBreakdown(world: WorldState): {
  physical: number;
  elemental: number;
  trailElement: ElementKind | null;
} {
  const main = getEquipped(world);
  const gear = Object.values(world.equipment);
  const physical = getCombatWeaponStats(world).damage;
  const agg = aggregateCombatElements(main, gear, physical);
  return {
    physical,
    elemental: agg.totalElementDamage,
    trailElement: agg.trailElement,
  };
}

function clearIncompatibleOffhand(world: WorldState, main: ItemInstance | null): boolean {
  const off = world.equipment.offhand;
  if (!off || !isDualWieldable(off)) return true;
  if (main && isDualWieldable(main)) return true;
  if (!tryAddItem(world, off)) return false;
  world.equipment.offhand = null;
  return true;
}

/** Totales de gear: speed/element se suman en % y luego se aplican una vez. */
export function gearTotals(world: WorldState): {
  armor: number;
  /** Factor final = 1 + suma((mult-1)). */
  moveSpeedMult: number;
  /** Suma de puntos porcentuales de velocidad (p.ej. 5 = +5%). */
  moveSpeedBonusPct: number;
  maxHpBonus: number;
} {
  let armor = 0;
  let speedPct = 0;
  let maxHpBonus = 0;
  for (const item of Object.values(world.equipment)) {
    if (!item) continue;
    armor += item.stats.armor;
    // moveSpeedMult 1.04 → +4%; 0.92 → −8%. Se suman, no se multiplican en cadena.
    speedPct += (item.stats.moveSpeedMult - 1) * 100;
    maxHpBonus += item.stats.maxHpBonus;
  }
  const moveSpeedBonusPct = Math.round(speedPct * 10) / 10;
  const moveSpeedMult = Math.max(0.55, 1 + speedPct / 100);
  return { armor, moveSpeedMult, moveSpeedBonusPct, maxHpBonus };
}

/** Recalcula movimiento / maxHp del jugador según core + gear. */
export function applyGearToPlayer(world: WorldState): void {
  const p = world.player;
  const g = gearTotals(world);
  p.speed = moveSpeedFromCore(p.core, g.moveSpeedMult);
  const newMax = BASE_PLAYER_MAX_HP + g.maxHpBonus;
  if (newMax !== p.maxHp) {
    const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    p.maxHp = newMax;
    p.hp = Math.min(newMax, Math.max(1, Math.round(ratio * newMax)));
  }
}

/** Daño de salida: arma × (1 + fuerza/50). */
export function outgoingDamage(attacker: Actor, weaponDamage: number): number {
  return weaponDamage * (1 + attacker.core.strength / 50);
}

/** Mitigación: defensa core + armor de ítems (solo player usa gear armor). */
function mitigatedDamage(world: WorldState, target: Actor, amount: number, applyGearArmor: boolean): number {
  let flat = target.core.defense;
  if (applyGearArmor && target.kind === "player") {
    flat += gearTotals(world).armor;
  }
  return Math.max(1, amount - flat);
}

export function setToast(world: WorldState, msg: string): void {
  world.toast = msg;
  world.toastTimer = 1.6;
}

export function toggleInventory(world: WorldState): void {
  world.inventoryOpen = !world.inventoryOpen;
  if (world.inventoryOpen) world.characterOpen = false;
}

export function toggleCharacter(world: WorldState): void {
  world.characterOpen = !world.characterOpen;
  if (world.characterOpen) world.inventoryOpen = false;
}

function tryAddItem(world: WorldState, item: ItemInstance): boolean {
  return tryPlaceItem(world.bag, item);
}

/** Equipa desde la mochila (por id de ítem) al slot correspondiente. */
export function moveBagItemTo(world: WorldState, itemId: string, x: number, y: number): void {
  moveBagItem(world.bag, itemId, x, y);
}

export function equipFromBag(world: WorldState, itemId: string): void {
  const placed = getBagItem(world.bag, itemId);
  if (!placed) {
    setToast(world, "Ítem no encontrado");
    return;
  }
  const item = placed.item;
  removeBagItem(world.bag, itemId);

  const abort = (msg: string) => {
    tryPlaceItem(world.bag, item);
    setToast(world, msg);
  };

  // Doble arma: 1ª → mano principal, 2ª → offhand (si la principal también es dual)
  if (isDualWieldable(item)) {
    const main = world.equipment.weapon;
    const off = world.equipment.offhand;
    if (!main) {
      world.equipment.weapon = item;
      setToast(world, `Equipado: ${item.name}`);
    } else if (isDualWieldable(main)) {
      if (off && !tryAddItem(world, off)) {
        abort("Sin espacio para el ítem desequipado");
        return;
      }
      world.equipment.offhand = item;
      setToast(world, `Doble arma: ${item.name}`);
    } else {
      if (!tryAddItem(world, main)) {
        abort("Sin espacio para el ítem desequipado");
        return;
      }
      world.equipment.weapon = item;
      if (!clearIncompatibleOffhand(world, item)) {
        world.equipment.weapon = main;
        removeBagItem(world.bag, main.id);
        abort("Sin espacio para el offhand");
        return;
      }
      setToast(world, `Equipado: ${item.name}`);
    }
    applyGearToPlayer(world);
    return;
  }

  const slot =
    item.kind === "ring" && world.equipment.ring1 && !world.equipment.ring2 ? "ring2" : item.equipSlot;
  const previous = world.equipment[slot];
  if (previous && !tryAddItem(world, previous)) {
    abort("Sin espacio para el ítem desequipado");
    return;
  }
  world.equipment[slot] = item;

  if (slot === "weapon") {
    if (!clearIncompatibleOffhand(world, item)) {
      world.equipment[slot] = previous;
      if (previous) removeBagItem(world.bag, previous.id);
      abort("Sin espacio para el offhand");
      return;
    }
  }

  applyGearToPlayer(world);
  setToast(world, `Equipado: ${item.name}`);
}

export function unequipSlot(world: WorldState, slot: EquipSlotId): void {
  const item = world.equipment[slot];
  if (!item) {
    setToast(world, "Slot vacío");
    return;
  }
  if (!tryAddItem(world, item)) {
    setToast(world, "Mochila llena");
    return;
  }
  world.equipment[slot] = null;
  applyGearToPlayer(world);
  setToast(world, `Guardaste ${item.name}`);
}

function dropItemAtPlayer(world: WorldState, item: ItemInstance): void {
  const p = world.player;
  const ox = (Math.random() - 0.5) * 0.6;
  const oy = (Math.random() - 0.5) * 0.6;
  world.loot.push({
    id: nextId("loot"),
    pos: { x: p.pos.x + ox, y: p.pos.y + oy },
    item,
    ttl: LOOT_TTL_PLAYER,
    source: "player",
    age: 0,
  });
}

/** Tira un ítem de la mochila al suelo (despawn 30s). */
export function dropFromBag(world: WorldState, itemId: string): void {
  if (!world.player.alive) return;
  const item = removeBagItem(world.bag, itemId);
  if (!item) {
    setToast(world, "Ítem no encontrado");
    return;
  }
  dropItemAtPlayer(world, item);
  setToast(world, `Tiraste ${item.name}`);
}

/** Tira el ítem equipado en un slot al suelo (despawn 30s). */
export function dropFromEquip(world: WorldState, slot: EquipSlotId): void {
  if (!world.player.alive) return;
  const item = world.equipment[slot];
  if (!item) {
    setToast(world, "Slot vacío");
    return;
  }
  world.equipment[slot] = null;
  applyGearToPlayer(world);
  dropItemAtPlayer(world, item);
  setToast(world, `Tiraste ${item.name}`);
}

function isRangedWeapon(weapon: ItemInstance | null): boolean {
  return !!weapon && (weapon.kind === "throw" || weapon.kind === "bow" || weapon.kind === "crossbow");
}

/** Arma a dos manos (arco/ballesta o melee grande). */
export function isTwoHanded(weapon: ItemInstance | null): boolean {
  if (!weapon) return false;
  if (weapon.kind === "bow" || weapon.kind === "crossbow") return true;
  if (weapon.kind === "axe") {
    return (weapon.params as AxeParams).haftLength >= 0.72;
  }
  if (weapon.kind === "club") {
    const p = weapon.params as ClubParams;
    return p.subtype !== "nunchaku" && p.length >= 0.95;
  }
  if (weapon.kind === "sword") {
    const p = weapon.params as SwordParams;
    // Solo mandobles claros (ancho + largo); el resto es 1H
    return p.bladeType === "wide" && p.bladeLength >= 1.05;
  }
  return false;
}

export function hasShield(world: WorldState): boolean {
  return world.equipment.offhand?.kind === "shield";
}

function pickCombatAnim(world: WorldState, weapon: ItemInstance | null): CombatAnimKind {
  if (!weapon) return "slash"; // puños / garras
  if (weapon.kind === "bow") return "bow";
  if (weapon.kind === "crossbow") return "crossbow";
  if (weapon.kind === "throw") return "throw";
  if (isTwoHanded(weapon)) return "twohand";
  if (getOffhandWeapon(world)) return "dualR";
  return "slash";
}

export function setBlocking(world: WorldState, on: boolean): void {
  if (!world.player.alive || world.inventoryOpen || world.characterOpen) {
    world.blocking = false;
    return;
  }
  world.blocking = on && hasShield(world);
  if (world.blocking) {
    world.combatAnim = "block";
    world.player.attackSwing = 0;
    world.pendingShot = null;
    world.pendingShotFired = true;
  }
}

function chargeKindForWeapon(weapon: ItemInstance | null): ChargeKind {
  if (!weapon) return "punch";
  if (weapon.kind === "throw") return "throw";
  if (weapon.kind === "bow" || weapon.kind === "crossbow") return "shot";
  if (weapon.kind === "axe") {
    const h = (weapon.params as AxeParams).headStyle;
    return h === "double" ? "arc" : "slam";
  }
  if (weapon.kind === "club") {
    const p = weapon.params as ClubParams;
    if (p.subtype === "nunchaku") return "arc";
    if (p.subtype === "scissors") return "thrust";
    if (p.subtype === "pan" || p.subtype === "crowbar" || p.subtype === "pipe") return "slam";
    return "thrust";
  }
  if (weapon.kind === "sword") {
    const blade = (weapon.params as SwordParams).bladeType;
    if (blade === "curved" || blade === "katana" || blade === "saber") return "arc";
    if (blade === "wide") return "slam";
    return "thrust"; // straight / foil
  }
  return "punch";
}

function fireDir(player: Actor, aimPos: Vec2 | null): { x: number; y: number } {
  if (aimPos) {
    const dx = aimPos.x - player.pos.x;
    const dy = aimPos.y - player.pos.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.05) return { x: dx / len, y: dy / len };
  }
  return { x: -Math.sin(player.facing), y: -Math.cos(player.facing) };
}

function spawnPlayerProjectile(world: WorldState, weapon: ItemInstance, charged: boolean): void {
  const player = world.player;
  const dir = fireDir(player, world.aimPos);
  const stats = weapon.stats;
  const range = Math.max(4, stats.reach + (charged ? 2.2 : 0));
  let speed = 14;
  let spinRate = 0;
  let visual: Projectile["visual"] = "weapon";
  let sourceItem: ItemInstance | null = weapon;
  let radius = 0.45;

  if (weapon.kind === "throw") {
    const sub = (weapon.params as ThrowParams).subtype;
    speed = sub === "javelin" ? 16 : sub === "shuriken" ? 18 : sub === "throwingDagger" ? 17 : 14;
    spinRate = sub === "shuriken" || sub === "throwingAxe" ? 18 : sub === "throwingDagger" ? 10 : 2;
    radius = sub === "javelin" ? 0.55 : 0.4;
  } else if (weapon.kind === "bow") {
    speed = charged ? 22 : 18;
    visual = "arrow";
    sourceItem = null;
    radius = 0.35;
  } else {
    speed = charged ? 20 : 16;
    visual = "bolt";
    sourceItem = null;
    radius = 0.4;
  }

  const dmgMult = charged ? (weapon.kind === "crossbow" ? 2.1 : weapon.kind === "bow" ? 1.7 : 1.6) : 1;
  const life = range / speed;
  const phys = stats.damage;
  const elem = aggregateCombatElements(weapon, Object.values(world.equipment), phys)
    .totalElementDamage;
  world.projectiles.push({
    id: nextId("proj"),
    pos: { x: player.pos.x + dir.x * 0.55, y: player.pos.y + dir.y * 0.55 },
    dirX: dir.x,
    dirY: dir.y,
    speed,
    life,
    damage: outgoingDamage(player, stats.damage + elem) * dmgMult,
    radius,
    spin: 0,
    spinRate,
    knock: AI_KNOCKBACK * (charged ? 1.4 : 0.9),
    stun: AI_STUN_ON_HIT * (charged ? 1.3 : 1),
    visual,
    sourceItem,
  });
}

function updateProjectiles(world: WorldState, dt: number): void {
  if (world.projectiles.length === 0) return;
  const next: Projectile[] = [];
  for (const p of world.projectiles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.pos.x += p.dirX * p.speed * dt;
    p.pos.y += p.dirY * p.speed * dt;
    p.spin += p.spinRate * dt;
    let hit = false;
    for (const ai of world.ais) {
      if (!ai.alive || ai.role === "hunter") continue;
      if (dist(p.pos, ai.pos) > p.radius + 0.55) continue;
      dealDamage(world, ai, p.damage);
      const klen = Math.hypot(p.dirX, p.dirY) || 1;
      ai.pos.x += (p.dirX / klen) * p.knock;
      ai.pos.y += (p.dirY / klen) * p.knock;
      clampToMap(ai.pos, world.config.mapSize);
      ai.stunTimer = Math.max(ai.stunTimer, p.stun);
      ai.attackSwing = 0;
      if (!ai.alive) {
        spawnLoot(world, ai.pos);
        setToast(world, "Impacto mortal");
      }
      hit = true;
      break;
    }
    if (!hit) next.push(p);
  }
  world.projectiles = next;
}

export function pickupNearest(world: WorldState): void {
  if (!world.player.alive) return;
  let bestCoin: CoinDrop | null = null;
  let bestCoinD = 1.6;
  for (const c of world.coinDrops) {
    const d = dist(world.player.pos, c.pos);
    if (d < bestCoinD) {
      bestCoinD = d;
      bestCoin = c;
    }
  }
  let best: LootDrop | null = null;
  let bestD = 1.6;
  for (const drop of world.loot) {
    const d = dist(world.player.pos, drop.pos);
    if (d < bestD) {
      bestD = d;
      best = drop;
    }
  }
  if (bestCoin && bestCoinD <= bestD) {
    world.coins += bestCoin.amount;
    world.coinDrops = world.coinDrops.filter((c) => c.id !== bestCoin!.id);
    setToast(world, `+${bestCoin.amount} monedas`);
    return;
  }
  if (!best) {
    setToast(world, "Nada cerca para recoger");
    return;
  }
  if (!tryAddItem(world, best.item)) {
    setToast(world, "Inventario lleno");
    return;
  }
  world.loot = world.loot.filter((l) => l.id !== best!.id);
  setToast(world, `Recogiste ${best.item.name}`);
}

function spawnLoot(world: WorldState, pos: Vec2): void {
  const item = createRandomLootItem();
  world.loot.push({
    id: nextId("loot"),
    pos: { x: pos.x + (Math.random() - 0.5) * 0.4, y: pos.y + (Math.random() - 0.5) * 0.4 },
    item,
    ttl: LOOT_TTL_CORPSE,
    source: "corpse",
    age: 0,
  });
  maybeSpawnCoins(world, pos);
}

function maybeSpawnCoins(world: WorldState, pos: Vec2): void {
  if (Math.random() > COIN_DROP_CHANCE) return;
  const amount =
    COIN_DROP_MIN + Math.floor(Math.random() * (COIN_DROP_MAX - COIN_DROP_MIN + 1));
  world.coinDrops.push({
    id: nextId("coin"),
    pos: { x: pos.x + (Math.random() - 0.5) * 0.5, y: pos.y + (Math.random() - 0.5) * 0.5 },
    amount,
    ttl: COIN_TTL,
    age: 0,
  });
}

export function statUpgradeCost(world: WorldState, stat: CoreStatId): number {
  const n = world.statPurchases[stat];
  return Math.max(1, Math.floor(STAT_COST_BASE * Math.pow(STAT_COST_GROWTH, n)));
}

/** Compra +1 a un stat core; el precio sube cada compra. */
export function buyStat(world: WorldState, stat: CoreStatId): void {
  const cost = statUpgradeCost(world, stat);
  if (world.coins < cost) {
    setToast(world, `Necesitás ${cost} monedas`);
    return;
  }
  world.coins -= cost;
  world.statPurchases[stat] += 1;
  world.player.core[stat] += 1;
  applyGearToPlayer(world);
  const label = stat === "strength" ? "Fuerza" : stat === "speed" ? "Velocidad" : "Defensa";
  setToast(world, `${label} +1 (${world.player.core[stat]}) · próximo ${statUpgradeCost(world, stat)}🪙`);
}

function pushDamage(world: WorldState, pos: Vec2, amount: number): void {
  world.damagePopups.push({
    id: nextId("dmg"),
    pos: { x: pos.x, y: pos.y },
    rise: 0,
    amount: Math.round(amount),
    life: 0.7,
    maxLife: 0.7,
  });
}

function dealDamage(world: WorldState, target: Actor, amount: number, applyGearArmor = false): void {
  if (!target.alive) return;
  let raw = amount;
  // Bloqueo con escudo: gran mitigación
  if (target.kind === "player" && world.blocking && hasShield(world)) {
    raw *= 0.28;
    target.energy = Math.max(0, target.energy - 4);
    if (target.energy <= 0) world.blocking = false;
  }
  const dmg = mitigatedDamage(world, target, raw, applyGearArmor);
  target.hp = Math.max(0, target.hp - dmg);
  target.hurtTimer = 0.25;
  pushDamage(world, target.pos, dmg);
  if (target.hp <= 0) {
    target.alive = false;
    target.hp = 0;
    target.moving = false;
    target.running = false;
    target.attackSwing = 0;
    if (target.kind === "ai") target.deathTimer = AI_CORPSE_TIME;
  }
}

export function tryAttack(world: WorldState, opts?: { sprintHeld?: boolean }): void {
  const player = world.player;
  if (!player.alive || player.attackCooldown > 0) return;
  if (world.blocking) return;
  const weapon = getEquipped(world);
  const stats = getCombatWeaponStats(world);
  const sprintHeld = !!(opts?.sprintHeld ?? player.running);
  const canCharge =
    sprintHeld &&
    (player.moving || player.running) &&
    player.energy >= ENERGY_CHARGE_COST;
  world.chargeAttack = canCharge;
  world.chargeKind = canCharge ? chargeKindForWeapon(weapon) : "none";
  const ranged = isRangedWeapon(weapon);
  world.combatAnim = pickCombatAnim(world, weapon);

  if (canCharge) {
    player.energy = Math.max(0, player.energy - ENERGY_CHARGE_COST);
    const kind = world.chargeKind;
    if (!ranged) {
      const lunge =
        kind === "thrust" ? 1.35 : kind === "slam" ? 0.75 : kind === "arc" ? 0.9 : 0.7;
      player.pos.x += player.lastMoveX * lunge;
      player.pos.y += player.lastMoveY * lunge;
      clampToMap(player.pos, world.config.mapSize);
    }
    const spdFactor = 1 + player.core.speed / 100;
    player.attackCooldown = Math.max(
      ranged ? 0.22 : 0.28,
      0.75 / Math.max(0.5, stats.attackSpeed * spdFactor),
    );
    const twoH = world.combatAnim === "twohand";
    player.attackSwing =
      SLASH_DURATION *
      (kind === "slam" ? 1.2 : ranged ? 0.85 : twoH ? 1.15 : 1.05);
    world.attackSwingMax = player.attackSwing;
    world.slashVariant =
      world.combatAnim === "dualL" || world.combatAnim === "throw" || world.combatAnim === "bow"
        ? 1
        : world.combatAnim === "dualR"
          ? 0
          : kind === "arc" || kind === "shot"
            ? 2
            : kind === "thrust"
              ? 0
              : 1;
  } else {
    world.chargeKind = "none";
    const spdFactor = 1 + player.core.speed / 100;
    player.attackCooldown = Math.max(
      ranged ? 0.16 : 0.12,
      0.55 / Math.max(0.5, stats.attackSpeed * spdFactor),
    );
    const twoH = world.combatAnim === "twohand";
    player.attackSwing = SLASH_DURATION * (ranged ? 0.85 : twoH ? 1.1 : world.combatAnim === "dualL" || world.combatAnim === "dualR" ? 0.85 : 1);
    world.attackSwingMax = player.attackSwing;
    world.slashVariant =
      world.combatAnim === "dualL" || world.combatAnim === "throw" || world.combatAnim === "bow"
        ? 1
        : world.combatAnim === "crossbow"
          ? 0
          : world.slashVariantNext % SLASH_VARIANT_COUNT;
    world.slashVariantNext = (world.slashVariantNext + 1) % SLASH_VARIANT_COUNT;
  }

  if (ranged && weapon) {
    // Disparo a mitad del swing (animación de tiro / arco)
    world.pendingShot = { weapon, charged: canCharge };
    world.pendingShotFired = false;
    world.slashHitApplied = true;
    if (canCharge) {
      setToast(
        world,
        weapon.kind === "bow" ? "Flecha potente!" : weapon.kind === "crossbow" ? "Disparo de ballesta!" : "Tiro especial!",
      );
    }
  } else {
    world.pendingShot = null;
    world.pendingShotFired = true;
    world.slashHitApplied = false;
  }
}

function resolveSlashHit(world: WorldState): void {
  if (world.slashHitApplied) return;
  world.slashHitApplied = true;
  const player = world.player;
  const weapon = getEquipped(world);
  const offWeapon = getOffhandWeapon(world);
  const stats = weapon?.stats ?? getCombatWeaponStats(world);
  const dual = !!offWeapon;
  const kind = world.chargeAttack ? world.chargeKind : "none";
  const reachBonus =
    kind === "thrust"
      ? 0.35
      : kind === "arc"
        ? 0.25
        : kind === "throw"
          ? 0.4
          : kind === "slam"
            ? 0.15
            : kind === "punch"
              ? 0.1
              : 0;
  // Alcance ≈ stats.reach del arma (+ poco padding); antes +0.55 hinchaba el hitbox.
  const reach = stats.reach + 0.2 + reachBonus;
  // Cono frontal (dot vs facing). Arc especial ≈ 360°; el resto no pega atrás.
  const halfAngle =
    kind === "arc" ? Math.PI : kind === "slam" ? 0.95 : kind === "thrust" ? 0.55 : 1.05;
  const minDot = Math.cos(halfAngle);
  const fx = -Math.sin(player.facing);
  const fy = -Math.cos(player.facing);
  const dmgMult =
    kind === "slam"
      ? 2.1
      : kind === "thrust"
        ? 1.75
        : kind === "throw"
          ? 1.6
          : kind === "arc"
            ? 1.45
            : kind === "punch"
              ? 1.55
              : 1;
  const knockMult =
    kind === "arc"
      ? 2.2
      : kind === "slam"
        ? 2.0
        : kind === "throw"
          ? 1.3
          : kind === "thrust"
            ? 1.7
            : kind === "punch"
              ? 1.5
              : 1;
  const stunMult =
    kind === "slam"
      ? 2.0
      : kind === "punch"
        ? 1.7
        : kind === "arc"
          ? 1.4
          : kind === "throw"
            ? 1.2
            : kind === "thrust"
              ? 1.5
              : 1;
  let hits = 0;
  let nearestD = Infinity;

  for (const ai of world.ais) {
    if (!ai.alive || ai.role === "hunter") continue;
    const d = dist(player.pos, ai.pos);
    if (d < nearestD) nearestD = d;
    if (d > reach || d < 0.02) continue;
    const toX = (ai.pos.x - player.pos.x) / d;
    const toY = (ai.pos.y - player.pos.y) / d;
    const facingDot = toX * fx + toY * fy;
    if (facingDot < minDot) continue;
    {
      const hit = getHitDamageBreakdown(world);
      dealDamage(world, ai, outgoingDamage(player, hit.physical + hit.elemental) * dmgMult);
      if (offWeapon)
        dealDamage(world, ai, outgoingDamage(player, offWeapon.stats.damage) * dmgMult);
      const woundP =
        (weapon?.stats.woundChance ?? 0) ||
        (!weapon ? getCombatWeaponStats(world).woundChance ?? 0 : 0);
      if (woundP > 0 && Math.random() < woundP) {
        ai.bleedTimer = Math.max(ai.bleedTimer, 3.5 + Math.random() * 2);
        ai.bleedDps = Math.max(ai.bleedDps, 1.8 + player.core.strength * 0.04);
        setToast(world, "¡Herida abierta!");
      }
    }
    let kdx = ai.pos.x - player.pos.x;
    let kdy = ai.pos.y - player.pos.y;
    if (kind === "arc") {
      // Empuje más lateral
      const side = player.lastMoveX;
      kdx += -player.lastMoveY * 0.8 * (side >= 0 ? 1 : -1);
      kdy += player.lastMoveX * 0.8 * (side >= 0 ? 1 : -1);
    }
    const klen = Math.hypot(kdx, kdy) || 1;
    const knock = AI_KNOCKBACK * knockMult;
    ai.pos.x += (kdx / klen) * knock;
    ai.pos.y += (kdy / klen) * knock;
    clampToMap(ai.pos, world.config.mapSize);
    ai.stunTimer = Math.max(ai.stunTimer, AI_STUN_ON_HIT * stunMult);
    ai.attackSwing = 0;
    hits += 1;
    if (!ai.alive) {
      spawnLoot(world, ai.pos);
      setToast(world, `${weapon?.name ?? "Golpe"} eliminó un enemigo`);
    }
  }

  if (hits === 0) {
    setToast(world, nearestD < reach + 1.5 ? "Golpe falló" : "Fuera de alcance");
  } else if (kind === "thrust") setToast(world, "Estocada!");
  else if (kind === "arc") setToast(world, "Arco cortante!");
  else if (kind === "slam") setToast(world, "Mazazo!");
  else if (kind === "throw" || kind === "shot") setToast(world, "Tiro especial!");
  else if (kind === "punch") setToast(world, "Embestida!");
  else if (!weapon) {
    const claws =
      world.equipment.gloves &&
      (world.equipment.gloves.params as { style?: string }).style === "claws";
    setToast(world, claws ? "Zarpazo!" : "Puñetazo!");
  } else if (dual) setToast(world, "Doble golpe!");
}

function spawnRole(world: WorldState, role: "hunter" | "bug"): void {
  const half = world.config.mapSize * 0.45;
  let x = 0;
  let y = 0;
  for (let n = 0; n < 8; n++) {
    x = (Math.random() * 2 - 1) * half;
    y = (Math.random() * 2 - 1) * half;
    if (dist({ x, y }, world.player.pos) > 12) break;
  }
  const tier = role === "bug" ? Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 4);
  world.ais.push(makeAi(vec(x, y), tier, role));
}

function updateAi(world: WorldState, dt: number): void {
  const player = world.player;
  // Cadáveres: countdown y vanish
  for (const ai of world.ais) {
    if (ai.alive || ai.deathTimer <= 0) continue;
    ai.deathTimer = Math.max(0, ai.deathTimer - dt);
  }
  if (world.ais.some((a) => !a.alive && a.deathTimer <= 0)) {
    world.ais = world.ais.filter((a) => a.alive || a.deathTimer > 0);
  }

  world.aiSpawnTimer -= dt;
  if (world.aiSpawnTimer <= 0) {
    world.aiSpawnTimer = AI_RESPAWN_INTERVAL * (0.7 + Math.random() * 0.6);
    const hunters = world.ais.filter((a) => a.alive && a.role === "hunter").length;
    const bugs = world.ais.filter((a) => a.alive && a.role !== "hunter").length;
    if (hunters < world.config.aiCount) spawnRole(world, "hunter");
    if (bugs < world.config.bugCount) spawnRole(world, "bug");
  }

  for (const ai of world.ais) {
    if (!ai.alive) continue;
    ai.attackCooldown = Math.max(0, ai.attackCooldown - dt);
    ai.attackSwing = Math.max(0, ai.attackSwing - dt);
    ai.hurtTimer = Math.max(0, ai.hurtTimer - dt);
    ai.stunTimer = Math.max(0, ai.stunTimer - dt);
    if (ai.stunTimer > 0) {
      ai.moving = false;
      continue;
    }

    const hunter = ai.role === "hunter";
    let tx = 0;
    let ty = 0;
    let prey: Actor | null = null;
    let best = hunter ? 16 : 7;
    if (!hunter && player.alive) {
      const dp = dist(ai.pos, player.pos);
      if (dp < best) {
        best = dp;
        prey = player;
      }
    }
    for (const other of world.ais) {
      if (!other.alive || other === ai) continue;
      if (hunter ? other.role !== "bug" : other.role !== "hunter") continue;
      const d = dist(ai.pos, other.pos);
      if (d < best) {
        best = d;
        prey = other;
      }
    }

    if (prey) {
      tx = prey.pos.x - ai.pos.x;
      ty = prey.pos.y - ai.pos.y;
    } else {
      ai.wander = (ai.wander ?? 0) - dt;
      if (ai.wander <= 0) {
        const a = Math.random() * Math.PI * 2;
        ai.lastMoveX = Math.cos(a);
        ai.lastMoveY = Math.sin(a);
        ai.wander = 2 + Math.random() * 3;
      }
      tx = ai.lastMoveX;
      ty = ai.lastMoveY;
    }

    const d = Math.hypot(tx, ty) || 1;
    ai.facing = Math.atan2(tx, ty) + Math.PI;
    if (!prey || d > 1.1) {
      const step = ai.speed * dt * (prey ? 1 : 0.55);
      ai.pos.x += (tx / d) * step;
      ai.pos.y += (ty / d) * step;
      ai.walkPhase += (step / STRIDE_LENGTH) * Math.PI;
      ai.moving = true;
      clampToMap(ai.pos, world.config.mapSize);
    } else {
      ai.moving = false;
      if (ai.attackCooldown <= 0) {
        dealDamage(world, prey, outgoingDamage(ai, hunter ? 12 : 7), prey.kind === "player");
        ai.attackCooldown = hunter ? 0.85 : 1.05;
        ai.attackSwing = 0.28;
        if (prey.kind === "player" && !prey.alive) setToast(world, "Moriste — recargá la página");
      }
    }
  }
}

export type InputState = {
  /** Movimiento absoluto en mundo (mapeo iso pantalla → XZ). */
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  hasAim: boolean;
  /** true si el mouse se movió desde el frame anterior */
  aimMoved: boolean;
  /** Shift: sprint */
  sprint: boolean;
  /** Espacio: impulso de salto (edge) */
  jump: boolean;
  /** Ctrl: agachar */
  crouch: boolean;
};

export function stepWorld(world: WorldState, dt: number, input: InputState): void {
  world.time += dt;
  if (world.toastTimer > 0) {
    world.toastTimer -= dt;
    if (world.toastTimer <= 0) world.toast = null;
  }

  const player = world.player;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.attackSwing = Math.max(0, player.attackSwing - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  // Sangrado (heridas abiertas)
  const tickBleed = (a: Actor) => {
    if (a.bleedTimer <= 0 || !a.alive) return;
    a.bleedTimer = Math.max(0, a.bleedTimer - dt);
    const dmg = a.bleedDps * dt;
    if (dmg > 0) {
      a.hp = Math.max(0, a.hp - dmg);
      if (a.hp <= 0) {
        a.alive = false;
        a.hp = 0;
        if (a.kind === "ai") a.deathTimer = AI_CORPSE_TIME;
      }
    }
    if (a.bleedTimer <= 0) a.bleedDps = 0;
  };
  tickBleed(player);
  for (const ai of world.ais) tickBleed(ai);
  if (player.attackSwing > 0 && player.attackSwing <= Math.max(0.05, world.attackSwingMax) * 0.55) {
    resolveSlashHit(world);
  }
  // Soltar proyectil a ~40% del swing (tiro / arco / ballesta)
  if (player.attackSwing > 0 && !world.pendingShotFired && world.pendingShot) {
    const u = 1 - Math.min(1, player.attackSwing / Math.max(0.05, world.attackSwingMax));
    if (u >= 0.4) {
      spawnPlayerProjectile(world, world.pendingShot.weapon, world.pendingShot.charged);
      world.pendingShotFired = true;
      world.pendingShot = null;
    }
  }

  updateProjectiles(world, dt);

  for (const popup of world.damagePopups) {
    popup.life -= dt;
    popup.rise += dt * 1.4;
  }
  world.damagePopups = world.damagePopups.filter((p) => p.life > 0);

  if (player.alive) {
    const grounded = player.height <= 0.001;
    player.crouching = input.crouch && grounded;
    if (input.jump && grounded && !player.crouching) {
      player.velY = 7.2;
      player.height = 0.001;
    }
    player.velY -= 22 * dt;
    player.height += player.velY * dt;
    if (player.height <= 0) {
      player.height = 0;
      player.velY = 0;
    }

    const len = Math.hypot(input.moveX, input.moveY);
    player.moving = len > 0 && player.alive;
    player.running =
      player.moving && input.sprint && player.energy > 1 && !player.crouching && grounded;

    // Mirar al mouse solo parado; con WASD, hacia donde camina
    if (player.moving) {
      player.facing = Math.atan2(input.moveX / len, input.moveY / len) + Math.PI;
    } else if (input.hasAim && input.aimMoved) {
      const adx = input.aimX - player.pos.x;
      const ady = input.aimY - player.pos.y;
      if (Math.hypot(adx, ady) > 0.05) {
        player.facing = Math.atan2(adx, ady) + Math.PI;
      }
    }

    if (player.moving) {
      const nx = input.moveX / len;
      const ny = input.moveY / len;
      player.lastMoveX = nx;
      player.lastMoveY = ny;
      const sprintMult = player.running ? 1.5 : 1;
      const crouchMult = player.crouching ? 0.5 : 1;
      const step = player.speed * sprintMult * crouchMult * dt;
      player.pos.x += nx * step;
      player.pos.y += ny * step;
      player.walkPhase += (step / STRIDE_LENGTH) * Math.PI;
      clampToMap(player.pos, world.config.mapSize);
      if (player.running) {
        player.energy = Math.max(0, player.energy - ENERGY_SPRINT_DRAIN * dt);
      }
    }

    if (!player.running) {
      player.energy = Math.min(
        player.maxEnergy,
        player.energy + ENERGY_REGEN * dt,
      );
    }
    if (player.hp > 0 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + HP_REGEN * dt);
    }

    world.aimPos = input.hasAim ? { x: input.aimX, y: input.aimY } : null;
  } else {
    player.moving = false;
    player.running = false;
  }

  updateAi(world, dt);

  // Despawn loot / monedas por TTL + edad de caída
  for (const drop of world.loot) {
    drop.ttl -= dt;
    drop.age += dt;
  }
  for (const c of world.coinDrops) {
    c.ttl -= dt;
    c.age += dt;
  }
  if (world.loot.some((d) => d.ttl <= 0)) {
    world.loot = world.loot.filter((d) => d.ttl > 0);
  }
  if (world.coinDrops.some((d) => d.ttl <= 0)) {
    world.coinDrops = world.coinDrops.filter((d) => d.ttl > 0);
  }
}

export { dist };
