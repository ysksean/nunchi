'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { emptyGauge, updateGauge, vibe, shouldCower } = require('../src/gauge');

test('emptyGauge starts a clean day', () => {
  const g = emptyGauge('2026-07-29');
  assert.equal(g.day, '2026-07-29');
  assert.deepEqual(g.counts, { angry: 0, happy: 0, sad: 0, urgent: 0, neutral: 0 });
  assert.deepEqual(g.streak, { mood: null, n: 0 });
});

test('updateGauge counts moods and tracks a streak', () => {
  let g = emptyGauge('2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-29');
  assert.equal(g.counts.angry, 2);
  assert.deepEqual(g.streak, { mood: 'angry', n: 2 });
});

test('a different mood resets the streak but keeps counts', () => {
  let g = emptyGauge('2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-29');
  g = updateGauge(g, 'happy', '2026-07-29');
  assert.equal(g.counts.angry, 1);
  assert.equal(g.counts.happy, 1);
  assert.deepEqual(g.streak, { mood: 'happy', n: 1 });
});

test('crossing midnight resets counts and streak', () => {
  let g = emptyGauge('2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-30'); // new day
  assert.equal(g.day, '2026-07-30');
  assert.equal(g.counts.angry, 1);
  assert.deepEqual(g.streak, { mood: 'angry', n: 1 });
});

test('neutral moods count but never cause a vibe or cower', () => {
  let g = emptyGauge('2026-07-29');
  for (let i = 0; i < 5; i++) g = updateGauge(g, 'neutral', '2026-07-29');
  assert.equal(vibe(g), 'neutral');
  assert.equal(shouldCower('neutral', g), false);
});

test('shouldCower only after 3 consecutive angry, and only while angry', () => {
  let g = emptyGauge('2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-29');
  assert.equal(shouldCower('angry', g), false); // only 2
  g = updateGauge(g, 'angry', '2026-07-29');
  assert.equal(shouldCower('angry', g), true); // 3rd
  // even with a long angry streak, a happy prompt shouldn't cower
  assert.equal(shouldCower('happy', g), false);
});

test('vibe turns good on a praise-heavy day', () => {
  let g = emptyGauge('2026-07-29');
  for (let i = 0; i < 4; i++) g = updateGauge(g, 'happy', '2026-07-29');
  assert.equal(vibe(g), 'good');
});

test('vibe turns rough when negativity outweighs praise', () => {
  let g = emptyGauge('2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-29');
  g = updateGauge(g, 'angry', '2026-07-29');
  g = updateGauge(g, 'sad', '2026-07-29');
  g = updateGauge(g, 'happy', '2026-07-29'); // net = 1 - 3 = -2 ... needs <= -3
  assert.equal(vibe(g), 'neutral');
  g = updateGauge(g, 'sad', '2026-07-29'); // net = 1 - 4 = -3
  assert.equal(vibe(g), 'rough');
});

test('updateGauge caps the recent-mood buffer', () => {
  let g = emptyGauge('2026-07-29');
  for (let i = 0; i < 20; i++) g = updateGauge(g, 'happy', '2026-07-29');
  assert.ok(g.recent.length <= 8);
});
