import { createSwordItem, randomSwordSeed } from "../shared/swords";
import type {
  Actor,
  DamagePopup,
  Equipment,
  EquipSlotId,
  ItemInstance,
  LootDrop,
  Vec2,
  WorldConfig,
} from "../shared/types";

export const BAG_SIZE = 40;
/** Metros de juego por paso (una pierna). Un ciclo completo ≈ 2 zancadas. */
export const STRIDE_LENGTH = 0.72;

export const EQUIP_SLOT_LABELS: Record<EquipSlotId, string> = {
  helmet: "Casco",
  amulet: "Amuleto",
  armor: "Armadura",
  weapon: "Arma",
  offhand: "Escudo",
  gloves: "Guantes",
  belt: "Cinturón",
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
  bag: (ItemInstance | null)[];
  inventoryOpen: boolean;
  loot: LootDrop[];
  damagePopups: DamagePopup[];
  aimPos: Vec2 | null;
  toast: string | null;
  toastTimer: number;
  /** Evita aplicar el daño del slash más de una vez */
  slashHitApplied: boolean;
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

export function createWorld(config: WorldConfig = { mapSize: 40, aiCount: 6 }): WorldState {
  const starter = createSwordItem(42);
  const bag: (ItemInstance | null)[] = Array.from({ length: BAG_SIZE }, () => null);

  const player: Actor = {
    id: nextId("player"),
    kind: "player",
    pos: vec(0, 0),
    hp: 100,
    maxHp: 100,
    speed: 3.1,
    facing: 0,
    attackCooldown: 0,
    attackSwing: 0,
    hurtTimer: 0,
    alive: true,
    moving: false,
    walkPhase: 0,
  };

  const ais: Actor[] = [];
  for (let i = 0; i < config.aiCount; i++) {
    const angle = (i / config.aiCount) * Math.PI * 2;
    const radius = 8 + (i % 3) * 3;
    ais.push({
      id: nextId("ai"),
      kind: "ai",
      pos: vec(Math.cos(angle) * radius, Math.sin(angle) * radius),
      hp: 40 + i * 5,
      maxHp: 40 + i * 5,
      speed: 1.7 + (i % 3) * 0.25,
      facing: 0,
      attackCooldown: 0.5 + i * 0.1,
      attackSwing: 0,
      hurtTimer: 0,
      alive: true,
      moving: false,
      walkPhase: 0,
    });
  }

  const equipment = emptyEquipment();
  equipment.weapon = starter;

  return {
    config,
    time: 0,
    player,
    ais,
    equipment,
    bag,
    inventoryOpen: false,
    loot: [],
    damagePopups: [],
    aimPos: null,
    toast: null,
    toastTimer: 0,
    slashHitApplied: true,
  };
}

export function getEquipped(world: WorldState): ItemInstance | null {
  return world.equipment.weapon;
}

export function setToast(world: WorldState, msg: string): void {
  world.toast = msg;
  world.toastTimer = 1.6;
}

export function toggleInventory(world: WorldState): void {
  world.inventoryOpen = !world.inventoryOpen;
}

function tryAddItem(world: WorldState, item: ItemInstance): boolean {
  const empty = world.bag.findIndex((s) => s === null);
  if (empty === -1) return false;
  world.bag[empty] = item;
  return true;
}

/** Equipa desde la mochila al slot que corresponde al ítem. */
export function equipFromBag(world: WorldState, bagIndex: number): void {
  if (bagIndex < 0 || bagIndex >= world.bag.length) return;
  const item = world.bag[bagIndex];
  if (!item) {
    setToast(world, "Slot vacío");
    return;
  }
  const slot = item.equipSlot;
  const previous = world.equipment[slot];
  world.bag[bagIndex] = previous;
  world.equipment[slot] = item;
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
  setToast(world, `Guardaste ${item.name}`);
}

export function pickupNearest(world: WorldState): void {
  if (!world.player.alive) return;
  let best: LootDrop | null = null;
  let bestD = 1.6;
  for (const drop of world.loot) {
    const d = dist(world.player.pos, drop.pos);
    if (d < bestD) {
      bestD = d;
      best = drop;
    }
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
  const item = createSwordItem(randomSwordSeed());
  world.loot.push({
    id: nextId("loot"),
    pos: { x: pos.x, y: pos.y },
    item,
  });
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

function dealDamage(world: WorldState, target: Actor, amount: number): void {
  if (!target.alive) return;
  target.hp = Math.max(0, target.hp - amount);
  target.hurtTimer = 0.25;
  pushDamage(world, target.pos, amount);
  if (target.hp <= 0) {
    target.alive = false;
    target.hp = 0;
  }
}

export function tryAttack(world: WorldState): void {
  const player = world.player;
  if (!player.alive || player.attackCooldown > 0) return;
  const weapon = getEquipped(world);
  const stats = weapon?.stats ?? { damage: 6, reach: 0.7, attackSpeed: 1.2, windup: 0.15 };
  player.attackCooldown = Math.max(0.42, 1 / stats.attackSpeed);
  player.attackSwing = 0.42;
  world.slashHitApplied = false;
}

function resolveSlashHit(world: WorldState): void {
  if (world.slashHitApplied) return;
  world.slashHitApplied = true;
  const player = world.player;
  const weapon = getEquipped(world);
  const stats = weapon?.stats ?? { damage: 6, reach: 0.7, attackSpeed: 1.2, windup: 0.15 };
  const reach = stats.reach + 0.55;
  let hits = 0;
  let nearestD = Infinity;

  for (const ai of world.ais) {
    if (!ai.alive) continue;
    const d = dist(player.pos, ai.pos);
    if (d < nearestD) nearestD = d;
    if (d > reach) continue;
    dealDamage(world, ai, stats.damage);
    hits += 1;
    if (!ai.alive) {
      spawnLoot(world, ai.pos);
      setToast(world, `${weapon?.name ?? "Golpe"} eliminó un enemigo`);
    }
  }

  if (hits === 0) {
    setToast(world, nearestD < reach + 1.5 ? "Golpe falló" : "Fuera de alcance");
  }
}

function updateAi(world: WorldState, dt: number): void {
  const player = world.player;
  for (const ai of world.ais) {
    if (!ai.alive) continue;
    ai.attackCooldown = Math.max(0, ai.attackCooldown - dt);
    ai.hurtTimer = Math.max(0, ai.hurtTimer - dt);

    if (!player.alive) continue;

    const d = dist(ai.pos, player.pos);
    const dx = player.pos.x - ai.pos.x;
    const dy = player.pos.y - ai.pos.y;
    ai.facing = Math.atan2(dx, dy) + Math.PI;

    if (d > 1.1) {
      const len = Math.hypot(dx, dy) || 1;
      ai.pos.x += (dx / len) * ai.speed * dt;
      ai.pos.y += (dy / len) * ai.speed * dt;
      clampToMap(ai.pos, world.config.mapSize);
    } else if (ai.attackCooldown <= 0) {
      dealDamage(world, player, 8);
      ai.attackCooldown = 0.9;
      ai.attackSwing = 0.18;
      if (!player.alive) setToast(world, "Moriste — recargá la página");
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
  // Daño en el medio del swing (sensación de impacto)
  if (player.attackSwing > 0 && player.attackSwing <= 0.42 * 0.55) {
    resolveSlashHit(world);
  }

  for (const popup of world.damagePopups) {
    popup.life -= dt;
    popup.rise += dt * 1.4;
  }
  world.damagePopups = world.damagePopups.filter((p) => p.life > 0);

  if (player.alive) {
    const len = Math.hypot(input.moveX, input.moveY);
    player.moving = len > 0 && player.alive;

    if (input.hasAim && input.aimMoved) {
      const adx = input.aimX - player.pos.x;
      const ady = input.aimY - player.pos.y;
      if (Math.hypot(adx, ady) > 0.05) {
        player.facing = Math.atan2(adx, ady) + Math.PI;
      }
    } else if (player.moving) {
      // Sin movimiento de mouse: mirar hacia donde camina
      player.facing = Math.atan2(input.moveX / len, input.moveY / len) + Math.PI;
    }

    if (player.moving) {
      const nx = input.moveX / len;
      const ny = input.moveY / len;
      const step = player.speed * dt;
      player.pos.x += nx * step;
      player.pos.y += ny * step;
      player.walkPhase += (step / STRIDE_LENGTH) * Math.PI;
      clampToMap(player.pos, world.config.mapSize);
    }

    world.aimPos = input.hasAim ? { x: input.aimX, y: input.aimY } : null;
  } else {
    player.moving = false;
  }

  updateAi(world, dt);

  // Auto-pickup very close loot
  for (const drop of [...world.loot]) {
    if (dist(player.pos, drop.pos) < 0.85) {
      if (tryAddItem(world, drop.item)) {
        world.loot = world.loot.filter((l) => l.id !== drop.id);
        setToast(world, `Recogiste ${drop.item.name}`);
      }
    }
  }
}

export { dist };
