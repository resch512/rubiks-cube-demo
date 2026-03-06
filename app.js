const cube = document.getElementById("cube");
const mixBtn = document.getElementById("mixBtn");
const solveBtn = document.getElementById("solveBtn");
const statusEl = document.getElementById("status");

const MOVE_MS = 500;
const faces = [
  ["front", "#22c55e"],
  ["back", "#3b82f6"],
  ["right", "#ef4444"],
  ["left", "#f97316"],
  ["top", "#f8fafc"],
  ["bottom", "#facc15"],
];

const moves = [
  { axis: "x", amount: 90 },
  { axis: "x", amount: -90 },
  { axis: "y", amount: 90 },
  { axis: "y", amount: -90 },
  { axis: "z", amount: 90 },
  { axis: "z", amount: -90 },
];

let rotation = { x: -24, y: -30, z: 0 };
let scramble = [];
let busy = false;

function buildCube() {
  faces.forEach(([name, color]) => {
    const face = document.createElement("div");
    face.className = `face ${name}`;

    for (let i = 0; i < 9; i++) {
      const sticker = document.createElement("div");
      sticker.className = "sticker";
      sticker.style.background = color;
      face.appendChild(sticker);
    }

    cube.appendChild(face);
  });
}

function applyRotation() {
  cube.style.transform = `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setBusy(v) {
  busy = v;
  mixBtn.disabled = v;
  solveBtn.disabled = v || scramble.length === 0;
}

function randomMove() {
  return moves[Math.floor(Math.random() * moves.length)];
}

function inverseMove(move) {
  return { axis: move.axis, amount: -move.amount };
}

async function runMoves(sequence) {
  for (const move of sequence) {
    rotation[move.axis] += move.amount;
    applyRotation();
    await sleep(MOVE_MS);
  }
}

async function onMix() {
  if (busy) return;
  setBusy(true);
  statusEl.textContent = "Mixing...";

  rotation = { x: -24, y: -30, z: 0 };
  applyRotation();
  await sleep(80);

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

buildCube();
applyRotation();
mixBtn.addEventListener("click", onMix);
solveBtn.addEventListener("click", onSolve);
