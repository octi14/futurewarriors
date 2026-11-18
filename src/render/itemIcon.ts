import type {
  AxeParams,
  HelmetParams,
  ItemInstance,
  ShieldParams,
  SwordParams,
  ThrowParams,
} from "../shared/types";

const rarityStroke: Record<string, string> = {
  common: "#8a7a5c",
  uncommon: "#5a8a4a",
  rare: "#4a6aaa",
  epic: "#9a6a20",
};

function rarityOf(item: ItemInstance): string {
  return (item.params as { rarity: string }).rarity;
}

function metalCss(hue: number, rarity: string): string {
  const lit = rarity === "epic" ? 58 : rarity === "rare" ? 52 : 48;
  const sat = rarity === "epic" ? 55 : rarity === "rare" ? 42 : rarity === "uncommon" ? 32 : 22;
  return `hsl(${Math.floor(hue * 360)} ${sat}% ${lit}%)`;
}

export function itemIconDataUrl(item: ItemInstance, size = 64): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  const stroke = rarityStroke[rarityOf(item)] ?? "#8a7a5c";
  ctx.fillStyle = "rgba(20,14,8,0.35)";
  ctx.fillRect(2, 2, size - 4, size - 4);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, size - 6, size - 6);

  const hue = (item.params as { metalHue?: number; hue?: number; leatherHue?: number }).metalHue
    ?? (item.params as { hue?: number }).hue
    ?? (item.params as { leatherHue?: number }).leatherHue
    ?? 0.5;

  if (item.kind === "sword") drawSword(ctx, item.params as SwordParams, size, stroke);
  else if (item.kind === "axe") drawAxe(ctx, item.params as AxeParams, size);
  else if (item.kind === "throw") drawThrow(ctx, item.params as ThrowParams, size);
  else if (item.kind === "boots") drawPairBoxes(ctx, size, `hsl(${25 + hue * 20},40%,30%)`);
  else if (item.kind === "shield") drawShield(ctx, item.params as ShieldParams, size, stroke);
  else if (item.kind === "helmet") drawHelmet(ctx, item.params as HelmetParams, size, stroke);
  else if (item.kind === "armor") drawRect(ctx, size, metalCss(hue, rarityOf(item)), 0.35, 0.2, 0.3, 0.55);
  else if (item.kind === "pants") drawPairBoxes(ctx, size, metalCss(hue, rarityOf(item)), true);
  else if (item.kind === "gloves") drawPairBoxes(ctx, size, metalCss(hue, rarityOf(item)), false, 0.35);
  else if (item.kind === "belt") drawRect(ctx, size, metalCss(hue, rarityOf(item)), 0.2, 0.42, 0.6, 0.16);

  return c.toDataURL("image/png");
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  size: number,
  fill: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(size * x, size * y, size * w, size * h);
}

function drawPairBoxes(
  ctx: CanvasRenderingContext2D,
  size: number,
  fill: string,
  tall = false,
  y = 0.4,
): void {
  ctx.fillStyle = fill;
  const h = tall ? size * 0.4 : size * 0.22;
  ctx.fillRect(size * 0.22, size * y, size * 0.2, h);
  ctx.fillRect(size * 0.58, size * y, size * 0.2, h);
}

function drawSword(
  ctx: CanvasRenderingContext2D,
  p: SwordParams,
  size: number,
  stroke: string,
): void {
  const metal = metalCss(p.metalHue, p.rarity);
  const cx = size * 0.5;
  const bladeH = size * (0.28 + p.bladeLength * 0.22);
  const bladeW = size * (0.06 + p.bladeWidth * 0.5);
  ctx.save();
  ctx.translate(cx, size * 0.56);
  ctx.rotate(-0.55);
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(-bladeW * 0.55, 0);
  ctx.lineTo(bladeW * 0.55, 0);
  ctx.lineTo(0, -bladeH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = stroke;
  ctx.fillRect(-bladeW * 1.6, -2, bladeW * 3.2, 5);
  ctx.fillStyle = "#5c3b22";
  ctx.fillRect(-bladeW * 0.35, 2, bladeW * 0.7, size * 0.16);
  ctx.restore();
}

function drawAxe(ctx: CanvasRenderingContext2D, p: AxeParams, size: number): void {
  const metal = metalCss(p.metalHue, p.rarity);
  ctx.fillStyle = "#5c3b22";
  ctx.fillRect(size * 0.46, size * 0.2, size * 0.08, size * 0.55);
  ctx.fillStyle = metal;
  ctx.fillRect(size * 0.28, size * 0.18, size * 0.44, size * 0.18);
}

function drawThrow(ctx: CanvasRenderingContext2D, p: ThrowParams, size: number): void {
  const metal = metalCss(p.metalHue, p.rarity);
  ctx.fillStyle = metal;
  if (p.subtype === "shuriken") {
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(size * 0.5, size * 0.5);
      ctx.rotate((i * Math.PI) / 2);
      ctx.fillRect(-size * 0.06, -size * 0.28, size * 0.12, size * 0.28);
      ctx.restore();
    }
  } else if (p.subtype === "javelin") {
    ctx.fillStyle = "#5c3b22";
    ctx.fillRect(size * 0.2, size * 0.46, size * 0.55, size * 0.08);
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.moveTo(size * 0.75, size * 0.5);
    ctx.lineTo(size * 0.9, size * 0.42);
    ctx.lineTo(size * 0.9, size * 0.58);
    ctx.fill();
  } else {
    ctx.fillRect(size * 0.3, size * 0.35, size * 0.4, size * 0.28);
  }
}

function drawShield(
  ctx: CanvasRenderingContext2D,
  p: ShieldParams,
  size: number,
  stroke: string,
): void {
  const metal = metalCss(p.metalHue, p.rarity);
  const cx = size * 0.5;
  const cy = size * 0.52;
  const w = size * (0.28 + p.width * 0.35);
  const h = size * (0.3 + p.height * 0.28);
  ctx.fillStyle = metal;
  ctx.beginPath();
  if (p.shape === "round") ctx.arc(cx, cy, w * 0.55, 0, Math.PI * 2);
  else {
    ctx.moveTo(cx - w * 0.45, cy - h * 0.4);
    ctx.lineTo(cx + w * 0.45, cy - h * 0.4);
    ctx.lineTo(cx + w * 0.35, cy + h * 0.45);
    ctx.lineTo(cx - w * 0.35, cy + h * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawHelmet(
  ctx: CanvasRenderingContext2D,
  p: HelmetParams,
  size: number,
  stroke: string,
): void {
  const metal = metalCss(p.metalHue, p.rarity);
  const cx = size * 0.5;
  const cy = size * 0.48;
  const r = size * (0.16 + p.dome * 0.55);
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.lineTo(cx + r, cy + r * 0.35);
  ctx.lineTo(cx - r, cy + r * 0.35);
  ctx.closePath();
  ctx.fill();
  if (p.style === "horned") {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx - r * 1.4, cy - r);
    ctx.lineTo(cx - r * 0.5, cy - r * 0.2);
    ctx.moveTo(cx + r, cy);
    ctx.lineTo(cx + r * 1.4, cy - r);
    ctx.lineTo(cx + r * 0.5, cy - r * 0.2);
    ctx.fill();
  }
  if (p.style !== "cap") ctx.fillRect(cx - 2, cy, 4, r * 0.7);
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

export function itemTooltipHtml(item: ItemInstance): string {
  const s = item.stats;
  const rarity = rarityOf(item);
  const lines: string[] = [
    `<div class="tt-name">${item.name}</div>`,
    `<div class="tt-meta">${rarity} · ${item.kind} · ${item.equipSlot} · ${item.gridW}×${item.gridH}</div>`,
  ];
  if (s.damage) lines.push(`<div class="tt-stat">Daño <b>${s.damage}</b></div>`);
  if (s.reach) lines.push(`<div class="tt-stat">Alcance <b>${s.reach}</b></div>`);
  if (s.attackSpeed) lines.push(`<div class="tt-stat">Vel. ataque <b>${s.attackSpeed}</b></div>`);
  if (s.armor) lines.push(`<div class="tt-stat">Armadura <b>${s.armor}</b></div>`);
  if (s.moveSpeedMult !== 1)
    lines.push(`<div class="tt-stat">Vel. movimiento <b>×${s.moveSpeedMult}</b></div>`);
  if (s.maxHpBonus) lines.push(`<div class="tt-stat">HP máx. <b>+${s.maxHpBonus}</b></div>`);
  lines.push(`<div class="tt-hint">Click: equipar / desequipar</div>`);
  lines.push(`<div class="tt-hint">Shift+click: tirar al suelo</div>`);
  return lines.join("");
}
