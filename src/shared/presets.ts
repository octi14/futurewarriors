import type {
  ArmorParams,
  BeltParams,
  BootsParams,
  GlovesParams,
  PantsParams,
  ShieldParams,
} from "./types";

/**
 * Cada style es su propio mesh (identidad).
 * Antes había aliases (crocs→sport, etc.); ya no — cada uno se dibuja aparte.
 */
function identity<T extends string>(keys: readonly T[]): Record<T, T> {
  const out = {} as Record<T, T>;
  for (const k of keys) out[k] = k;
  return out;
}

export const BOOT_VISUAL = identity([
  "canvas",
  "sport",
  "military",
  "combat",
  "trail",
  "greaves",
  "plate",
  "sneaker",
  "sandal",
  "loafer",
  "oxford",
  "riding",
  "dress",
  "work",
  "ski",
  "crocs",
  "cleats",
] as const satisfies readonly BootsParams["style"][]);

export const ARMOR_VISUAL = identity([
  "hoodie",
  "jacket",
  "vest",
  "leather",
  "padded",
  "chain",
  "scale",
  "plate",
  "shirt",
  "tunic",
  "coat",
  "duster",
  "poncho",
  "tabard",
  "brigandine",
  "gambeson",
  "hauberk",
  "lamellar",
  "cuirass",
  "swat",
  "snow",
  "jersey",
  "leatherJacket",
] as const satisfies readonly ArmorParams["style"][]);

export const PANTS_VISUAL = identity([
  "cloth",
  "jeans",
  "jogger",
  "cargo",
  "leather",
  "plated",
  "shorts",
  "chaps",
  "kilt",
  "breeches",
  "fatigues",
  "football",
  "armored",
] as const satisfies readonly PantsParams["style"][]);

export const GLOVE_VISUAL = identity([
  "cloth",
  "leather",
  "gauntlet",
  "wraps",
  "mittens",
  "bracers",
  "boxing",
  "keeper",
  "rubber",
  "claws",
] as const satisfies readonly GlovesParams["style"][]);

export const BELT_VISUAL = identity([
  "rope",
  "leather",
  "plated",
  "sash",
  "chainbelt",
  "utility",
] as const satisfies readonly BeltParams["style"][]);

export const SHIELD_VISUAL = identity([
  "round",
  "heater",
  "kite",
  "buckler",
  "targe",
  "tower",
  "pavise",
  "lid",
  "door",
  "shutter",
  "cymbal",
] as const satisfies readonly ShieldParams["shape"][]);

/** @deprecated Ya no hay alias; se mantiene por compat. */
export function resolveVisualStyle<T extends string>(style: T, _table: Record<T, T>, _max = 4): T {
  return style;
}

export function bootVisual(s: BootsParams["style"]): BootsParams["style"] {
  return s;
}
export function armorVisual(s: ArmorParams["style"]): ArmorParams["style"] {
  return s;
}
export function pantsVisual(s: PantsParams["style"]): PantsParams["style"] {
  return s;
}
export function gloveVisual(s: GlovesParams["style"]): GlovesParams["style"] {
  return s;
}
export function beltVisual(s: BeltParams["style"]): BeltParams["style"] {
  return s;
}
export function shieldVisual(s: ShieldParams["shape"]): ShieldParams["shape"] {
  return s;
}

export function pickStyle<T extends string>(r: () => number, table: Record<T, T>): T {
  const keys = Object.keys(table) as T[];
  return keys[Math.floor(r() * keys.length)]!;
}

/** Familia de caña/altura para shells (no implica mismo mesh). */
export function bootHeightClass(
  s: BootsParams["style"],
): "clog" | "open" | "low" | "mid" | "tall" | "metal" {
  if (s === "crocs") return "clog";
  if (s === "sandal") return "open";
  if (
    s === "canvas" ||
    s === "sport" ||
    s === "sneaker" ||
    s === "cleats" ||
    s === "loafer" ||
    s === "oxford"
  )
    return "low";
  if (s === "dress" || s === "military" || s === "work") return "mid";
  if (s === "greaves" || s === "plate") return "metal";
  return "tall"; // combat, trail, riding, ski
}
