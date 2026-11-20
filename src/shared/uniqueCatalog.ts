import type { ItemKind, Rarity } from "./types";

/**
 * Legendarios/míticos nombrados (no genéricos).
 * Solo lo que esté en UNIQUE_CATALOG puede dropear con cupo.
 */
export type UniqueDef = {
  key: string;
  /** Nombre fijo en el mundo. */
  name: string;
  rarity: Extract<Rarity, "legendary" | "mythic">;
  /** mythic=1; legendary=5..10. */
  maxCopies: number;
};

/** Catálogo activo (drop + cupo). Pasá ideas desde UNIQUE_IDEAS cuando estén listas. */
export const UNIQUE_CATALOG: UniqueDef[] = [];

export function uniqueMaxCopies(key: string): number {
  return UNIQUE_CATALOG.find((u) => u.key === key)?.maxCopies ?? 0;
}

export function uniqueStillAvailable(
  key: string,
  dropped: Record<string, number>,
): boolean {
  const max = uniqueMaxCopies(key);
  if (max <= 0) return false;
  return (dropped[key] ?? 0) < max;
}

export function registerUniqueDrop(
  key: string,
  dropped: Record<string, number>,
): void {
  dropped[key] = (dropped[key] ?? 0) + 1;
}

/* -------------------------------------------------------------------------- */
/*  IDEAS — borrador de ítems especiales (no dropean hasta pasarlos al catálogo) */
/*  Completá / tachá / mové a UNIQUE_CATALOG o EASTER_EGGS cuando quieras ship.   */
/* -------------------------------------------------------------------------- */

export type UniqueIdea = {
  /** Id tentativo snake_case. */
  key: string;
  /** Nombre de display tentativo. */
  name: string;
  rarity: Extract<
    Rarity,
    "exceptional" | "epic" | "legendary" | "mythic"
  >;
  /** Qué tipo de ítem sería. */
  kind?: ItemKind;
  /** Cupo deseado (mythic=1, legendary≈5–10). */
  maxCopies?: number;
  /** Lore / look / mecánicas — libre. */
  notes?: string;
};

/**
 * Acá van las ideas. Orden sugerido: mythic → legendary → epic → exceptional.
 * No afecta el juego hasta que copies una entrada a UNIQUE_CATALOG (o implementes el ítem).
 */
export const UNIQUE_IDEAS: UniqueIdea[] = [
  {
    key: "Thanos_Gauntlet",
    name: "Guantelete del Infinito",
    rarity: "mythic",
    kind: "gloves",
    maxCopies: 1,
    notes: "El todopoderoso Guantelete del Infinito de Thanos, que permite controlar el tiempo y el espacio.",
  },
  {
    key: "Messi_argentina_shirt",
    name: "Camiseta de Messi",
    rarity: "mythic",
    kind: "armor",
    maxCopies: 1,
    notes: "La mítica camiseta de Argentina de Lionel Messi.",
  },
  {
    key: "Ayrton_Senna_helmet",
    name: "Cascó de Ayrton Senna",
    rarity: "mythic",
    kind: "helmet",
    maxCopies: 1,
    notes: "El casco de Ayrton Senna, el mejor piloto de Fórmula 1 de todos los tiempos.",
  },
  {
    key: "Queen_Elizabeth_crown",
    name: "Corona de la Reina Isabel II",
    rarity: "mythic",
    kind: "helmet",
    maxCopies: 1,
    notes: "La corona de la Reina Isabel II, la reina de Inglaterra y Irlanda del Norte.",
  },
  {
    key: "LeBron_James_jersey",
    name: "Jersey de LeBron James",
    rarity: "mythic",
    kind: "armor",
    maxCopies: 1,
    notes: "El jersey de LeBron James, el mejor jugador de baloncesto de todos los tiempos.",
  },
  {
    key: "Muhammad_Ali_gloves",
    name: "Guantes de Muhammad Ali",
    rarity: "mythic",
    kind: "gloves",
    maxCopies: 1,
    notes: "Los guantes de Muhammad Ali, el mejor boxeador de todos los tiempos.",
  },
  {
    key: "Genghis_Khan_armor",
    name: "Armadura de Gengis Khan",
    rarity: "mythic",
    kind: "armor",
    maxCopies: 1,
    notes: "La armadura de Gengis Khan, el gran conquistador mongol.",
  },
  {
    key: "Pegasus_wings_boots",
    name: "Botas aladas de Pegasus",
    rarity: "mythic",
    kind: "boots",
    maxCopies: 1,
    notes: "Las botas aladas de Pegasus, el caballo mágico de la mitología griega.",
  },
  {
    key: "Daft_Punk_helmet",
    name: "Casco de Daft Punk",
    rarity: "mythic",
    kind: "helmet",
    maxCopies: 1,
    notes: "El casco de Daft Punk.",
  },
  {
    key: "Max_Verstappen_helmet",
    name: "Casco de Max Verstappen",
    rarity: "mythic",
    kind: "helmet",
    maxCopies: 1,
    notes: "Casco de F1 de Max Verstappen (mythic only).",
  },
  // ——— MYTHIC (1 sola copia en el universo) ———
  // {
  //   key: "mythic_…",
  //   name: "…",
  //   rarity: "mythic",
  //   kind: "sword",
  //   maxCopies: 1,
  //   notes: "…",
  // },

  // ——— LEGENDARY (5–10 copias; después no dropea más) ———
  // {
  //   key: "legend_…",
  //   name: "…",
  //   rarity: "legendary",
  //   kind: "armor",
  //   maxCopies: 7,
  //   notes: "…",
  // },

  // ——— EPIC / EXCEPTIONAL (únicos narrativos, cupo a definir) ———
  // {
  //   key: "epic_…",
  //   name: "…",
  //   rarity: "epic",
  //   kind: "helmet",
  //   notes: "…",
  // },
];

/** Easter eggs: calidad baja, peso de drop minúsculo. */
export type EasterEggDef = {
  key: string;
  /** Prob absoluta al generar un loot de ese kind (además del roll normal). */
  weight: number;
  kind: "helmet" | "armor" | "boots" | "pants" | "gloves";
  /** Style concreto del params. */
  style: string;
  name: string;
  rarity: Extract<Rarity, "vulgar" | "common" | "regular">;
};

export const EASTER_EGGS: EasterEggDef[] = [
  {
    key: "egg_chavo_beret",
    weight: 0.0007,
    kind: "helmet",
    style: "beret",
    name: "Gorro del Vecindario",
    rarity: "common",
  },
  {
    key: "egg_chavo_shirt",
    weight: 0.0005,
    kind: "armor",
    style: "jersey",
    name: "Remera del Vecindario",
    rarity: "vulgar",
  },
  {
    key: "egg_mariachi",
    weight: 0.0005,
    kind: "helmet",
    style: "cowboy",
    name: "Sombrero Charro",
    rarity: "vulgar",
  },
];
