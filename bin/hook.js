#!/usr/bin/env node
'use strict';

/**
 * Claude Code hook handler.
 * Reads the hook event JSON from stdin, updates ~/.nunchi/state.json, exits.
 * The user's prompt text is classified in-memory and never persisted.
 */

const { classifyMood } = require('../src/mood');
const { readState, writeState } = require('../src/state');
const { updateGauge, dayKey } = require('../src/gauge');

// A PostToolUse response signals failure in a few shapes across tools.
function toolFailed(response) {
  if (!response || typeof response !== 'object') return false;
  return response.success === false || response.error != null || response.is_error === true;
}

/**
 * Pure reducer: maps a hook event + previous state to the state patch to write,
 * or null when the event should not change anything. Kept side-effect free so
 * it can be unit tested without stdin or the filesystem.
 */
function nextState(event, prev, now, day = dayKey(new Date(now))) {
  switch (event.hook_event_name) {
    case 'UserPromptSubmit': {
      const mood = classifyMood(event.prompt);
      return {
        mood,
        moodAt: now,
        claudeState: 'thinking',
        claudeStateAt: now,
        gauge: updateGauge(prev.gauge, mood, day),
      };
    }
    case 'PreToolUse':
      return { claudeState: 'working', claudeStateAt: now };
    case 'PostToolUse':
      return { claudeState: toolFailed(event.tool_response) ? 'error' : 'working', claudeStateAt: now };
    // Claude Code calls it Notification; Codex calls it PermissionRequest.
    case 'Notification':
    case 'PermissionRequest':
      return { claudeState: 'waiting', claudeStateAt: now };
    case 'SubagentStart':
      return { claudeState: 'working', claudeStateAt: now };
    case 'Stop': {
      // Keep a fresh error on screen; celebrate only when tools were running;
      // a plain chat reply ends quietly so the pet isn't bouncing all day.
      if (prev.claudeState === 'error') return { claudeState: 'error', claudeStateAt: now };
      const celebrate = prev.claudeState === 'working';
      return { claudeState: celebrate ? 'done' : 'idle', claudeStateAt: now };
    }
    case 'SubagentStop':
      return { claudeState: 'idle', claudeStateAt: now };
    case 'SessionStart':
      return { claudeState: 'idle', claudeStateAt: now };
    case 'SessionEnd':
      return { claudeState: 'sleeping', claudeStateAt: now };
    default:
      return null;
  }
}

function main(input) {
  let event;
  try {
    event = JSON.parse(input);
  } catch {
    process.exit(0);
  }
  const patch = nextState(event, readState(), Date.now());
  if (patch) writeState(patch);
  process.exit(0);
}

module.exports = { nextState, toolFailed };

if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (buf += c));
  process.stdin.on('end', () => main(buf));
}
