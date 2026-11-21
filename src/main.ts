import * as THREE from "three";
import {
  buyStat,
  createWorld,
  dropFromBag,
  dropFromEquip,
  equipFromBag,
  moveBagItemTo,
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
const world = createWorld({ mapSize: 80, aiCount: 1, bugCount: 40 });
const hud = bindHud({
  onEquipBag: (id) => equipFromBag(world, id),
  onMoveBag: (id, x, y) => moveBagItemTo(world, id, x, y),
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

const render = await createRenderer(app, world.config.mapSize);

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
let jumpQueued = false;
function sprintHeld(): boolean {
  return keys.has("ShiftLeft") || keys.has("ShiftRight");
}
function crouchHeld(): boolean {
  return keys.has("KeyX");
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
    if (!uiOpen()) jumpQueued = true;
  }
  if (e.code === "KeyE") pickupNearest(world);
  if (e.code === "KeyI") {
    e.preventDefault();
    toggleInventory(world);
    syncLookLock();
  }
  if (e.code === "KeyC") {
    e.preventDefault();
    toggleCharacter(world);
    syncLookLock();
  }
  if (e.code === "KeyV") {
    e.preventDefault();
    toggleView();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
let lookYaw = world.player.facing;
const viewBtn = document.getElementById("view-btn")!;
function toggleView(): void {
  const on = !render.isFirstPerson();
  if (on) lookYaw = world.player.facing;
  render.setFirstPerson(on);
  document.body.classList.toggle("fps", on);
  viewBtn.textContent = on ? "3ª" : "1ª";
  viewBtn.setAttribute("aria-pressed", String(on));
  viewBtn.setAttribute("aria-label", on ? "Tercera persona" : "Primera persona");
  const fine = matchMedia("(pointer: fine)").matches;
  if (on && fine && !uiOpen()) render.renderer.domElement.requestPointerLock();
  else if (!on && document.pointerLockElement) document.exitPointerLock();
}
function syncLookLock(): void {
  document.body.classList.toggle("ui-open", uiOpen());
  if (!render.isFirstPerson() || !matchMedia("(pointer: fine)").matches) return;
  if (uiOpen()) {
    if (document.pointerLockElement) document.exitPointerLock();
  } else {
    render.renderer.domElement.requestPointerLock();
  }
}
viewBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleView();
});

let lookPointer: number | null = null;
window.addEventListener("pointerdown", (e) => {
  if (!render.isFirstPerson() || uiOpen() || document.pointerLockElement) return;
  const t = e.target as HTMLElement;
  if (t.closest("#inv, #char, #help, #combat-hud, #view-btn")) return;
  lookPointer = e.pointerId;
});
window.addEventListener("pointermove", (e) => {
  if (e.pointerId !== lookPointer || !render.isFirstPerson() || uiOpen()) return;
  lookYaw -= e.movementX * 0.004;
  render.addPitch(-e.movementY * 0.003);
});
window.addEventListener("pointerup", (e) => {
  if (e.pointerId === lookPointer) lookPointer = null;
});
window.addEventListener("pointercancel", (e) => {
  if (e.pointerId === lookPointer) lookPointer = null;
});

window.addEventListener("mousemove", (e) => {
  pointerClientX = e.clientX;
  pointerClientY = e.clientY;
  hasPointer = true;
  if (render.isFirstPerson() && !uiOpen() && document.pointerLockElement) {
    lookYaw -= e.movementX * 0.0022;
    render.addPitch(-e.movementY * 0.0018);
  }
});
window.addEventListener("mousedown", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("#inv, #char, #help, #combat-hud, #view-btn")) return;
  if (
    render.isFirstPerson() &&
    !uiOpen() &&
    !document.pointerLockElement &&
    matchMedia("(pointer: fine)").matches
  ) {
    render.renderer.domElement.requestPointerLock();
  }
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
  const fp = render.isFirstPerson();
  let moveX = 0;
  let moveY = 0;
  if (!uiOpen()) {
    if (fp) {
      let f = 0;
      let s = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) f += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) f -= 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) s -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) s += 1;
      const fx = -Math.sin(lookYaw);
      const fz = -Math.cos(lookYaw);
      moveX = fx * f + -fz * s;
      moveY = fz * f + fx * s;
    } else {
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
  }

  const ground = !fp && hasPointer ? mouseToGround(pointerClientX, pointerClientY) : null;
  const aimMoved =
    !fp &&
    hasPointer &&
    (pointerClientX !== prevPointerX || pointerClientY !== prevPointerY);
  prevPointerX = pointerClientX;
  prevPointerY = pointerClientY;

  let aimX = ground?.x ?? world.player.pos.x;
  let aimY = ground?.y ?? world.player.pos.y;
  if (fp) {
    const pitch = render.pitch();
    const fx = -Math.sin(lookYaw);
    const fz = -Math.cos(lookYaw);
    const sp = Math.sin(pitch);
    const cp = Math.cos(pitch);
    const eyeY = world.player.height + (world.player.crouching ? 0.92 : 1.55);
    const reach = sp < -0.08 ? Math.min(36, eyeY / -sp) : 24;
    aimX = world.player.pos.x + fx * cp * reach;
    aimY = world.player.pos.y + fz * cp * reach;
  }

  const jump = jumpQueued;
  jumpQueued = false;
  return {
    moveX,
    moveY,
    aimX,
    aimY,
    hasAim: fp || ground !== null,
    aimMoved,
    sprint: sprintHeld(),
    jump,
    crouch: !uiOpen() && crouchHeld(),
    lookFacing: fp ? lookYaw : null,
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
