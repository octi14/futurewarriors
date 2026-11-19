import { rarityT } from "../shared/rng";
import type { CoreStatId, EquipSlotId, ItemInstance, Rarity } from "../shared/types";
import type { WorldState } from "../sim/world";
import {
  BAG_COLS,
  BAG_ROWS,
  EQUIP_SLOT_LABELS,
  getCombatWeaponStats,
  getEquipped,
  getOffhandWeapon,
  statUpgradeCost,
} from "../sim/world";
import { rarityGlowStrength } from "./itemMesh";
import { itemIconDataUrl, itemTooltipHtml } from "./itemIcon";

export type ProjectFn = (worldX: number, worldZ: number, height: number) => {
  x: number;
  y: number;
  visible: boolean;
};

function itemGlowVars(item: ItemInstance): string {
  const rarity = (item.params as { rarity: Rarity }).rarity;
  const hue =
    (item.params as { metalHue?: number; hue?: number; leatherHue?: number }).metalHue ??
    (item.params as { hue?: number }).hue ??
    (item.params as { leatherHue?: number }).leatherHue ??
    0.5;
  const t = rarityT(rarity);
  const sat = 14 + t * 40;
  const lit = 42 + t * 18;
  const str = rarityGlowStrength(rarity);
  return `--glow: hsl(${Math.floor(hue * 360)} ${sat}% ${lit}%); --glow-str: ${str}`;
}

function iconImg(item: ItemInstance): string {
  const px = Math.max(96, Math.max(item.gridW, item.gridH) * 56);
  const rarity = (item.params as { rarity: Rarity }).rarity;
  return `<img class="item-icon rarity-${rarity}" style="${itemGlowVars(item)}" src="${itemIconDataUrl(item, px)}" alt="" draggable="false" />`;
}

function uiKey(world: WorldState): string {
  const eq = Object.entries(world.equipment)
    .map(([k, v]) => `${k}:${v?.id ?? ""}`)
    .join("|");
  const bag = world.bag.map((p) => `${p.item.id}@${p.x},${p.y}`).join(";");
  const sp = world.statPurchases;
  return `${world.inventoryOpen}:${world.characterOpen}:${eq}:${bag}:${world.coins}:${sp.strength},${sp.speed},${sp.defense}`;
}

export function bindHud(handlers: {
  onEquipBag: (itemId: string) => void;
  onUnequip: (slot: EquipSlotId) => void;
  onDropBag: (itemId: string) => void;
  onDropEquip: (slot: EquipSlotId) => void;
  onBuyStat: (stat: CoreStatId) => void;
}): {
  update: (world: WorldState, project: ProjectFn) => void;
} {
  const hpFill = document.getElementById("hp-fill")!;
  const hpLabel = document.getElementById("hp-label")!;
  const enFill = document.getElementById("en-fill")!;
  const enLabel = document.getElementById("en-label")!;
  const beltEl = document.getElementById("hud-belt")!;
  const invEl = document.getElementById("inv")!;
  const charEl = document.getElementById("char")!;
  const toastEl = document.getElementById("toast")!;
  const floatersEl = document.getElementById("floaters")!;
  const tipEl = document.getElementById("tooltip")!;

  let lastKey = "";
  let tipItem: ItemInstance | null = null;
  let itemIndex = new Map<string, ItemInstance>();

  function hideTip(): void {
    tipItem = null;
    tipEl.classList.remove("show");
  }

  function showTip(item: ItemInstance, clientX: number, clientY: number): void {
    tipItem = item;
    tipEl.innerHTML = itemTooltipHtml(item);
    tipEl.classList.add("show");
    const pad = 12;
    const tw = tipEl.offsetWidth || 200;
    const th = tipEl.offsetHeight || 120;
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + tw > window.innerWidth - 8) x = clientX - tw - pad;
    if (y + th > window.innerHeight - 8) y = clientY - th - pad;
    tipEl.style.left = `${Math.max(8, x)}px`;
    tipEl.style.top = `${Math.max(8, y)}px`;
  }

  function findItemById(id: string | undefined): ItemInstance | null {
    if (!id) return null;
    return itemIndex.get(id) ?? null;
  }

  invEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const drop = e.shiftKey;
    const bag = target.closest<HTMLElement>("[data-bag-item]");
    if (bag?.dataset.bagItem) {
      if (drop) handlers.onDropBag(bag.dataset.bagItem);
      else handlers.onEquipBag(bag.dataset.bagItem);
      hideTip();
      return;
    }
    const eq = target.closest<HTMLElement>("[data-unequip]");
    if (eq && eq.classList.contains("filled")) {
      const slot = eq.dataset.unequip as EquipSlotId;
      if (drop) handlers.onDropEquip(slot);
      else handlers.onUnequip(slot);
      hideTip();
    }
  });

  charEl.addEventListener("click", (e) => {
    const buy = (e.target as HTMLElement).closest<HTMLElement>("[data-buy-stat]");
    if (buy?.dataset.buyStat) handlers.onBuyStat(buy.dataset.buyStat as CoreStatId);
  });

  invEl.addEventListener("mousemove", (e) => {
    if (!tipItem) return;
    showTip(tipItem, e.clientX, e.clientY);
  });

  invEl.addEventListener("mouseover", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (!t) return;
    const item = findItemById(t.dataset.itemId);
    if (item) showTip(item, e.clientX, e.clientY);
  });

  invEl.addEventListener("mouseout", (e) => {
    const related = e.relatedTarget as Node | null;
    if (related && invEl.contains(related)) {
      const t = (related as HTMLElement).closest?.("[data-tip]");
      if (t) return;
    }
    hideTip();
  });

  function rebuildInv(world: WorldState): void {
    itemIndex = new Map();
    for (const it of Object.values(world.equipment)) {
      if (it) itemIndex.set(it.id, it);
    }
    for (const p of world.bag) itemIndex.set(p.item.id, p.item);

    const occ = new Map<number, { rarity: string; glow: string }>();
    for (const p of world.bag) {
      const rarity = (p.item.params as { rarity: string }).rarity;
      const glow = itemGlowVars(p.item);
      for (let dy = 0; dy < p.item.gridH; dy++) {
        for (let dx = 0; dx < p.item.gridW; dx++) {
          occ.set((p.y + dy) * BAG_COLS + (p.x + dx), { rarity, glow });
        }
      }
    }
    const cells = Array.from({ length: BAG_COLS * BAG_ROWS }, (_, i) => {
      const o = occ.get(i);
      const base = `grid-column:${(i % BAG_COLS) + 1};grid-row:${Math.floor(i / BAG_COLS) + 1}`;
      if (!o) return `<div class="bag-cell" style="${base}"></div>`;
      return `<div class="bag-cell occupied rarity-${o.rarity}" style="${base};${o.glow}"></div>`;
    }).join("");

    const itemsHtml = world.bag
      .map((p) => {
        const { item, x, y } = p;
        const rarity = (item.params as { rarity: string }).rarity;
        return `<button type="button" class="bag-item rarity-${rarity}" data-bag-item="${item.id}" data-tip="1" data-item-id="${item.id}"
          style="grid-column:${x + 1} / span ${item.gridW};grid-row:${y + 1} / span ${item.gridH};${itemGlowVars(item)}">
          ${iconImg(item)}
        </button>`;
      })
      .join("");

    const slotGlyph: Record<EquipSlotId, string> = {
      amulet: `<svg class="eq-glyph" viewBox="0 0 24 24"><path d="M12 3l2.2 4.4 4.8.7-3.5 3.4.8 4.8L12 14.8 7.7 16.3l.8-4.8L5 8.1l4.8-.7z"/></svg>`,
      helmet: `<svg class="eq-glyph" viewBox="0 0 24 24"><path d="M5 14c0-4.5 3-8 7-8s7 3.5 7 8v2H5v-2z"/><path d="M5 16h14v2.5c0 .8-.7 1.5-1.5 1.5h-11C5.7 20 5 19.3 5 18.5V16z"/></svg>`,
      weapon: `<svg class="eq-glyph" viewBox="0 0 24 24"><path d="M14 3l7 7-1.5 1.5-2.2-2.2-6.6 6.6-3.2-.5-.5-3.2 6.6-6.6-2.2-2.2z"/><path d="M8.5 15.5L5 19"/></svg>`,
      armor: `<svg class="eq-glyph" viewBox="0 0 24 24"><path d="M12 3l6 2v4c0 5-2.5 8.5-6 10-3.5-1.5-6-5-6-10V5l6-2z"/><path d="M12 7v10"/></svg>`,
      offhand: `<svg class="eq-glyph" viewBox="0 0 24 24"><path d="M12 3c4 0 7 2 7 5v7c0 3-3 6-7 7-4-1-7-4-7-7V8c0-3 3-5 7-5z"/></svg>`,
      gloves: `<svg class="eq-glyph" viewBox="0 0 24 24"><path d="M8 10V6.5a1.5 1.5 0 013 0V10"/><path d="M11 10V5.5a1.5 1.5 0 013 0V10"/><path d="M14 10V6.8a1.4 1.4 0 012.8 0V12c0 3-1.5 5-4.8 5H10c-2.5 0-4-1.8-4-4.2V11a1.5 1.5 0 013 0v-.2"/></svg>`,
      belt: `<svg class="eq-glyph" viewBox="0 0 24 24"><path d="M3 11h18v3H3z"/><rect x="10" y="10" width="4" height="5" rx="0.5"/></svg>`,
      pants: `<svg class="eq-glyph" viewBox="0 0 24 24"><path d="M8 4h8l-.5 5L17 20h-3.2l-1.3-8h-.8L10.2 20H7L8.5 9z"/></svg>`,
      boots: `<svg class="eq-glyph" viewBox="0 0 24 24"><path d="M9 4h4v9h5l2 3.5H8.5C7 16.5 6 15 6 13.2V4z"/></svg>`,
      ring1: `<svg class="eq-glyph" viewBox="0 0 24 24"><circle cx="12" cy="13" r="5.5"/><path d="M10 7.5l2-3 2 3"/></svg>`,
      ring2: `<svg class="eq-glyph" viewBox="0 0 24 24"><circle cx="12" cy="13" r="5.5"/><path d="M10 7.5l2-3 2 3"/></svg>`,
    };

    const eqSlot = (slot: EquipSlotId, cls = "") => {
      const item = world.equipment[slot];
      const label = EQUIP_SLOT_LABELS[slot];
      const glyph = slotGlyph[slot];
      if (!item) {
        return `<button type="button" class="eq-slot empty ${cls}" data-unequip="${slot}" title="${label}">
          ${glyph}
        </button>
        <span class="eq-label">${label}</span>`;
      }
      const rarity = (item.params as { rarity: string }).rarity;
      return `<button type="button" class="eq-slot filled rarity-${rarity} ${cls}" data-unequip="${slot}" data-tip="1" data-item-id="${item.id}" title="${label}" style="${itemGlowVars(item)}">
        ${glyph}
        ${iconImg(item)}
      </button>
      <span class="eq-label">${label}</span>`;
    };

    invEl.innerHTML = `
      <div class="inv-title">
        <span>Inventario <span style="opacity:.65;font-weight:400">(I)</span></span>
        <span class="inv-coins"><svg class="coin-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#c9a227" stroke="#7a5a10" stroke-width="1.2"/><circle cx="8" cy="8" r="4.5" fill="none" stroke="#f0d878" stroke-width="1"/><text x="8" y="11" text-anchor="middle" font-size="7" font-weight="700" fill="#6a4a08">G</text></svg>${world.coins}</span>
      </div>
      <div class="inv-body">
        <div class="inv-equip">
          <div class="inv-section">Equipo</div>
          <div class="paper-doll">
            <div class="pd-amulet">${eqSlot("amulet", "xs")}</div>
            <div class="pd-helmet">${eqSlot("helmet")}</div>
            <div class="pd-weapon">${eqSlot("weapon", "lg")}</div>
            <div class="pd-armor">${eqSlot("armor", "lg")}</div>
            <div class="pd-offhand">${eqSlot("offhand", "lg")}</div>
            <div class="pd-gloves">${eqSlot("gloves", "sm")}</div>
            <div class="pd-belt">${eqSlot("belt", "sm")}</div>
            <div class="pd-pants">${eqSlot("pants", "sm")}</div>
            <div class="pd-boots">${eqSlot("boots", "sm")}</div>
            <div class="pd-ring1">${eqSlot("ring1", "xs")}</div>
            <div class="pd-ring2">${eqSlot("ring2", "xs")}</div>
          </div>
        </div>
        <div class="inv-storage">
          <div class="inv-section">Mochila</div>
          <div class="bag-frame">
            <div class="bag-grid" style="grid-template-columns:repeat(${BAG_COLS},var(--cell));grid-template-rows:repeat(${BAG_ROWS},var(--cell))">
              ${cells}${itemsHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function rebuildChar(world: WorldState): void {
    const c = world.player.core;
    const row = (stat: CoreStatId, label: string, val: number) => {
      const cost = statUpgradeCost(world, stat);
      const can = world.coins >= cost;
      return `<button type="button" class="stat-buy ${can ? "" : "disabled"}" data-buy-stat="${stat}">
        <span class="stat-buy-label">${label} <b>${val}</b></span>
        <span class="stat-buy-cost">+1 · ${cost}🪙</span>
      </button>`;
    };
    charEl.innerHTML = `
      <div class="char-title">
        <span>Personaje <span style="opacity:.65;font-weight:400">(C)</span></span>
        <span class="char-coins"><svg class="coin-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#c9a227" stroke="#7a5a10" stroke-width="1.2"/><circle cx="8" cy="8" r="4.5" fill="none" stroke="#f0d878" stroke-width="1"/><text x="8" y="11" text-anchor="middle" font-size="7" font-weight="700" fill="#6a4a08">G</text></svg>${world.coins}</span>
      </div>
      <div class="char-section">Atributos</div>
      <div class="char-core">
        <div class="char-core-row"><span>Fuerza</span><b>${c.strength}</b></div>
        <div class="char-core-row"><span>Velocidad</span><b>${c.speed}</b></div>
        <div class="char-core-row"><span>Defensa</span><b>${c.defense}</b></div>
      </div>
      <div class="char-section">Entrenar</div>
      <div class="stat-shop">
        ${row("strength", "Fuerza", c.strength)}
        ${row("speed", "Velocidad", c.speed)}
        ${row("defense", "Defensa", c.defense)}
      </div>
    `;
  }

  function update(world: WorldState, project: ProjectFn): void {
    const p = world.player;
    const eq = getEquipped(world);
    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    const enPct = Math.max(0, Math.min(100, (p.energy / Math.max(1, p.maxEnergy)) * 100));
    const cd = p.attackCooldown;
    const cdPct = cd > 0 ? Math.min(100, (cd / 0.55) * 100) : 0;

    hpFill.style.height = `${hpPct}%`;
    hpLabel.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    enFill.style.height = `${enPct}%`;
    enLabel.textContent = `${Math.ceil(p.energy)}/${p.maxEnergy}`;

    const c = p.core;
    const dual = getOffhandWeapon(world);
    const stats = getCombatWeaponStats(world);
    beltEl.innerHTML = `
      <div class="weapon-name">${eq ? (dual ? `${eq.name} + ${dual.name}` : eq.name) : "Puños"}</div>
      ${
        eq
          ? `<div class="weapon-stats">DMG ${stats.damage} · Alc ${stats.reach} · Vel ${stats.attackSpeed}</div>`
          : `<div class="weapon-stats">Sin arma equipada</div>`
      }
      <div class="core-stats">FUE ${c.strength} · VEL ${c.speed} · DEF ${c.defense} · ${world.coins}🪙</div>
      <div class="meta">IA ${world.ais.filter((a) => a.alive).length} · ${p.running ? "Corriendo" : cd > 0 ? "Recarga" : "Listo"}</div>
      <div class="cd-pip" title="Recarga de ataque"><i style="width:${cdPct}%"></i></div>
    `;

    const key = uiKey(world);
    if (key !== lastKey) {
      lastKey = key;
      hideTip();
      if (world.inventoryOpen) {
        invEl.classList.add("open");
        rebuildInv(world);
      } else {
        invEl.classList.remove("open");
        invEl.innerHTML = "";
      }
      if (world.characterOpen) {
        charEl.classList.add("open");
        rebuildChar(world);
      } else {
        charEl.classList.remove("open");
        charEl.innerHTML = "";
      }
    }

    if (world.toast) {
      toastEl.textContent = world.toast;
      toastEl.classList.add("show");
    } else {
      toastEl.classList.remove("show");
    }

    const bits: string[] = [];
    for (const ai of world.ais) {
      if (!ai.alive) continue;
      const scr = project(ai.pos.x, ai.pos.y, 1.55);
      if (!scr.visible) continue;
      const pct = Math.max(0, (ai.hp / ai.maxHp) * 100);
      bits.push(
        `<div class="ai-hp" style="left:${scr.x}px;top:${scr.y}px"><i style="width:${pct}%"></i></div>`,
      );
    }
    for (const dmg of world.damagePopups) {
      const scr = project(dmg.pos.x, dmg.pos.y, 1.2 + dmg.rise);
      if (!scr.visible) continue;
      const alpha = Math.max(0, dmg.life / dmg.maxLife);
      bits.push(
        `<div class="dmg" style="left:${scr.x}px;top:${scr.y}px;opacity:${alpha}">-${dmg.amount}</div>`,
      );
    }
    floatersEl.innerHTML = bits.join("");
  }

  return { update };
}
