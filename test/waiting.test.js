'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { waitingNotify, WAIT_NOTIFY_MS } = require('../src/waiting');

test('does not fire before the threshold', () => {
  const t0 = { track: { since: null, notified: false }, fire: false };
  const a = waitingNotify('waiting', t0.track, 1000);
  assert.equal(a.fire, false);
  const b = waitingNotify('waiting', a.track, 1000 + WAIT_NOTIFY_MS - 1);
  assert.equal(b.fire, false);
});

test('fires once when the wait crosses the threshold', () => {
  let track = { since: null, notified: false };
  const enter = waitingNotify('waiting', track, 1000);
  assert.equal(enter.fire, false);
  track = enter.track;
  const mid = waitingNotify('waiting', track, 1000 + WAIT_NOTIFY_MS - 1000);
  assert.equal(mid.fire, false);
  const due = waitingNotify('waiting', mid.track, 1000 + WAIT_NOTIFY_MS);
  assert.equal(due.fire, true);
  // No nagging on subsequent polls of the same episode.
  const again = waitingNotify('waiting', due.track, 1000 + 2 * WAIT_NOTIFY_MS);
  assert.equal(again.fire, false);
});

test('resets when the state leaves waiting and can fire again later', () => {
  let r = { track: { since: null, notified: false }, fire: false };
  r = waitingNotify('waiting', r.track, 0);
  r = waitingNotify('waiting', r.track, WAIT_NOTIFY_MS); // fires
  assert.equal(r.fire, true);
  r = waitingNotify('working', r.track, WAIT_NOTIFY_MS + 1); // approved
  assert.equal(r.fire, false);
  assert.deepEqual(r.track, { since: null, notified: false });
  r = waitingNotify('waiting', r.track, WAIT_NOTIFY_MS + 2_000); // new episode
  assert.equal(r.fire, false);
  r = waitingNotify('waiting', r.track, WAIT_NOTIFY_MS + 2_000 + WAIT_NOTIFY_MS);
  assert.equal(r.fire, true);
});

test('non-waiting states are no-ops even without prior tracking', () => {
  for (const s of ['idle', 'working', 'error', 'done', 'sleeping']) {
    const r = waitingNotify(s, undefined, 1234);
    assert.equal(r.fire, false);
    assert.equal(r.track.since, null);
  }
});
