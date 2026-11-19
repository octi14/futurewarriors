import type {
  ArmorParams,
  BeltParams,
  BootsParams,
  GlovesParams,
  PantsParams,
  ShieldParams,
} from "./types";

/** Género nuevo → familia visual/stats que ya existe. El ítem guarda el género. */
export const BOOT_VISUAL: Record<BootsParams["style"], BootsParams["style"]> = {
  canvas: "canvas",
  sport: "sport",
  military: "military",
  combat: "combat",
  trail: "trail",
  greaves: "greaves",
  plate: "plate",
  sneaker: "sport",
  sandal: "sport",
  loafer: "canvas",
  oxford: "canvas",
  riding: "military",
  dress: "military",
  work: "combat",
  ski: "trail",
};

export const ARMOR_VISUAL: Record<ArmorParams["style"], ArmorParams["style"]> = {
  hoodie: "hoodie",
  jacket: "jacket",
  vest: "vest",
  leather: "leather",
  padded: "padded",
  chain: "chain",
  scale: "scale",
  plate: "plate",
  shirt: "hoodie",
  tunic: "hoodie",
  coat: "jacket",
  duster: "jacket",
  poncho: "vest",
  tabard: "vest",
  brigandine: "leather",
  gambeson: "padded",
  hauberk: "chain",
  lamellar: "scale",
  cuirass: "plate",
};

export const PANTS_VISUAL: Record<PantsParams["style"], PantsParams["style"]> = {
  cloth: "cloth",
  jeans: "jeans",
  jogger: "jogger",
  cargo: "cargo",
  leather: "leather",
  plated: "plated",
  shorts: "jogger",
  chaps: "leather",
  kilt: "cloth",
  breeches: "leather",
  fatigues: "cargo",
};

export const GLOVE_VISUAL: Record<GlovesParams["style"], GlovesParams["style"]> = {
  cloth: "cloth",
  leather: "leather",
  gauntlet: "gauntlet",
  wraps: "cloth",
  mittens: "cloth",
  bracers: "leather",
};

export const BELT_VISUAL: Record<BeltParams["style"], BeltParams["style"]> = {
  rope: "rope",
  leather: "leather",
  plated: "plated",
  sash: "rope",
  chainbelt: "plated",
  utility: "leather",
};

export const SHIELD_VISUAL: Record<ShieldParams["shape"], ShieldParams["shape"]> = {
  round: "round",
  heater: "heater",
  kite: "kite",
  buckler: "round",
  targe: "round",
  tower: "kite",
  pavise: "heater",
};

export function bootVisual(s: BootsParams["style"]): BootsParams["style"] {
  return BOOT_VISUAL[s];
}
export function armorVisual(s: ArmorParams["style"]): ArmorParams["style"] {
  return ARMOR_VISUAL[s];
}
export function pantsVisual(s: PantsParams["style"]): PantsParams["style"] {
  return PANTS_VISUAL[s];
}
export function gloveVisual(s: GlovesParams["style"]): GlovesParams["style"] {
  return GLOVE_VISUAL[s];
}
export function beltVisual(s: BeltParams["style"]): BeltParams["style"] {
  return BELT_VISUAL[s];
}
export function shieldVisual(s: ShieldParams["shape"]): ShieldParams["shape"] {
  return SHIELD_VISUAL[s];
}

export function pickStyle<T extends string>(r: () => number, table: Record<T, T>): T {
  const keys = Object.keys(table) as T[];
  return keys[Math.floor(r() * keys.length)]!;
}
