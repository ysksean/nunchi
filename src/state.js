'use strict';

/** Shared read/write helpers for the runtime state file (~/.claude-pet/state.json). */

const fs = require('fs');
const os = require('os');
const path = require('path');

const STATE_DIR = path.join(os.homedir(), '.claude-pet');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

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

function writeState(patch) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const next = { ...readState(), ...patch };
  // Atomic-ish write so the watcher never reads a half-written file.
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next));
  fs.renameSync(tmp, STATE_FILE);
  return next;
}

module.exports = { STATE_FILE, readState, writeState };
