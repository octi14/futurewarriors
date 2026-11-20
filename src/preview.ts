import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  attachEquippedVisuals,
  emptyEquipMeshes,
  mountEquipMeshes,
  type EquipMeshes,
} from "./render/equipAttach";
import { createHero } from "./render/loadHero";
import {
  createArmorItem,
  createAxeItem,
  createBeltItem,
  createBootsItem,
  createBowItem,
  createCrossbowItem,
  createGlovesItem,
  createHelmetItem,
  createPantsItem,
  createShieldItem,
  createSmallAxeItem,
  createThrowItem,
} from "./shared/gear";
import { SLASH_DURATION } from "./sim/world";
import { createDaggerItem, createSwordItem, randomSwordSeed } from "./shared/swords";
import { setBootDetailTune } from "./render/skinnedGear";
import type { AxeParams, BootsParams, CombatAnimKind, Equipment, ItemInstance, SwordParams } from "./shared/types";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2418);
scene.fog = new THREE.Fog(0x2a2418, 12, 28);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(1.2, 1.4, 2.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
controls.minDistance = 1.2;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xd4c4a0, 0x3a2e1c, 1.0));
const sun = new THREE.DirectionalLight(0xffe2b0, 1.35);
sun.position.set(2, 6, 5);
sun.castShadow = true;
scene.add(sun);
scene.add(new THREE.DirectionalLight(0x8899aa, 0.65).translateX(-4).translateY(2).translateZ(-2));
const rim = new THREE.DirectionalLight(0xffe8c8, 0.35);
rim.position.set(0, 3, -5);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(6, 48),
  new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(8, 16, 0x6a5a40, 0x3a3020);
grid.position.y = 0.01;
scene.add(grid);

const status = document.getElementById("status")!;

let walkOn = false;
let walkPhase = 0;
let slashT = 0;
let slashMax = SLASH_DURATION;
let combatAnim: CombatAnimKind = "slash";
let twoHandStance = false;
let autoSpin = false;
const STRIDE = 0.72;
const WALK_SPEED = 3.1;

function asTwoHand(item: ItemInstance): ItemInstance {
  if (item.kind === "sword") {
    const p = item.params as SwordParams;
    p.bladeType = "wide";
    p.bladeLength = Math.max(1.12, p.bladeLength);
    item.gridW = 2;
    item.gridH = Math.max(item.gridH, 3);
  } else if (item.kind === "axe") {
    const p = item.params as AxeParams;
    p.haftLength = Math.max(1.05, p.haftLength);
    p.headSize = Math.max(0.36, p.headSize);
    item.gridH = Math.max(item.gridH, 3);
  }
  item.name = `${item.name} (2H)`;
  return item;
}

document.getElementById("btn-walk")!.addEventListener("click", (e) => {
  walkOn = !walkOn;
  (e.currentTarget as HTMLButtonElement).textContent = `Caminar: ${walkOn ? "ON" : "OFF"}`;
});
document.getElementById("btn-slash")!.addEventListener("click", () => {
  combatAnim = "slash";
  slashMax = SLASH_DURATION;
  slashT = slashMax;
});
document.getElementById("btn-twohand")!.addEventListener("click", () => {
  twoHandStance = true;
  equipment.weapon = asTwoHand(createSwordItem(randomSwordSeed()));
  equipment.offhand = null;
  rebuild();
  status.textContent = `${status.textContent} · pose 2H`;
});
document.getElementById("btn-spin")!.addEventListener("click", (e) => {
  autoSpin = !autoSpin;
  controls.autoRotate = autoSpin;
  controls.autoRotateSpeed = 1.6;
  (e.currentTarget as HTMLButtonElement).textContent = `Auto-rotar: ${autoSpin ? "ON" : "OFF"}`;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let hero: Awaited<ReturnType<typeof createHero>>;
try {
  hero = await createHero();
} catch (e) {
  status.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
  throw e;
}
scene.add(hero.root);
// Debug: órbita desde DevTools / agent

const equipment: Pick<
  Equipment,
  "weapon" | "offhand" | "helmet" | "armor" | "belt" | "pants" | "boots" | "gloves"
> = {
  weapon: createSwordItem(1001),
  offhand: null,
  helmet: null,
  armor: createArmorItem(4241),
  belt: null,
  pants: createPantsItem(4240),
  boots: createBootsItem(4242),
  gloves: createGlovesItem(4243),
};

let equipMeshes: EquipMeshes = emptyEquipMeshes();
mountEquipMeshes(hero, equipMeshes);

function rebuild(): void {
  equipMeshes = attachEquippedVisuals(hero, equipMeshes, equipment);
  const parts = Object.values(equipment)
    .filter(Boolean)
    .map((i) => (i as ItemInstance).name);
  status.textContent = parts.length ? parts.join(" · ") : "Sin equipo — offsets en equipAttach.ts";
}

rebuild();

type GripName = "bootGripL" | "bootGripR" | "gloveGripL" | "gloveGripR";
function setGrip(
  name: GripName,
  opts: { px?: number; py?: number; pz?: number; rx?: number; ry?: number; rz?: number; s?: number },
): Record<string, number> {
  const g = hero[name];
  if (opts.px !== undefined) g.position.x = opts.px;
  if (opts.py !== undefined) g.position.y = opts.py;
  if (opts.pz !== undefined) g.position.z = opts.pz;
  if (opts.rx !== undefined) g.rotation.x = opts.rx;
  if (opts.ry !== undefined) g.rotation.y = opts.ry;
  if (opts.rz !== undefined) g.rotation.z = opts.rz;
  if (opts.s !== undefined) g.scale.setScalar(opts.s);
  return {
    px: g.position.x,
    py: g.position.y,
    pz: g.position.z,
    rx: g.rotation.x,
    ry: g.rotation.y,
    rz: g.rotation.z,
    s: g.scale.x,
  };
}
function focusFeet(): void {
  controls.target.set(0, 0.12, 0);
  camera.position.set(0.55, 0.45, 0.85);
  controls.update();
}
function focusHands(): void {
  controls.target.set(0, 1.05, 0.1);
  camera.position.set(0.7, 1.25, 0.95);
  controls.update();
}
function setTestBoots(style: BootsParams["style"], metalTone: BootsParams["metalTone"] = "none"): void {
  const b = createBootsItem((Math.random() * 1e9) | 0);
  const p = b.params as BootsParams;
  p.style = style;
  p.metalTone = metalTone;
  if (style === "greaves" || style === "trail" || style === "combat") p.height = 0.42;
  else if (style === "military") p.height = 0.32;
  equipment.boots = b;
  rebuild();
  focusFeet();
}

/** TEMP: sliders empeine — bakear valores y borrar UI. */
const bootTuneEls = {
  y0: document.getElementById("boot-y0") as HTMLInputElement | null,
  y1: document.getElementById("boot-y1") as HTMLInputElement | null,
  zPad: document.getElementById("boot-zpad") as HTMLInputElement | null,
  pitch: document.getElementById("boot-pitch") as HTMLInputElement | null,
  toeLen: document.getElementById("boot-toelen") as HTMLInputElement | null,
  toePad: document.getElementById("boot-toepad") as HTMLInputElement | null,
  read: document.getElementById("boot-tune-readout"),
};
function applyBootTuneFromUi(): void {
  const y0 = parseFloat(bootTuneEls.y0?.value ?? "-0.2");
  const y1 = parseFloat(bootTuneEls.y1?.value ?? "0.08");
  const zPad = parseFloat(bootTuneEls.zPad?.value ?? "0.04");
  const pitchMul = parseFloat(bootTuneEls.pitch?.value ?? "1");
  const toeLen = parseFloat(bootTuneEls.toeLen?.value ?? "0.22");
  const toePad = parseFloat(bootTuneEls.toePad?.value ?? "0.004");
  setBootDetailTune({ y0, y1, zPad, pitchMul, toeLen, toePad });
  if (bootTuneEls.read) {
    bootTuneEls.read.textContent = `y0 ${y0.toFixed(2)} · y1 ${y1.toFixed(2)} · z ${zPad.toFixed(3)} · p ${pitchMul.toFixed(2)} · toe ${toeLen.toFixed(2)}/${toePad.toFixed(4)}`;
  }
  localStorage.setItem("fw.preview.bootTune", JSON.stringify({ y0, y1, zPad, pitchMul }));
  if (equipment.boots) rebuild();
}
try {
  const raw = localStorage.getItem("fw.preview.bootTune");
  if (raw) {
    const s = JSON.parse(raw) as { y0?: number; y1?: number; zPad?: number; pitchMul?: number };
    if (bootTuneEls.y0 && typeof s.y0 === "number") bootTuneEls.y0.value = String(s.y0);
    if (bootTuneEls.y1 && typeof s.y1 === "number") bootTuneEls.y1.value = String(s.y1);
    if (bootTuneEls.zPad && typeof s.zPad === "number") bootTuneEls.zPad.value = String(s.zPad);
    if (bootTuneEls.pitch && typeof s.pitchMul === "number") bootTuneEls.pitch.value = String(s.pitchMul);
  }
} catch {
  /* ignore */
}
for (const el of [
  bootTuneEls.y0,
  bootTuneEls.y1,
  bootTuneEls.zPad,
  bootTuneEls.pitch,
  bootTuneEls.toeLen,
  bootTuneEls.toePad,
]) {
  el?.addEventListener("input", applyBootTuneFromUi);
}
applyBootTuneFromUi();
document.getElementById("boot-style-btns")?.addEventListener("click", (ev) => {
  const t = (ev.target as HTMLElement).closest("button[data-boot]") as HTMLButtonElement | null;
  if (!t?.dataset.boot) return;
  setTestBoots(
    t.dataset.boot as BootsParams["style"],
    (t.dataset.tone as BootsParams["metalTone"]) || "none",
  );
});

(
  window as unknown as {
    __fwPreview: {
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      hero: typeof hero;
      setGrip: typeof setGrip;
      focusFeet: typeof focusFeet;
      focusHands: typeof focusHands;
      rebuild: typeof rebuild;
      setTestBoots: typeof setTestBoots;
      setBootDetailTune: typeof setBootDetailTune;
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
    };
  }
).__fwPreview = {
  renderer,
  scene,
  camera,
  controls,
  hero,
  setGrip,
  focusFeet,
  focusHands,
  rebuild,
  setTestBoots,
  setBootDetailTune,
};

function makeItem(kind: string): ItemInstance {
  const seed = randomSwordSeed();
  switch (kind) {
    case "sword":
      return createSwordItem(seed);
    case "dagger":
    case "daggerOff":
      return createDaggerItem(seed);
    case "axe":
      return createAxeItem(seed, false, false);
    case "axe2h":
      return createAxeItem(seed, false, true);
    case "smallAxe":
      return createSmallAxeItem(seed);
    case "bow":
      return createBowItem(seed);
    case "crossbow":
      return createCrossbowItem(seed);
    case "throw":
      return createThrowItem(seed);
    case "shield":
      return createShieldItem(seed);
    case "helmet":
      return createHelmetItem(seed);
    case "armor":
      return createArmorItem(seed);
    case "belt":
      return createBeltItem(seed);
    case "boots":
      return createBootsItem(seed);
    case "pants":
      return createPantsItem(seed);
    case "gloves":
      return createGlovesItem(seed);
    default:
      return createSwordItem(seed);
  }
}

document.getElementById("ui")!.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
  if (!btn || btn.id.startsWith("btn-")) return;
  const clear = btn.dataset.clear as keyof typeof equipment | undefined;
  if (clear) {
    equipment[clear] = null;
    rebuild();
    return;
  }
  const kind = btn.dataset.kind;
  if (!kind) return;
  const weapons = ["sword", "dagger", "axe", "smallAxe", "bow", "crossbow", "throw", "sword2h", "axe2h"];
  if (!weapons.includes(kind)) twoHandStance = false;
  if (kind === "sword2h" || kind === "axe2h") {
    twoHandStance = true;
    equipment.offhand = null;
    equipment.weapon = asTwoHand(makeItem(kind === "sword2h" ? "sword" : "axe"));
    rebuild();
    return;
  }
  const item = makeItem(kind);
  if (kind === "daggerOff" || item.equipSlot === "offhand") equipment.offhand = item;
  else {
    const slot = item.equipSlot as keyof typeof equipment;
    if (slot in equipment) equipment[slot] = item;
  }
  rebuild();
});

document.getElementById("btn-clear-all")!.addEventListener("click", (e) => {
  e.stopPropagation();
  for (const k of Object.keys(equipment) as (keyof typeof equipment)[]) equipment[k] = null;
  rebuild();
});

const chkWire = document.getElementById("chk-wire") as HTMLInputElement;
chkWire.addEventListener("change", () => {
  hero.root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const m = o.material;
      if (m && !Array.isArray(m) && "wireframe" in m) {
        (m as THREE.MeshStandardMaterial).wireframe = chkWire.checked;
      }
    }
  });
});

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const swinging = slashT > 0;
  if (swinging) {
    slashT = Math.max(0, slashT - dt);
    const u = 1 - slashT / Math.max(0.05, slashMax);
    hero.applyCombat(u, combatAnim, false, 0);
  } else if (walkOn) {
    walkPhase += ((WALK_SPEED * dt) / STRIDE) * Math.PI;
  }
  const stance = twoHandStance ? "twohand" : "idle";
  hero.update(dt, walkPhase, walkOn && !swinging, swinging, false, stance);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
