import * as THREE from "three";
import {
  armorVisual,
  bootHeightClass,
  gloveVisual,
  pantsVisual,
} from "../shared/presets";
import type { ArmorParams, BootsParams, GlovesParams, PantsParams } from "../shared/types";
import { rarityT } from "../shared/rng";
import { applyItemGlow, metalColor } from "./itemMesh";

const ARMOR_BONES = new Set([
  // sin Hips → no invade pantalón
  "Abdomen",
  "Torso",
  // sin Neck → cuello al descubierto
  "ShoulderL",
  "ShoulderR",
  "UpperArmL",
  "UpperArmR",
]);
/** Pelvis/piernas: la armadura no debe heredar peso de acá. */
const ARMOR_EXCLUDE_BONES = new Set(["Hips", "UpperLegL", "UpperLegR", "LowerLegL", "LowerLegR"]);

/** Botas bajas: solo pies. */
const BOOT_BONES = new Set(["FootL", "FootR"]);
/** Grebas / trail / combat: pie + pantorrilla (sí tienen caña). */
const BOOT_TALL_BONES = new Set(["FootL", "FootR", "LowerLegL", "LowerLegR"]);
/** Hombreras. */
const ARMOR_SHOULDER_BONES = new Set(["ShoulderL", "ShoulderR", "UpperArmL", "UpperArmR"]);
/** Peto central. */
const ARMOR_CHEST_BONES = new Set(["Abdomen", "Torso"]);

/**
 * Muslos + Hips + Abdomen (frente/cintura). Sin Abdomen, al subir rise
 * solo engordan costados/glúteos y queda la V delantera.
 */
const PANT_BONES = new Set(["UpperLegL", "UpperLegR", "Hips", "Abdomen"]);
/** Solo piernas+Hips (sin abdomen) — estilos muy bajos. */
const PANT_BONES_LOW = new Set(["UpperLegL", "UpperLegR", "Hips"]);

/** Manopla: palma + dedos en bloque, con pulgar cubierto (no se escapa). */
const GLOVE_MITTEN_BONES = new Set([
  "PalmL",
  "PalmR",
  "MiddleHandL",
  "MiddleHandR",
  "FingersL",
  "FingersR",
  "Thumb1L",
  "Thumb2L",
  "Thumb1R",
  "Thumb2R",
]);

/** Guante con dedos / pulgar articulado. */
const GLOVE_FINGERED_BONES = new Set([
  "PalmL",
  "PalmR",
  "MiddleHandL",
  "MiddleHandR",
  "FingersL",
  "FingersR",
  "Thumb1L",
  "Thumb2L",
  "Thumb1R",
  "Thumb2R",
]);

const GLOVE_BONES = GLOVE_FINGERED_BONES;

type ShellOpts = {
  boneNames: Set<string>;
  inflate: number;
  material: THREE.Material;
  /** Peso mínimo en huesos permitidos para considerar el vértice. */
  minWeight?: number;
  /** Si el peso en estos huesos ≥ peso permitido, se descarta (anti-bleed torso). */
  excludeBoneNames?: Set<string>;
  /** Escala UV procedural (malla no trae UVs útiles tras soldar). */
  uvScale?: number;
  /** Multiplica el inflate según |normal| bind (x,y,z). */
  inflateNormalBias?: { x: number; y: number; z: number };
  /** Escala silueta respecto al centro del shell (aplana / alarga / sube caña). */
  shapeScale?: { x: number; y: number; z: number };
  /**
   * HumanMale: frente = +Z, espalda = −Z.
   * "front" descarta tris de atrás y empuja más con normal +Z (evita tela en glúteos).
   */
  preferWorldZ?: "front" | "back";
  /** Descarta tris con Y promedio (bind) por encima — baja la “lona” frontal. */
  maxBindY?: number;
  /** Descarta tris con Y promedio (bind) por debajo — acorta dobladillo / deja ver botas. */
  minBindY?: number;
  /** 0..1: en frente (+Z) acerca X al centro y suma un poco de Z (cierra el V). */
  closeFrontMidline?: number;
  /**
   * Puntera: tras inflar/escalar (misma silueta que el shell base) conserva solo los tris
   * cuyo Z bind ≥ punta − toeFrac·largo del pie.
   */
  toeFrac?: number;
  /** "keep" (default) = solo la puntera; "drop" = todo menos la puntera (capas que la taparían). */
  toeMode?: "keep" | "drop";
};

/** Solo pecho/cuello: Abdomen queda para que la cintura gane alto sin V. */
const PANT_EXCLUDE_BONES = new Set(["Torso", "Neck"]);

type PatternKind =
  | "leather"
  | "cloth"
  | "quilt"
  | "chain"
  | "scale"
  | "metal"
  | "rivet"
  | "lace"
  | "camo"
  | "denim";

function rng(seed: number): () => number {
  let s = (seed >>> 0) ^ 0x9e3779b9;
  return () => {
    s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) + 0x7f4a7c15) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

const texCache = new Map<string, THREE.CanvasTexture>();

function patternTex(kind: PatternKind, seed: number, hue: number): THREE.CanvasTexture {
  const key = `${kind}|${seed & 255}|${(hue * 64) | 0}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const r = rng(seed * 17 + kind.length * 91);
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const base = new THREE.Color();
  if (kind === "leather") base.setHSL(0.07 + hue * 0.1, 0.35, 0.28 + r() * 0.12);
  else if (kind === "cloth") base.setHSL(hue, 0.25 + r() * 0.35, 0.35 + r() * 0.2);
  else if (kind === "quilt") base.setHSL(0.1 + hue * 0.15, 0.2, 0.4);
  else if (kind === "chain") base.setHSL(0.58, 0.04, 0.42);
  else if (kind === "scale") base.setHSL(0.08 + hue * 0.5, 0.15, 0.35);
  else if (kind === "rivet") base.setHSL(0.08, 0.15, 0.22);
  else if (kind === "lace") base.setHSL(0.07 + hue * 0.08, 0.28, 0.24);
  else if (kind === "camo") base.setHSL(0.25 + hue * 0.08, 0.35, 0.28);
  else if (kind === "denim") base.setHSL(0.58 + hue * 0.06, 0.35, 0.28);
  else base.setHSL(0.58, 0.05 + hue * 0.2, 0.55);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, 64, 64);

  if (kind === "leather") {
    for (let i = 0; i < 400; i++) {
      const n = (r() * 40 - 20) | 0;
      g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.08})`;
      g.fillRect((r() * 64) | 0, (r() * 64) | 0, 1 + (r() * 3) | 0, 1);
      if (n > 0) {
        g.fillStyle = `rgba(255,255,255,0.04)`;
        g.fillRect((r() * 64) | 0, (r() * 64) | 0, 1, 1);
      }
    }
  } else if (kind === "cloth") {
    const step = 3 + (r() * 3) | 0;
    g.strokeStyle = `rgba(0,0,0,0.12)`;
    for (let x = 0; x < 64; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 64);
      g.stroke();
    }
    for (let y = 0; y < 64; y += step) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(64, y);
      g.stroke();
    }
  } else if (kind === "quilt") {
    const cell = 10 + (r() * 6) | 0;
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.lineWidth = 1.2;
    for (let y = 0; y < 64; y += cell) {
      for (let x = 0; x < 64; x += cell) {
        g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.06})`;
        g.beginPath();
        g.arc(x + cell * 0.5, y + cell * 0.5, 1.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (kind === "chain") {
    g.fillStyle = "#00000022";
    for (let y = 0; y < 64; y += 4) {
      for (let x = 0; x < 64; x += 4) {
        const ox = (y / 4) % 2 === 0 ? 0 : 2;
        g.beginPath();
        g.arc(x + ox + 2, y + 2, 1.6, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.15)";
        g.stroke();
      }
    }
  } else if (kind === "scale") {
    for (let y = 0; y < 70; y += 5) {
      for (let x = 0; x < 70; x += 6) {
        const ox = (y / 5) % 2 === 0 ? 0 : 3;
        g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.15})`;
        g.beginPath();
        g.ellipse(x + ox, y, 3.2, 4.2, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.12)";
        g.stroke();
      }
    }
  } else if (kind === "metal") {
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.08})`;
      g.fillRect(0, (r() * 64) | 0, 64, 1 + (r() * 2) | 0);
    }
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`;
      g.fillRect((r() * 64) | 0, (r() * 64) | 0, 2 + (r() * 8) | 0, 1);
    }
  } else if (kind === "lace") {
    // Criss-cross real: ojales metal + cordón redondo en X (ref. combat/work boots)
    g.fillStyle = "rgba(55,42,30,0.5)";
    g.fillRect(22, 4, 20, 56); // lengüeta
    const pairs = 7;
    for (let i = 0; i < pairs; i++) {
      const y = 6 + i * 8;
      // ojales plateados
      for (const x of [16, 48]) {
        g.fillStyle = "#8a8e94";
        g.beginPath();
        g.arc(x, y, 2.4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#1a1814";
        g.beginPath();
        g.arc(x, y, 1.1, 0, Math.PI * 2);
        g.fill();
      }
      if (i === 0) {
        // barra inferior horizontal (inicia el lace)
        g.strokeStyle = "rgba(210,195,160,0.9)";
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(16, y);
        g.lineTo(48, y);
        g.stroke();
      } else {
        // diagonales X entre pares
        g.strokeStyle = "rgba(200,185,150,0.85)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(16, y - 8);
        g.lineTo(48, y);
        g.moveTo(48, y - 8);
        g.lineTo(16, y);
        g.stroke();
      }
    }
  } else if (kind === "camo") {
    const blobs = [
      new THREE.Color().setHSL(0.22, 0.35, 0.22),
      new THREE.Color().setHSL(0.1, 0.25, 0.18),
      new THREE.Color().setHSL(0.28, 0.2, 0.35),
    ];
    for (let i = 0; i < 28; i++) {
      const c2 = blobs[(r() * blobs.length) | 0]!;
      g.fillStyle = `#${c2.getHexString()}`;
      g.beginPath();
      g.ellipse(r() * 64, r() * 64, 6 + r() * 10, 4 + r() * 8, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === "denim") {
    // Twill 2/1 diagonal + topstitch naranja (ref. Levi's / denim macro)
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const twill = (x + y * 2) % 4;
        if (twill === 0) g.fillStyle = "rgba(255,255,255,0.07)";
        else if (twill === 2) g.fillStyle = "rgba(0,0,40,0.12)";
        else g.fillStyle = "rgba(255,255,255,0.02)";
        g.fillRect(x, y, 1, 1);
      }
    }
    // Costura doble naranja
    g.strokeStyle = "rgba(196,145,45,0.7)";
    g.lineWidth = 1.2;
    for (const x of [10, 12, 52, 54]) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 64);
      g.stroke();
    }
    // Remache cobre
    g.fillStyle = "#b87333";
    g.beginPath();
    g.arc(14, 14, 2.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,220,160,0.5)";
    g.beginPath();
    g.arc(13.2, 13.2, 1, 0, Math.PI * 2);
    g.fill();
  } else {
    // rivet / trim
    for (let y = 4; y < 64; y += 12) {
      for (let x = 4; x < 64; x += 12) {
        g.fillStyle = "rgba(180,160,100,0.7)";
        g.beginPath();
        g.arc(x + r() * 2, y + r() * 2, 1.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

function withPolyOffset(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -1;
  return m;
}

function rarityGlow(m: THREE.MeshStandardMaterial, rarity: ArmorParams["rarity"], hue = 0.55): void {
  // Placeholder; el glow final lo aplica applyItemGlow sobre el root.
  m.userData.rarity = rarity;
  m.userData.glowHue = hue;
}

function softArmorMat(params: ArmorParams): THREE.MeshStandardMaterial {
  const { style, finish, hue, rarity, seed } = params;
  const r = rng(seed);
  const clothish =
    style === "hoodie" ||
    style === "shirt" ||
    style === "tunic" ||
    style === "poncho" ||
    style === "tabard";
  const jacketish = style === "jacket" || style === "coat" || style === "duster";
  const quiltish = style === "padded" || style === "gambeson";
  const chainish = style === "chain" || style === "hauberk";
  const scaleish = style === "scale" || style === "lamellar";
  const plateish = style === "plate" || style === "cuirass";
  const brig = style === "brigandine";

  let pattern: PatternKind = clothish
    ? "cloth"
    : quiltish
      ? "quilt"
      : jacketish || style === "leather"
        ? "leather"
        : style === "vest" || brig
          ? "rivet"
          : chainish
            ? "chain"
            : scaleish
              ? "scale"
              : plateish
                ? "metal"
                : "leather";
  if ((style === "leather" || brig) && r() > 0.55) pattern = "rivet";

  let color: THREE.Color;
  let metalness = 0.05;
  let roughness = 0.85;
  if (clothish || jacketish || style === "leather" || quiltish) {
    const brightCloth = style === "tunic" || style === "tabard" || style === "shirt";
    color = new THREE.Color().setHSL(
      clothish ? hue : 0.06 + hue * 0.14,
      clothish ? 0.35 + r() * 0.25 : 0.28 + r() * 0.2,
      finish === "darkened"
        ? 0.18 + r() * 0.08
        : brightCloth
          ? 0.4 + r() * 0.12
          : clothish
            ? 0.36 + r() * 0.16
            : 0.32 + r() * 0.14,
    );
    metalness = 0.02;
    roughness = 0.88 + r() * 0.08;
  } else if (style === "vest") {
    color = new THREE.Color().setHSL(0.1, 0.08, finish === "darkened" ? 0.14 : 0.22);
    metalness = 0.15;
    roughness = 0.78;
    pattern = "rivet";
  } else if (finish === "bare") {
    color = new THREE.Color().setHSL(0.58, 0.03 + rarityT(rarity) * 0.1, 0.45 + r() * 0.12);
    metalness = 0.78;
    roughness = 0.38 + r() * 0.12;
  } else if (finish === "darkened") {
    color = new THREE.Color().setHSL(0.62, 0.05, 0.16 + r() * 0.08);
    metalness = 0.7;
    roughness = 0.48;
  } else if (finish === "polished") {
    color = metalColor(hue, rarity);
    metalness = 0.88;
    roughness = 0.22 + r() * 0.1;
  } else {
    color = metalColor(hue, rarity);
    metalness = chainish ? 0.7 : 0.58;
    roughness = 0.36 + r() * 0.12;
  }

  const map = patternTex(pattern, seed, hue);
  map.repeat.set(2.2 + r() * 2.5, 2.2 + r() * 2.5);
  const m = withPolyOffset(
    new THREE.MeshStandardMaterial({
      color,
      map,
      metalness,
      roughness,
      envMapIntensity: metalness > 0.4 ? 0.95 : 0.35,
      side: THREE.DoubleSide,
    }),
  );
  rarityGlow(m, rarity);
  return m;
}

function softAccentMat(params: ArmorParams): THREE.MeshStandardMaterial {
  const r = rng(params.seed + 99);
  const painted = metalColor((params.hue + 0.35 + r() * 0.2) % 1, params.rarity);
  const map = patternTex(params.style === "scale" ? "scale" : "metal", params.seed + 3, params.hue);
  map.repeat.set(1.5 + r(), 1.5 + r());
  const m = withPolyOffset(
    new THREE.MeshStandardMaterial({
      color: params.finish === "darkened" ? new THREE.Color().setHSL(0.6, 0.05, 0.18) : painted,
      map,
      metalness: 0.82,
      roughness: params.finish === "polished" ? 0.22 : 0.4,
      envMapIntensity: 1,
      side: THREE.DoubleSide,
    }),
  );
  rarityGlow(m, params.rarity);
  return m;
}

/** Tela secundaria (accent / franja / colorblock). */
function softClothToneMat(params: ArmorParams, toneHue: number, seedOff = 0): THREE.MeshStandardMaterial {
  const r = rng(params.seed + 211 + seedOff);
  const dark = params.finish === "darkened";
  const color = new THREE.Color().setHSL(
    toneHue,
    0.28 + r() * 0.35,
    dark ? 0.16 + r() * 0.1 : 0.32 + r() * 0.2,
  );
  const map = patternTex("cloth", params.seed + 17 + seedOff, toneHue);
  map.repeat.set(1.8 + r(), 1.8 + r());
  return withPolyOffset(
    new THREE.MeshStandardMaterial({
      color,
      map,
      metalness: 0.02,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
  );
}

const logoTexCache = new Map<string, THREE.CanvasTexture>();

/** Glifo inventado (no tipografía real) → cientos de “marcas”. */
function inventLogoTex(logoId: number, seed: number, inkHue: number): THREE.CanvasTexture {
  const key = `logo:${logoId}:${seed & 0xff}:${inkHue.toFixed(2)}`;
  const hit = logoTexCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 128);
  const r = rng(seed * 31 + logoId * 97);
  const ink = new THREE.Color().setHSL(inkHue, 0.55 + r() * 0.3, 0.45 + r() * 0.25);
  ctx.fillStyle = `#${ink.getHexString()}`;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 6 + r() * 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const kind = logoId % 8;
  ctx.translate(64, 64);
  ctx.rotate((r() - 0.5) * 0.5);
  if (kind === 0) {
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(36, 32);
    ctx.lineTo(-36, 32);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 1) {
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(-8, -28, 16, 56);
  } else if (kind === 2) {
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-40 + i * 8, -30, 10, 60);
    }
  } else if (kind === 3) {
    ctx.beginPath();
    ctx.moveTo(-38, 30);
    ctx.quadraticCurveTo(0, -50, 38, 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 8, 12, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 4) {
    ctx.strokeRect(-32, -32, 64, 64);
    ctx.fillRect(-12, -12, 24, 24);
  } else if (kind === 5) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 36;
      const y = Math.sin(a) * 36;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    r() > 0.5 ? ctx.fill() : ctx.stroke();
  } else if (kind === 6) {
    ctx.beginPath();
    ctx.moveTo(-30, -30);
    ctx.lineTo(30, 30);
    ctx.moveTo(30, -30);
    ctx.lineTo(-30, 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const n = 3 + (logoId % 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 16, Math.sin(a) * 16, 14, 8, a, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  logoTexCache.set(key, tex);
  return tex;
}

function metalToneColor(
  tone: BootsParams["metalTone"] | undefined,
  hue: number,
  rarity: BootsParams["rarity"],
): THREE.Color {
  if (tone === "gold") return new THREE.Color().setHSL(0.12, 0.75, 0.52);
  if (tone === "copper") return new THREE.Color().setHSL(0.06, 0.65, 0.42);
  if (tone === "steel" || !tone) return new THREE.Color().setHSL(0.58, 0.04, 0.58);
  return metalColor(hue, rarity);
}

function softBootMat(params: BootsParams, layer: "base" | "plate" = "base"): THREE.MeshStandardMaterial {
  const r = rng(params.seed + (layer === "plate" ? 7 : 0));
  if (layer === "plate" || params.style === "plate" || params.style === "greaves") {
    const map = patternTex("metal", params.seed, params.leatherHue);
    map.repeat.set(1.8, 1.8);
    const m = withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: metalToneColor(params.metalTone, params.leatherHue, params.rarity),
        map,
        metalness: 0.82 + r() * 0.1,
        roughness: params.metalTone === "gold" ? 0.28 : params.metalTone === "copper" ? 0.4 : 0.34,
        side: THREE.DoubleSide,
      }),
    );
    rarityGlow(m, params.rarity);
    return m;
  }
  if (params.style === "crocs") {
    // EVA foam mate, colores vivos de casa
    const foam = new THREE.Color().setHSL(
      params.leatherHue < 0.15
        ? 0.02
        : params.leatherHue < 0.4
          ? 0.55
          : params.leatherHue < 0.7
            ? 0.12
            : 0.33,
      0.55 + r() * 0.25,
      0.42 + r() * 0.12,
    );
    return withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: foam,
        roughness: 0.98,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
  }
  const kind: PatternKind =
    params.style === "canvas" || params.style === "sport" || params.style === "sneaker"
      ? "cloth"
      : params.style === "combat" || params.style === "work"
        ? "lace"
        : "leather";
  const map = patternTex(kind, params.seed, params.leatherHue);
  map.repeat.set(2 + r(), 2 + r());
  const c =
    params.style === "canvas"
      ? params.leatherHue < 0.03
        ? new THREE.Color().setHSL(0.02, 0.06, 0.1)
        : params.leatherHue < 0.08
          ? new THREE.Color().setHSL(0.0, 0.7, 0.32)
          : params.leatherHue > 0.5 && params.leatherHue < 0.7
            ? new THREE.Color().setHSL(0.6, 0.42, 0.2)
            : new THREE.Color().setHSL(params.leatherHue, 0.48, 0.2)
      : params.style === "sandal"
        ? new THREE.Color().setHSL(0.08 + params.leatherHue * 0.06, 0.4, 0.38)
        : params.style === "oxford" || params.style === "loafer" || params.style === "dress"
          ? new THREE.Color().setHSL(0.05 + params.leatherHue * 0.05, 0.35, 0.16)
          : new THREE.Color().setHSL(
              0.06 + params.leatherHue * 0.1,
              0.32,
              params.style === "trail" || params.style === "combat" || params.style === "ski"
                ? 0.22
                : 0.34,
            );
  return withPolyOffset(
    new THREE.MeshStandardMaterial({
      color: c,
      map,
      roughness:
        params.style === "canvas"
          ? 0.94
          : params.style === "oxford" || params.style === "dress"
            ? 0.55
            : 0.9,
      metalness: 0.03,
      side: THREE.DoubleSide,
    }),
  );
}

function softGloveMat(params: GlovesParams): THREE.MeshStandardMaterial {
  const r = rng(params.seed);
  if (params.style === "bracers") {
    const map = patternTex("rivet", params.seed, params.hue);
    return withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: metalColor(params.hue, params.rarity),
        map,
        metalness: 0.55,
        roughness: 0.4,
        side: THREE.DoubleSide,
      }),
    );
  }
  if (params.style === "mittens" || params.style === "wraps") {
    return withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(
          params.style === "wraps" ? 0.08 : params.hue,
          params.style === "wraps" ? 0.35 : 0.25,
          params.style === "mittens" ? 0.55 : 0.32,
        ),
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
  }
  if (params.style === "gauntlet") {
    const map = patternTex(r() > 0.5 ? "metal" : "rivet", params.seed, params.hue);
    map.repeat.set(2, 2);
    const m = withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: metalColor(params.hue, params.rarity),
        map,
        metalness: 0.72,
        roughness: 0.36,
        side: THREE.DoubleSide,
      }),
    );
    rarityGlow(m, params.rarity);
    return m;
  }
  const kind: PatternKind = params.style === "cloth" ? "cloth" : "leather";
  const map = patternTex(kind, params.seed, params.hue);
  map.repeat.set(2.5, 2.5);
  const c = new THREE.Color().setHSL(
    params.style === "cloth" ? params.hue : 0.07 + params.hue * 0.08,
    params.style === "cloth" ? 0.35 : 0.3,
    params.style === "cloth" ? 0.4 : 0.3,
  );
  return withPolyOffset(
    new THREE.MeshStandardMaterial({
      color: c,
      map,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
}

function softPantsMat(params: PantsParams): THREE.MeshStandardMaterial {
  const r = rng(params.seed);
  if (params.style === "plated") {
    const map = patternTex("metal", params.seed, params.hue);
    map.repeat.set(2, 2);
    const m = withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: metalColor(params.hue, params.rarity),
        map,
        metalness: 0.65,
        roughness: 0.4,
        side: THREE.DoubleSide,
      }),
    );
    rarityGlow(m, params.rarity);
    return m;
  }
  if (params.style === "shorts") {
    return withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(params.hue, 0.35, 0.4),
        roughness: 0.9,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
    );
  }
  if (params.style === "kilt") {
    return withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(params.hue, 0.45, 0.32),
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
  }
  if (params.style === "chaps" || params.style === "breeches") {
    return withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.07, 0.4, 0.22),
        roughness: 0.85,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    );
  }
  if (params.style === "fatigues") {
    const map = patternTex("camo", params.seed, params.hue);
    return withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.22, 0.35, 0.28),
        map,
        roughness: 0.92,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
    );
  }
  if (params.style === "jeans") {
    const map = patternTex("denim", params.seed, params.hue);
    map.repeat.set(3.2, 3.2);
    return withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.58 + (params.hue - 0.55) * 0.3, 0.4, 0.32),
        map,
        roughness: 0.92,
        metalness: 0.04,
        side: THREE.DoubleSide,
      }),
    );
  }
  const kind: PatternKind =
    params.style === "cargo"
      ? "camo"
      : params.style === "jogger"
        ? "cloth"
        : params.style === "cloth"
          ? r() > 0.5
            ? "cloth"
            : "quilt"
          : "leather";
  const map = patternTex(kind, params.seed, params.hue);
  map.repeat.set(2.2 + r(), 2.2 + r());
  const c = new THREE.Color().setHSL(
    params.style === "cargo"
      ? 0.22 + params.hue * 0.08
      : params.style === "cloth" || params.style === "jogger"
        ? params.hue
        : 0.07 + params.hue * 0.1,
    params.style === "cargo" ? 0.35 : params.style === "leather" ? 0.32 : 0.3 + r() * 0.25,
    params.style === "jogger" ? 0.38 + r() * 0.12 : params.style === "cargo" ? 0.26 : 0.3,
  );
  return withPolyOffset(
    new THREE.MeshStandardMaterial({
      color: c,
      map,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
}

function boneAllowSet(skeleton: THREE.Skeleton, names: Set<string>): Set<number> {
  const allow = new Set<number>();
  skeleton.bones.forEach((b, i) => {
    if (names.has(b.name)) allow.add(i);
  });
  return allow;
}

function vertBoneWeight(
  skinIndex: THREE.BufferAttribute,
  skinWeight: THREE.BufferAttribute,
  vi: number,
  allow: Set<number>,
): number {
  let w = 0;
  for (let k = 0; k < 4; k++) {
    const bi = skinIndex.getComponent(vi, k);
    if (allow.has(bi)) w += skinWeight.getComponent(vi, k);
  }
  return w;
}

/**
 * Cascarón skinned sólido.
 * HumanMale parte vértices por cara (flat/UV); inflar con esas normales
 * abre grietas. Acá se sueldan por posición, se suavizan normales y recién
 * ahí se infla — la piel queda continua y sigue skinned.
 */
export function createSkinnedShell(sources: THREE.SkinnedMesh[], opts: ShellOpts): THREE.Group {
  const {
    boneNames,
    inflate,
    material,
    minWeight = 0.1,
    excludeBoneNames,
    uvScale = 2.4,
    inflateNormalBias,
    shapeScale,
    preferWorldZ,
    maxBindY,
    minBindY,
    closeFrontMidline,
    toeFrac,
    toeMode,
  } = opts;
  const root = new THREE.Group();
  root.name = "skinned-shell";
  const bias = inflateNormalBias ?? { x: 1, y: 1, z: 1 };
  const biasNorm = Math.max(1e-4, (bias.x + bias.y + bias.z) / 3);
  // HumanMale: frente +Z. No confundir con −Z (espalda) al cerrar entrepierna.
  const zPrefer = preferWorldZ === "front" ? 1 : preferWorldZ === "back" ? -1 : 0;
  const midPull = Math.min(1, Math.max(0, closeFrontMidline ?? 0));

  // Puntera: rango Z talón→punta sobre TODAS las mallas (por malla, la pierna daba un falso "pie")
  let toeZMin = Infinity;
  let toeZMax = -Infinity;
  if (toeFrac !== undefined) {
    for (const src of sources) {
      const footAllow = boneAllowSet(src.skeleton, BOOT_BONES);
      const p = src.geometry.attributes.position as THREE.BufferAttribute;
      const si = src.geometry.attributes.skinIndex as THREE.BufferAttribute | undefined;
      const sw = src.geometry.attributes.skinWeight as THREE.BufferAttribute | undefined;
      if (!si || !sw || footAllow.size === 0) continue;
      for (let i = 0; i < p.count; i++) {
        if (vertBoneWeight(si, sw, i, footAllow) < 0.5) continue;
        const z = p.getZ(i);
        if (z < toeZMin) toeZMin = z;
        if (z > toeZMax) toeZMax = z;
      }
    }
  }

  for (const src of sources) {
    const allow = boneAllowSet(src.skeleton, boneNames);
    if (allow.size === 0) continue;
    const exclude = excludeBoneNames ? boneAllowSet(src.skeleton, excludeBoneNames) : null;

    const geo = src.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const skinIndex = geo.attributes.skinIndex as THREE.BufferAttribute | undefined;
    const skinWeight = geo.attributes.skinWeight as THREE.BufferAttribute | undefined;
    if (!skinIndex || !skinWeight) continue;

    const wOf = (i: number) => vertBoneWeight(skinIndex, skinWeight, i, allow);
    const wEx = (i: number) => (exclude ? vertBoneWeight(skinIndex, skinWeight, i, exclude) : 0);
    /** Allow usable; exclude suave (no exigir 0 abdomen o se abre hueco en crotch). */
    const legOk = (i: number) => {
      const a = wOf(i);
      if (a < minWeight * 0.55) return false;
      const e = wEx(i);
      return e < Math.max(0.55, a * 1.15);
    };
    const idx = geo.index;
    const triCount = idx ? idx.count / 3 : posAttr.count / 3;

    // 1) Elegir tris por peso de hueso (y anti-bleed torso si hay exclude)
    const rawTris: number[] = [];
    const usedOld = new Set<number>();
    for (let t = 0; t < triCount; t++) {
      const a = idx ? idx.getX(t * 3) : t * 3;
      const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      if (exclude) {
        const okA = legOk(a);
        const okB = legOk(b);
        const okC = legOk(c);
        // Mayoría (2/3): exigir 3/3 dejaba V en entrepierna
        const votes = (okA ? 1 : 0) + (okB ? 1 : 0) + (okC ? 1 : 0);
        if (votes < 2) continue;
        // Descartar si el tri está dominado por torso
        if ((wEx(a) + wEx(b) + wEx(c)) / 3 > 0.42) continue;
        if (Math.max(wOf(a), wOf(b), wOf(c)) < minWeight) continue;
      } else if (Math.max(wOf(a), wOf(b), wOf(c)) < minWeight) continue;
      // Entrepierna/frente: no tomar glúteos (−Z) al querer cubrir el V delantero
      if (zPrefer !== 0) {
        const zTri = (posAttr.getZ(a) + posAttr.getZ(b) + posAttr.getZ(c)) / 3;
        if (zPrefer > 0 && zTri < -0.01) continue;
        if (zPrefer < 0 && zTri > 0.01) continue;
      }
      if (maxBindY !== undefined || minBindY !== undefined) {
        const yTri = (posAttr.getY(a) + posAttr.getY(b) + posAttr.getY(c)) / 3;
        if (maxBindY !== undefined && yTri > maxBindY) continue;
        if (minBindY !== undefined && yTri < minBindY) continue;
      }
      rawTris.push(a, b, c);
      usedOld.add(a);
      usedOld.add(b);
      usedOld.add(c);
    }
    if (rawTris.length < 3) continue;

    // 2) Soldar por posición (cierra islas flat-shaded)
    const posKey = (oi: number) => {
      const x = posAttr.getX(oi);
      const y = posAttr.getY(oi);
      const z = posAttr.getZ(oi);
      return `${x.toFixed(5)}|${y.toFixed(5)}|${z.toFixed(5)}`;
    };
    const weldOf = new Map<string, number>(); // posKey → welded index
    const oldToWeld = new Map<number, number>();
    const weldRepOld: number[] = []; // representante oi por welded vert

    for (const oi of usedOld) {
      const k = posKey(oi);
      let wi = weldOf.get(k);
      if (wi === undefined) {
        wi = weldRepOld.length;
        weldOf.set(k, wi);
        weldRepOld.push(oi);
      }
      oldToWeld.set(oi, wi);
    }

    const weldedIdx: number[] = [];
    for (let i = 0; i < rawTris.length; i++) {
      weldedIdx.push(oldToWeld.get(rawTris[i]!)!);
    }

    const n = weldRepOld.length;
    const positions = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    const skinI = new Uint16Array(n * 4);
    const skinW = new Float32Array(n * 4);
    const influence = new Float32Array(n);

    for (let wi = 0; wi < n; wi++) {
      const oi = weldRepOld[wi]!;
      const x = posAttr.getX(oi);
      const y = posAttr.getY(oi);
      const z = posAttr.getZ(oi);
      positions[wi * 3] = x;
      positions[wi * 3 + 1] = y;
      positions[wi * 3 + 2] = z;
      // UV procedural estable (pre-inflate)
      uvs[wi * 2] = (x * 0.85 + z * 0.55) * uvScale;
      uvs[wi * 2 + 1] = y * uvScale;
      for (let k = 0; k < 4; k++) {
        skinI[wi * 4 + k] = skinIndex.getComponent(oi, k);
        skinW[wi * 4 + k] = skinWeight.getComponent(oi, k);
      }
      influence[wi] = wOf(oi);
    }

    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    out.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    out.setAttribute("skinIndex", new THREE.BufferAttribute(skinI, 4));
    out.setAttribute("skinWeight", new THREE.BufferAttribute(skinW, 4));
    out.setIndex(weldedIdx);

    // 3) Normales suaves sobre malla soldada
    out.computeVertexNormals();
    const nrm = out.attributes.normal as THREE.BufferAttribute;

    // 4) Inflar a lo largo de normales suaves (bias por eje = silueta)
    for (let wi = 0; wi < n; wi++) {
      const w = influence[wi]!;
      const t = Math.min(1, Math.max(0, (w - minWeight * 0.25) / Math.max(1e-4, minWeight * 1.5)));
      const nx = nrm.getX(wi);
      const ny = nrm.getY(wi);
      const nz = nrm.getZ(wi);
      const axisW =
        (Math.abs(nx) * bias.x + Math.abs(ny) * bias.y + Math.abs(nz) * bias.z) / biasNorm;
      // Frente +Z: no engordar espalda al cerrar entrepierna
      const faceW =
        zPrefer === 0 ? 1 : Math.max(0.2, 0.55 + 0.75 * Math.max(0, nz * zPrefer));
      const push = inflate * (0.7 + 0.4 * t) * axisW * faceW;
      positions[wi * 3] += nx * push;
      positions[wi * 3 + 1] += ny * push;
      positions[wi * 3 + 2] += nz * push;
      if (zPrefer !== 0) {
        positions[wi * 3 + 2] += zPrefer * inflate * 0.35 * faceW;
      }
      // Cerrar V: solo |x| chico y frente (+Z). shapeScale.x>1 abre la V; esto la cierra.
      if (midPull > 0) {
        const x = positions[wi * 3]!;
        const z = positions[wi * 3 + 2]!;
        const ax = Math.abs(x);
        if (z > -0.02 && ax < 0.14) {
          const k = midPull * (1 - ax / 0.14);
          positions[wi * 3] = x * (1 - k * 0.9);
          positions[wi * 3 + 2] += k * 0.05;
        }
      }
    }

    // 5) Escala de forma (aplana zapatilla / sube caña) sin romper skinning
    if (shapeScale) {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (let wi = 0; wi < n; wi++) {
        cx += positions[wi * 3]!;
        cy += positions[wi * 3 + 1]!;
        cz += positions[wi * 3 + 2]!;
      }
      cx /= n;
      cy /= n;
      cz /= n;
      for (let wi = 0; wi < n; wi++) {
        positions[wi * 3] = cx + (positions[wi * 3]! - cx) * shapeScale.x;
        positions[wi * 3 + 1] = cy + (positions[wi * 3 + 1]! - cy) * shapeScale.y;
        positions[wi * 3 + 2] = cz + (positions[wi * 3 + 2]! - cz) * shapeScale.z;
      }
    }

    // 6) Puntera: recorte por Z bind (talón→punta medido en verts del pie)
    if (toeFrac !== undefined) {
      const zCut = toeZMax - (toeZMax - toeZMin) * toeFrac;
      const zOf = (wi: number) => posAttr.getZ(weldRepOld[wi]!);
      const P: number[] = Array.from(positions);
      const U: number[] = Array.from(uvs);
      const SI: number[] = Array.from(skinI);
      const SW: number[] = Array.from(skinW);
      // Vértice nuevo sobre el plano de corte (borde recto, no dentado por tris)
      const cutCache = new Map<string, number>();
      const cutVert = (a: number, b: number): number => {
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const hit = cutCache.get(key);
        if (hit !== undefined) return hit;
        const za = zOf(a);
        const t = (zCut - za) / (zOf(b) - za);
        const ni = P.length / 3;
        for (let k = 0; k < 3; k++) P.push(P[a * 3 + k]! + (P[b * 3 + k]! - P[a * 3 + k]!) * t);
        for (let k = 0; k < 2; k++) U.push(U[a * 2 + k]! + (U[b * 2 + k]! - U[a * 2 + k]!) * t);
        const acc = new Map<number, number>();
        for (let k = 0; k < 4; k++) {
          const ia = SI[a * 4 + k]!;
          const ib = SI[b * 4 + k]!;
          acc.set(ia, (acc.get(ia) ?? 0) + SW[a * 4 + k]! * (1 - t));
          acc.set(ib, (acc.get(ib) ?? 0) + SW[b * 4 + k]! * t);
        }
        const top = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
        const sum = top.reduce((s, e) => s + e[1], 0) || 1;
        for (let k = 0; k < 4; k++) {
          SI.push(top[k]?.[0] ?? 0);
          SW.push((top[k]?.[1] ?? 0) / sum);
        }
        cutCache.set(key, ni);
        return ni;
      };
      const kept: number[] = [];
      for (let i = 0; i < weldedIdx.length; i += 3) {
        const tri = [weldedIdx[i]!, weldedIdx[i + 1]!, weldedIdx[i + 2]!];
        const inside = tri.map((v) => zOf(v) >= zCut === (toeMode !== "drop"));
        const nIn = inside.filter(Boolean).length;
        if (nIn === 0) continue;
        if (nIn === 3) {
          kept.push(tri[0]!, tri[1]!, tri[2]!);
          continue;
        }
        const poly: number[] = [];
        for (let e = 0; e < 3; e++) {
          const a = tri[e]!;
          const b = tri[(e + 1) % 3]!;
          const ia = inside[e]!;
          const ib = inside[(e + 1) % 3]!;
          if (ia) poly.push(a);
          if (ia !== ib) poly.push(ia ? cutVert(a, b) : cutVert(b, a));
        }
        for (let k = 1; k + 1 < poly.length; k++) kept.push(poly[0]!, poly[k]!, poly[k + 1]!);
      }
      if (kept.length < 3) continue;
      out.deleteAttribute("normal");
      out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      out.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
      out.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(SI, 4));
      out.setAttribute("skinWeight", new THREE.Float32BufferAttribute(SW, 4));
      out.setIndex(kept);
    }

    out.attributes.position.needsUpdate = true;
    out.computeVertexNormals();

    const mat = material.clone();
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.side = THREE.FrontSide;
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -1;
      mat.polygonOffsetUnits = -1;
      // Ambient mínimo; applyItemGlow pisa emissive con rareza
      if (mat.emissive.getHex() === 0) {
        mat.emissive = mat.color.clone().multiplyScalar(0.02);
        mat.emissiveIntensity = 0.08;
      }
    }
    const mesh = new THREE.SkinnedMesh(out, mat);
    mesh.name = `shell-${src.name}`;
    // Proyectan al piso; no reciben → sin banda negra entre capas/uniones
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.bind(src.skeleton, src.bindMatrix);
    mesh.bindMode = src.bindMode;
    root.add(mesh);
  }

  return root;
}

function mergeShells(...parts: THREE.Group[]): THREE.Group {
  const root = new THREE.Group();
  root.name = "skinned-gear-layered";
  for (const p of parts) {
    while (p.children.length) root.add(p.children[0]!);
  }
  return root;
}

function findBone(sources: THREE.SkinnedMesh[], name: string): THREE.Bone | null {
  for (const s of sources) {
    const b = s.skeleton.bones.find((x) => x.name === name);
    if (b) return b;
  }
  return null;
}

/** Adornos rígidos en huesos; se limpian al unequip vía userData.onDispose. */
function attachDecor(
  root: THREE.Group,
  sources: THREE.SkinnedMesh[],
  boneName: string,
  obj: THREE.Object3D,
): void {
  const bone = findBone(sources, boneName);
  if (!bone) {
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    return;
  }
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      o.renderOrder = 2; // encima del shell skinned
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && "polygonOffset" in m) {
          (m as THREE.MeshStandardMaterial).polygonOffset = true;
          (m as THREE.MeshStandardMaterial).polygonOffsetFactor = -2;
          (m as THREE.MeshStandardMaterial).polygonOffsetUnits = -2;
        }
      }
    }
  });
  bone.add(obj);
  const list = (root.userData.decors as THREE.Object3D[] | undefined) ?? [];
  list.push(obj);
  root.userData.decors = list;
  root.userData.onDispose = () => {
    const decors = root.userData.decors as THREE.Object3D[] | undefined;
    if (!decors) return;
    for (const d of decors) {
      d.parent?.remove(d);
      d.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    }
    root.userData.decors = [];
  };
}

/** AABB del shell skinned en espacio local del hueso Foot*. */
type FootShellFit = {
  min: THREE.Vector3;
  max: THREE.Vector3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  /** Z del dorso del pie a lo largo de +Y (talón→punta), en espacio Foot. */
  zTopAt: (y: number) => number;
};

/** Tune temporal (preview sliders) → bakear y borrar UI. Fracciones de len/h. */
export type BootDetailTune = {
  y0: number;
  y1: number;
  zPad: number;
  pitchMul: number;
  /** Largo de la puntera (fracción del largo del pie). */
  toeLen: number;
  /** Inflate extra de la puntera sobre el shell base (unidades bind). */
  toePad: number;
};

export const bootDetailTune: BootDetailTune = {
  y0: -0.3,
  y1: 0.12,
  zPad: 0.04,
  pitchMul: 1.65,
  toeLen: 0.22,
  toePad: 0.004,
};

export function setBootDetailTune(partial: Partial<BootDetailTune>): BootDetailTune {
  Object.assign(bootDetailTune, partial);
  return { ...bootDetailTune };
}

function measureFootShellFit(
  shellRoot: THREE.Object3D,
  sources: THREE.SkinnedMesh[],
  footName: string,
): FootShellFit | null {
  const bone = findBone(sources, footName);
  if (!bone) return null;
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  const allowNames = new Set([footName]);
  // Bind pose: geometry → bindMatrix → boneInverse (shell ya creado)
  // Foot local: +Z arriba, +Y puntera, ±X costados
  shellRoot.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const pos = o.geometry.attributes.position as THREE.BufferAttribute | undefined;
    const skinIndex = o.geometry.attributes.skinIndex as THREE.BufferAttribute | undefined;
    const skinWeight = o.geometry.attributes.skinWeight as THREE.BufferAttribute | undefined;
    if (!pos || !skinIndex || !skinWeight) return;
    const bi = o.skeleton.bones.findIndex((b) => b.name === footName);
    if (bi < 0) return;
    const boneInv = o.skeleton.boneInverses[bi];
    if (!boneInv) return;
    const allow = boneAllowSet(o.skeleton, allowNames);
    for (let i = 0; i < pos.count; i++) {
      let footW = 0;
      let other = 0;
      for (let k = 0; k < 4; k++) {
        const idx = skinIndex.getComponent(i, k);
        const w = skinWeight.getComponent(i, k);
        if (allow.has(idx)) footW += w;
        else other = Math.max(other, w);
      }
      // Foot debe dominar (evita pantorrilla); umbral un poco más bajo = suela completa
      if (footW < 0.35 || footW < other * 0.9) continue;
      v.fromBufferAttribute(pos, i);
      v.applyMatrix4(o.bindMatrix);
      v.applyMatrix4(boneInv);
      pts.push(v.clone());
    }
  });
  if (pts.length < 8) return null;

  // Percentiles: descarta outliers de tobillo/caña sin aplastar el pie a ojo
  const xs = pts.map((p) => p.x).sort((a, b) => a - b);
  const ys = pts.map((p) => p.y).sort((a, b) => a - b);
  const zs = pts.map((p) => p.z).sort((a, b) => a - b);
  const at = (a: number[], t: number) => a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * t)))]!;
  const min = new THREE.Vector3(at(xs, 0.06), at(ys, 0.06), at(zs, 0.04)); // z bajo = suela
  const max = new THREE.Vector3(at(xs, 0.94), at(ys, 0.94), at(zs, 0.92)); // z alto = empeine
  const size = new THREE.Vector3().subVectors(max, min);
  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  if (size.x < 1e-4 || size.y < 1e-4 || size.z < 1e-4) return null;

  // Perfil del dorso: max Z por bandas en Y (centro X) → cordones siguen el empeine
  const bands = 10;
  const zBand: number[] = [];
  for (let b = 0; b < bands; b++) {
    const y0 = min.y + (size.y * b) / bands;
    const y1 = min.y + (size.y * (b + 1)) / bands;
    const bandPts = pts.filter(
      (p) => p.y >= y0 && p.y < y1 && Math.abs(p.x - center.x) < size.x * 0.35,
    );
    if (bandPts.length < 3) {
      zBand.push(max.z);
      continue;
    }
    const bz = bandPts.map((p) => p.z).sort((a, c) => a - c);
    zBand.push(at(bz, 0.88));
  }
  const zTopAt = (y: number) => {
    const t = (y - min.y) / Math.max(1e-4, size.y);
    const u = Math.min(0.999, Math.max(0, t)) * (bands - 1);
    const i = Math.floor(u);
    const f = u - i;
    const a = zBand[i] ?? max.z;
    const b = zBand[Math.min(bands - 1, i + 1)] ?? a;
    return a + (b - a) * f;
  };

  return { min, max, center, size, zTopAt };
}

type FootWrapOpts = {
  /** Fracción de alto del shell a subir desde el piso (0=suela al ras; ~0.12–0.22 asoma cierre). */
  liftFrac?: number;
  /** Inclinación (rad) alrededor de X hueso: negativo = puntera baja (sigue empeine). */
  pitch?: number;
};

/**
 * HumanMale Foot* (mundo): hueso +Z ≈ arriba, +Y ≈ puntera.
 * Orientación detalle→hueso: Rx(π/2)·Rz(π) ⇒
 *   detalle +Y (caña) → hueso +Z
 *   detalle +Z (puntera) → hueso +Y
 * Escala en frame del detalle (evita shear), luego centra al AABB del shell.
 */
function wrapForFoot(
  obj: THREE.Object3D,
  mirrorX: boolean,
  fit: FootShellFit | null,
  fallbackScale = 1.35,
  opts: FootWrapOpts = {},
): THREE.Group {
  const wrap = new THREE.Group();
  wrap.name = "boot-detail-wrap";
  const liftFrac = opts.liftFrac ?? 0;
  const pitch = opts.pitch ?? 0;

  const sized = new THREE.Group();
  sized.add(obj);

  const orient = new THREE.Group();
  // XYZ: Rx luego Rz — NO Ry(π) (invertía caña↔suelo)
  orient.rotation.set(Math.PI / 2, 0, Math.PI);
  orient.add(sized);
  wrap.add(orient);

  if (!fit) {
    sized.scale.setScalar(fallbackScale);
    if (mirrorX) sized.scale.x *= -1;
    wrap.position.set(0, 0.02, 0.01);
    wrap.rotation.x = pitch;
    return wrap;
  }

  obj.updateMatrixWorld(true);
  const db = new THREE.Box3().setFromObject(obj);
  const dSize = new THREE.Vector3();
  const dCenter = new THREE.Vector3();
  db.getSize(dSize);
  db.getCenter(dCenter);
  if (dSize.x < 1e-5 || dSize.y < 1e-5 || dSize.z < 1e-5) {
    sized.scale.setScalar(fallbackScale);
    if (mirrorX) sized.scale.x *= -1;
    wrap.position.copy(fit.center);
    wrap.rotation.x = pitch;
    return wrap;
  }

  const clampS = (v: number) => Math.min(1.25, Math.max(0.7, v));
  const hMul = liftFrac > 0 ? 0.95 : 0.88;
  const sx = clampS(fit.size.x / dSize.x);
  const sy = clampS((fit.size.z * hMul) / dSize.y);
  const sz = clampS(fit.size.y / dSize.z);
  sized.scale.set(mirrorX ? -sx : sx, sy, sz);

  // AABB del detalle ya escalado+rotado (sin pitch aún)
  const boneBox = new THREE.Box3();
  const corner = new THREE.Vector3();
  const corners = [
    [db.min.x, db.min.y, db.min.z],
    [db.min.x, db.min.y, db.max.z],
    [db.min.x, db.max.y, db.min.z],
    [db.min.x, db.max.y, db.max.z],
    [db.max.x, db.min.y, db.min.z],
    [db.max.x, db.min.y, db.max.z],
    [db.max.x, db.max.y, db.min.z],
    [db.max.x, db.max.y, db.max.z],
  ] as const;
  for (const c of corners) {
    corner.set(c[0] * sized.scale.x, c[1] * sized.scale.y, c[2] * sized.scale.z);
    corner.applyEuler(orient.rotation);
    boneBox.expandByPoint(corner);
  }
  const bCenter = boneBox.getCenter(new THREE.Vector3());
  // Piso del shell + lift suave; Y un poco a la puntera (empeine, no tobillo)
  const zPos = fit.min.z - boneBox.min.z + fit.size.z * liftFrac + 0.003;
  const yBias = liftFrac > 0 ? fit.size.y * 0.06 : 0;
  wrap.position.set(fit.center.x - bCenter.x, fit.center.y - bCenter.y + yBias, zPos);
  wrap.rotation.x = pitch;
  return wrap;
}

/** Lift/pitch: un poco arriba + inclinación al empeine (sin flotar). */
function footWrapOptsFor(params: BootsParams): FootWrapOpts {
  const s = params.style;
  if (s === "military" || s === "combat") {
    return { liftFrac: 0.09, pitch: -0.34 };
  }
  if (s === "trail") {
    return { liftFrac: 0.1, pitch: -0.36 };
  }
  if (s === "greaves" || s === "plate") {
    return { liftFrac: 0.08, pitch: -0.28 };
  }
  if (s === "sport" || s === "sneaker" || s === "loafer" || s === "oxford") {
    return { liftFrac: 0.05, pitch: -0.2 };
  }
  if (s === "crocs" || s === "sandal") {
    return { liftFrac: 0.02, pitch: -0.1 };
  }
  return { liftFrac: 0, pitch: 0 };
}

type BootClosure = "laces" | "instepStrap" | "velcro" | "wings" | "slipon" | "buckle";

/** Cierre/ornamento según estilo + seed (diversidad). */
function pickBootClosure(params: BootsParams): BootClosure {
  const r = rng(params.seed + 404);
  const s = params.style;
  if (s === "greaves" || s === "riding") return "buckle";
  if (s === "plate") return r() < 0.5 ? "buckle" : "laces";
  if (s === "canvas") return "laces";
  if (s === "crocs" || s === "sandal" || s === "loafer") return "slipon";
  if (s === "oxford" || s === "dress") return "laces";
  if (s === "sport" || s === "sneaker") {
    const v = r();
    if (v < 0.55) return "laces";
    if (v < 0.7) return "velcro";
    if (v < 0.85) return "instepStrap";
    return "wings";
  }
  if (s === "combat" || s === "military" || s === "trail" || s === "work" || s === "ski") {
    const v = r();
    if (v < 0.7) return "laces";
    if (v < 0.85) return "velcro";
    return "instepStrap";
  }
  return "laces";
}

/** ¿Punta blanca Chuck? (seed estable; también lo usa la capa skinned). */
function canvasHasToeCap(params: BootsParams): boolean {
  return rng(params.seed + 77)() > 0.32;
}

/** Material de puntera según estilo; null = sin puntera. */
function bootToeCapMat(params: BootsParams): THREE.MeshStandardMaterial | null {
  if (params.style === "canvas") {
    return canvasHasToeCap(params)
      ? new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.88 })
      : null;
  }
  if (params.style === "combat") {
    // Puntera de cuero lustrado casi negro (L muy bajo: el color se trata como lineal y aclara)
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.06 + params.leatherHue * 0.1, 0.3, 0.012),
      roughness: 0.42,
      metalness: 0,
    });
  }
  if (params.style === "plate" || params.style === "greaves") {
    // Metal pulido más claro que la placa; metalness media: sin envMap el metal puro se ve negro
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(metalToneColor(params.metalTone, params.leatherHue, params.rarity)).lerp(
        new THREE.Color(0xffffff),
        0.15,
      ),
      metalness: 0.5,
      roughness: 0.3,
    });
    rarityGlow(m, params.rarity);
    return m;
  }
  return null;
}

/**
 * Crocs: clog de foam, orificios de ventilación, correa de talón (casa, no deporte).
 * Espacio Foot*: +Z arriba, +Y puntera.
 */
function buildCrocsDetailsOnFootFit(params: BootsParams, fit: FootShellFit): THREE.Group {
  const g = new THREE.Group();
  g.name = "boot-details-crocs-fit";
  const { min, max, center, size } = fit;
  const w = size.x;
  const len = size.y;
  const h = size.z;
  const foam = softBootMat(params);
  const dark = foam.clone();
  dark.color.offsetHSL(0, 0, -0.12);

  // Suela gruesa tipo clog
  const soleH = Math.max(0.018, Math.min(0.045, h * 0.32 + params.sole * 0.1));
  const sole = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, len * 1.08, soleH), foam);
  sole.position.set(center.x, center.y, min.z - soleH * 0.35);
  g.add(sole);
  // Tacos bajos irregulares
  for (let i = 0; i < 5; i++) {
    const nubble = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.06, w * 0.07, soleH * 0.4, 6), dark);
    nubble.rotation.x = Math.PI / 2;
    nubble.position.set(
      center.x + ((i % 3) - 1) * w * 0.28,
      center.y - len * 0.25 + Math.floor(i / 3) * len * 0.45,
      min.z - soleH * 0.55,
    );
    g.add(nubble);
  }

  // Empeine cerrado (clog) — no cordones
  const vamp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, len * 0.55, h * 0.55), foam);
  vamp.position.set(center.x, center.y + len * 0.12, center.z + h * 0.05);
  g.add(vamp);

  // Orificios de ventilación (círculos en el empeine)
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 1,
    metalness: 0,
  });
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.045, w * 0.045, h * 0.08, 8), holeMat);
      hole.rotation.x = Math.PI / 2;
      hole.position.set(
        center.x - w * 0.28 + col * w * 0.18,
        center.y + len * 0.02 + row * len * 0.14,
        max.z + h * 0.02,
      );
      g.add(hole);
    }
  }

  // Correa de talón (pivot atrás)
  const strap = new THREE.Mesh(new THREE.TorusGeometry(w * 0.38, h * 0.06, 6, 12, Math.PI * 1.15), foam);
  strap.rotation.y = Math.PI / 2;
  strap.position.set(center.x, center.y - len * 0.38, center.z + h * 0.15);
  g.add(strap);
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(w * 0.06, 6, 6), dark);
  pivot.position.set(center.x + w * 0.42, center.y - len * 0.28, center.z + h * 0.1);
  g.add(pivot);
  const pivot2 = pivot.clone();
  pivot2.position.x = center.x - w * 0.42;
  g.add(pivot2);

  return g;
}

/** Sandalia abierta: suela + tiras. */
function buildSandalDetailsOnFootFit(params: BootsParams, fit: FootShellFit): THREE.Group {
  const g = new THREE.Group();
  g.name = "boot-details-sandal-fit";
  const { min, max, center, size } = fit;
  const w = size.x;
  const len = size.y;
  const h = size.z;
  const leather = softBootMat(params);
  const soleH = Math.max(0.012, h * 0.2 + params.sole * 0.06);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, len * 1.05, soleH), leather);
  sole.position.set(center.x, center.y, min.z - soleH * 0.35);
  g.add(sole);
  for (const t of [0.15, 0.45, 0.7]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, len * 0.08, h * 0.12), leather);
    strap.position.set(center.x, center.y - len * 0.35 + t * len, max.z * 0.3);
    g.add(strap);
  }
  const toeLoop = new THREE.Mesh(new THREE.TorusGeometry(w * 0.12, h * 0.04, 5, 10), leather);
  toeLoop.position.set(center.x, center.y + len * 0.35, center.z);
  toeLoop.rotation.x = Math.PI / 2;
  g.add(toeLoop);
  return g;
}

/**
 * Lona Chuck: suela + cordones en ESPACIO Foot* (mismo que el shell medido).
 * Foot: +Z arriba, +Y puntera, ±X costados. Sin wrapForFoot (evita suela volada).
 */
function buildCanvasDetailsOnFootFit(params: BootsParams, fit: FootShellFit): THREE.Group {
  const g = new THREE.Group();
  g.name = "boot-details-canvas-fit";
  const r = rng(params.seed + 77);
  const hue = params.leatherHue;
  const laceRoll = r();
  const laceColor =
    laceRoll < 0.55
      ? 0xf5f5f2
      : laceRoll < 0.8
        ? 0x6b4a32
        : new THREE.Color().setHSL(hue, 0.45, 0.55).getHex();

  const canvasCol =
    hue < 0.08
      ? new THREE.Color().setHSL(0.02, hue < 0.03 ? 0.08 : 0.72, hue < 0.03 ? 0.1 : 0.32)
      : hue > 0.5 && hue < 0.7
        ? new THREE.Color().setHSL(0.6, 0.45, 0.22)
        : new THREE.Color().setHSL(hue, 0.5, 0.22);
  const canvasMat = new THREE.MeshStandardMaterial({
    color: canvasCol,
    roughness: 0.92,
    metalness: 0.02,
  });
  const whiteRub = new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.88 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
  const laceMat = new THREE.MeshStandardMaterial({
    color: laceColor,
    roughness: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xc8ccd2,
    metalness: 0.92,
    roughness: 0.28,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const patchMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: 0.8 });

  const { min, max, center, size } = fit;
  const w = size.x;
  const len = size.y;
  const h = size.z;
  // Grosor suela ~22% alto del shell + param
  const soleH = Math.max(0.01, Math.min(0.04, h * 0.22 + params.sole * 0.07));

  // —— SUELA: bajo min.z, cubre el AABB del pie (X ancho, Y talón→punta) ——
  const sole = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, len * 1.06, soleH), whiteRub);
  sole.position.set(center.x, center.y + len * 0.02, min.z - soleH * 0.4);
  g.add(sole);
  const pin = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, len * 1.07, soleH * 0.12), stripeMat);
  pin.position.set(center.x, center.y + len * 0.02, min.z + soleH * 0.05);
  g.add(pin);
  // Tacos / waffle bajo la suela (hacia −Z)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(w * 0.14, len * 0.08, soleH * 0.35), whiteRub);
      cell.position.set(
        center.x - w * 0.28 + i * w * 0.18,
        center.y - len * 0.15 + j * len * 0.35,
        min.z - soleH * 0.55,
      );
      g.add(cell);
    }
  }

  // Punta blanca: capa skinned (bootToeCapMat en buildSkinnedBoots)

  // Lengüeta sobre el empeine (centro, un poco hacia puntera, arriba)
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(w * 0.38, len * 0.28, h * 0.08), canvasMat);
  tongue.position.set(center.x, center.y + len * 0.08, max.z + h * 0.02);
  g.add(tongue);
  const patch = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, len * 0.08, h * 0.04), patchMat);
  patch.position.set(center.x, center.y - len * 0.02, max.z + h * 0.05);
  g.add(patch);

  // —— CORDONES: sobre max.z, a lo largo de +Y (empeine → punta) ——
  const n = 5 + ((params.seed >> 3) % 2);
  const xEye = w * 0.28;
  const y0 = center.y - len * 0.08;
  const y1 = center.y + len * 0.32;
  const zLace = max.z + Math.max(0.006, h * 0.06);
  const eyePairs: { y: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const yy = y0 + (y1 - y0) * t;
    const zz = zLace - t * h * 0.04;
    eyePairs.push({ y: yy, z: zz });
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.07, w * 0.018, 4, 8), eyeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(center.x + sx * xEye, yy, zz);
      g.add(ring);
    }
  }
  const flatW = w * 0.1;
  const flatT = Math.max(0.004, h * 0.04);
  const b0 = eyePairs[0]!;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(xEye * 2, flatW, flatT), laceMat);
  bar.position.set(center.x, b0.y, b0.z + flatT);
  g.add(bar);
  for (let i = 1; i < eyePairs.length; i++) {
    const a = eyePairs[i - 1]!;
    const b = eyePairs[i]!;
    for (const dir of [-1, 1] as const) {
      const from = new THREE.Vector3(center.x + dir * -xEye, a.y, a.z + flatT);
      const to = new THREE.Vector3(center.x + dir * xEye, b.y, b.z + flatT);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(flatW, flatT, from.distanceTo(to)), laceMat);
      seg.position.copy(mid);
      seg.lookAt(to);
      g.add(seg);
    }
  }
  const top = eyePairs[eyePairs.length - 1]!;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(w * 0.1, 6, 5), laceMat);
  knot.scale.set(1.3, 0.7, 0.85);
  knot.position.set(center.x, top.y + len * 0.02, top.z + flatT * 2);
  g.add(knot);
  for (const sx of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(w * 0.08, w * 0.025, 4, 8), laceMat);
    loop.rotation.y = Math.PI / 2;
    loop.position.set(center.x + sx * w * 0.12, top.y + len * 0.015, top.z + flatT);
    g.add(loop);
  }
  return g;
}

/**
 * Botas altas / metal: suela + cierre en espacio Foot* según AABB del shell.
 * Empeine: z baja hacia la puntera (+Y). Sin wrapForFoot (evita bloques flotando).
 */
function buildTallBootDetailsOnFootFit(params: BootsParams, fit: FootShellFit): THREE.Group {
  const g = new THREE.Group();
  g.name = `boot-details-fit-${params.style}`;
  const closure = pickBootClosure(params);
  const hue = params.leatherHue;
  const metal = params.style === "plate" || params.style === "greaves";
  const { min, center, size } = fit;
  const w = size.x;
  const len = size.y;
  const h = size.z;

  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x14110e,
    roughness: 0.94,
  });
  const laceMat = new THREE.MeshStandardMaterial({
    color: 0xe8e4dc,
    roughness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: metalToneColor(params.metalTone === "gold" ? "gold" : "steel", hue, params.rarity),
    metalness: 0.9,
    roughness: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue, 0.3, 0.34),
    roughness: 0.85,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.08, 0.2, 0.12),
    roughness: 0.9,
  });
  const metalMat = softBootMat(params, "plate");

  const soleH = Math.max(0.01, Math.min(0.038, h * 0.2 + params.sole * 0.06));
  // Suela bajo el pie
  const sole = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, len * 1.05, soleH), soleMat);
  sole.position.set(center.x, center.y + len * 0.02, min.z - soleH * 0.38);
  g.add(sole);

  if (params.style === "combat" || params.style === "military" || params.style === "trail") {
    for (let i = 0; i < 5; i++) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, len * 0.1, soleH * 0.35), soleMat);
      lug.position.set(center.x, min.y + len * (0.15 + i * 0.16), min.z - soleH * 0.5);
      g.add(lug);
    }
  }

  // Empeine: zTopAt(y) + tune; pitch desde pendiente tobillo→punta (tramo corto suele ser plano)
  const tune = bootDetailTune;
  const zPad = Math.max(0.002, h * tune.zPad);
  const zSurf = (y: number) => fit.zTopAt(y) + zPad;
  const y0 = center.y + len * tune.y0;
  const y1 = center.y + len * tune.y1;
  const slopePitch = -Math.atan2(
    Math.max(0.001, zSurf(center.y - len * 0.28) - zSurf(center.y + len * 0.38)),
    len * 0.66,
  );
  const pitch = Math.min(slopePitch, -0.32) * tune.pitchMul;

  if (closure === "laces" || closure === "velcro" || closure === "instepStrap") {
    const yMid = (y0 + y1) * 0.5;
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, (y1 - y0) * 1.05, h * 0.05), accentMat);
    tongue.position.set(center.x, yMid, zSurf(yMid));
    tongue.rotation.x = pitch;
    g.add(tongue);
  }

  if (closure === "laces") {
    const n = params.style === "combat" || params.style === "military" ? 7 : 6;
    const xEye = w * 0.26;
    const eyes: { y: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const yy = y0 + (y1 - y0) * t;
      const zz = zSurf(yy);
      eyes.push({ y: yy, z: zz });
      for (const sx of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.065, w * 0.016, 4, 8), eyeMat);
        ring.rotation.x = Math.PI / 2 + pitch;
        ring.position.set(center.x + sx * xEye, yy, zz + h * 0.025);
        g.add(ring);
      }
    }
    for (let i = 1; i < eyes.length; i++) {
      const a = eyes[i - 1]!;
      const b = eyes[i]!;
      for (const dir of [-1, 1] as const) {
        const from = new THREE.Vector3(center.x + dir * -xEye, a.y, a.z + h * 0.03);
        const to = new THREE.Vector3(center.x + dir * xEye, b.y, b.z + h * 0.03);
        const mid = from.clone().add(to).multiplyScalar(0.5);
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(w * 0.025, w * 0.025, from.distanceTo(to), 5),
          laceMat,
        );
        seg.position.copy(mid);
        seg.lookAt(to);
        seg.rotateX(Math.PI / 2);
        g.add(seg);
      }
    }
    const top = eyes[eyes.length - 1]!;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(w * 0.09, 6, 5), laceMat);
    knot.position.set(center.x, top.y + len * 0.02, top.z + h * 0.06);
    g.add(knot);
  } else if (closure === "velcro" || closure === "instepStrap") {
    const n = closure === "velcro" ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const yy = y0 + (y1 - y0) * t;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, len * 0.1, h * 0.05), strapMat);
      strap.position.set(center.x, yy, zSurf(yy));
      strap.rotation.x = pitch;
      g.add(strap);
      const buck = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, len * 0.08, h * 0.06), eyeMat);
      buck.position.set(center.x + w * 0.28, yy, zSurf(yy) + h * 0.015);
      g.add(buck);
    }
  } else if (closure === "buckle") {
    for (let i = 0; i < (metal ? 2 : 1); i++) {
      const t = 0.2 + i * 0.35;
      const yy = y0 + (y1 - y0) * t;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, len * 0.09, h * 0.045), strapMat);
      strap.position.set(center.x, yy, zSurf(yy));
      strap.rotation.x = pitch;
      g.add(strap);
      const buck = new THREE.Mesh(new THREE.TorusGeometry(w * 0.1, w * 0.03, 4, 8), metal ? metalMat : eyeMat);
      buck.position.set(center.x + w * 0.3, yy, zSurf(yy) + h * 0.02);
      buck.rotation.y = Math.PI / 2;
      g.add(buck);
    }
  } else if (closure === "wings") {
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.28, len * 0.35, h * 0.08), accentMat);
      wing.position.set(center.x + sx * w * 0.35, center.y + len * 0.05, zSurf(center.y));
      wing.rotation.z = sx * -0.3;
      wing.rotation.x = -0.25;
      g.add(wing);
    }
  }

  // Puntera: capa skinned (bootToeCapMat en buildSkinnedBoots)

  g.userData.closure = closure;
  return g;
}

/**
 * Detalles en frame bootGrip (+Y caña/arriba, +Z puntera) → wrapForFoot (sport).
 * Canvas / botas altas: builders OnFootFit.
 */
function buildBootDetails(params: BootsParams): THREE.Group {
  const g = new THREE.Group();
  g.name = `boot-details-${params.style}`;
  const hue = params.leatherHue;
  const low = params.style === "sport";
  const metal = params.style === "plate" || params.style === "greaves";
  const closure = pickBootClosure(params);
  const r = rng(params.seed + 77);

  const soleMat = new THREE.MeshStandardMaterial({
    color: params.style === "sport" ? 0xf2f2f0 : 0x14110e,
    roughness: 0.94,
  });
  const midMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue, 0.55, 0.52),
    roughness: 0.78,
  });
  const foxMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.72 });
  const tallClose =
    params.style === "military" ||
    params.style === "combat" ||
    params.style === "trail" ||
    params.style === "greaves" ||
    params.style === "plate";
  // Cordones claros en botas altas para que se lean sobre el shell
  const laceMat = new THREE.MeshStandardMaterial({
    color: low || tallClose ? 0xe8e4dc : new THREE.Color().setHSL(0.07, 0.35, 0.18),
    roughness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: metalToneColor("steel", hue, params.rarity),
    metalness: 0.9,
    roughness: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue, low ? 0.5 : 0.28, low ? 0.45 : tallClose ? 0.32 : 0.22),
    roughness: 0.85,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.08, 0.2, 0.12),
    roughness: 0.9,
  });
  const metalMat = softBootMat(params, "plate");

  const soleH = params.style === "sport" ? 0.038 + params.sole * 0.35 : 0.032;
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, soleH, 0.26), soleMat);
  sole.position.set(0, soleH * 0.45, 0.06);
  g.add(sole);

  if (params.style === "sport") {
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.125, soleH * 1.35, 0.16), midMat);
    mid.position.set(0, soleH * 1.15, 0.0);
    g.add(mid);
    for (const x of [-0.068, 0.068]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.14), accentMat);
      stripe.position.set(x, soleH + 0.055, 0.06);
      g.add(stripe);
    }
    if (r() > 0.4) {
      const badge = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), accentMat);
      badge.position.set(0.055, soleH + 0.07, 0.1);
      badge.rotation.y = Math.PI / 2;
      g.add(badge);
    }
  }

  // Cierre más alto en caña; lengüeta fina inclinada (no bloque negro flotante)
  const yClose = soleH + (low ? 0.125 : tallClose ? 0.145 : 0.13);
  const zClose = tallClose ? 0.11 : 0.1;

  if (closure === "laces" || closure === "velcro" || closure === "instepStrap") {
    const tongue = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, tallClose ? 0.014 : 0.022, low ? 0.09 : 0.1),
      accentMat,
    );
    tongue.position.set(0, yClose, zClose);
    tongue.rotation.x = tallClose ? -0.35 : -0.12;
    g.add(tongue);
  }

  // --- Cierres: criss-cross / velcro / correas (más arriba en botas altas) ---
  if (closure === "laces") {
    const n = low ? 5 : params.style === "combat" || params.style === "military" ? 7 : tallClose ? 6 : 5;
    const eyePairs: { y: number; z: number }[] = [];
    const xEye = 0.032;
    const ySpan = low ? 0.055 : tallClose ? 0.095 : 0.07;
    const zSpan = low ? 0.08 : tallClose ? 0.1 : 0.085;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const yy = yClose + t * ySpan;
      const zz = (tallClose ? 0.13 : 0.12) - t * zSpan;
      eyePairs.push({ y: yy, z: zz });
      for (const x of [-xEye, xEye]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0022, 4, 8), eyeMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, yy, zz);
        g.add(ring);
      }
      if (!low && i >= n - 2) {
        for (const x of [-xEye, xEye]) {
          const hook = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.002, 3, 6, Math.PI), eyeMat);
          hook.rotation.set(0, 0, x > 0 ? -0.4 : 0.4);
          hook.position.set(x, yy + 0.004, zz);
          g.add(hook);
        }
      }
    }
    const b0 = eyePairs[0]!;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, xEye * 2, 5), laceMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, b0.y + 0.006, b0.z);
    g.add(bar);
    for (let i = 1; i < eyePairs.length; i++) {
      const a = eyePairs[i - 1]!;
      const b = eyePairs[i]!;
      const midY = (a.y + b.y) * 0.5 + 0.006;
      const midZ = (a.z + b.z) * 0.5;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const len = Math.hypot(xEye * 2, dy, dz);
      const angZ = Math.atan2(dy, xEye * 2);
      for (const dir of [-1, 1] as const) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 5), laceMat);
        seg.position.set(0, midY, midZ);
        seg.rotation.set(0, 0, dir * (Math.PI / 2 - angZ * 0.85));
        seg.rotation.x = dz * 0.8;
        g.add(seg);
      }
    }
    const top = eyePairs[eyePairs.length - 1]!;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), laceMat);
    knot.position.set(0, top.y + 0.012, top.z - 0.01);
    g.add(knot);
    for (const x of [-0.018, 0.018]) {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.045, 4), laceMat);
      tip.rotation.z = x > 0 ? 0.8 : -0.8;
      tip.position.set(x, top.y + 0.002, top.z - 0.02);
      g.add(tip);
    }
  } else if (closure === "velcro") {
    for (let i = 0; i < 2; i++) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.035), strapMat);
      strap.position.set(0.01, yClose + i * 0.03, zClose - 0.02 + i * 0.03);
      strap.rotation.x = -0.15;
      g.add(strap);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.016, 0.03), foxMat);
      pad.position.set(0.04, yClose + i * 0.03, zClose - 0.02 + i * 0.03);
      pad.rotation.x = -0.15;
      g.add(pad);
    }
  } else if (closure === "instepStrap") {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.04), strapMat);
    strap.position.set(0, yClose, zClose);
    strap.rotation.x = -0.18;
    g.add(strap);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.02), eyeMat);
    buckle.position.set(0.04, yClose + 0.003, zClose);
    g.add(buckle);
  } else if (closure === "wings") {
    for (const x of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.12), accentMat);
      wing.position.set(x * 0.07, yClose, zClose - 0.02);
      wing.rotation.z = x * -0.35;
      wing.rotation.x = -0.12;
      g.add(wing);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.03), strapMat);
    bridge.position.set(0, yClose + 0.02, zClose);
    g.add(bridge);
  } else if (closure === "buckle") {
    for (let i = 0; i < (metal ? 2 : 1); i++) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.032), strapMat);
      strap.position.set(0, yClose + i * 0.045, zClose - 0.01 + i * 0.02);
      strap.rotation.x = -0.12;
      g.add(strap);
      const buckle = new THREE.Mesh(
        new THREE.TorusGeometry(0.014, 0.004, 4, 8),
        metal ? metalMat : eyeMat,
      );
      buckle.position.set(0.045, yClose + i * 0.045, zClose - 0.01 + i * 0.02);
      buckle.rotation.y = Math.PI / 2;
      g.add(buckle);
    }
  } else {
    for (const x of [-0.055, 0.055]) {
      const gore = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.08), strapMat);
      gore.position.set(x, yClose, zClose - 0.04);
      g.add(gore);
    }
  }

  // Lug sole
  if (params.style === "combat" || params.style === "military" || params.style === "trail") {
    for (let i = 0; i < 5; i++) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.028), soleMat);
      lug.position.set(0, 0.005, -0.02 + i * 0.042);
      g.add(lug);
    }
  }

  if (metal || params.style === "combat") {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 8, 6),
      metal ? metalMat : accentMat,
    );
    cap.scale.set(1.15, 0.55, 1.1);
    cap.position.set(0, soleH + 0.048, 0.16);
    g.add(cap);
  }

  // Heel tab (atrás, Z negativo) — no confundir con cordones
  const heel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.018), accentMat);
  heel.position.set(0, soleH + 0.07, -0.055);
  g.add(heel);

  g.userData.closure = closure;
  return g;
}

/** Correa a la pantorrilla (algunas zapatillas / botas). */
function buildCalfTie(params: BootsParams): THREE.Group {
  const g = new THREE.Group();
  const strapMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.08 + params.leatherHue * 0.05, 0.25, 0.15),
    roughness: 0.9,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 14), strapMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.12, 0.02);
  g.add(ring);
  const bow = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), strapMat);
  bow.scale.set(1.4, 0.7, 0.8);
  bow.position.set(0.06, 0.12, 0.05);
  g.add(bow);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.01), strapMat);
  tail.position.set(0.07, 0.06, 0.05);
  g.add(tail);
  return g;
}

/** Default si el item no trae `pockets` (loot viejo). */
function defaultPantPockets(style: PantsParams["style"]): number {
  if (style === "cargo") return 6;
  if (style === "jeans") return 4;
  if (style === "leather" || style === "cloth") return 2;
  return 0;
}

/**
 * Bolsillos fuera del shell (push según shellScale).
 * n: 2 delanteros · 4 +traseros · 5 +monedero · 6 +cargo muslo.
 */
function pantPocketDecors(root: THREE.Group, sources: THREE.SkinnedMesh[], params: PantsParams): void {
  const n = Math.min(6, Math.max(0, params.pockets ?? defaultPantPockets(params.style)));
  if (n <= 0) return;
  const cloth = softPantsMat(params);
  const scale = params.shellScale ?? 1;
  const push = 0.05 + scale * 0.06;
  const denimish = params.style === "jeans";
  const stitch = new THREE.MeshStandardMaterial({ color: 0xc4912d, roughness: 0.65, metalness: 0.08 });
  const rivet = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.28 });
  const flapMat = cloth.clone();
  flapMat.color = flapMat.color.clone().offsetHSL(0, 0, -0.1);

  const wantFront = n >= 2;
  // Cargo n=4: delanteros + muslo (sin traseros); n=6: todo
  const wantBack = n >= 4 && !(params.style === "cargo" && n < 6);
  const wantCoin = n >= 5 && n !== 6;
  const wantCargo = n >= 6 || params.style === "cargo";

  for (const side of ["L", "R"] as const) {
    const outward = side === "L" ? -1 : 1;
    const g = new THREE.Group();

    if (wantFront) {
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.11, 0.045), cloth);
      front.position.set(outward * (0.1 + push * 0.15), 0.28, 0.1 + push);
      g.add(front);
      if (denimish) {
        for (const [ox, oy] of [
          [0.035, 0.04],
          [0.035, -0.04],
        ] as const) {
          const riv = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 6), rivet);
          riv.rotation.x = Math.PI / 2;
          riv.position.set(outward * (0.1 + push * 0.15 + ox), 0.28 + oy, 0.125 + push);
          g.add(riv);
        }
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.006, 0.006), stitch);
        edge.position.set(outward * (0.1 + push * 0.15), 0.335, 0.125 + push);
        g.add(edge);
      }
    }

    if (wantBack) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.115, 0.045), cloth);
      back.position.set(outward * (0.08 + push * 0.1), 0.3, -(0.1 + push));
      g.add(back);
      if (denimish) {
        for (const sx of [-1, 1]) {
          const arc = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, 0.006), stitch);
          arc.position.set(outward * (0.08 + push * 0.1) + sx * 0.022, 0.32, -(0.12 + push));
          arc.rotation.z = sx * -0.55;
          g.add(arc);
        }
      }
    }

    if (wantCargo) {
      const thighY = n >= 6 ? 0.12 : 0.14;
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.07), cloth);
      pocket.position.set(outward * (0.12 + push * 0.35), thighY, 0.04 + push * 0.35);
      g.add(pocket);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.04, 0.072), flapMat);
      flap.position.set(outward * (0.12 + push * 0.35), thighY + 0.07, 0.04 + push * 0.35);
      g.add(flap);
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.016, 0.028),
        new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 0.9 }),
      );
      strap.position.set(outward * (0.12 + push * 0.35), thighY + 0.05, 0.08 + push * 0.35);
      g.add(strap);
      if (n >= 6) {
        const low = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.06), cloth);
        low.position.set(outward * (0.11 + push * 0.3), thighY - 0.14, 0.05 + push * 0.3);
        g.add(low);
      }
    }

    if (wantCoin && side === "R") {
      const coin = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.035), cloth);
      coin.position.set(0.04, 0.34, 0.11 + push);
      g.add(coin);
    }

    if (g.children.length) attachDecor(root, sources, `UpperLeg${side}`, g);
  }
}

function jeansDetailDecors(root: THREE.Group, sources: THREE.SkinnedMesh[], params: PantsParams): void {
  const denim = softPantsMat(params);
  const zipMat = new THREE.MeshStandardMaterial({ color: 0xa67c3d, metalness: 0.85, roughness: 0.32 });
  const scale = params.shellScale ?? 1;
  const push = 0.04 + scale * 0.05;

  for (const side of ["L", "R"] as const) {
    const outward = side === "L" ? -1 : 1;
    const fly = new THREE.Group();
    if (side === "R") {
      for (let i = 0; i < 6; i++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.01, 0.008), zipMat);
        tooth.position.set(-0.02, 0.36 + i * 0.022, 0.1 + push);
        fly.add(tooth);
      }
      const flyFabric = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.02), denim);
      flyFabric.position.set(-0.01, 0.42, 0.09 + push);
      fly.add(flyFabric);
    }
    const loop = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.04, 0.01), denim);
    loop.position.set(outward * 0.05, 0.48, 0.08 + push);
    fly.add(loop);
    attachDecor(root, sources, `UpperLeg${side}`, fly);
  }
}

function joggerCuffDecors(root: THREE.Group, sources: THREE.SkinnedMesh[], params: PantsParams): void {
  const cuffMat = softPantsMat(params);
  cuffMat.color = cuffMat.color.clone().offsetHSL(0, -0.05, -0.1);
  for (const side of ["L", "R"] as const) {
    const g = new THREE.Group();
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 5, 10), cuffMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0, 0.02, 0);
    g.add(cuff);
    // Cordón del puño
    const draw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.08, 5),
      new THREE.MeshStandardMaterial({ color: 0xeee8df, roughness: 0.7 }),
    );
    draw.position.set(0.04, 0.02, 0.05);
    draw.rotation.z = 0.5;
    g.add(draw);
    attachDecor(root, sources, `UpperLeg${side}`, g);
  }
}

function armorBodyBones(params: ArmorParams): Set<string> {
  const sleeves = params.sleeves ?? (params.style === "vest" ? "none" : "long");
  const bones = new Set(["Abdomen", "Torso"]);
  if (sleeves === "short") {
    bones.add("ShoulderL");
    bones.add("ShoulderR");
  } else if (sleeves === "long") {
    for (const n of ARMOR_SHOULDER_BONES) bones.add(n);
  }
  return bones;
}

export function buildSkinnedArmor(sources: THREE.SkinnedMesh[], params: ArmorParams): THREE.Group {
  params = { ...params, style: armorVisual(params.style) };
  const r = rng(params.seed);
  const bulk = params.bulk;
  const s = params.style;
  const casual =
    s === "hoodie" ||
    s === "jacket" ||
    s === "vest" ||
    s === "shirt" ||
    s === "tunic" ||
    s === "coat" ||
    s === "duster" ||
    s === "poncho" ||
    s === "tabard";
  const baseInflate = casual
    ? 0.012 + bulk * 0.01 + (s === "coat" || s === "duster" || s === "tunic" ? 0.006 : 0)
    : s === "plate" || s === "cuirass"
      ? 0.02 + bulk * 0.012
      : s === "padded" || s === "gambeson"
        ? 0.022 + bulk * 0.014
        : 0.016 + bulk * 0.01;

  const base = createSkinnedShell(sources, {
    boneNames: armorBodyBones(params),
    excludeBoneNames: ARMOR_EXCLUDE_BONES,
    inflate: baseInflate,
    material: softArmorMat(params),
    minWeight: 0.14,
    uvScale: 2 + r() * 1.5,
  });
  const layers: THREE.Group[] = [base];

  if (s === "plate" || s === "scale" || s === "lamellar" || s === "cuirass" || s === "brigandine") {
    layers.push(
      createSkinnedShell(sources, {
        boneNames: ARMOR_SHOULDER_BONES,
        excludeBoneNames: ARMOR_EXCLUDE_BONES,
        inflate: baseInflate + 0.01,
        material: softAccentMat(params),
        minWeight: 0.16,
        uvScale: 3,
      }),
    );
  }
  if (
    s === "plate" ||
    s === "cuirass" ||
    s === "vest" ||
    s === "brigandine" ||
    rarityT(params.rarity) >= 0.75
  ) {
    layers.push(
      createSkinnedShell(sources, {
        boneNames: ARMOR_CHEST_BONES,
        excludeBoneNames: ARMOR_EXCLUDE_BONES,
        inflate: baseInflate + 0.008,
        material: s === "vest" || s === "tabard" ? softArmorMat(params) : softAccentMat(params),
        minWeight: 0.22,
        uvScale: 2.2,
      }),
    );
  }

  // Colorblock: panel pecho en accent (segunda piel, no tapa mangas)
  if (params.colorBlock && params.accentHue !== undefined) {
    layers.push(
      createSkinnedShell(sources, {
        boneNames: ARMOR_CHEST_BONES,
        excludeBoneNames: ARMOR_EXCLUDE_BONES,
        inflate: baseInflate + 0.004,
        material: softClothToneMat(params, params.accentHue, 3),
        minWeight: 0.2,
        preferWorldZ: "front",
        maxBindY: 0.35,
        uvScale: 2.4,
      }),
    );
  }

  const root = mergeShells(...layers);
  armorClothesDecors(root, sources, params);
  if (params.style === "vest") {
    const plateMat = softAccentMat({ ...params, style: "plate", finish: "darkened", sleeves: "none" });
    const plates = new THREE.Group();
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.04), plateMat);
    front.position.set(0, 0.15, 0.14);
    plates.add(front);
    for (const x of [-0.12, 0.12]) {
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.28, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x1a1a14, roughness: 0.9 }),
      );
      strap.position.set(x, 0.14, 0.1);
      plates.add(strap);
    }
    attachDecor(root, sources, "Torso", plates);
  }
  applyItemGlow(root, params.hue, params.rarity, { lights: true });
  return root;
}

/**
 * Superficie del shell en espacio Torso.
 * zFrontAt(y) / zBackAt(y): la panza es más chata que el pecho — un solo zFront flotaba.
 */
type TorsoShellFit = {
  yMin: number;
  yMax: number;
  xHalf: number;
  zFrontAt: (y: number) => number;
  zBackAt: (y: number) => number;
};

type YZ = { y: number; z: number };

function zAtBand(samples: YZ[], y: number, front: boolean): number {
  if (samples.length === 0) return front ? 0.28 : -0.26;
  // Vecinos en ±banda de Y; si pocos, todos
  const band = 0.12;
  let near = samples.filter((s) => Math.abs(s.y - y) <= band);
  if (near.length < 5) near = samples;
  const zs = near.map((s) => s.z).sort((a, b) => a - b);
  // Frente: percentil ~70 (superficie, no outlier de pezón/inflate)
  // Espalda: percentil ~30
  const t = front ? 0.7 : 0.3;
  return zs[Math.min(zs.length - 1, Math.floor(zs.length * t))]!;
}

/** Fallback si no hay suficientes verts (unidades hueso Torso). */
function armorDecorFallback(): TorsoShellFit {
  return {
    yMin: -0.35,
    yMax: 0.55,
    xHalf: 0.35,
    zFrontAt: () => 0.28,
    zBackAt: () => -0.26,
  };
}

function measureTorsoShellFit(
  shellRoot: THREE.Object3D,
  sources: THREE.SkinnedMesh[],
): TorsoShellFit | null {
  const bone = findBone(sources, "Torso");
  if (!bone) return null;
  const front: YZ[] = [];
  const back: YZ[] = [];
  let yMin = Infinity;
  let yMax = -Infinity;
  let xMax = 0;
  const v = new THREE.Vector3();
  // Solo Torso (Abdomen estira el AABB y deja Y enorme)
  const torsoNames = new Set(["Torso"]);

  shellRoot.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const pos = o.geometry.attributes.position as THREE.BufferAttribute | undefined;
    const skinIndex = o.geometry.attributes.skinIndex as THREE.BufferAttribute | undefined;
    const skinWeight = o.geometry.attributes.skinWeight as THREE.BufferAttribute | undefined;
    if (!pos || !skinIndex || !skinWeight) return;
    const bi = o.skeleton.bones.findIndex((b) => b.name === "Torso");
    if (bi < 0) return;
    const boneInv = o.skeleton.boneInverses[bi];
    if (!boneInv) return;
    const allow = boneAllowSet(o.skeleton, torsoNames);
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) {
        if (allow.has(skinIndex.getComponent(i, k))) w += skinWeight.getComponent(i, k);
      }
      if (w < 0.4) continue;
      v.fromBufferAttribute(pos, i);
      v.applyMatrix4(o.bindMatrix);
      v.applyMatrix4(boneInv);
      yMin = Math.min(yMin, v.y);
      yMax = Math.max(yMax, v.y);
      xMax = Math.max(xMax, Math.abs(v.x));
      if (Math.abs(v.x) > 0.2) continue;
      if (v.z > 0.02) front.push({ y: v.y, z: v.z });
      else if (v.z < -0.02) back.push({ y: v.y, z: v.z });
    }
  });

  if (front.length < 8 || back.length < 8 || !Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    return null;
  }
  // Clamp: el shell skinned a veces mete hombros/cuello
  yMin = Math.max(yMin, -0.55);
  yMax = Math.min(yMax, 0.72);
  return {
    yMin,
    yMax,
    xHalf: Math.min(0.42, Math.max(0.22, xMax * 0.8)),
    zFrontAt: (y) => zAtBand(front, y, true),
    zBackAt: (y) => zAtBand(back, y, false),
  };
}

/**
 * Mesh de cierre / bolsillos / capucha / etc.
 * Posiciones derivadas del AABB del shell en Torso (measureTorsoShellFit).
 * Ajuste fino manual: `pad` (holgura sobre tela) y offsets sueltos abajo.
 */
function armorClothesDecors(
  root: THREE.Group,
  sources: THREE.SkinnedMesh[],
  params: ArmorParams,
): void {
  const style = params.style;
  const casual = style === "hoodie" || style === "jacket" || style === "leather" || style === "padded";
  if (!casual && style !== "vest") return;

  const r = rng(params.seed + 401);
  const fit = measureTorsoShellFit(root, sources) ?? armorDecorFallback();
  const ySpan = Math.max(0.2, fit.yMax - fit.yMin);
  const yBelly = fit.yMin + ySpan * 0.28;
  const yChest = fit.yMin + ySpan * 0.55;
  const yHigh = fit.yMax - ySpan * 0.02; // tope del shell → capucha más alta
  const xHalf = fit.xHalf;
  /**
   * Empírico preview: boneInverse da Z ~2× más “afuera” que la tela que se ve.
   * surfScale acerca cierre/bolsillos a la tela; halfDepth apoya la cara interna.
   */
  // 0.52 entierra; 1.0 flota. Ajuste fino: subí/bajá surfScale (pegado↔afuera).
  const surfScale = 0.76;
  const frontCenter = (y: number, depth: number) =>
    fit.zFrontAt(y) * surfScale + depth * 0.5 + 0.006;
  const backCenter = (y: number, depth: number) =>
    fit.zBackAt(y) * surfScale - depth * 0.5 - 0.006;
  root.userData.torsoFit = {
    yMin: fit.yMin,
    yMax: fit.yMax,
    xHalf,
    zBelly: fit.zFrontAt(yBelly),
    zChest: fit.zFrontAt(yChest),
    zBackHigh: fit.zBackAt(yHigh),
  };

  const cloth = softArmorMat(params);
  const accentH = params.accentHue ?? (params.hue + 0.42) % 1;
  const stripeH = params.stripeHue ?? accentH;
  const stripeMat = softClothToneMat(params, stripeH, 9);
  const zipKind =
    params.zipper ??
    (style === "jacket" ? "full" : style === "hoodie" ? (r() > 0.5 ? "half" : "none") : "none");
  const pocketN =
    params.pockets ??
    (style === "hoodie" ? 1 : style === "jacket" ? 2 : style === "vest" ? 3 : 0);
  const stripe = params.stripe ?? "none";
  const hood = params.hood ?? style === "hoodie";
  const logoId = params.logo ?? 0;
  const cuffs = params.cuffs ?? casual;
  const cords = params.cords ?? (hood && style === "hoodie");

  // —— CIERRE (Z según Y: pecho ≠ panza) ——
  if (zipKind !== "none") {
    const zipMat = new THREE.MeshStandardMaterial({
      color: 0x0e0e12,
      metalness: 0.92,
      roughness: 0.25,
      emissive: new THREE.Color(0x222228),
      emissiveIntensity: 0.15,
    });
    const tapeMat = softClothToneMat(params, (accentH + 0.5) % 1, 11); // contraste vs tela
    const zip = new THREE.Group();
    const teeth = zipKind === "full" ? 12 : 6;
    const step = ySpan * (zipKind === "full" ? 0.07 : 0.055);
    const y0 = zipKind === "full" ? yBelly : yChest - step * teeth * 0.15;
    const h = teeth * step;
    const tapeD = 0.016;
    const yMid = y0 + h * 0.5;
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.04, h + 0.03, tapeD), tapeMat);
    tape.position.set(0, yMid, frontCenter(yMid, tapeD));
    zip.add(tape);
    for (let i = 0; i < teeth; i++) {
      const yy = y0 + i * step;
      const td = 0.018;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.022, td), zipMat);
      tooth.position.set(0, yy, frontCenter(yy, td));
      zip.add(tooth);
    }
    const pullD = 0.024;
    const yPull = y0 + h * 0.65;
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.032, pullD), zipMat);
    pull.position.set(0.025, yPull, frontCenter(yPull, pullD));
    zip.add(pull);
    attachDecor(root, sources, "Torso", zip);
  }

  // —— BOLSILLOS ——
  if (pocketN > 0) {
    const g = new THREE.Group();
    if (style === "hoodie" && pocketN === 1) {
      const depth = 0.05;
      const yK = yBelly + ySpan * 0.06;
      const kangaroo = new THREE.Mesh(new THREE.BoxGeometry(xHalf * 1.55, ySpan * 0.22, depth), cloth);
      kangaroo.position.set(0, yK, frontCenter(yK, depth));
      g.add(kangaroo);
      const slit = new THREE.Mesh(
        new THREE.BoxGeometry(xHalf * 1.35, 0.014, 0.01),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 }),
      );
      const yS = yBelly + ySpan * 0.15;
      slit.position.set(0, yS, frontCenter(yS, 0.01) + 0.008);
      g.add(slit);
    } else {
      const slots = Math.min(4, pocketN);
      for (let i = 0; i < slots; i++) {
        const left = i % 2 === 0;
        const row = (i / 2) | 0;
        const depth = 0.045;
        const yy = yBelly + 0.04 + row * ySpan * 0.28;
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, depth), cloth);
        pouch.position.set((left ? -1 : 1) * xHalf * 0.55, yy, frontCenter(yy, depth));
        g.add(pouch);
        if (style === "jacket" || style === "vest") {
          const flapD = 0.048;
          const yF = yBelly + 0.1 + row * ySpan * 0.28;
          const flap = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.04, flapD), stripeMat);
          flap.position.set((left ? -1 : 1) * xHalf * 0.55, yF, frontCenter(yF, flapD));
          g.add(flap);
        }
      }
    }
    attachDecor(root, sources, "Torso", g);
  }

  // —— Franjas ——
  if (stripe !== "none") {
    const sg = new THREE.Group();
    if (stripe === "chest" || stripe === "hem") {
      const y = stripe === "chest" ? yChest : yBelly - 0.06;
      const depth = 0.032;
      const band = new THREE.Mesh(new THREE.BoxGeometry(xHalf * 2.1, 0.045, depth), stripeMat);
      band.position.set(0, y, frontCenter(y, depth));
      sg.add(band);
      attachDecor(root, sources, "Torso", sg);
    } else if (stripe === "side") {
      for (const side of [-1, 1]) {
        const y = (yChest + yBelly) * 0.5;
        const depth = 0.032;
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.035, ySpan * 0.85, depth), stripeMat);
        band.position.set(side * xHalf * 0.95, y, frontCenter(y, depth) * 0.55);
        sg.add(band);
      }
      attachDecor(root, sources, "Torso", sg);
    } else if (stripe === "sleeve" && params.sleeves !== "none") {
      for (const side of ["L", "R"] as const) {
        const arm = new THREE.Group();
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.1), stripeMat);
        band.position.set(0, 0.18, 0);
        arm.add(band);
        if (r() > 0.5) {
          const band2 = band.clone();
          band2.position.y = 0.28;
          arm.add(band2);
        }
        attachDecor(root, sources, `UpperArm${side}`, arm);
      }
    }
  }

  // —— Logo ——
  if (logoId > 0) {
    const ink = params.accentHue ?? (params.hue + 0.5) % 1;
    const tex = inventLogoTex(logoId, params.seed, ink);
    const g = new THREE.Group();
    const back = new THREE.Mesh(
      new THREE.CircleGeometry(0.08, 12),
      softClothToneMat(params, (params.hue + 0.08) % 1, 33),
    );
    back.position.z = -0.002;
    g.add(back);
    const badge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.12),
      new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        metalness: 0.05,
        roughness: 0.8,
        side: THREE.DoubleSide,
        emissive: new THREE.Color().setHSL(ink, 0.4, 0.12),
      }),
    );
    g.add(badge);
    const yLogo = yHigh - ySpan * 0.12;
    g.position.set(logoId % 2 === 0 ? 0 : xHalf * 0.35, yLogo, frontCenter(yLogo, 0.01));
    attachDecor(root, sources, "Torso", g);
  }

  // —— CAPUCHA (espalda alta, caída atrás — no puesta) ——
  if (hood) {
    const hoodMat =
      params.accentHue !== undefined && r() > 0.55
        ? softClothToneMat(params, params.accentHue, 21)
        : cloth;
    const h = new THREE.Group();
    // Capucha caída en la espalda alta (no puesta): chata, atrás, bajo la nuca.
    const hoodR = Math.min(0.12, ySpan * 0.15);
    const hoodDepth = hoodR * 1.2;
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(hoodR, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hoodMat,
    );
    shell.rotation.x = Math.PI * 0.95;
    shell.scale.set(1.15, 0.4, 1.2); // ancha y muy chata
    const yHood = fit.yMin + ySpan * 0.7;
    shell.position.set(0, yHood, backCenter(yHood, hoodDepth) - 0.09);
    h.add(shell);
    const yokeD = 0.05;
    const yYoke = yHood - ySpan * 0.1;
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(xHalf * 0.9, 0.045, yokeD), hoodMat);
    yoke.position.set(0, yYoke, backCenter(yYoke, yokeD) - 0.02);
    h.add(yoke);
    if (cords) {
      const cordMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(accentH, 0.25, 0.75),
        roughness: 0.65,
      });
      for (const sx of [-1, 1]) {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, ySpan * 0.2, 5), cordMat);
        cord.position.set(sx * 0.05, yChest, frontCenter(yChest, 0.014));
        h.add(cord);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), cordMat);
        const yTip = yChest - ySpan * 0.12;
        tip.position.set(sx * 0.05, yTip, frontCenter(yTip, 0.02));
        h.add(tip);
      }
    }
    attachDecor(root, sources, "Torso", h);
  }

  // —— Puños ——
  if (cuffs && params.sleeves === "long") {
    const cuffMat = softClothToneMat(params, stripe !== "none" ? stripeH : params.hue, 27);
    for (const side of ["L", "R"] as const) {
      const bone = findBone(sources, `Palm${side}`) ? `Palm${side}` : `UpperArm${side}`;
      const g = new THREE.Group();
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 5, 10), cuffMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.set(0, bone.startsWith("Palm") ? -0.03 : 0.04, 0);
      g.add(cuff);
      attachDecor(root, sources, bone, g);
    }
  }
}

/**
 * Botas skinned finas + silueta distinta por estilo (bias/shapeScale),
 * detalles (cordones/suela) afuera del shell.
 */
export function buildSkinnedBoots(sources: THREE.SkinnedMesh[], params: BootsParams): THREE.Group {
  const style = params.style;
  const r = rng(params.seed);
  const heightClass = bootHeightClass(style);
  const metal = heightClass === "metal";
  const low = heightClass === "low" || heightClass === "clog" || heightClass === "open";
  const tall = heightClass === "tall" || heightClass === "metal" || heightClass === "mid";

  // Low/clog/open: SOLO pie. Mid/tall/metal: LowerLeg.
  const bones = low ? BOOT_BONES : tall ? BOOT_TALL_BONES : BOOT_BONES;
  const bootExclude = low ? new Set(["LowerLegL", "LowerLegR", "UpperLegL", "UpperLegR", "Hips"]) : undefined;

  let inflate = 0.012;
  let minWeight = 0.1;
  let bias = { x: 1, y: 1, z: 1 };
  let shape = { x: 1, y: 1, z: 1 };

  if (style === "crocs") {
    inflate = 0.018 + params.sole * 0.05;
    minWeight = 0.12;
    bias = { x: 1.18, y: 0.5, z: 1.22 }; // ancho y chato (clog)
    shape = { x: 1.14, y: 0.62, z: 1.16 };
  } else if (style === "sandal") {
    inflate = 0.008 + params.sole * 0.02;
    minWeight = 0.1;
    bias = { x: 1.05, y: 0.4, z: 1.1 };
    shape = { x: 1.02, y: 0.55, z: 1.08 };
  } else if (style === "canvas") {
    inflate = 0.011 + params.sole * 0.02;
    minWeight = 0.14;
    bias = { x: 1.08, y: 0.55, z: 1.15 };
    shape = { x: 1.04, y: 0.68, z: 1.1 };
  } else if (style === "sport" || style === "sneaker") {
    inflate = 0.011 + params.sole * 0.04;
    minWeight = 0.13;
    bias = { x: 1.1, y: 0.58, z: 1.16 };
    shape = { x: 1.06, y: 0.7, z: 1.12 };
  } else if (style === "loafer" || style === "oxford") {
    inflate = 0.01 + params.sole * 0.02;
    minWeight = 0.13;
    bias = { x: 1.02, y: 0.52, z: 1.12 };
    shape = { x: 1.0, y: 0.65, z: 1.08 };
  } else if (style === "military" || style === "dress" || style === "work") {
    inflate = 0.014 + params.height * 0.01;
    minWeight = 0.16;
    bias = { x: 0.95, y: 1.15, z: 1.0 };
    shape = { x: 0.98, y: 1.08, z: 1.02 };
  } else if (style === "combat") {
    inflate = 0.015 + params.height * 0.012;
    minWeight = 0.15;
    bias = { x: 1.0, y: 1.25, z: 1.05 };
    shape = { x: 1.0, y: 1.18, z: 1.04 };
  } else if (style === "trail" || style === "riding") {
    inflate = 0.014 + params.height * 0.014;
    minWeight = 0.17;
    bias = { x: 0.95, y: 1.35, z: 0.95 };
    shape = { x: 0.96, y: 1.22, z: 1.0 };
  } else if (style === "ski") {
    inflate = 0.02 + params.height * 0.016;
    minWeight = 0.18;
    bias = { x: 1.1, y: 1.4, z: 1.05 };
    shape = { x: 1.08, y: 1.25, z: 1.05 };
  } else if (style === "greaves") {
    inflate = 0.016 + params.height * 0.01;
    minWeight = 0.2;
    bias = { x: 0.9, y: 1.4, z: 0.85 };
    shape = { x: 0.94, y: 1.28, z: 0.95 };
  } else {
    // plate
    inflate = 0.015 + params.height * 0.01;
    minWeight = 0.14;
    bias = { x: 1.05, y: 1.1, z: 1.1 };
    shape = { x: 1.04, y: 1.05, z: 1.06 };
  }

  const layers: THREE.Group[] = [
    createSkinnedShell(sources, {
      boneNames: bones,
      excludeBoneNames: bootExclude,
      inflate,
      material: softBootMat(params, metal ? "plate" : "base"),
      minWeight,
      uvScale: low ? 2.2 : style === "combat" || style === "ski" ? 1.6 : 2.6,
      inflateNormalBias: bias,
      shapeScale: shape,
    }),
  ];

  // Con puntera: las capas secundarias no cubren la punta (si no, la tapan a parches)
  const toeMat = bootToeCapMat(params);
  const toeDrop = toeMat ? { toeFrac: bootDetailTune.toeLen, toeMode: "drop" as const } : {};

  // Capas extra solo metal/combat (lona/trainer = 1 shell continuo, sin islas)
  if (metal || ((style === "combat" || style === "work") && r() > 0.4)) {
    layers.push(
      createSkinnedShell(sources, {
        boneNames: BOOT_BONES,
        inflate: inflate * 0.55 + 0.004,
        material: softBootMat(params, metal ? "plate" : "base"),
        minWeight: Math.min(0.22, minWeight + 0.04),
        uvScale: 3,
        inflateNormalBias: bias,
        ...toeDrop,
      }),
    );
  }

  const closure = pickBootClosure(params);

  // Overlay lace-tex solo en botas altas (canvas/sport: detalles sobre el fit del shell)
  if (closure === "laces" && !low) {
    const laceMap = patternTex("lace", params.seed + 3, params.leatherHue);
    laceMap.repeat.set(1.2, 2.4);
    const laceShellMat = withPolyOffset(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08, 0.12, 0.28),
        map: laceMap,
        roughness: 0.88,
        metalness: 0.04,
        side: THREE.DoubleSide,
      }),
    );
    layers.push(
      createSkinnedShell(sources, {
        boneNames: BOOT_BONES,
        inflate: inflate + 0.008,
        material: laceShellMat,
        minWeight: 0.18,
        uvScale: 1.8,
        inflateNormalBias: { x: 0.7, y: 1.35, z: 1.25 },
        shapeScale: { x: 0.92, y: 0.85, z: 1.05 },
        ...toeDrop,
      }),
    );
  }

  const root = mergeShells(...layers);
  // Importante: pose bind actualizada antes de medir el shell
  for (const s of sources) {
    s.skeleton.update();
    s.updateMatrixWorld(true);
  }

  // Nunca calf-tie en lona/trainer (era la “caña” flotante en LowerLeg)
  const wantCalfTie =
    !low &&
    (style === "combat" || style === "riding") &&
    (closure === "slipon" || closure === "instepStrap" || rng(params.seed + 9)() > 0.72);

  const tallFit =
    heightClass === "mid" || heightClass === "tall" || heightClass === "metal";
  for (const side of ["FootL", "FootR"] as const) {
    const fit = measureFootShellFit(root, sources, side);
    if (!fit) continue;
    if (style === "crocs") {
      attachDecor(root, sources, side, buildCrocsDetailsOnFootFit(params, fit));
    } else if (style === "sandal") {
      attachDecor(root, sources, side, buildSandalDetailsOnFootFit(params, fit));
    } else if (style === "canvas") {
      attachDecor(root, sources, side, buildCanvasDetailsOnFootFit(params, fit));
    } else if (tallFit) {
      attachDecor(root, sources, side, buildTallBootDetailsOnFootFit(params, fit));
    } else {
      attachDecor(
        root,
        sources,
        side,
        wrapForFoot(
          buildBootDetails(params),
          side === "FootL",
          fit,
          low ? 1.2 : 1.35,
          footWrapOptsFor(params),
        ),
      );
    }
  }

  // Puntera: misma silueta que el shell base + pad, recortada a la punta.
  // Después de medir el fit (no sesga percentiles de cordones/suela).
  if (toeMat) {
    const toeLayer = createSkinnedShell(sources, {
      boneNames: bones,
      excludeBoneNames: bootExclude,
      inflate: inflate + bootDetailTune.toePad,
      material: toeMat,
      minWeight,
      uvScale: 3,
      inflateNormalBias: bias,
      shapeScale: shape,
      toeFrac: bootDetailTune.toeLen,
    });
    for (const m of [...toeLayer.children]) {
      m.name = "boot-toe-cap";
      root.add(m);
    }
  }
  if (wantCalfTie) {
    for (const side of ["L", "R"] as const) {
      attachDecor(root, sources, `LowerLeg${side}`, buildCalfTie(params));
    }
  }
  if (metal || params.style === "greaves") {
    const mat = softBootMat(params, "plate");
    for (const side of ["L", "R"] as const) {
      const shin = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.05), mat);
      plate.position.set(0.02, 0.1, 0.03);
      shin.add(plate);
      attachDecor(root, sources, `LowerLeg${side}`, shin);
    }
  }
  applyItemGlow(root, params.leatherHue, params.rarity, { lights: true });
  return root;
}

/** Pantalón: shell skinned. Scale = inflate/+Z (cierra V); rise = cintura + Abdomen. */
export function buildSkinnedPants(sources: THREE.SkinnedMesh[], params: PantsParams): THREE.Group {
  params = { ...params, style: pantsVisual(params.style) };
  const r = rng(params.seed);
  const shellScale = Math.min(1.6, Math.max(0.6, params.shellScale ?? 1));
  const waistRise = Math.min(1, Math.max(0, params.waistRise ?? 0.4));
  // ↑ waistRise = cintura un poco más alta, pero NUNCA torso (bind Y≈0)
  const minWeight = 0.05 - waistRise * 0.1;
  // HumanMale: cintura/cadera ~ Y≤0; Abdomen sin tope se comía el pecho
  const maxBindY = -0.05 + waistRise * 0.06; // ≈ -0.04 .. +0.02
  // Dobladillo: rise no alarga hacia el pie; length baja el corte (sigue por encima de botas)
  const len = Math.min(1, Math.max(0, params.length ?? 0.7));
  const minBindY = -0.35 - len * 0.22; // ≈ -0.52 .. -0.74 (deja ver botas)
  const scaleAmt = shellScale - 1;
  const closeMid = Math.max(0, Math.min(1, 0.25 + scaleAmt * 1.1));

  let inflate = 0.016;
  let shape = { x: 1, y: 1, z: 1 };
  let bias = { x: 1, y: 1, z: 1 };
  if (params.style === "jeans") {
    inflate = 0.015 + r() * 0.004;
    shape = { x: 0.97, y: 0.98, z: 0.98 };
    bias = { x: 0.95, y: 0.95, z: 1.05 };
  } else if (params.style === "jogger") {
    inflate = 0.02 + params.length * 0.006;
    shape = { x: 1.04, y: 0.98, z: 1.04 };
  } else if (params.style === "shorts") {
    inflate = 0.014 + r() * 0.003;
    shape = { x: 1.02, y: 0.72, z: 1.02 };
    bias = { x: 1, y: 0.55, z: 1 };
  } else if (params.style === "kilt") {
    inflate = 0.022 + r() * 0.005;
    shape = { x: 1.12, y: 0.85, z: 1.08 };
    bias = { x: 1.1, y: 0.7, z: 1.05 };
  } else if (params.style === "chaps") {
    inflate = 0.012;
    shape = { x: 1.05, y: 1.0, z: 0.95 };
  } else if (params.style === "breeches") {
    inflate = 0.015;
    shape = { x: 1.0, y: 0.9, z: 1.02 };
  } else if (params.style === "cargo" || params.style === "fatigues") {
    inflate = 0.017 + r() * 0.004;
    shape = { x: 1.01, y: 0.98, z: 1.01 };
  } else if (params.style === "plated") {
    inflate = 0.019 + r() * 0.005;
  } else if (params.style === "leather") {
    inflate = 0.016 + r() * 0.004;
  } else {
    inflate = 0.016 + params.length * 0.004;
  }
  inflate *= 0.85 + shellScale * 0.55;
  bias = {
    x: bias.x * (1.05 - scaleAmt * 0.2),
    y: bias.y,
    z: bias.z * (1 + Math.max(0, scaleAmt) * 0.9),
  };
  shape = {
    x: shape.x * (1 - Math.max(0, scaleAmt) * 0.12),
    y: shape.y,
    z: shape.z * (1 + Math.max(0, scaleAmt) * 0.06),
  };

  // Abdomen solo para el frente bajo de cintura; maxBindY evita subir al pecho
  const bones = waistRise >= 0.25 ? PANT_BONES : PANT_BONES_LOW;
  const pantShell = {
    boneNames: bones,
    excludeBoneNames: PANT_EXCLUDE_BONES,
  };

  const pantsMat = softPantsMat(params);
  const layers: THREE.Group[] = [
    createSkinnedShell(sources, {
      ...pantShell,
      inflate,
      material: pantsMat,
      minWeight,
      maxBindY,
      minBindY,
      uvScale: params.style === "jeans" ? 3.2 : 2.4 + r(),
      inflateNormalBias: bias,
      shapeScale: shape,
      closeFrontMidline: closeMid,
    }),
  ];

  if (params.style === "jeans" || params.style === "cargo" || params.style === "leather") {
    layers.push(
      createSkinnedShell(sources, {
        ...pantShell,
        inflate: inflate + 0.006,
        material: pantsMat,
        minWeight: Math.min(0.28, minWeight + 0.08),
        maxBindY,
        minBindY,
        uvScale: 2.8,
        inflateNormalBias: { x: 1.1, y: 0.85, z: 1.2 },
        shapeScale: { x: shape.x * 1.02, y: 0.96, z: shape.z * 1.02 },
      }),
    );
  }

  if (params.style === "plated") {
    layers.push(
      createSkinnedShell(sources, {
        ...pantShell,
        inflate: inflate + 0.008,
        material: softAccentMat({
          seed: params.seed,
          style: "plate",
          sleeves: "none",
          finish: "bare",
          bulk: 0.5,
          hue: params.hue,
          rarity: params.rarity,
        }),
        minWeight: Math.min(0.28, minWeight + 0.08),
        maxBindY,
        minBindY,
        uvScale: 3,
      }),
    );
  }

  const root = mergeShells(...layers);
  pantPocketDecors(root, sources, params);
  if (params.style === "jeans") jeansDetailDecors(root, sources, params);
  if (params.style === "cloth" || params.style === "leather") {
    const zipMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.75, roughness: 0.4 });
    const zip = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.008), zipMat);
      tooth.position.set(-0.02, 0.32 + i * 0.022, 0.1);
      zip.add(tooth);
    }
    attachDecor(root, sources, "UpperLegR", zip);
  }
  if (params.style === "jogger") joggerCuffDecors(root, sources, params);
  if (params.style === "plated") {
    const mat = softAccentMat({
      seed: params.seed + 1,
      style: "plate",
      sleeves: "none",
      finish: "polished",
      bulk: 0.6,
      hue: params.hue,
      rarity: params.rarity,
    });
    for (const side of ["L", "R"] as const) {
      const g = new THREE.Group();
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.05), mat);
      pad.position.set(0.02, 0.02, 0.06);
      g.add(pad);
      attachDecor(root, sources, `UpperLeg${side}`, g);
    }
  }
  applyItemGlow(root, params.hue, params.rarity);
  return root;
}

/** Guantes: manopla o dedos + placa de nudillos en gauntlet. */
export function buildSkinnedGloves(sources: THREE.SkinnedMesh[], params: GlovesParams): THREE.Group {
  params = { ...params, style: gloveVisual(params.style) };
  const mitten = params.style === "cloth" || (params.style === "gauntlet" && params.bulk >= 0.5);
  const inflate = mitten ? 0.025 + params.bulk * 0.01 : 0.018 + params.bulk * 0.008;
  const base = createSkinnedShell(sources, {
    boneNames: mitten ? GLOVE_MITTEN_BONES : GLOVE_FINGERED_BONES,
    inflate,
    material: softGloveMat(params),
    minWeight: 0.045,
    uvScale: 3.2,
    shapeScale: { x: 0.98, y: 0.64, z: 0.83 },
  });
  const root =
    params.style === "gauntlet"
      ? mergeShells(
          base,
          createSkinnedShell(sources, {
            boneNames: new Set(["PalmL", "PalmR", "MiddleHandL", "MiddleHandR"]),
            inflate: inflate + 0.012,
            material: softGloveMat({ ...params, style: "gauntlet" }),
            minWeight: 0.15,
            uvScale: 2.5,
          }),
        )
      : base;
  applyItemGlow(root, params.hue, params.rarity, { lights: true });
  return root;
}

export {
  ARMOR_BONES,
  BOOT_BONES,
  BOOT_TALL_BONES,
  PANT_BONES,
  GLOVE_BONES,
  GLOVE_MITTEN_BONES,
  GLOVE_FINGERED_BONES,
};
