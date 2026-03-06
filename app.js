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

const colors = {
  U: "#f8fafc", // white
  D: "#facc15", // yellow
  F: "#22c55e", // green
  B: "#3b82f6", // blue
  R: "#ef4444", // red
  L: "#f97316", // orange
};

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
host.appendChild(canvas);

let scramble = [];
let busy = false;
let rot = { x: -0.55, y: -0.7, z: 0 };

function resize() {
  const rect = host.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(260, Math.floor(rect.width * dpr));
  canvas.height = Math.max(260, Math.floor(rect.height * dpr));
  canvas.style.width = `${Math.max(260, Math.floor(rect.width))}px`;
  canvas.style.height = `${Math.max(260, Math.floor(rect.height))}px`;
}
window.addEventListener("resize", resize);
resize();

function setBusy(v) {
  busy = v;
  mixBtn.disabled = v;
  solveBtn.disabled = v || scramble.length === 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomMove() {
  return moves[Math.floor(Math.random() * moves.length)];
}

function inverseMove(m) {
  return { axis: m.axis, amount: -m.amount };
}

function rotatePoint(p, r) {
  let { x, y, z } = p;

  // X
  let cy = Math.cos(r.x), sy = Math.sin(r.x);
  [y, z] = [y * cy - z * sy, y * sy + z * cy];

  // Y
  let cx = Math.cos(r.y), sx = Math.sin(r.y);
  [x, z] = [x * cx + z * sx, -x * sx + z * cx];

  // Z
  let cz = Math.cos(r.z), sz = Math.sin(r.z);
  [x, y] = [x * cz - y * sz, x * sz + y * cz];

  return { x, y, z };
}

function project(p, w, h, scale) {
  const distance = 4.2;
  const f = scale / (distance - p.z);
  return { x: w / 2 + p.x * f, y: h / 2 - p.y * f, z: p.z };
}

function faceNormal(face) {
  const a = face[0], b = face[1], c = face[2];
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  return {
    x: u.y * v.z - u.z * v.y,
    y: u.z * v.x - u.x * v.z,
    z: u.x * v.y - u.y * v.x,
  };
}

function drawFace(poly, color) {
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#111827";
  ctx.stroke();

  // draw 3x3 sticker grid
  for (let i = 1; i < 3; i++) {
    const t = i / 3;
    const pA = {
      x: poly[0].x + (poly[1].x - poly[0].x) * t,
      y: poly[0].y + (poly[1].y - poly[0].y) * t,
    };
    const pB = {
      x: poly[3].x + (poly[2].x - poly[3].x) * t,
      y: poly[3].y + (poly[2].y - poly[3].y) * t,
    };
    ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pB.x, pB.y); ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke();

    const pC = {
      x: poly[0].x + (poly[3].x - poly[0].x) * t,
      y: poly[0].y + (poly[3].y - poly[0].y) * t,
    };
    const pD = {
      x: poly[1].x + (poly[2].x - poly[1].x) * t,
      y: poly[1].y + (poly[2].y - poly[1].y) * t,
    };
    ctx.beginPath(); ctx.moveTo(pC.x, pC.y); ctx.lineTo(pD.x, pD.y); ctx.stroke();
  }
}

function render() {
  const w = canvas.width;
  const h = canvas.height;
  const scale = Math.min(w, h) * 0.65;
  ctx.clearRect(0, 0, w, h);

  const verts = [
    { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 }, { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 },  { x: 1, y: -1, z: 1 },  { x: 1, y: 1, z: 1 },  { x: -1, y: 1, z: 1 },
  ].map((p) => rotatePoint(p, rot));

  const faces = [
    { idx: [4,5,6,7], color: colors.F }, // front
    { idx: [1,0,3,2], color: colors.B }, // back
    { idx: [5,1,2,6], color: colors.R }, // right
    { idx: [0,4,7,3], color: colors.L }, // left
    { idx: [7,6,2,3], color: colors.U }, // top
    { idx: [0,1,5,4], color: colors.D }, // bottom
  ].map((f) => {
    const poly3 = f.idx.map((i) => verts[i]);
    const centerZ = poly3.reduce((s, p) => s + p.z, 0) / 4;
    return { ...f, poly3, centerZ, normal: faceNormal(poly3) };
  });

  faces
    .filter((f) => f.normal.z < 0)
    .sort((a, b) => a.centerZ - b.centerZ)
    .forEach((f) => drawFace(f.poly3.map((p) => project(p, w, h, scale)), f.color));

  requestAnimationFrame(render);
}

async function animateMove(move) {
  const start = rot[move.axis];
  const end = start + move.amount;
  const started = performance.now();

  return new Promise((resolve) => {
    function tick(now) {
      const t = Math.min(1, (now - started) / MOVE_MS);
      const ease = 1 - Math.pow(1 - t, 3);
      rot[move.axis] = start + (end - start) * ease;
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

async function runMoves(sequence) {
  for (const m of sequence) {
    await animateMove(m);
    await sleep(15);
  }
}

async function onMix() {
  if (busy) return;
  setBusy(true);
  statusEl.textContent = "Mixing...";

  rot = { x: -0.55, y: -0.7, z: 0 };
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
render();
