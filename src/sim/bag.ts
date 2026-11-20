import type { BagPlacement, ItemInstance } from "../shared/types";

export const BAG_COLS = 10;
export const BAG_ROWS = 6;

export function createEmptyOccupancy(): (string | null)[] {
  return Array.from({ length: BAG_COLS * BAG_ROWS }, () => null);
}

function idx(x: number, y: number): number {
  return y * BAG_COLS + x;
}

/** Marca celdas ocupadas por cada placement. */
export function buildOccupancy(bag: BagPlacement[]): (string | null)[] {
  const cells = createEmptyOccupancy();
  for (const p of bag) {
    for (let dy = 0; dy < p.item.gridH; dy++) {
      for (let dx = 0; dx < p.item.gridW; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x < 0 || y < 0 || x >= BAG_COLS || y >= BAG_ROWS) continue;
        cells[idx(x, y)] = p.item.id;
      }
    }
  }
  return cells;
}

export function canPlace(
  bag: BagPlacement[],
  x: number,
  y: number,
  w: number,
  h: number,
  ignoreId?: string,
): boolean {
  if (x < 0 || y < 0 || x + w > BAG_COLS || y + h > BAG_ROWS) return false;
  const cells = buildOccupancy(bag);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const id = cells[idx(x + dx, y + dy)];
      if (id && id !== ignoreId) return false;
    }
  }
  return true;
}

export function findFreeCell(
  bag: BagPlacement[],
  w: number,
  h: number,
): { x: number; y: number } | null {
  for (let y = 0; y <= BAG_ROWS - h; y++) {
    for (let x = 0; x <= BAG_COLS - w; x++) {
      if (canPlace(bag, x, y, w, h)) return { x, y };
    }
  }
  return null;
}

export function tryPlaceItem(bag: BagPlacement[], item: ItemInstance): boolean {
  const spot = findFreeCell(bag, item.gridW, item.gridH);
  if (!spot) return false;
  bag.push({ item, x: spot.x, y: spot.y });
  return true;
}

export function removeBagItem(bag: BagPlacement[], itemId: string): ItemInstance | null {
  const i = bag.findIndex((p) => p.item.id === itemId);
  if (i < 0) return null;
  const [p] = bag.splice(i, 1);
  return p.item;
}

export function getBagItem(bag: BagPlacement[], itemId: string): BagPlacement | null {
  return bag.find((p) => p.item.id === itemId) ?? null;
}

export function moveBagItem(bag: BagPlacement[], itemId: string, x: number, y: number): boolean {
  const p = getBagItem(bag, itemId);
  if (!p) return false;
  if (!canPlace(bag, x, y, p.item.gridW, p.item.gridH, itemId)) return false;
  p.x = x;
  p.y = y;
  return true;
}
