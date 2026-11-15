import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adHooks, openStore, levelFor } from '../assets/scripts/game/AdBridge';

test('the ad network call is used for the store when the page provides one', () => {
  const calls = [];
  const done = openStore({ cta: () => calls.push('cta') }, 'https://store', u => calls.push(u));
  assert.deepEqual(calls, ['cta']);
  assert.equal(done, true);
});

test('the store url is opened when no ad network is present', () => {
  const calls = [];
  assert.equal(openStore({}, 'https://store', u => calls.push(u)), true);
  assert.deepEqual(calls, ['https://store']);
});

test('nothing is opened without a network or a url', () => {
  assert.equal(openStore({}, '', () => assert.fail('opened')), false);
});

test('hooks come from the page and default to none', () => {
  const hooks = { cta() {} };
  assert.equal(adHooks({ playableAd: hooks }), hooks);
  assert.deepEqual(adHooks({}), {});
});

test('the page can choose the level', () => {
  assert.equal(levelFor({ level: 'FinalLevels/dog' }, 'level1'), 'FinalLevels/dog');
  assert.equal(levelFor({}, 'level1'), 'level1');
});
