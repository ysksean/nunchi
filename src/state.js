'use strict';

/**
 * Shared read/write helpers for the runtime state file (~/.nunchi/state.json).
 *
 * Several agents (Claude Code, Codex) can fire hooks at the same moment, so
 * writes must survive concurrency: each writer uses its own temp file, and the
 * read-modify-write is guarded by a lock so tallies can't be lost.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const STATE_DIR = path.join(os.homedir(), '.nunchi');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const LOCK_FILE = STATE_FILE + '.lock';

// A hook is short-lived; if a lock outlives this, its owner died mid-write.
const LOCK_STALE_MS = 2000;
const LOCK_WAIT_MS = 1500;

const DEFAULT_STATE = {
  mood: 'neutral',
  moodAt: 0,
  claudeState: 'idle',
  claudeStateAt: 0,
};

function readState() {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Exclusive-create lock with a stale-lock takeover; never blocks a hook forever. */
function acquireLock() {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') return false;
      let age = Infinity;
      try {
        age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      } catch {
        continue; // lock vanished — retry immediately
      }
      if (age > LOCK_STALE_MS) {
        try {
          fs.unlinkSync(LOCK_FILE);
        } catch {
          /* someone else cleaned it */
        }
        continue;
      }
      if (Date.now() > deadline) return false; // proceed unlocked rather than stall
      sleepSync(15);
    }
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    /* already gone */
  }
}

function persist(next) {
  // Per-process temp file: two writers renaming a shared name race to ENOENT.
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next));
  fs.renameSync(tmp, STATE_FILE);
  return next;
}

/**
 * Read-modify-write under the lock. `compute(prev)` returns a patch (or null to
 * skip) and must be pure — it runs inside the critical section, so anything
 * derived from the previous state (mood tallies, streaks) stays consistent when
 * two agents fire hooks at once.
 */
function updateState(compute) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const locked = acquireLock();
  try {
    const prev = readState();
    const patch = compute(prev);
    if (!patch) return prev;
    return persist({ ...prev, ...patch });
  } finally {
    if (locked) releaseLock();
  }
}

function writeState(patch) {
  return updateState(() => patch);
}

module.exports = { STATE_FILE, readState, writeState, updateState };
