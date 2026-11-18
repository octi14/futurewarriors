import type { CoreStatId, EquipSlotId, ItemInstance } from "../shared/types";
import type { WorldState } from "../sim/world";
import {
  BAG_COLS,
  BAG_ROWS,
  EQUIP_SLOT_LABELS,
  getEquipped,
  statUpgradeCost,
} from "../sim/world";
import { itemIconDataUrl, itemTooltipHtml } from "./itemIcon";

export type ProjectFn = (worldX: number, worldZ: number, height: number) => {
  x: number;
  y: number;
  visible: boolean;
};

function iconImg(item: ItemInstance): string {
  return `<img class="item-icon" src="${itemIconDataUrl(item)}" alt="" draggable="false" />`;
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

    const cells = Array.from({ length: BAG_COLS * BAG_ROWS }, (_, i) => {
      return `<div class="bag-cell" style="grid-column:${(i % BAG_COLS) + 1};grid-row:${Math.floor(i / BAG_COLS) + 1}"></div>`;
    }).join("");

    const itemsHtml = world.bag
      .map((p) => {
        const { item, x, y } = p;
        return `<button type="button" class="bag-item" data-bag-item="${item.id}" data-tip="1" data-item-id="${item.id}"
          style="grid-column:${x + 1} / span ${item.gridW};grid-row:${y + 1} / span ${item.gridH}">
          ${iconImg(item)}
        </button>`;
      })
      .join("");

    const eqSlot = (slot: EquipSlotId, cls = "") => {
      const item = world.equipment[slot];
      const label = EQUIP_SLOT_LABELS[slot];
      if (!item) {
        return `<button type="button" class="eq-slot empty ${cls}" data-unequip="${slot}">
          <span class="eq-label">${label}</span>
        </button>`;
      }
      return `<button type="button" class="eq-slot filled ${cls}" data-unequip="${slot}" data-tip="1" data-item-id="${item.id}">
        <span class="eq-label">${label}</span>
        ${iconImg(item)}
      </button>`;
    };

    invEl.innerHTML = `
      <div class="inv-title">
        <span>Inventario <span style="opacity:.65;font-weight:400">(I)</span></span>
        <span class="inv-coins">${world.coins} 🪙</span>
      </div>
      <div class="inv-body">
        <div class="inv-equip">
          <div class="inv-section">Equipo</div>
          <div class="paper-doll">
            <div class="pd-amulet">${eqSlot("amulet", "sm")}</div>
            <div class="pd-helmet">${eqSlot("helmet")}</div>
            <div class="pd-weapon">${eqSlot("weapon")}</div>
            <div class="pd-armor">${eqSlot("armor")}</div>
            <div class="pd-offhand">${eqSlot("offhand")}</div>
            <div class="pd-gloves">${eqSlot("gloves", "sm")}</div>
            <div class="pd-belt">${eqSlot("belt", "sm")}</div>
            <div class="pd-pants">${eqSlot("pants", "sm")}</div>
            <div class="pd-boots">${eqSlot("boots", "sm")}</div>
            <div class="pd-ring1">${eqSlot("ring1", "sm")}</div>
            <div class="pd-ring2">${eqSlot("ring2", "sm")}</div>
          </div>
        </div>
        <div class="inv-storage">
          <div class="inv-section">Mochila · click equipar · shift+click tirar</div>
          <div class="bag-grid" style="grid-template-columns:repeat(${BAG_COLS},var(--cell));grid-template-rows:repeat(${BAG_ROWS},var(--cell))">
            ${cells}${itemsHtml}
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
        <span class="char-coins">${world.coins} 🪙</span>
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
    beltEl.innerHTML = `
      <div class="weapon-name">${eq ? eq.name : "Puños"}</div>
      ${
        eq
          ? `<div class="weapon-stats">DMG ${eq.stats.damage} · Alc ${eq.stats.reach} · Vel ${eq.stats.attackSpeed}</div>`
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
