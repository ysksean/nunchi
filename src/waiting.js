'use strict';

/**
 * Permission-wait reminder. The pet shows a bouncing "waiting" face, but if
 * you're in another window you'll never see it — so after the agent has been
 * waiting for approval a while, fire one native notification.
 *
 * Pure and time-free (the caller passes `now`) so it's unit-testable; main.js
 * feeds it on every state poll and shows the notification when `fire` is true.
 */

// How long the agent must sit in 'waiting' before nudging the user.
const WAIT_NOTIFY_MS = 30_000;

/**
 * @param {string} claudeState current pet state
 * @param {{since: number|null, notified: boolean}} track previous tracker
 * @param {number} now current timestamp (ms)
 * @returns {{track: {since: number|null, notified: boolean}, fire: boolean}}
 */
function waitingNotify(claudeState, track, now) {
  const t = track || { since: null, notified: false };

  if (claudeState !== 'waiting') {
    return { track: { since: null, notified: false }, fire: false };
  }

  // A new waiting episode starts whenever we weren't waiting before.
  const since = t.since == null ? now : t.since;
  const fire = now - since >= WAIT_NOTIFY_MS && !t.notified;
  // Fire exactly once per episode — no nagging on every 300ms poll.
  return { track: { since, notified: t.notified || fire }, fire };
}

module.exports = { waitingNotify, WAIT_NOTIFY_MS };
