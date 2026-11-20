import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createState, tap, isWon } from '../assets/scripts/core/Rules';
import { buildLayout } from '../assets/scripts/core/Layout';
import { solve, settle } from '../assets/scripts/core/Solver';
import { mk } from './helpers';

function replayWins(level, taps) {
  const s = createState(level, buildLayout(level).gates);
  settle(s);
  for (const t of taps) { assert.equal(tap(s, t), true, `tap ${t} must be legal`); settle(s); }
  return isWon(s);
}

test('an already sorted level needs no taps', () => {
  const l = mk({ truckCapacity: 2, trucks: ['MM', 'OO'] });
  assert.deepEqual(solve(l, buildLayout(l).gates), []);
});
test('units already on the belt are sorted by settling alone', () => {
  const l = mk({ truckCapacity: 2, trucks: ['M', 'O'], belt: 'OM' });
  assert.deepEqual(solve(l, buildLayout(l).gates), []);
});
test('a three-move level is solved and the solution replays to a win', () => {

  const l = mk({ truckCapacity: 2, trucks: ['OM', 'MW', 'WO'] });
  const sol = solve(l, buildLayout(l).gates);
  assert.ok(sol && sol.length === 3, JSON.stringify(sol));
  assert.equal(replayWins(l, sol), true);
});
test('an impossible level returns null', () => {
  const l = mk({ trucks: ['MO', 'OM'], truckCapacity: 2, beltCapacity: 2 - 1 + 1 });
  l.beltCapacity = 2; l.belt = 'W';
  assert.equal(solve(l, buildLayout(l).gates), null);
});
test('every shipped level is solvable and its solution replays to a win', () => {
  const files = ['levels/', 'FinalLevels/'].flatMap(d => {
    const dir = new URL('../assets/' + d, import.meta.url);
    return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => new URL(f, dir));
  });
  assert.ok(files.length > 0, 'no level files');
  for (const f of files) {
    const l = JSON.parse(readFileSync(f, 'utf8'));
    if (String(f).includes('/FinalLevels/')) assert.ok(l.trucks.length <= 6, `${f} has ${l.trucks.length} trucks (final levels allow 6)`);
    const sol = solve(l, buildLayout(l).gates);
    assert.ok(sol, `${f} unsolvable`);
    assert.equal(replayWins(l, sol), true, String(f));
  }
});

test('solveFrom continues from a mid-game position without modifying it', async () => {
  const { solveFrom } = await import('../assets/scripts/core/Solver');
  const l = mk({ truckCapacity: 2, trucks: ['OM', 'MW', 'WO'] });
  const s = createState(l, buildLayout(l).gates);
  tap(s, 0);
  const before = JSON.stringify(s);
  const sol = solveFrom(s);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual((sol || []).slice().sort(), [1, 2]);
});
