import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPath, buildLayout, beltCapacityFor, beltFits, SLOT_LENGTH } from '../assets/scripts/core/Layout';
import { mk } from './helpers';

const rect = { points: [[-3, 6], [3, 6], [3, 1], [-3, 1]], radius: 1.2, width: 0.9 };
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('rounded rectangle path length matches the perimeter formula', () => {
  const expected = 2 * (6 + 5) - 8 * 1.2 + 2 * Math.PI * 1.2;
  near(buildPath(rect).length, expected, expected * 0.01);
});
test('path is closed: the end meets the start', () => {
  const p = buildPath(rect);
  near(p.at(0).x, p.at(0.99999).x, 0.01);
  near(p.at(0).y, p.at(0.99999).y, 0.01);
});
test('nearest() inverts at()', () => {
  const p = buildPath(rect);
  for (const f of [0.05, 0.3, 0.52, 0.77, 0.93]) near(p.nearest(p.at(f)), f, 0.005);
});
test('a radius too large for the edges is clamped instead of producing NaN', () => {
  const p = buildPath({ points: [[0, 0], [2, 0], [2, 2], [0, 2]], radius: 50, width: 0.5 });
  assert.ok(Number.isFinite(p.length) && p.length > 0);
  assert.ok(Number.isFinite(p.at(0.4).x));
});
test('a non-rectangular path (triangle) builds and stays closed', () => {
  const p = buildPath({ points: [[0, 5], [4, 0], [-4, 0]], radius: 0.8, width: 0.9 });
  near(p.at(0).x, p.at(0.99999).x, 0.01);
  assert.ok(p.length > 10);
});
test('layout has one truck per level truck, below the belt', () => {
  const l = buildLayout(mk({ trucks: ['M', 'O', 'W', 'M', 'O'], truckCapacity: 15 }));
  assert.equal(l.trucks.length, 5);
  for (const t of l.trucks) assert.ok(t.top < 1 - 0.45, 'truck mouth is below the belt');
  near(l.trucks[0].top - l.trucks[0].bottom, 15 * l.unit, 1e-9);
});
test('gates are unique even when trucks crowd a short belt', () => {
  const l = buildLayout(mk({ trucks: 'MOWMOWMOWM'.split(''), beltCapacity: 12 }));
  assert.equal(new Set(l.gates).size, 10);
  for (const g of l.gates) assert.ok(g >= 0 && g < 12);
});
test('more trucks than belt slots is rejected', () => {
  assert.throws(() => buildLayout(mk({ trucks: 'MOWMOW'.split(''), beltCapacity: 4 })), /gate|slots/i);
});
test('bounds contain the belt and every truck', () => {
  const l = buildLayout(mk({ trucks: ['M', 'O', 'W'] }));
  assert.ok(l.bounds.maxY >= 6.45 && l.bounds.minX <= -3.45 && l.bounds.maxX >= 3.45);
  assert.ok(l.bounds.minY <= l.trucks[0].bottom);
});
test('gates follow the order the trucks stand in along the belt', () => {
  const l = buildLayout(mk({ trucks: 'MOWMOW'.split(''), beltCapacity: 16, beltPath: { points: [[-3.1, 6], [3.1, 6], [3.1, 1], [-3.1, 1]], radius: 1.3, width: 1 } }));
  for (let i = 1; i < l.gates.length; i++) assert.equal(l.gates[i], l.gates[i - 1] - 1, JSON.stringify(l.gates));
});
test('with more trucks than fit under the belt, the row is squeezed and gates stay near their trucks', () => {
  const path = { points: [[-3.1, 6], [3.1, 6], [3.1, 1], [-3.1, 1]], radius: 1.3, width: 1 };
  const l = buildLayout(mk({ trucks: 'MOWMOWMOWM'.split(''), beltCapacity: 16, beltPath: path }));
  const rowWidth = l.trucks[9].x - l.trucks[0].x + l.trucks[0].width;
  assert.ok(rowWidth <= 7.2 + 1.5 + 1e-9, `row ${rowWidth}`);
  let worst = 0;
  l.trucks.forEach((t, i) => {
    const g = l.path.at((l.gates[i] + l.phase) / 16);
    worst = Math.max(worst, Math.hypot(g.x - t.x, g.y - t.top));
  });
  assert.ok(worst < 5, `worst gate distance ${worst}`);
  assert.equal(new Set(l.gates).size, 10);
});
test('each gate is drawn on the belt right by its truck (phase lines slots up with the row)', () => {
  const path = { points: [[-3.1, 6], [3.1, 6], [3.1, 1], [-3.1, 1]], radius: 1.3, width: 1 };
  const l = buildLayout(mk({ trucks: 'MOWMOW'.split(''), beltCapacity: 16, beltPath: path }));
  assert.ok(Math.abs(l.phase) <= 0.5, `phase ${l.phase}`);

  for (const i of [1, 2, 3, 4]) {
    const g = l.path.at((l.gates[i] + l.phase) / 16);
    assert.ok(Math.abs(g.x - l.trucks[i].x) < 0.45, `truck ${i + 1}: gate x ${g.x} vs truck x ${l.trucks[i].x}`);
  }
});

const loop = { points: [[-3.1, 6], [3.1, 6], [3.1, 1], [-3.1, 1]], radius: 1.3, width: 1 };
test('truckPlaces puts each truck mouth where the level says, facing the given way', () => {

  const places = [[0, -0.35, 90], [0, 7.35, -90], [-1.75, 3.5, 180]];
  const l = buildLayout(mk({ trucks: 'MOW'.split(''), truckCapacity: 4, beltCapacity: 16, beltPath: loop, truckPlaces: places }));
  const len = 4 * l.unit;
  l.trucks.forEach((t, i) => { near(t.mx, places[i][0], 1e-9); near(t.my, places[i][1], 1e-9); near(t.length, len, 1e-9); near(t.width, 0.9, 1e-9); });
  near(l.trucks[0].fy, 1, 1e-9); near(l.trucks[1].fy, -1, 1e-9); near(l.trucks[2].fx, -1, 1e-9);

  near(l.trucks[1].cy, 7.35 + len / 2, 1e-9);
  near(l.trucks[2].cx, -1.75 + len / 2, 1e-9);

  const n = 16;
  l.trucks.forEach((t, i) => {
    const want = l.path.nearest({ x: t.mx, y: t.my }) * n;
    let d = Math.abs(l.gates[i] + l.phase - want) % n; d = Math.min(d, n - d);
    assert.ok(d <= 1, `truck ${i} gate ${l.gates[i]} vs ${want}`);
  });
  assert.ok(l.bounds.maxY >= 7.35 + len, 'bounds reach the truck above the belt');
});
test('the default row is the same as before: mouths in a line under the belt, facing up', () => {
  const l = buildLayout(mk({ trucks: 'MOW'.split(''), beltPath: loop }));
  for (const t of l.trucks) { near(t.fy, 1, 1e-9); near(t.my, 0.5 - 0.6, 1e-9); near(t.cx, t.mx, 1e-9); near(t.my, t.top, 1e-9); }
});
test('trucks that overlap each other or lie on the belt are rejected', () => {
  assert.throws(() => buildLayout(mk({ trucks: 'MO'.split(''), beltPath: loop, truckPlaces: [[0, -0.35, 90], [0.4, -0.35, 90]] })), /overlap/i);
  assert.throws(() => buildLayout(mk({ trucks: ['M'], beltPath: loop, truckPlaces: [[0, 2, 90]] })), /belt/i);
});

test('beltCapacityFor gives one slot per SLOT_LENGTH of belt', () => {
  const d = { points: [[-3, 6], [3, 6], [3, 1], [-3, 1]], radius: 1.2, width: 0.65 };
  assert.equal(beltCapacityFor(d), Math.round(buildPath(d).length / SLOT_LENGTH));
});
test('beltFits accepts a capacity in proportion to the belt length and rejects one that is not', () => {
  const beltPath = { points: [[-3, 6], [3, 6], [3, 1], [-3, 1]], radius: 1.2, width: 0.65 };
  const cap = beltCapacityFor(beltPath);
  assert.equal(beltFits(mk({ trucks: ['M'], beltPath, beltCapacity: cap })), true);
  assert.equal(beltFits(mk({ trucks: ['M'], beltPath, beltCapacity: cap * 2 })), false);
  assert.equal(beltFits(mk({ trucks: ['M'], beltPath, beltCapacity: Math.round(cap / 2) })), false);
});

test('a flat path has no height anywhere', () => {
  const p = buildPath(rect);
  for (let i = 0; i < 20; i++) assert.equal(p.height(i / 20), 0);
});

test('a third number on a point raises the belt there, sloping evenly to its neighbours', () => {
  const p = buildPath({ points: [[0, 0, 0], [4, 0, 1], [4, 4, 0], [0, 4, 0]], radius: 0, width: 0.5 });
  near(p.height(0), 0, 1e-9);
  near(p.height(0.125), 0.5, 1e-9);
  near(p.height(0.25), 1, 1e-9);
  near(p.height(0.375), 0.5, 1e-9);
  near(p.height(0.75), 0, 1e-9);
});

test('a belt may cross over itself', () => {
  const eight = { points: [[-2, -1, 0], [2, 1, 0], [2, -1, 0], [-2, 1, 0]], radius: 0, width: 0.5 };
  const p = buildPath(eight);
  assert.ok(p.length > 12);
  const a = p.at(p.nearest({ x: 0, y: 0 }));
  near(a.x, 0, 1e-6); near(a.y, 0, 1e-6);
});
