import { rarityMult, rarityRank } from "./rng";
import type { ClubParams, ItemInstance, ItemStats, Rarity } from "./types";

const WEAPON_KINDS = new Set(["sword", "axe", "club", "throw", "bow", "crossbow"]);
const JEWELRY_KINDS = new Set(["ring", "amulet"]);

/** Bonus porcentuales. La velocidad base del arma queda; esto la multiplica. */
function rollAffixes(r: () => number, rarity: Rarity, weapon: boolean): Partial<ItemStats> {
  const t = rarityRank(rarity);
  const span = 3 + t * 1.6;
  const out: Partial<ItemStats> = {};
  const signed = () => Math.round((r() < 0.7 ? 1 : -1) * (2 + r() * span));
  if (r() < 0.45 + t * 0.04) out.attackSpeedPct = signed();
  if (r() < 0.4 + t * 0.04) out.hpRegenPct = signed();
  if (r() < 0.4 + t * 0.04) out.energyRegenPct = signed();
  if (r() < 0.32 + t * 0.04) out.maxEnergyPct = signed();
  if (weapon && r() < 0.22 + t * 0.06) {
    out.stunChance = Math.round((0.04 + t * 0.015 + r() * 0.06) * 100) / 100;
  }
  if (weapon && r() < 0.2 + t * 0.06) {
    out.critChance = Math.round((0.03 + t * 0.02 + r() * 0.08) * 100) / 100;
  }
  return out;
}

export function stampItem<T extends ItemInstance>(item: T, r: () => number): T {
  const rarity = (item.params as { rarity?: Rarity }).rarity ?? "common";
  const m = rarityMult(rarity);
  if (!WEAPON_KINDS.has(item.kind) && !JEWELRY_KINDS.has(item.kind)) {
    const floor = Math.round(Math.max(0.2, 0.4 * m) * 10) / 10;
    item.stats.armor = Math.max(item.stats.armor ?? 0, floor);
  }
  const builtSpeed = item.stats.attackSpeedPct ?? 0;
  const aff = rollAffixes(r, rarity, WEAPON_KINDS.has(item.kind));
  if (builtSpeed) aff.attackSpeedPct = (aff.attackSpeedPct ?? 0) + builtSpeed;
  Object.assign(item.stats, aff);
  if (item.kind === "club" && (item.params as ClubParams).subtype === "gpu") {
    item.name = "GeForce RTX 5090";
  }
  return item;
}
