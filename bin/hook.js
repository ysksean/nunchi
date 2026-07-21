#!/usr/bin/env node
'use strict';

/**
 * Claude Code hook handler.
 * Reads the hook event JSON from stdin, updates ~/.claude-pet-mood/state.json, exits.
 * The user's prompt text is classified in-memory and never persisted.
 */

const { classifyMood } = require('../src/mood');
const { writeState } = require('../src/state');

function main(input) {
  let event;
  try {
    event = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const now = Date.now();
  const name = event.hook_event_name;

  switch (name) {
    case 'UserPromptSubmit':
      writeState({
        mood: classifyMood(event.prompt),
        moodAt: now,
        claudeState: 'thinking',
        claudeStateAt: now,
      });
      break;
    case 'PreToolUse':
    case 'PostToolUse':
      writeState({ claudeState: 'working', claudeStateAt: now });
      break;
    case 'Notification':
      writeState({ claudeState: 'waiting', claudeStateAt: now });
      break;
    case 'Stop':
    case 'SubagentStop':
      writeState({ claudeState: 'idle', claudeStateAt: now });
      break;
    case 'SessionStart':
      writeState({ claudeState: 'idle', claudeStateAt: now });
      break;
    case 'SessionEnd':
      writeState({ claudeState: 'sleeping', claudeStateAt: now });
      break;
    default:
      break;
  }
  process.exit(0);
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (buf += c));
process.stdin.on('end', () => main(buf));
