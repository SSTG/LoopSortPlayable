import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, tap } from '../assets/scripts/core/Rules';
import { HintGuide } from '../assets/scripts/game/HintGuide';
import { mk } from './helpers';

const level = () => createState(mk({ trucks: ['MO', 'OM'], truckCapacity: 2, beltCapacity: 6 }), [0, 3]);

test('after a tap the hand waits for the idle time', () => {
  const h = new HintGuide(), s = level();
  h.onTap();
  assert.equal(h.update(2.9, s, 3), -1);
  assert.ok(h.update(0.2, s, 3) >= 0);
});
test('a block dropping on its own restarts the idle wait and hides the hand', () => {
  const h = new HintGuide(), s = level();
  h.onTap();
  assert.ok(h.update(3.1, s, 3) >= 0, 'hand shows after 3 s idle');
  h.onActivity();
  assert.equal(h.truck, -1, 'hand hidden at once');
  assert.equal(h.update(2.9, s, 3), -1, 'still waiting 2.9 s after the drop');
  assert.ok(h.update(0.2, s, 3) >= 0, 'back 3 s after the drop');
});

test('the first hand also waits the idle time, counted from the last automatic drop', () => {
  const h = new HintGuide(), s = level();
  assert.equal(h.update(2.9, s, 3), -1, 'no hand before 3 s at the start');
  h.onActivity();
  assert.equal(h.update(2.9, s, 3), -1, 'matches just stopped: still waiting');
  assert.ok(h.update(0.2, s, 3) >= 0, 'hand 3 s after the last drop');
});
