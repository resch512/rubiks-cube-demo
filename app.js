import "https://esm.sh/cubing/twisty";

const cube = document.getElementById("cube");
const mixBtn = document.getElementById("mixBtn");
const solveBtn = document.getElementById("solveBtn");
const statusEl = document.getElementById("status");

const MOVES = ["U", "D", "L", "R", "F", "B"];
const SUFFIX = ["", "'", "2"];
const MOVE_MS = 500;

let scrambleMoves = [];
let busy = false;

function setBusy(v) {
  busy = v;
  mixBtn.disabled = v;
  solveBtn.disabled = v || scrambleMoves.length === 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function generateScramble(length = 20) {
  const out = [];
  let prevFace = "";

  while (out.length < length) {
    const face = MOVES[randomInt(MOVES.length)];
    if (face === prevFace) continue;
    prevFace = face;
    out.push(face + SUFFIX[randomInt(SUFFIX.length)]);
  }

  return out;
}

function inverseMove(move) {
  if (move.endsWith("2")) return move;
  if (move.endsWith("'")) return move.slice(0, -1);
  return `${move}'`;
}

function inverseAlg(moves) {
  return [...moves].reverse().map(inverseMove);
}

async function animateMoves(moves) {
  for (const move of moves) {
    cube.alg = move;
    cube.play();
    await sleep(MOVE_MS);
  }
}

async function resetSolved() {
  cube.experimentalSetupAlg = "";
  cube.alg = "";
  cube.pause();
  cube.jumpToStart();
  await sleep(30);
}

async function onMix() {
  if (busy) return;
  setBusy(true);
  statusEl.textContent = "Mixing...";

  await resetSolved();
  scrambleMoves = generateScramble(20);
  await animateMoves(scrambleMoves);

  statusEl.textContent = "Mixed. Tap Solve to solve it.";
  setBusy(false);
}

async function onSolve() {
  if (busy || scrambleMoves.length === 0) return;
  setBusy(true);
  statusEl.textContent = "Solving...";

  const solution = inverseAlg(scrambleMoves);
  await animateMoves(solution);

  scrambleMoves = [];
  statusEl.textContent = "Solved ✅";
  setBusy(false);
}

mixBtn.addEventListener("click", onMix);
solveBtn.addEventListener("click", onSolve);

statusEl.textContent = "Ready (solved)";
