import { buildLayout, beltFits, beltCapacityFor } from '../assets/scripts/core/Layout.ts';
import { solve, settle } from '../assets/scripts/core/Solver.ts';
import { createState, load, freeStart } from '../assets/scripts/core/Rules.ts';

const fail = msg => { console.error(msg); process.exit(1); };
const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = Number(process.argv[i + 1]);
  if (!Number.isInteger(v) || v < 0) fail(`--${name} needs a whole number`);
  return v;
};
const N = arg('trucks', 6), K = arg('colors', 3), CAP = arg('capacity', 15);
let BELT = arg('belt', 0);
let ONBELT = arg('onbelt', -1);
const SPARE = 0;
if (arg('spare', 0) !== 0) fail('--spare is gone: every truck must end up full, so a level has no spare room');
const MIX = arg('mix', 40);
const MINLOAD = arg('minload', 0);
const LIMIT = arg('limit', 0);
let seed = arg('seed', 1) >>> 0;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const ALL_COLORS = { M: '#F224F2', O: '#F2682A', W: '#FFF1F8', B: '#3A7BF2', G: '#35C24A', Y: '#F5C52A', R: '#DD0705', C: '#32DDE6', P: '#BB62E0' };
const paletteAt = process.argv.indexOf('--palette');
const PICK = paletteAt < 0 ? ['M', 'O', 'W', 'B', 'G', 'Y'] : process.argv[paletteAt + 1].split(',');
for (const k of PICK) if (!ALL_COLORS[k]) fail(`--palette: unknown colour "${k}" (have ${Object.keys(ALL_COLORS).join(', ')})`);
const PALETTE = PICK.map(k => [k, ALL_COLORS[k]]);
if (K < 1 || K > PALETTE.length || N < K) fail(`need 1 <= colors <= ${PALETTE.length} and trucks >= colors`);
if (CAP < 1) fail('capacity must be at least 1');

const SHAPES = {
  rect: { points: [[-3.1, 5.7], [3.1, 5.7], [3.1, 1], [-3.1, 1]], radius: 1.3, width: 0.65 },
  small: { points: [[-2.2, 4.4], [2.2, 4.4], [2.2, 1], [-2.2, 1]], radius: 1.1, width: 0.65 },
  house: { points: [[-3.3, 4], [0, 7.4], [3.3, 4], [3.3, 1], [-3.3, 1]], radius: 1.1, width: 0.65 },
  horseshoe: { points: [[-3.4, 5.6], [-1.3, 5.6], [-1.3, 3.3], [1.3, 3.3], [1.3, 5.6], [3.4, 5.6], [3.4, 1], [-3.4, 1]], radius: 1.0, width: 0.65 },
  hourglass: { points: [[-3.3, 6.6], [3.3, 6.6], [1.4, 3.8], [3.3, 1], [-3.3, 1], [-1.4, 3.8]], radius: 0.9, width: 0.65 },
  crown: { points: [[-3.4, 6.6], [0, 3.6], [3.4, 6.6], [3.4, 1], [-3.4, 1]], radius: 0.9, width: 0.65 },

  horns: { points: [[-3.5, 7.6], [-2.1, 7.6], [-1.5, 4.4], [1.5, 4.4], [2.1, 7.6], [3.5, 7.6], [3.0, 3.2], [2.0, 1], [-2.0, 1], [-3.0, 3.2]], radius: 0.6, width: 0.65 },

  dog: { points: [[-3.7, 6.6], [-2.5, 6.6], [-2.3, 4.9], [0.6, 4.9], [0.8, 6.3], [0.8, 7.5], [1.9, 7.5], [2.1, 6.6], [3.7, 6.4], [3.7, 5.3], [2.3, 5.1], [2.3, 3.6], [2.4, 1], [1.1, 1], [1.0, 2.9], [-1.6, 2.9], [-1.7, 1], [-3.0, 1], [-3.4, 3.9]], radius: 0.45, width: 0.65 },
};

const r2 = v => Math.round(v * 100) / 100;
const lift = pts => { const low = Math.min(...pts.map(p => p[1])); return pts.map(p => p.length > 2 ? [r2(p[0]), r2(p[1] - low + 1), r2(p[2])] : [r2(p[0]), r2(p[1] - low + 1)]); };
const arc = (cx, cy, r, from, to, steps) => Array.from({ length: steps }, (_, k) => { const a = from + ((to - from) * k) / steps; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

SHAPES.infinity = (() => {
  const N = 72, A = 3.6, TALL = 1.6, BRIDGE = 0.75, RAMP = 3.0;
  const pts = Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2, k = 1 + Math.sin(t) ** 2; return [(A * Math.cos(t)) / k, (TALL * A * Math.sin(t) * Math.cos(t)) / k]; });
  const top = N / 4, dist = new Array(N).fill(Infinity);
  dist[top] = 0;
  for (let i = top + 1, d = 0; i < top + N / 2; i++) { d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); dist[i] = d; }
  for (let i = top - 1, d = 0; i > top - N / 2; i--) { const a = pts[(i + N) % N], b = pts[(i + 1 + N) % N]; d += Math.hypot(a[0] - b[0], a[1] - b[1]); dist[(i + N) % N] = d; }
  return { points: lift(pts.map((p, i) => [p[0], p[1], dist[i] < RAMP ? BRIDGE * (0.5 + 0.5 * Math.cos((Math.PI * dist[i]) / RAMP)) : 0])), radius: 0.2, width: 0.65 };
})();

SHAPES.clover = (() => {
  const S = 1.1, R = 0.9 * S, D = 2.1 * S, F = 0.6 * S;
  const c = (D + Math.sqrt(2 * (R + F) ** 2 - D * D)) / 2;
  const open = Math.atan2(c, c - D);
  const out = [];
  for (let q = 0; q < 4; q++) {
    const turn = -q * Math.PI / 2, co = Math.cos(turn), si = Math.sin(turn);
    const piece = [...arc(D, 0, R, open, -open, 20), ...arc(c, -c, F, Math.PI - open, open + Math.PI / 2, 8)];
    for (const [x, y] of piece) out.push([x * co - y * si, x * si + y * co]);
  }
  return { points: lift(out), radius: 0, width: 0.65 };
})();

SHAPES.spiral = (() => {
  const turns = 1.35, steps = 80, half = 0.5;
  const ang = i => (i / steps) * turns * Math.PI * 2 - Math.PI * 0.2, rad = i => 0.9 + 1.8 * ((i / steps) * turns);
  const at = (i, off) => [(rad(i) + off) * Math.cos(ang(i)), (rad(i) + off) * Math.sin(ang(i))];
  const out = [];
  for (let i = steps; i >= 0; i--) out.push(at(i, half));
  out.push(...arc(...at(0, 0), half, ang(0), ang(0) - Math.PI, 10).slice(1));
  for (let i = 0; i <= steps; i++) out.push(at(i, -half));
  out.push(...arc(...at(steps, 0), half, ang(steps) + Math.PI, ang(steps), 10).slice(1));
  return { points: lift(out), radius: 0, width: 0.65 };
})();
const shapeAt = process.argv.indexOf('--shape');
const SHAPE = shapeAt < 0 ? 'rect' : process.argv[shapeAt + 1];
if (!SHAPES[SHAPE]) fail(`--shape must be one of: ${Object.keys(SHAPES).join(', ')}`);
const text = name => { const i = process.argv.indexOf('--' + name); return i < 0 ? null : process.argv[i + 1]; };
const WIDTH = text('width') === null ? SHAPES[SHAPE].width : Number(text('width'));

const FIT = beltCapacityFor({ ...SHAPES[SHAPE], width: WIDTH });
if (!BELT) BELT = FIT;
if (!beltFits({ beltCapacity: BELT, beltPath: { ...SHAPES[SHAPE], width: WIDTH } })) fail(`--belt ${BELT} does not suit the "${SHAPE}" belt's length: use about ${FIT} (or leave --belt out)`);
if (ONBELT < 0) ONBELT = Math.max(0, BELT - 2);
if (N > BELT) fail('each truck needs its own belt slot: trucks must be <= belt');
if (ONBELT > BELT) fail('onbelt must be <= belt');
if (LIMIT > BELT) fail('--limit must be <= the belt capacity');
if (LIMIT && ONBELT > LIMIT) ONBELT = LIMIT;
if (ONBELT > N * (CAP - 1)) fail(`onbelt (${ONBELT}) must be <= trucks * (capacity - 1) (${N * (CAP - 1)})`);
if (!(WIDTH > 0)) fail('--width needs a positive number');
const PLACES = text('places') === null ? null : text('places').split(';').map(p => p.split(',').map(Number));
if (PLACES && (PLACES.length !== N || PLACES.some(p => p.length !== 3 || p.some(v => !isFinite(v))))) fail(`--places needs ${N} entries of x,y,angle separated by ';', one per truck`);

for (let attempt = 0; attempt < 300; attempt++) {

  const trucks = Array.from({ length: N }, (_, i) => new Array(CAP).fill(PALETTE[i % K][0]));
  const belt = [];
  for (let r = 0; r < SPARE + ONBELT; r++) {
    const t = trucks[Math.floor(rnd() * N)];
    if (t.length <= 1) { r--; continue; }
    const c = t.pop();
    if (belt.length < ONBELT) belt.push(c);
  }
  const cells = [];
  trucks.forEach((t, ti) => t.forEach((_, i) => cells.push([t, i])));
  belt.forEach((_, i) => cells.push([belt, i]));
  for (let m = 0; m < MIX; m++) {
    const a = cells[Math.floor(rnd() * cells.length)], b = cells[Math.floor(rnd() * cells.length)];
    const tmp = a[0][a[1]]; a[0][a[1]] = b[0][b[1]]; b[0][b[1]] = tmp;
  }
  const level = {
    caption: 'Harder than you think', tapsToRedirect: -1,
    ...(process.argv.includes('--match') ? { matchTruckColor: true } : {}),
    truckCapacity: CAP, beltCapacity: BELT, ...(LIMIT ? { beltLimit: LIMIT } : {}),
    colors: Object.fromEntries(PALETTE.slice(0, K)),
    trucks: trucks.map(t => t.join('')), belt: belt.join(''),
    ...(PLACES ? { truckPlaces: PLACES } : {}),
    beltPath: { ...SHAPES[SHAPE], width: WIDTH },
  };
  const gates = buildLayout(level).gates;
  const opening = createState(level, gates);
  settle(opening);
  if (load(opening) < MINLOAD) continue;

  level.trucks = opening.trucks.map(t => t.join(''));
  level.belt = opening.ring.filter(Boolean).join('');
  if (freeStart(level).length) continue;
  const sol = solve(level, gates, 60000);
  if (sol && sol.length >= 4) {
    console.error(`attempt ${attempt + 1}: belt starts at ${load(opening)}/${BELT}, solvable in ${sol.length} taps: ${sol.map(t => t + 1).join(' ')}`);
    console.log(JSON.stringify(level, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)(?:,\s+(-?[\d.]+))?\s+\]/g, (m, a, b, c) => c === undefined ? `[${a}, ${b}]` : `[${a}, ${b}, ${c}]`));
    process.exit(0);
  }
}
console.error('No solvable level found with these settings; lower --mix or --onbelt.');
process.exit(1);
