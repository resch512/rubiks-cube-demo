const host = document.getElementById("cube");
const mixBtn = document.getElementById("mixBtn");
const solveBtn = document.getElementById("solveBtn");
const statusEl = document.getElementById("status");

const MOVE_MS = 500;
const FACE_MOVES = ["U", "D", "L", "R", "F", "B"];
const SUFFIXES = ["", "'", "2"];

const COLORS = {
  U: "#f8fafc", // white
  D: "#facc15", // yellow
  F: "#22c55e", // green
  B: "#3b82f6", // blue
  R: "#ef4444", // red
  L: "#f97316", // orange
};

const FACE_DEF = {
  U: { axis: "y", layer: 1, baseDir: 1 },
  D: { axis: "y", layer: -1, baseDir: -1 },
  R: { axis: "x", layer: 1, baseDir: -1 },
  L: { axis: "x", layer: -1, baseDir: 1 },
  F: { axis: "z", layer: 1, baseDir: 1 },
  B: { axis: "z", layer: -1, baseDir: -1 },
};

const viewRot = { x: -0.58, y: -0.68, z: 0 };
const spacing = 0.72;
const half = 0.28;

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
host.appendChild(canvas);

let cubies = [];
let scramble = [];
let busy = false;
let animState = null;

function initCubies() {
  cubies = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const stickers = {};
        if (y === 1) stickers.U = COLORS.U;
        if (y === -1) stickers.D = COLORS.D;
        if (z === 1) stickers.F = COLORS.F;
        if (z === -1) stickers.B = COLORS.B;
        if (x === 1) stickers.R = COLORS.R;
        if (x === -1) stickers.L = COLORS.L;
        cubies.push({ pos: { x, y, z }, stickers });
      }
    }
  }
}

function resize() {
  const rect = host.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(280, Math.floor(rect.width * dpr));
  canvas.height = Math.max(280, Math.floor(rect.height * dpr));
  canvas.style.width = `${Math.max(280, Math.floor(rect.width))}px`;
  canvas.style.height = `${Math.max(280, Math.floor(rect.height))}px`;
}
window.addEventListener("resize", resize);
resize();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setBusy(v) {
  busy = v;
  mixBtn.disabled = v;
  solveBtn.disabled = v || scramble.length === 0;
}

function randomMoveToken() {
  return FACE_MOVES[Math.floor(Math.random() * FACE_MOVES.length)] + SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
}

function parseMove(token) {
  const face = token[0];
  const suff = token.slice(1);
  let turns = 1;
  let sign = 1;
  if (suff === "'") sign = -1;
  if (suff === "2") turns = 2;
  const def = FACE_DEF[face];
  return {
    axis: def.axis,
    layer: def.layer,
    dir: def.baseDir * sign,
    turns,
  };
}

function invertToken(token) {
  if (token.endsWith("2")) return token;
  return token.endsWith("'") ? token[0] : `${token[0]}'`;
}

function rotateVec(v, axis, dir) {
  const { x, y, z } = v;
  if (axis === "x") return dir === 1 ? { x, y: -z, z: y } : { x, y: z, z: -y };
  if (axis === "y") return dir === 1 ? { x: z, y, z: -x } : { x: -z, y, z: x };
  return dir === 1 ? { x: -y, y: x, z } : { x: y, y: -x, z };
}

function rotateStickerFace(face, axis, dir) {
  const n = {
    U: { x: 0, y: 1, z: 0 },
    D: { x: 0, y: -1, z: 0 },
    F: { x: 0, y: 0, z: 1 },
    B: { x: 0, y: 0, z: -1 },
    R: { x: 1, y: 0, z: 0 },
    L: { x: -1, y: 0, z: 0 },
  }[face];
  const r = rotateVec(n, axis, dir);
  if (r.y === 1) return "U";
  if (r.y === -1) return "D";
  if (r.z === 1) return "F";
  if (r.z === -1) return "B";
  if (r.x === 1) return "R";
  return "L";
}

function commitQuarterTurn(axis, layer, dir) {
  cubies.forEach((c) => {
    if (c.pos[axis] !== layer) return;
    c.pos = rotateVec(c.pos, axis, dir);
    const next = {};
    Object.entries(c.stickers).forEach(([face, color]) => {
      next[rotateStickerFace(face, axis, dir)] = color;
    });
    c.stickers = next;
  });
}

function rotXYZ(p, r) {
  let { x, y, z } = p;
  const sx = Math.sin(r.x), cx = Math.cos(r.x);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  const sy = Math.sin(r.y), cy = Math.cos(r.y);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const sz = Math.sin(r.z), cz = Math.cos(r.z);
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  return { x, y, z };
}

function applyAxisAngle(p, axis, angle) {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  if (axis === "x") return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
  if (axis === "y") return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

function project(p, w, h, scale) {
  const dist = 8;
  const f = scale / (dist - p.z);
  return { x: w / 2 + p.x * f, y: h / 2 - p.y * f, z: p.z };
}

function faceGeom(face) {
  if (face === "F") return { n: { x: 0, y: 0, z: 1 }, corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] };
  if (face === "B") return { n: { x: 0, y: 0, z: -1 }, corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] };
  if (face === "R") return { n: { x: 1, y: 0, z: 0 }, corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] };
  if (face === "L") return { n: { x: -1, y: 0, z: 0 }, corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] };
  if (face === "U") return { n: { x: 0, y: 1, z: 0 }, corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] };
  return { n: { x: 0, y: -1, z: 0 }, corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] };
}

function render() {
  const w = canvas.width;
  const h = canvas.height;
  const scale = Math.min(w, h) * 0.9;
  ctx.clearRect(0, 0, w, h);

  const polys = [];

  for (const c of cubies) {
    const center = { x: c.pos.x * spacing, y: c.pos.y * spacing, z: c.pos.z * spacing };
    const inActiveLayer = animState && c.pos[animState.axis] === animState.layer;

    for (const [face, color] of Object.entries(c.stickers)) {
      const g = faceGeom(face);
      let normal = { ...g.n };
      let points = g.corners.map(([x, y, z]) => ({ x: x * half + center.x, y: y * half + center.y, z: z * half + center.z }));

      if (inActiveLayer) {
        points = points.map((p) => applyAxisAngle(p, animState.axis, animState.angle));
        normal = applyAxisAngle(normal, animState.axis, animState.angle);
      }

      points = points.map((p) => rotXYZ(p, viewRot));
      normal = rotXYZ(normal, viewRot);

      if (normal.z <= 0) continue;

      const poly2 = points.map((p) => project(p, w, h, scale));
      const depth = points.reduce((s, p) => s + p.z, 0) / points.length;
      polys.push({ poly2, color, depth });
    }
  }

  polys.sort((a, b) => a.depth - b.depth);

  for (const p of polys) {
    const poly = p.poly2;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  requestAnimationFrame(render);
}

async function animateQuarter(axis, layer, dir) {
  const started = performance.now();
  return new Promise((resolve) => {
    function tick(now) {
      const t = Math.min(1, (now - started) / MOVE_MS);
      const ease = 1 - Math.pow(1 - t, 3);
      animState = { axis, layer, angle: dir * ease * (Math.PI / 2) };
      if (t < 1) requestAnimationFrame(tick);
      else {
        animState = null;
        commitQuarterTurn(axis, layer, dir);
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

async function runToken(token) {
  const m = parseMove(token);
  for (let i = 0; i < m.turns; i++) {
    await animateQuarter(m.axis, m.layer, m.dir);
    await sleep(15);
  }
}

async function runMoves(tokens) {
  for (const t of tokens) await runToken(t);
}

async function onMix() {
  if (busy) return;
  setBusy(true);
  statusEl.textContent = "Mixing...";

  initCubies();
  scramble = Array.from({ length: 20 }, () => randomMoveToken());
  await runMoves(scramble);

  statusEl.textContent = "Mixed. Tap Solve to solve it.";
  setBusy(false);
}

async function onSolve() {
  if (busy || scramble.length === 0) return;
  setBusy(true);
  statusEl.textContent = "Solving...";

  const solution = [...scramble].reverse().map(invertToken);
  await runMoves(solution);

  scramble = [];
  statusEl.textContent = "Solved ✅";
  setBusy(false);
}

mixBtn.addEventListener("click", onMix);
solveBtn.addEventListener("click", onSolve);

initCubies();
statusEl.textContent = "Ready (solved)";
render();