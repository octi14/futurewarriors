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
  createHelmetItem,
  createShieldItem,
  createSmallAxeItem,
  createThrowItem,
} from "./shared/gear";
import { createDaggerItem, createSwordItem, randomSwordSeed } from "./shared/swords";
import type { Equipment, ItemInstance } from "./shared/types";

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
let autoSpin = false;
const STRIDE = 0.72;
const WALK_SPEED = 3.1;

document.getElementById("btn-walk")!.addEventListener("click", (e) => {
  walkOn = !walkOn;
  (e.currentTarget as HTMLButtonElement).textContent = `Caminar: ${walkOn ? "ON" : "OFF"}`;
});
document.getElementById("btn-slash")!.addEventListener("click", () => {
  slashT = 0.42;
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

const equipment: Pick<Equipment, "weapon" | "offhand" | "helmet" | "armor" | "belt" | "boots"> = {
  weapon: createSwordItem(1001),
  offhand: null,
  helmet: null,
  armor: null,
  belt: null,
  boots: null,
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

(
  window as unknown as {
    __fwPreview: {
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      hero: typeof hero;
    };
  }
).__fwPreview = { camera, controls, hero };

function makeItem(kind: string): ItemInstance {
  const seed = randomSwordSeed();
  switch (kind) {
    case "sword":
      return createSwordItem(seed);
    case "dagger":
    case "daggerOff":
      return createDaggerItem(seed);
    case "axe":
      return createAxeItem(seed, false);
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
    hero.applySlash(1 - slashT / 0.42);
  } else if (walkOn) {
    walkPhase += ((WALK_SPEED * dt) / STRIDE) * Math.PI;
  }
  hero.update(dt, walkPhase, walkOn && !swinging, swinging);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
