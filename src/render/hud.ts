import type { EquipSlotId, ItemInstance } from "../shared/types";
import type { WorldState } from "../sim/world";
import { EQUIP_SLOT_LABELS, getEquipped } from "../sim/world";
import { itemIconDataUrl, itemTooltipHtml } from "./itemIcon";

export type ProjectFn = (worldX: number, worldZ: number, height: number) => {
  x: number;
  y: number;
  visible: boolean;
};

function iconImg(item: ItemInstance): string {
  return `<img class="item-icon" src="${itemIconDataUrl(item)}" alt="" draggable="false" />`;
}

function bagKey(world: WorldState): string {
  const eq = Object.entries(world.equipment)
    .map(([k, v]) => `${k}:${v?.id ?? ""}`)
    .join("|");
  const bag = world.bag.map((i) => i?.id ?? "").join(",");
  return `${world.inventoryOpen}:${eq}:${bag}`;
}

export function bindHud(handlers: {
  onEquipBag: (bagIndex: number) => void;
  onUnequip: (slot: EquipSlotId) => void;
}): {
  update: (world: WorldState, project: ProjectFn) => void;
} {
  const statsEl = document.getElementById("stats")!;
  const invEl = document.getElementById("inv")!;
  const toastEl = document.getElementById("toast")!;
  const floatersEl = document.getElementById("floaters")!;
  const tipEl = document.getElementById("tooltip")!;

  let lastKey = "";
  let tipItem: ItemInstance | null = null;

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

  invEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const bag = target.closest<HTMLElement>("[data-bag]");
    if (bag && bag.dataset.bag !== undefined && !bag.classList.contains("empty")) {
      handlers.onEquipBag(Number(bag.dataset.bag));
      hideTip();
      return;
    }
    const eq = target.closest<HTMLElement>("[data-unequip]");
    if (eq && eq.classList.contains("filled")) {
      handlers.onUnequip(eq.dataset.unequip as EquipSlotId);
      hideTip();
    }
  });

  invEl.addEventListener("mousemove", (e) => {
    if (!tipItem) return;
    showTip(tipItem, e.clientX, e.clientY);
  });

  invEl.addEventListener("mouseover", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (!t) return;
    const bag = t.dataset.bag;
    if (bag !== undefined) {
      // need world ref — store on element via data-id lookup in rebuild
      const id = t.dataset.itemId;
      const item = findItemById(id);
      if (item) showTip(item, e.clientX, e.clientY);
      return;
    }
    const slot = t.dataset.unequip as EquipSlotId | undefined;
    if (slot) {
      const item = findItemById(t.dataset.itemId);
      if (item) showTip(item, e.clientX, e.clientY);
    }
  });

  invEl.addEventListener("mouseout", (e) => {
    const related = e.relatedTarget as Node | null;
    if (related && invEl.contains(related)) {
      const t = (related as HTMLElement).closest?.("[data-tip]");
      if (t) return;
    }
    hideTip();
  });

  let itemIndex = new Map<string, ItemInstance>();
  function findItemById(id: string | undefined): ItemInstance | null {
    if (!id) return null;
    return itemIndex.get(id) ?? null;
  }

  function rebuildInv(world: WorldState): void {
    itemIndex = new Map();
    for (const it of Object.values(world.equipment)) {
      if (it) itemIndex.set(it.id, it);
    }
    for (const it of world.bag) {
      if (it) itemIndex.set(it.id, it);
    }

    const bagHtml = world.bag
      .map((item, i) => {
        if (!item) {
          return `<button type="button" class="bag-slot empty" data-bag="${i}"></button>`;
        }
        return `<button type="button" class="bag-slot" data-bag="${i}" data-tip="1" data-item-id="${item.id}">
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
      <div class="inv-title">Inventario <span>(I cerrar · click equipar/desequipar)</span></div>
      <div class="inv-body">
        <div class="paper-doll">
          <div class="pd-amulet">${eqSlot("amulet", "sm")}</div>
          <div class="pd-helmet">${eqSlot("helmet")}</div>
          <div class="pd-weapon">${eqSlot("weapon")}</div>
          <div class="pd-armor">${eqSlot("armor")}</div>
          <div class="pd-offhand">${eqSlot("offhand")}</div>
          <div class="pd-gloves">${eqSlot("gloves", "sm")}</div>
          <div class="pd-belt">${eqSlot("belt", "sm")}</div>
          <div class="pd-boots">${eqSlot("boots", "sm")}</div>
          <div class="pd-ring1">${eqSlot("ring1", "sm")}</div>
          <div class="pd-ring2">${eqSlot("ring2", "sm")}</div>
        </div>
        <div class="inv-storage">
          <div class="inv-section">Almacenamiento</div>
          <div class="bag-grid">${bagHtml}</div>
        </div>
      </div>
    `;
  }

  function update(world: WorldState, project: ProjectFn): void {
    const p = world.player;
    const eq = getEquipped(world);
    const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
    const cd = p.attackCooldown;
    statsEl.innerHTML = `
      <div><b>HP</b> ${Math.ceil(p.hp)} / ${p.maxHp}</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%;background:${hpPct < 30 ? "#a03020" : "#8a3a2a"}"></div></div>
      <div style="margin-top:8px"><b>Arma</b> ${eq ? eq.name : "Puños"}</div>
      ${
        eq
          ? `<div style="opacity:.85;font-size:12px">DMG ${eq.stats.damage} · Reach ${eq.stats.reach} · SPD ${eq.stats.attackSpeed}</div>`
          : ""
      }
      <div style="margin-top:6px;opacity:.7">IA vivas: ${world.ais.filter((a) => a.alive).length}${cd > 0 ? ` · CD ${cd.toFixed(2)}s` : " · listo"}</div>
    `;

    const key = bagKey(world);
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
