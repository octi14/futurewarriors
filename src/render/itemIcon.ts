import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ELEMENT_LABEL_ES } from "../shared/elements";
import { RARITY_LABEL_ES } from "../shared/rng";
import type { ItemInstance, Rarity } from "../shared/types";
import { buildItemMesh, disposeObject3D } from "./itemMesh";

const rarityNameColor: Record<Rarity, string> = {
  vulgar: "#9a9080",
  common: "#d8c8a8",
  regular: "#c6d4a8",
  uncommon: "#7dcc6a",
  rare: "#6a9aef",
  exceptional: "#5ec8e8",
  epic: "#c87bff",
  legendary: "#e8b84a",
  mythic: "#ff6b8a",
};

function rarityOf(item: ItemInstance): Rarity {
  return (item.params as { rarity: Rarity }).rarity;
}

const cache = new Map<string, string>();

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let root: THREE.Group | null = null;

function ensureIconGl(): void {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0xfff0d8, 0.55));
  const key = new THREE.DirectionalLight(0xffe2a8, 1.6);
  key.position.set(2.2, 3.5, 2.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa8c0e8, 0.55);
  fill.position.set(-2.5, 1.5, -1.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff5e0, 0.45);
  rim.position.set(0, 2, -3);
  scene.add(rim);

  camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
  root = new THREE.Group();
  scene.add(root);
}

function fitItemInView(mesh: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  mesh.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const dist = maxDim * 1.55;
  camera!.position.set(dist * 0.55, dist * 0.42, dist * 0.95);
  camera!.near = dist / 100;
  camera!.far = dist * 20;
  camera!.lookAt(0, 0, 0);
  camera!.updateProjectionMatrix();
}

/** Icono 3D del ítem (flotando, estilo Diablo/MU). Cacheado por id+tamaño. */
export function itemIconDataUrl(item: ItemInstance, size = 128): string {
  const key = `${item.id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  ensureIconGl();
  const gl = renderer!;
  const sc = scene!;
  const cam = camera!;
  const hold = root!;

  while (hold.children.length) {
    const ch = hold.children[0];
    hold.remove(ch);
    disposeObject3D(ch);
  }

  gl.setPixelRatio(1);
  gl.setSize(size, size, false);

  const mesh = buildItemMesh(item);
  // Ángulo “en vitrina” según tipo
  if (item.kind === "sword" || item.kind === "axe" || item.kind === "throw") {
    mesh.rotation.y += 0.4;
    mesh.rotation.z += 0.15;
  } else if (item.kind === "bow" || item.kind === "crossbow") {
    mesh.rotation.y += 0.25;
  } else if (item.kind === "shield" || item.kind === "helmet" || item.kind === "armor") {
    mesh.rotation.y += 0.35;
    mesh.rotation.x += 0.1;
  } else {
    mesh.rotation.y += 0.45;
  }
  hold.add(mesh);
  fitItemInView(hold);

  gl.render(sc, cam);
  const url = gl.domElement.toDataURL("image/png");
  cache.set(key, url);

  hold.remove(mesh);
  disposeObject3D(mesh);
  return url;
}

export function itemTooltipHtml(item: ItemInstance): string {
  const s = item.stats;
  const rarity = rarityOf(item);
  const nameColor = rarityNameColor[rarity] ?? rarityNameColor.common;
  const lines: string[] = [
    `<div class="tt-name" style="color:${nameColor}">${item.name}</div>`,
    `<div class="tt-meta">${RARITY_LABEL_ES[rarity] ?? rarity} · ${item.kind} · ${item.equipSlot}</div>`,
  ];
  if (s.damage) lines.push(`<div class="tt-stat">Daño <b>${s.damage}</b></div>`);
  if (s.element && s.elementDamage)
    lines.push(
      `<div class="tt-stat">${ELEMENT_LABEL_ES[s.element]} <b>+${s.elementDamage}</b></div>`,
    );
  if (s.reach) lines.push(`<div class="tt-stat">Alcance <b>${s.reach}</b></div>`);
  if (s.attackSpeed) lines.push(`<div class="tt-stat">Vel. ataque <b>${s.attackSpeed}</b></div>`);
  if (s.armor) lines.push(`<div class="tt-stat">Armadura <b>${s.armor}</b></div>`);
  if (s.moveSpeedMult !== 1)
    lines.push(`<div class="tt-stat">Vel. movimiento <b>×${s.moveSpeedMult}</b></div>`);
  if (s.maxHpBonus) lines.push(`<div class="tt-stat">HP máx. <b>+${s.maxHpBonus}</b></div>`);
  if (item.easterEgg) lines.push(`<div class="tt-meta">Easter egg</div>`);
  return lines.join("");
}
