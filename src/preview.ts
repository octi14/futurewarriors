import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createHero } from "./render/loadHero";
import { buildSwordMesh } from "./render/swordMesh";
import { createSwordItem } from "./shared/swords";

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
const fill = new THREE.DirectionalLight(0x8899aa, 0.65);
fill.position.set(-4, 2, -2);
scene.add(fill);
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

const status = document.createElement("div");
status.style.cssText =
  "position:absolute;left:12px;bottom:12px;color:#c4a574;font:12px Georgia,serif;z-index:2";
status.textContent = "Cargando modelo…";
document.body.appendChild(status);

let walkOn = false;
let walkPhase = 0;
let slashT = 0;
let autoSpin = false;
const STRIDE = 0.72;
const WALK_SPEED = 3.1;

const btnWalk = document.getElementById("btn-walk")!;
const btnSlash = document.getElementById("btn-slash")!;
const btnSpin = document.getElementById("btn-spin")!;
const chkWire = document.getElementById("chk-wire") as HTMLInputElement;

btnWalk.textContent = "Caminar: OFF";
btnWalk.addEventListener("click", () => {
  walkOn = !walkOn;
  btnWalk.textContent = `Caminar: ${walkOn ? "ON" : "OFF"}`;
});
btnSlash.addEventListener("click", () => {
  slashT = 0.42;
});
btnSpin.addEventListener("click", () => {
  autoSpin = !autoSpin;
  controls.autoRotate = autoSpin;
  controls.autoRotateSpeed = 1.6;
  btnSpin.textContent = `Auto-rotar: ${autoSpin ? "ON" : "OFF"}`;
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
  status.textContent = `Error cargando humano: ${e instanceof Error ? e.message : String(e)}`;
  console.error(e);
  throw e;
}
scene.add(hero.root);
status.textContent = "Humano CC0 Quaternius (skinned) — no procedural";

const sword = buildSwordMesh(createSwordItem(1001).params);
sword.scale.setScalar(0.7);
sword.position.set(0, -0.02, 0.04);
sword.rotation.set(Math.PI / 2, 0, 0.05);
hero.handGrip.add(sword);

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
