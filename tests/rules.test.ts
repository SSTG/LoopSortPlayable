import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLevel, createState, load, canTap, tap, tick, isSettled, isWon, isLost, levelCaption, redirectDue, isComplete, freeStart, beltSpeed, fillProblem } from '../assets/scripts/core/Rules';
import { mk } from './helpers';

const run = (s, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...tick(s)); return ev; };

test('validateLevel rejects a truck holding more than truckCapacity', () => {
  assert.throws(() => validateLevel(mk({ trucks: ['MMMMM'] })), /truck 1/i);
});
test('validateLevel rejects a belt holding more than beltCapacity', () => {
  assert.throws(() => validateLevel(mk({ trucks: ['M'], belt: 'MMMMMMM' })), /belt/i);
});
test('validateLevel rejects a colour missing from colors', () => {
  assert.throws(() => validateLevel(mk({ trucks: ['MX'] })), /X/);
});
test('validateLevel rejects a level with no trucks', () => {
  assert.throws(() => validateLevel(mk({ trucks: [] })), /truck/i);
});

test('tap puts the whole top same-colour run on the belt at once', () => {
  const s = createState(mk({ trucks: ['MOO', 'W'] }), [0, 3]);
  assert.equal(tap(s, 0), true);
  assert.deepEqual(s.trucks[0], ['M']);
  assert.equal(load(s), 2);
  assert.deepEqual(s.ring, ['O', 'O', null, null, null, null]);
});
test('units entering the belt push the ones in the way forward instead of waiting', () => {
  const s = createState(mk({ trucks: ['MO', 'M'], belt: 'WW', beltCapacity: 4 }), [0, 2]);

  const ev = [];
  assert.equal(tap(s, 0, ev), true);
  assert.deepEqual(s.ring, ['O', 'W', 'W', null]);
  assert.deepEqual(ev, [{ type: 'shift', from: 0, to: 1 }, { type: 'enter', truck: 0, slot: 0, color: 'O' }]);
});
test('a pushed unit drops straight away if it lands at a truck that takes it', () => {
  const s = createState(mk({ trucks: ['MO', 'MW'], belt: 'W', beltCapacity: 4 }), [0, 1]);
  const ev = [];
  tap(s, 0, ev);
  assert.deepEqual(s.trucks[1], ['M', 'W', 'W']);
  assert.deepEqual(s.ring, ['O', null, null, null]);
  assert.deepEqual(ev[ev.length - 1], { type: 'drop', truck: 1, slot: 1, color: 'W' });
});
test('a block does not fall straight back into the truck it was tapped out of', () => {
  const s = createState(mk({ trucks: ['O', 'WM'], beltCapacity: 4 }), [0, 2]);
  tap(s, 0);
  assert.deepEqual(s.trucks[0], []);
  assert.equal(load(s), 1);
});
test('when the run does not fit, the tap sends as many as the belt has room for and the rest stay', () => {
  const s = createState(mk({ trucks: ['MOO', 'W'], belt: 'MMMMM' }), [0, 3]);
  assert.equal(canTap(s, 0), true);
  assert.equal(tap(s, 0), true);
  assert.deepEqual(s.trucks[0], ['M', 'O']);
  assert.equal(load(s), 6);
});
test('tap is refused when the belt is already full', () => {
  const s = createState(mk({ trucks: ['MOO', 'W'], belt: 'MMMMMM' }), [0, 3]);
  assert.equal(canTap(s, 0), false);
  assert.equal(tap(s, 0), false);
  assert.deepEqual(s.trucks[0], ['M', 'O', 'O']);
});
test('tap on an empty truck is refused', () => {
  const s = createState(mk({ trucks: ['', 'MO'] }), [0, 3]);
  assert.equal(tap(s, 0), false);
});
test('tap is refused once the game is won', () => {
  const s = createState(mk({ truckCapacity: 2, trucks: ['MM', 'OO'] }), [0, 3]);
  assert.equal(isWon(s), true);
  assert.equal(tap(s, 0), false);
});
test('rapid taps never push the load above beltCapacity', () => {
  const s = createState(mk({ trucks: ['WMMOO', 'W'], truckCapacity: 5, beltCapacity: 3 }), [0, 1]);
  assert.equal(tap(s, 0), true);
  assert.equal(load(s), 2);
  assert.equal(tap(s, 0), true, 'one M of the two fits');
  assert.equal(load(s), 3);
  assert.deepEqual(s.trucks[0], ['W', 'M']);
  assert.equal(tap(s, 0), false);
});
test('a belt unit drops into a truck whose top matches and has room', () => {
  const s = createState(mk({ trucks: ['WO', 'WM'], belt: 'O' }), [0, 3]);
  const ev = run(s, 6);
  assert.deepEqual(ev, [{ type: 'drop', truck: 0, slot: 0, color: 'O' }]);
  assert.deepEqual(s.trucks[0], ['W', 'O', 'O']);
  assert.equal(load(s), 0);
});
test('a belt unit does not drop into a full or mismatching truck', () => {
  const s = createState(mk({ trucks: ['OOOO', 'WM'], belt: 'O' }), [0, 3]);
  assert.deepEqual(run(s, 12), []);
  assert.equal(load(s), 1);
});
test('an empty truck accepts any colour', () => {
  const s = createState(mk({ trucks: ['', 'WM'], belt: 'O' }), [0, 3]);
  run(s, 6);
  assert.deepEqual(s.trucks[0], ['O']);
});
test('an emptied truck takes its block back after a full lap if nothing else did', () => {
  const s = createState(mk({ trucks: ['O', 'WM'], beltCapacity: 4 }), [0, 2]);
  tap(s, 0);
  run(s, 4);
  assert.deepEqual(s.trucks[0], ['O']);
});

test('isSettled only after a full quiet lap', () => {
  const s = createState(mk({ trucks: ['WM', 'OW'], belt: 'O' }), [0, 3]);
  run(s, 5);
  assert.equal(isSettled(s), false);
  run(s, 1);
  assert.equal(isSettled(s), true);
});
test('isWon only when the belt is empty and every truck is full of one colour', () => {
  assert.equal(isWon(createState(mk({ truckCapacity: 2, trucks: ['MM', 'OO'] }), [0, 2])), true);
  assert.equal(isWon(createState(mk({ truckCapacity: 2, trucks: ['MM', 'OM'] }), [0, 2])), false);
  assert.equal(isWon(createState(mk({ truckCapacity: 2, trucks: ['MM', 'O'] }), [0, 2])), false);
  assert.equal(isWon(createState(mk({ truckCapacity: 2, trucks: ['MM', ''] }), [0, 2])), false);
  assert.equal(isWon(createState(mk({ truckCapacity: 2, trucks: ['MM', 'OO'], belt: 'W' }), [0, 2])), false);
});
test('isLost at once when the belt is full and no block on it can drop into a truck', () => {
  const s = createState(mk({ trucks: ['MMOO', 'OOMM'], beltCapacity: 2, belt: 'WW' }), [0, 1]);
  assert.equal(isLost(s), true);
});
test('not lost while the belt is full but a block on it can still drop into a truck', () => {
  const s = createState(mk({ trucks: ['MMO', 'OOMM'], beltCapacity: 2, belt: 'OW' }), [0, 1]);
  assert.equal(canTap(s, 0), false);
  assert.equal(isLost(s), false);
  run(s, 4);
  assert.deepEqual(s.trucks[0], ['M', 'M', 'O', 'O']);
});
test('not lost while the belt has room for a tap', () => {
  const s = createState(mk({ trucks: ['MMOO', 'OOMM'], beltCapacity: 3, belt: 'WW' }), [0, 1]);
  assert.equal(isLost(s), false);
});
test('beltLimit counts as full for losing', () => {
  const s = createState(mk({ trucks: ['MMOO', 'OOMM'], beltCapacity: 4, beltLimit: 2, belt: 'WW' }), [0, 2]);
  assert.equal(isLost(s), true);
});
test('matchTruckColor: lost when the only matching tops belong to trucks of another colour', () => {
  // Truck 0 is M with an O on top: under the colour rule it will not take the O block.
  const s = createState(mk({ matchTruckColor: true, trucks: ['MMO', 'OOMM'], beltCapacity: 2, belt: 'OW' }), [0, 1]);
  assert.equal(isLost(s), true);
});
test('validateLevel explains a missing belt or incomplete beltPath instead of crashing later', () => {
  const noBelt: any = mk({ trucks: ['M'] }); delete noBelt.belt;
  assert.throws(() => validateLevel(noBelt), /belt/i);
  const noWidth: any = mk({ trucks: ['M'] }); delete noWidth.beltPath.width;
  assert.throws(() => validateLevel(noWidth), /width/i);
  const badPoint: any = mk({ trucks: ['M'] }); badPoint.beltPath.points[1] = [3];
  assert.throws(() => validateLevel(badPoint), /point/i);
});

test('caption and tapsToRedirect are optional and default to the standard text and -1', () => {
  const l = mk({ trucks: ['M'] });
  validateLevel(l);
  assert.equal(levelCaption(l), 'Harder than you think');
  assert.equal(redirectDue(l, 1000), false);
  assert.equal(levelCaption(mk({ trucks: ['M'], caption: 'Can you sort it?' })), 'Can you sort it?');
});
test('tapsToRedirect redirects from that tap on', () => {
  const l = mk({ trucks: ['M'], tapsToRedirect: 3 });
  validateLevel(l);
  assert.equal(redirectDue(l, 2), false);
  assert.equal(redirectDue(l, 3), true);
  assert.equal(redirectDue(l, 4), true);
  assert.equal(redirectDue(mk({ trucks: ['M'], tapsToRedirect: -1 }), 3), false);
});
test('validateLevel rejects a bad caption or tapsToRedirect', () => {
  assert.throws(() => validateLevel(mk({ trucks: ['M'], caption: 5 as any })), /caption/i);
  for (const bad of [0, 2.5, -3, '4']) assert.throws(() => validateLevel(mk({ trucks: ['M'], tapsToRedirect: bad as any })), /tapsToRedirect/);
});

test('validateLevel rejects truckPlaces that do not match the trucks', () => {
  validateLevel(mk({ trucks: ['M', 'O'], truckPlaces: [[-1, 0, 90], [1, 0, 90]] }));
  assert.throws(() => validateLevel(mk({ trucks: ['M', 'O'], truckPlaces: [[0, 0, 90]] })), /truckPlaces/);
  assert.throws(() => validateLevel(mk({ trucks: ['M'], truckPlaces: [[0, 0]] as any })), /truckPlaces/);
  assert.throws(() => validateLevel(mk({ trucks: ['M'], truckPlaces: [[0, 0, 'up']] as any })), /truckPlaces/);
});

test('a truck that is full of one colour is complete and can no longer be tapped', () => {
  const s = createState(mk({ trucks: ['MMMM', 'MMM', 'MMOM', 'O'], beltCapacity: 8 }), [0, 2, 4, 6]);
  assert.equal(isComplete(s, 0), true);
  assert.equal(isComplete(s, 1), false);
  assert.equal(isComplete(s, 2), false);
  assert.equal(canTap(s, 0), false);
  assert.equal(tap(s, 0), false);
  assert.equal(canTap(s, 1), true);
});

test('freeStart is empty when no cube on the belt could drop without a tap', () => {

  assert.deepEqual(freeStart(mk({ truckCapacity: 4, trucks: ['WM', 'MO', 'WWWW'], belt: 'WW' })), []);
});
test('freeStart names a truck that would take a belt cube of its top colour', () => {
  assert.deepEqual(freeStart(mk({ truckCapacity: 4, trucks: ['WM', 'MO'], belt: 'WO' })), [{ color: 'O', truck: 1 }]);
});
test('freeStart counts an empty truck as taking any belt cube', () => {
  assert.deepEqual(freeStart(mk({ truckCapacity: 4, trucks: ['MM', ''], belt: 'W' })), [{ color: 'W', truck: 1 }]);
});
test('freeStart is empty for an empty belt', () => {
  assert.deepEqual(freeStart(mk({ truckCapacity: 4, trucks: ['M', ''], belt: '' })), []);
});

test('beltSpeed is full while the belt has room and a third when it is full', () => {
  assert.equal(beltSpeed(0, 16), 1);
  assert.equal(beltSpeed(8, 16), 1);
  assert.ok(Math.abs(beltSpeed(16, 16) - 1 / 3) < 1e-9);
});
test('beltSpeed slows steadily as the belt fills up', () => {
  assert.ok(beltSpeed(13, 16) < 1 && beltSpeed(13, 16) > beltSpeed(15, 16) && beltSpeed(15, 16) > 1 / 3);
});

test('fillProblem is null when the blocks of every colour fill whole trucks and every truck gets filled', () => {
  assert.equal(fillProblem(mk({ truckCapacity: 3, trucks: ['MMO', 'OM', 'W'], belt: 'OWW' })), null);
});
test('fillProblem names a colour whose blocks do not fill whole trucks', () => {
  assert.match(fillProblem(mk({ truckCapacity: 3, trucks: ['MMO', 'OM', 'W'], belt: 'OW' })) || '', /"W"/);
});
test('fillProblem reports blocks that fill fewer trucks than the level has', () => {
  assert.match(fillProblem(mk({ truckCapacity: 3, trucks: ['MMM', 'OOO', ''] })) || '', /2 of 3 trucks/);
});

test('validateLevel accepts belt points that carry a height, and rejects a height below the ground', () => {
  const pts = (h: unknown) => ({ points: [[-3, 6], [3, 6, h], [3, 1], [-3, 1]], radius: 1.2, width: 0.9 }) as never;
  assert.doesNotThrow(() => validateLevel(mk({ trucks: ['MMMM'], beltPath: pts(0.75) })));
  assert.throws(() => validateLevel(mk({ trucks: ['MMMM'], beltPath: pts(-1) })), /point 2/i);
  assert.throws(() => validateLevel(mk({ trucks: ['MMMM'], beltPath: pts('up') })), /point 2/i);
});

test('beltLimit caps the load below the number of belt slots', () => {
  const s = createState(mk({ trucks: ['WMMOO', 'WMM'], truckCapacity: 5, beltCapacity: 6, beltLimit: 3 }), [0, 3]);
  assert.equal(s.ring.length, 6);
  assert.equal(tap(s, 0), true);
  assert.equal(load(s), 2);
  assert.equal(tap(s, 0), true, 'only one of the two M fits under the limit of 3');
  assert.equal(load(s), 3);
  assert.deepEqual(s.trucks[0], ['W', 'M']);
  assert.equal(canTap(s, 1), false, 'belt at its limit');
});
test('validateLevel rejects a beltLimit above beltCapacity, or a belt fuller than the limit', () => {
  assert.throws(() => validateLevel(mk({ trucks: ['M'], beltLimit: 7 })), /beltLimit/);
  assert.throws(() => validateLevel(mk({ trucks: ['M'], beltLimit: 0 })), /beltLimit/);
  assert.throws(() => validateLevel(mk({ trucks: ['M'], belt: 'OOO', beltLimit: 2 })), /beltLimit/);
  validateLevel(mk({ trucks: ['M'], belt: 'OO', beltLimit: 2 }));
});
test('a tapped run longer than the gap to the next truck still all drops into that truck', () => {
  const s = createState(mk({ truckCapacity: 6, beltCapacity: 10, trucks: ['MOOOO', 'O', 'W'] }), [0, 2, 6]);
  tap(s, 0);
  run(s, 3);
  assert.deepEqual(s.trucks[1], ['O', 'O', 'O', 'O', 'O']);
  assert.equal(load(s), 0);
});

test('matchTruckColor: a truck only takes blocks of its own colour', () => {
  // Truck 0 is M (first colour), truck 1 is O. An O block passes truck 0 even though its top is O.
  const s = createState(mk({ matchTruckColor: true, trucks: ['MO', 'OM'], belt: 'O' }), [0, 3]);
  assert.deepEqual(run(s, 12), []);
  assert.equal(load(s), 1);
});
test('matchTruckColor: an empty truck only takes its own colour', () => {
  const s = createState(mk({ matchTruckColor: true, trucks: ['', 'WM'], belt: 'O' }), [0, 3]);
  run(s, 12);
  assert.deepEqual(s.trucks[0], []);
  const t = createState(mk({ matchTruckColor: true, truckColors: ['O', 'M'], trucks: ['', 'WM'], belt: 'O' }), [0, 3]);
  run(t, 12);
  assert.deepEqual(t.trucks[0], ['O']);
});
test('matchTruckColor: a truck full of another colour is not complete', () => {
  const l = mk({ matchTruckColor: true, truckCapacity: 2, trucks: ['OO', 'MM'] });
  const s = createState(l, [0, 2]);
  assert.equal(isComplete(s, 0), false);
  assert.equal(isWon(s), false);
  assert.equal(isWon(createState({ ...l, truckColors: ['O', 'M'] }, [0, 2])), true);
});
test('without matchTruckColor the truck colour is only cosmetic', () => {
  const s = createState(mk({ truckCapacity: 2, truckColors: ['M', 'O'], trucks: ['OO', 'MM'] }), [0, 2]);
  assert.equal(isWon(s), true);
});
test('matchTruckColor: fillProblem wants each colour to fill its own trucks', () => {
  assert.match(fillProblem(mk({ matchTruckColor: true, truckCapacity: 2, trucks: ['MM', 'MM', 'OO'] })) || '', /matchTruckColor/);
  assert.equal(fillProblem(mk({ matchTruckColor: true, truckCapacity: 2, trucks: ['MM', 'OO'] })), null);
});
test('matchTruckColor: freeStart ignores trucks of another colour', () => {
  assert.deepEqual(freeStart(mk({ matchTruckColor: true, truckCapacity: 4, trucks: ['MO', ''], belt: 'W' })), []);
  assert.deepEqual(freeStart(mk({ matchTruckColor: true, truckCapacity: 4, trucks: ['MO', 'OO', ''], belt: 'W' })), [{ color: 'W', truck: 2 }]);
});
test('validateLevel rejects a bad matchTruckColor or truckColors', () => {
  assert.throws(() => validateLevel(mk({ trucks: ['M'], matchTruckColor: 'yes' as any })), /matchTruckColor/);
  assert.throws(() => validateLevel(mk({ trucks: ['M', 'O'], truckColors: ['M'] })), /truckColors/);
  assert.throws(() => validateLevel(mk({ trucks: ['M'], matchTruckColor: true, truckColors: ['#123456'] })), /truckColors/);
  validateLevel(mk({ trucks: ['M'], truckColors: ['#123456'] }));
});
