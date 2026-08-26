'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { planWaitingNudge, WAIT_NOTIFY_MS, WAIT_STALE_MS } = require('../src/waiting');

const T0 = 1_000_000; // arbitrary episode start (claudeStateAt)
const waiting = (at = T0) => ({ claudeState: 'waiting', claudeStateAt: at });

test('non-waiting states cancel any pending nudge', () => {
  for (const s of ['idle', 'working', 'error', 'done', 'sleeping', 'thinking']) {
    const plan = planWaitingNudge({ claudeState: s, claudeStateAt: T0 }, 0, T0 + 1);
    assert.equal(plan.action, 'cancel');
  }
});

test('a fresh wait arms a timer for the remaining time', () => {
  const plan = planWaitingNudge(waiting(), 0, T0 + 5_000);
  assert.equal(plan.action, 'arm');
  assert.equal(plan.delay, WAIT_NOTIFY_MS - 5_000);
  assert.equal(plan.episode, T0);
});

test('fires once the episode is old enough, keyed to when the wait actually began', () => {
  // The app may only observe the wait late (launch/reload mid-wait) —
  // claudeStateAt, not observation time, decides that the nudge is overdue.
  const plan = planWaitingNudge(waiting(), 0, T0 + WAIT_NOTIFY_MS);
  assert.equal(plan.action, 'fire');
  assert.equal(plan.episode, T0);
});

test('an already-notified episode stays silent on later polls', () => {
  const plan = planWaitingNudge(waiting(), T0, T0 + WAIT_NOTIFY_MS + 5_000);
  assert.equal(plan.action, 'none');
});

test('a new waiting episode gets its own full window and can fire again', () => {
  const t1 = T0 + 90_000; // hook re-stamped claudeStateAt for a new prompt
  const armed = planWaitingNudge(waiting(t1), T0, t1 + 1_000);
  assert.equal(armed.action, 'arm');
  const fired = planWaitingNudge(waiting(t1), T0, t1 + WAIT_NOTIFY_MS);
  assert.equal(fired.action, 'fire');
  assert.equal(fired.episode, t1);
});

test('a stale wait (dead session leftovers) is silenced instead of nudging', () => {
  const plan = planWaitingNudge(waiting(), 0, T0 + WAIT_STALE_MS);
  assert.equal(plan.action, 'stale');
  assert.equal(plan.episode, T0);
});

test('missing state fields never throw', () => {
  assert.equal(planWaitingNudge({}, 0, 123).action, 'cancel');
  // no claudeStateAt → episode 0, which is never nudged (silent, never fires)
  const plan = planWaitingNudge({ claudeState: 'waiting' }, 0, WAIT_STALE_MS + 1);
  assert.ok(plan.action === 'none' || plan.action === 'stale');
  assert.notEqual(plan.action, 'fire');
});
