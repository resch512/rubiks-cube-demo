import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const host = document.getElementById("cube");
const mixBtn = document.getElementById("mixBtn");
const solveBtn = document.getElementById("solveBtn");
const statusEl = document.getElementById("status");

const MOVE_MS = 500;
const moves = [
  { axis: "x", amount: Math.PI / 2 },
  { axis: "x", amount: -Math.PI / 2 },
  { axis: "y", amount: Math.PI / 2 },
  { axis: "y", amount: -Math.PI / 2 },
  { axis: "z", amount: Math.PI / 2 },
  { axis: "z", amount: -Math.PI / 2 },
];

let scramble = [];
let busy = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(3.6, 3.2, 4.4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
host.appendChild(renderer.domElement);

const light1 = new THREE.DirectionalLight(0xffffff, 0.9);
light1.position.set(4, 6, 5);
scene.add(light1);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const sticker = {
  U: "#f8fafc", // white
  D: "#facc15", // yellow
  F: "#22c55e", // green
  B: "#3b82f6", // blue
  R: "#ef4444", // red
  L: "#f97316", // orange
};

function faceTexture(color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, 256, 256);

  const pad = 18;
  const gap = 10;
  const cell = (256 - pad * 2 - gap * 2) / 3;
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 3; col++) {
      const x = pad + col * (cell + gap);
      const y = pad + r * (cell + gap);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cell, cell);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeRect(x, y, cell, cell);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const materials = [
  new THREE.MeshStandardMaterial({ map: faceTexture(sticker.R), roughness: 0.65, metalness: 0.05 }), // +x
  new THREE.MeshStandardMaterial({ map: faceTexture(sticker.L), roughness: 0.65, metalness: 0.05 }), // -x
  new THREE.MeshStandardMaterial({ map: faceTexture(sticker.U), roughness: 0.65, metalness: 0.05 }), // +y
  new THREE.MeshStandardMaterial({ map: faceTexture(sticker.D), roughness: 0.65, metalness: 0.05 }), // -y
  new THREE.MeshStandardMaterial({ map: faceTexture(sticker.F), roughness: 0.65, metalness: 0.05 }), // +z
  new THREE.MeshStandardMaterial({ map: faceTexture(sticker.B), roughness: 0.65, metalness: 0.05 }), // -z
];

const cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), materials);
cubeGroup.add(cubeMesh);
cubeGroup.rotation.set(-0.5, -0.65, 0);

function resize() {
  const w = host.clientWidth || 300;
  const h = host.clientHeight || 300;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();

function render() {
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setBusy(v) {
  busy = v;
  mixBtn.disabled = v;
  solveBtn.disabled = v || scramble.length === 0;
}

function randomMove() {
  return moves[Math.floor(Math.random() * moves.length)];
}

function inverseMove(m) {
  return { axis: m.axis, amount: -m.amount };
}

async function animateMove(move) {
  const start = cubeGroup.rotation[move.axis];
  const end = start + move.amount;
  const started = performance.now();

  return new Promise((resolve) => {
    function tick(now) {
      const t = Math.min(1, (now - started) / MOVE_MS);
      const ease = 1 - Math.pow(1 - t, 3);
      cubeGroup.rotation[move.axis] = start + (end - start) * ease;
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

async function runMoves(sequence) {
  for (const m of sequence) {
    await animateMove(m);
    await sleep(20);
  }
}

async function onMix() {
  if (busy) return;
  setBusy(true);
  statusEl.textContent = "Mixing...";

  cubeGroup.rotation.set(-0.5, -0.65, 0);
  scramble = Array.from({ length: 18 }, () => randomMove());
  await runMoves(scramble);

  statusEl.textContent = "Mixed. Tap Solve to solve it.";
  setBusy(false);
}

async function onSolve() {
  if (busy || scramble.length === 0) return;
  setBusy(true);
  statusEl.textContent = "Solving...";

  const solution = [...scramble].reverse().map(inverseMove);
  await runMoves(solution);

  scramble = [];
  statusEl.textContent = "Solved ✅";
  setBusy(false);
}

mixBtn.addEventListener("click", onMix);
solveBtn.addEventListener("click", onSolve);

statusEl.textContent = "Ready (solved)";
