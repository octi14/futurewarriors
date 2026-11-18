import * as THREE from "three";
import {
  buyStat,
  createWorld,
  dropFromBag,
  dropFromEquip,
  equipFromBag,
  pickupNearest,
  setBlocking,
  stepWorld,
  toggleCharacter,
  toggleInventory,
  tryAttack,
  unequipSlot,
  type InputState,
} from "./sim/world";
import { createRenderer } from "./render/scene";
import { bindHud } from "./render/hud";

const app = document.getElementById("app")!;
const world = createWorld({ mapSize: 40, aiCount: 6 });
const hud = bindHud({
  onEquipBag: (id) => equipFromBag(world, id),
  onUnequip: (slot) => unequipSlot(world, slot),
  onDropBag: (id) => dropFromBag(world, id),
  onDropEquip: (slot) => dropFromEquip(world, slot),
  onBuyStat: (stat) => buyStat(world, stat),
});

const projectScratch = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimHit = new THREE.Vector3();

let pointerClientX = window.innerWidth * 0.5;
let pointerClientY = window.innerHeight * 0.5;
let hasPointer = false;
let prevPointerX = pointerClientX;
let prevPointerY = pointerClientY;

const render = await createRenderer(app);

function projectWorld(worldX: number, worldZ: number, height: number) {
  projectScratch.set(worldX, height, worldZ).project(render.camera);
  const w = app.clientWidth;
  const h = app.clientHeight;
  return {
    x: (projectScratch.x * 0.5 + 0.5) * w,
    y: (-projectScratch.y * 0.5 + 0.5) * h,
    visible: projectScratch.z > -1 && projectScratch.z < 1,
  };
}

function mouseToGround(clientX: number, clientY: number): { x: number; y: number } | null {
  const rect = render.renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, render.camera);
  const ok = raycaster.ray.intersectPlane(groundPlane, aimHit);
  if (!ok) return null;
  return { x: aimHit.x, y: aimHit.z };
}

const keys = new Set<string>();
function sprintHeld(): boolean {
  return keys.has("ShiftLeft") || keys.has("ShiftRight");
}
function uiOpen(): boolean {
  return world.inventoryOpen || world.characterOpen;
}
function doAttack(): void {
  if (uiOpen()) return;
  tryAttack(world, { sprintHeld: sprintHeld() });
}
window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Space") {
    e.preventDefault();
    doAttack();
  }
  if (e.code === "KeyE") pickupNearest(world);
  if (e.code === "KeyI") {
    e.preventDefault();
    toggleInventory(world);
  }
  if (e.code === "KeyC") {
    e.preventDefault();
    toggleCharacter(world);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousemove", (e) => {
  pointerClientX = e.clientX;
  pointerClientY = e.clientY;
  hasPointer = true;
});
window.addEventListener("mousedown", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("#inv, #char, #help, #combat-hud")) return;
  if (e.button === 0) doAttack();
  if (e.button === 2) {
    e.preventDefault();
    setBlocking(world, true);
  }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 2) setBlocking(world, false);
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("blur", () => setBlocking(world, false));
window.addEventListener("resize", () => render.resize());

function readInput(): InputState {
  let moveX = 0;
  let moveY = 0;
  if (!uiOpen()) {
    if (keys.has("KeyW") || keys.has("ArrowUp")) {
      moveX -= 1;
      moveY -= 1;
    }
    if (keys.has("KeyS") || keys.has("ArrowDown")) {
      moveX += 1;
      moveY += 1;
    }
    if (keys.has("KeyA") || keys.has("ArrowLeft")) {
      moveX -= 1;
      moveY += 1;
    }
    if (keys.has("KeyD") || keys.has("ArrowRight")) {
      moveX += 1;
      moveY -= 1;
    }
  }

  const ground = hasPointer ? mouseToGround(pointerClientX, pointerClientY) : null;
  const aimMoved =
    hasPointer &&
    (pointerClientX !== prevPointerX || pointerClientY !== prevPointerY);
  prevPointerX = pointerClientX;
  prevPointerY = pointerClientY;

  return {
    moveX,
    moveY,
    aimX: ground?.x ?? world.player.pos.x,
    aimY: ground?.y ?? world.player.pos.y,
    hasAim: ground !== null,
    aimMoved,
    sprint: sprintHeld(),
  };
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepWorld(world, dt, readInput());
  render.sync(world);
  hud.update(world, projectWorld);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
