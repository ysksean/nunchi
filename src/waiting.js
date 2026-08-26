'use strict';

/**
 * Permission-wait reminder. The pet shows a bouncing "waiting" face, but if
 * you're in another window you'll never see it — so once the agent has been
 * waiting a while, fire one native notification.
 *
 * The wait is time-driven while the state file is event-driven (nothing writes
 * it during a wait), so the caller must arm a timer — this module only plans.
 * Episodes are identified by `claudeStateAt`, the timestamp the hook stamped
 * when the wait actually began: that keeps the clock honest across app
 * launches/reloads mid-wait, gives every new prompt its own full window, and
 * lets leftovers from a dead session be recognized and silenced.
 *
 * Pure and time-free (the caller passes `now`) so it's unit-testable.
 */

// How long the agent must sit in 'waiting' before nudging the user.
const WAIT_NOTIFY_MS = 30_000;
// A wait this old is a dead session's leftover, not a live prompt — stay quiet.
const WAIT_STALE_MS = 10 * 60_000;

/**
 * @param {{claudeState?: string, claudeStateAt?: number}} state current pet state
 * @param {number} notifiedEpisode claudeStateAt of the last episode we nudged for
 * @param {number} now current timestamp (ms)
 * @returns {{action: 'cancel'|'none'|'arm'|'fire'|'stale', episode?: number, delay?: number}}
 *   cancel: not waiting — clear any pending timer
 *   none:   already nudged for this episode
 *   arm:    schedule a re-check in `delay` ms
 *   fire:   show the notification now (and remember `episode`)
 *   stale:  silence this episode without nudging (and remember `episode`)
 */
function planWaitingNudge(state, notifiedEpisode, now) {
  if (!state || state.claudeState !== 'waiting') return { action: 'cancel' };

  const episode = state.claudeStateAt || 0;
  if (episode === notifiedEpisode) return { action: 'none' };

  const elapsed = now - episode;
  if (elapsed >= WAIT_STALE_MS) return { action: 'stale', episode };
  if (elapsed >= WAIT_NOTIFY_MS) return { action: 'fire', episode };
  return { action: 'arm', episode, delay: WAIT_NOTIFY_MS - elapsed };
}

module.exports = { planWaitingNudge, WAIT_NOTIFY_MS, WAIT_STALE_MS };
