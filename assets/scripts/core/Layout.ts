import type { LevelData, BeltPathData } from './Level';
import { buildPath } from './Path';
import type { Path } from './Path';

export * from './Path';

export interface TruckSlot {
  x: number; top: number; bottom: number; width: number;
  mx: number; my: number; fx: number; fy: number; cx: number; cy: number; length: number;
}

export interface Layout {
  path: Path;
  trucks: TruckSlot[];
  gates: number[];
  phase: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  unit: number;
}

export const TRUCK_PITCH = 1.25;
export const TRUCK_WIDTH = 0.9;
export const TRUCK_GAP = 0.6;
export const UNIT = 0.468;

export const SLOT_LENGTH = 1.26;
const SLOT_MIN = 1.15, SLOT_MAX = 1.4;

export function beltCapacityFor(d: BeltPathData): number {
  return Math.max(1, Math.round(buildPath(d).length / SLOT_LENGTH));
}

export function beltFits(l: LevelData): boolean {
  const pitch = buildPath(l.beltPath).length / l.beltCapacity;
  return pitch >= SLOT_MIN && pitch <= SLOT_MAX;
}

export function buildLayout(l: LevelData): Layout {
  const path = buildPath(l.beltPath);
  const half = l.beltPath.width / 2;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < 400; i++) {
    const p = path.at(i / 400);
    minX = Math.min(minX, p.x - half); maxX = Math.max(maxX, p.x + half);
    minY = Math.min(minY, p.y - half); maxY = Math.max(maxY, p.y + half);
  }
  const n = l.trucks.length, slots = l.beltCapacity;
  if (n > slots) throw new Error(`${n} trucks need ${n} gate slots but beltCapacity is ${slots}`);
  const cx = (minX + maxX) / 2;
  const top = minY - TRUCK_GAP;
  const bottom = top - l.truckCapacity * UNIT;

  let pitch = Math.min(TRUCK_PITCH, (maxX - minX + 1.5) / (n - 1 + TRUCK_WIDTH / TRUCK_PITCH));

  const places = l.truckPlaces;
  if (places) pitch = TRUCK_PITCH;
  const length = l.truckCapacity * UNIT;
  const width = (TRUCK_WIDTH * pitch) / TRUCK_PITCH;
  const trucks: TruckSlot[] = [];
  const raw: number[] = [];
  for (let i = 0; i < n; i++) {

    const mx = places ? places[i][0] : cx + (i - (n - 1) / 2) * pitch, my = places ? places[i][1] : top;
    const ang = ((places ? places[i][2] : 90) * Math.PI) / 180;
    const fx = places ? Math.cos(ang) : 0, fy = places ? Math.sin(ang) : 1;
    const ex = mx - fx * length, ey = my - fy * length;
    trucks.push({ x: (mx + ex) / 2, top: Math.max(my, ey), bottom: Math.min(my, ey), width, mx, my, fx, fy, cx: (mx + ex) / 2, cy: (my + ey) / 2, length });

    let g = path.nearest({ x: mx, y: my }) * slots;
    if (i > 0) { while (g - raw[0] > slots / 2) g -= slots; while (g - raw[0] < -slots / 2) g += slots; }
    raw.push(g);
  }

  const order = raw.map((_, i) => i).sort((a, b) => raw[a] - raw[b]);
  let best: number[] = [], phase = 0, bestCost = Infinity;
  for (let step = -10; step < 10; step++) {
    const ph = step / 20;
    const seq: number[] = new Array(n);
    let prev = -Infinity, drift = 0;
    for (const i of order) {
      prev = Math.max(Math.round(raw[i] - ph), prev + 1);
      seq[i] = prev;
      drift += raw[i] - prev - ph;
    }

    const slide = Math.round(drift / n);
    let cost = 0;
    for (let i = 0; i < n; i++) { seq[i] += slide; cost += (raw[i] - seq[i] - ph) ** 2; }
    if (cost < bestCost - 1e-9) { bestCost = cost; best = seq; phase = ph; }
  }
  const gates = best.map(g => ((g % slots) + slots) % slots);

  const inTruck = (t: TruckSlot, x: number, y: number) => ({ along: -((x - t.mx) * t.fx + (y - t.my) * t.fy), across: (x - t.mx) * t.fy - (y - t.my) * t.fx });
  const corners = (t: TruckSlot, extra: number) => [[0, -1], [0, 1], [1, -1], [1, 1]].map(([a, s]) => ({
    x: t.mx - t.fx * a * (t.length + extra) + t.fy * s * t.width / 2, y: t.my - t.fy * a * (t.length + extra) - t.fx * s * t.width / 2 }));
  trucks.forEach((t, i) => {
    for (let k = 0; k < 400; k++) {
      const p = path.at(k / 400), q = inTruck(t, p.x, p.y);
      if (q.along > -half && q.along < t.length + half && Math.abs(q.across) < t.width / 2 + half) throw new Error(`Truck ${i + 1} lies on the belt: move it in truckPlaces`);
    }
    for (let j = 0; j < i; j++) {

      const apart = (a: TruckSlot, b: TruckSlot) => {
        const qs = corners(b, 0).map(c => inTruck(a, c.x, c.y));
        return qs.every(q => q.along <= 0) || qs.every(q => q.along >= a.length) || qs.every(q => q.across <= -a.width / 2) || qs.every(q => q.across >= a.width / 2);
      };
      if (!apart(t, trucks[j]) && !apart(trucks[j], t)) throw new Error(`Trucks ${j + 1} and ${i + 1} overlap: move them apart in truckPlaces`);
    }
    for (const c of corners(t, 0.5)) {
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    }
  });
  return { path, trucks, gates, phase, bounds: { minX, maxX, minY, maxY }, unit: UNIT };
}
