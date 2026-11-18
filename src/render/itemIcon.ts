import type { ItemInstance } from "../shared/types";

const rarityStroke: Record<string, string> = {
  common: "#8a7a5c",
  uncommon: "#5a8a4a",
  rare: "#4a6aaa",
  epic: "#9a6a20",
};

/** Icono 2D del ítem (data URL) para el inventario. */
export function itemIconDataUrl(item: ItemInstance, size = 64): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  const stroke = rarityStroke[item.params.rarity] ?? "#8a7a5c";
  ctx.fillStyle = "rgba(20,14,8,0.35)";
  ctx.fillRect(2, 2, size - 4, size - 4);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, size - 6, size - 6);

  if (item.kind === "sword") {
    const hue = item.params.metalHue;
    const metal = `hsl(${200 + hue * 40}, 18%, ${45 + (item.params.rarity === "epic" ? 15 : 0)}%)`;
    const grip = "#5c3b22";
    const cx = size * 0.5;
    const bladeH = size * (0.28 + item.params.bladeLength * 0.22);
    const bladeW = size * (0.06 + item.params.bladeWidth * 0.5);

    ctx.save();
    ctx.translate(cx, size * 0.56);
    ctx.rotate(-0.55);

    // hoja
    ctx.fillStyle = metal;
    ctx.beginPath();
    if (item.params.bladeType === "curved") {
      ctx.moveTo(-bladeW * 0.4, 0);
      ctx.quadraticCurveTo(bladeW * 1.2, -bladeH * 0.5, bladeW * 0.2, -bladeH);
      ctx.lineTo(-bladeW * 0.3, -bladeH * 0.92);
      ctx.quadraticCurveTo(bladeW * 0.4, -bladeH * 0.45, -bladeW * 0.5, 0);
    } else if (item.params.bladeType === "wide") {
      ctx.moveTo(-bladeW, 0);
      ctx.lineTo(bladeW, 0);
      ctx.lineTo(bladeW * 0.35, -bladeH);
      ctx.lineTo(-bladeW * 0.35, -bladeH);
    } else {
      ctx.moveTo(-bladeW * 0.55, 0);
      ctx.lineTo(bladeW * 0.55, 0);
      ctx.lineTo(0, -bladeH);
    }
    ctx.closePath();
    ctx.fill();

    // guardia
    ctx.fillStyle = stroke;
    ctx.fillRect(-bladeW * 1.6, -2, bladeW * 3.2, 5);

    // empuñadura
    ctx.fillStyle = grip;
    ctx.fillRect(-bladeW * 0.35, 2, bladeW * 0.7, size * 0.16);

    // pomo
    ctx.beginPath();
    ctx.arc(0, size * 0.18, bladeW * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.restore();
  }

  return c.toDataURL("image/png");
}

export function itemTooltipHtml(item: ItemInstance): string {
  const p = item.params;
  const s = item.stats;
  return `
    <div class="tt-name">${item.name}</div>
    <div class="tt-meta">${p.rarity} · ${p.bladeType} · ${item.equipSlot}</div>
    <div class="tt-stat">Daño <b>${s.damage}</b></div>
    <div class="tt-stat">Alcance <b>${s.reach}</b></div>
    <div class="tt-stat">Vel. ataque <b>${s.attackSpeed}</b></div>
    <div class="tt-stat">Hoja <b>${p.bladeLength.toFixed(2)}</b> · Ancho <b>${p.bladeWidth.toFixed(2)}</b></div>
    <div class="tt-hint">Click: equipar / desequipar</div>
  `;
}
