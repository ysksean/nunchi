'use strict';

/**
 * 눈치 게이지 — accumulates the day's tone so the pet's baseline reflects how
 * you've been talking to it, not just the last message. Pure and time-free
 * (the caller passes today's date key) so it's fully unit-testable.
 *
 * Privacy: only mood tallies are kept — never prompt text.
 */

const MOODS = ['angry', 'happy', 'sad', 'urgent', 'neutral'];
const RECENT_CAP = 8;

// Consecutive angry prompts before the pet cowers instead of just flinching.
const COWER_STREAK = 3;
// How lopsided the day must be before the idle baseline shifts.
const VIBE_THRESHOLD = 3;

function emptyGauge(day) {
  const counts = {};
  for (const m of MOODS) counts[m] = 0;
  return { day, counts, streak: { mood: null, n: 0 }, recent: [] };
}

/**
 * @param {object} gauge previous gauge (or undefined)
 * @param {string} mood classified mood of the new prompt
 * @param {string} day today's local date key, e.g. '2026-07-29'
 */
function updateGauge(gauge, mood, day) {
  let g = gauge && gauge.day === day ? gauge : emptyGauge(day);
  g = {
    day,
    counts: { ...g.counts },
    streak: { ...g.streak },
    recent: g.recent.slice(),
  };

  if (!MOODS.includes(mood)) mood = 'neutral';
  g.counts[mood] = (g.counts[mood] || 0) + 1;

  if (g.streak.mood === mood) g.streak = { mood, n: g.streak.n + 1 };
  else g.streak = { mood, n: 1 };

  g.recent.push(mood);
  if (g.recent.length > RECENT_CAP) g.recent = g.recent.slice(-RECENT_CAP);

  return g;
}

/** Net day sentiment → 'good' | 'rough' | 'neutral'. */
function vibe(gauge) {
  if (!gauge || !gauge.counts) return 'neutral';
  const c = gauge.counts;
  const net = (c.happy || 0) - (c.angry || 0) - (c.sad || 0);
  if (net >= VIBE_THRESHOLD) return 'good';
  if (net <= -VIBE_THRESHOLD) return 'rough';
  return 'neutral';
}

/** True when this angry prompt lands on a 3+ angry streak. */
function shouldCower(mood, gauge) {
  return mood === 'angry' && !!gauge && !!gauge.streak && gauge.streak.mood === 'angry' && gauge.streak.n >= COWER_STREAK;
}

/** Local YYYY-MM-DD for a Date (reset boundary is local midnight). */
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { emptyGauge, updateGauge, vibe, shouldCower, dayKey, COWER_STREAK, VIBE_THRESHOLD };
