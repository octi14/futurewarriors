import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { readFileSync } from "fs";
import { resolve } from "path";

const path = resolve("public/models/HumanMale.glb");
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const buf = readFileSync(path);
const gltf = await loader.parseAsync(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  "",
);
const model = gltf.scene;
const box0 = new THREE.Box3().setFromObject(model);
const size = new THREE.Vector3();
box0.getSize(size);
model.scale.setScalar(1.78 / size.y);
const box1 = new THREE.Box3().setFromObject(model);
model.position.y = -box1.min.y;
model.updateMatrixWorld(true);

const boneNames = [];
model.traverse((o) => {
  if (o.isBone || /Hips|Abdomen|Torso|Chest|Neck|Head|Arm|Shoulder/i.test(o.name)) {
    boneNames.push(`${o.type}:${o.name}`);
  }
});
console.log("BONES", boneNames.sort().join(" | "));

function find(names) {
  let f = null;
  model.traverse((o) => {
    if (!f && names.includes(o.name)) f = o;
  });
  return f;
}

function wp(o) {
  const v = new THREE.Vector3();
  o.getWorldPosition(v);
  return v;
}

for (const n of [
  "Hips",
  "Abdomen",
  "Torso",
  "Chest",
  "Neck",
  "Head",
  "UpperArmL",
  "UpperArmR",
  "ShoulderL",
  "ShoulderR",
]) {
  const o = find([n]);
  if (!o) {
    console.log(n, "MISSING");
    continue;
  }
  const p = wp(o);
  console.log(n, p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3));
}

const bb = new THREE.Box3().setFromObject(model);
console.log(
  "BODY",
  bb.min.toArray().map((n) => n.toFixed(3)).join(","),
  "->",
  bb.max.toArray().map((n) => n.toFixed(3)).join(","),
);

for (const y of [0.75, 0.9, 1.05, 1.15, 1.25, 1.35, 1.45, 1.55]) {
  const xs = [];
  const zs = [];
  const v = new THREE.Vector3();
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 2) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (Math.abs(v.y - y) < 0.04 && Math.abs(v.x) < 0.5) {
        xs.push(v.x);
        zs.push(v.z);
      }
    }
  });
  if (!xs.length) {
    console.log("Y", y, "empty");
    continue;
  }
  const hx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const hz = (Math.max(...zs) - Math.min(...zs)) / 2;
  console.log(
    "Y",
    y,
    "halfX",
    hx.toFixed(3),
    "halfZ",
    hz.toFixed(3),
    "zMax",
    Math.max(...zs).toFixed(3),
  );
}

// Torso bone local → world with grip offset like loadHero
const torso = find(["Torso", "Abdomen", "Body"]);
if (torso) {
  const grip = new THREE.Group();
  grip.position.set(0, 0.28, 0.03);
  torso.add(grip);
  model.updateMatrixWorld(true);
  console.log("torsoGrip world", wp(grip).x.toFixed(3), wp(grip).y.toFixed(3), wp(grip).z.toFixed(3));
  const neck = find(["Neck"]);
  const abdomen = find(["Abdomen"]);
  if (neck) {
    const n = wp(neck);
    const g = wp(grip);
    console.log("neck-grip dy", (n.y - g.y).toFixed(3), "neck y", n.y.toFixed(3));
  }
  if (abdomen) {
    const a = wp(abdomen);
    const g = wp(grip);
    console.log("abdomen-grip dy", (a.y - g.y).toFixed(3), "abdomen y", a.y.toFixed(3));
  }
  const ual = find(["UpperArmL"]);
  const uar = find(["UpperArmR"]);
  if (ual && uar) {
    console.log(
      "shoulders world Y",
      wp(ual).y.toFixed(3),
      wp(uar).y.toFixed(3),
      "halfSpan",
      (Math.abs(wp(ual).x - wp(uar).x) / 2).toFixed(3),
    );
  }
}
