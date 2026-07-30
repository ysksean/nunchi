'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { nextState } = require('../bin/hook');

const prev = { mood: 'neutral', moodAt: 0, claudeState: 'idle', claudeStateAt: 0 };

test('UserPromptSubmit classifies mood and enters thinking', () => {
  const s = nextState({ hook_event_name: 'UserPromptSubmit', prompt: '짜증나 왜 안 돼' }, prev, 100);
  assert.equal(s.mood, 'angry');
  assert.equal(s.moodAt, 100);
  assert.equal(s.claudeState, 'thinking');
});

test('UserPromptSubmit accumulates the daily gauge', () => {
  let st = { ...prev };
  st = { ...st, ...nextState({ hook_event_name: 'UserPromptSubmit', prompt: '짜증나' }, st, 100, '2026-07-29') };
  st = { ...st, ...nextState({ hook_event_name: 'UserPromptSubmit', prompt: '아 진짜 왜 이래' }, st, 200, '2026-07-29') };
  assert.equal(st.gauge.counts.angry, 2);
  assert.equal(st.gauge.streak.n, 2);
  // next day resets
  st = { ...st, ...nextState({ hook_event_name: 'UserPromptSubmit', prompt: '고마워 완벽해' }, st, 300, '2026-07-30') };
  assert.equal(st.gauge.day, '2026-07-30');
  assert.equal(st.gauge.counts.happy, 1);
  assert.equal(st.gauge.counts.angry, 0);
});

test('PreToolUse enters working', () => {
  const s = nextState({ hook_event_name: 'PreToolUse', tool_name: 'Bash' }, prev, 100);
  assert.equal(s.claudeState, 'working');
});

test('PostToolUse success stays working', () => {
  const s = nextState({ hook_event_name: 'PostToolUse', tool_response: { success: true } }, prev, 100);
  assert.equal(s.claudeState, 'working');
});

test('PostToolUse failure shows the error face', () => {
  const s = nextState(
    { hook_event_name: 'PostToolUse', tool_response: { success: false } },
    { ...prev, claudeState: 'working' },
    100
  );
  assert.equal(s.claudeState, 'error');
  assert.equal(s.claudeStateAt, 100);
});

test('PostToolUse detects errors reported as an error field', () => {
  const s = nextState({ hook_event_name: 'PostToolUse', tool_response: { error: 'boom' } }, prev, 100);
  assert.equal(s.claudeState, 'error');
});

test('Stop after tool work celebrates, plain reply goes idle', () => {
  const done = nextState({ hook_event_name: 'Stop' }, { ...prev, claudeState: 'working' }, 100);
  assert.equal(done.claudeState, 'done');
  const quiet = nextState({ hook_event_name: 'Stop' }, { ...prev, claudeState: 'thinking' }, 100);
  assert.equal(quiet.claudeState, 'idle');
});

test('Stop right after an error keeps the error visible', () => {
  const s = nextState({ hook_event_name: 'Stop' }, { ...prev, claudeState: 'error' }, 100);
  assert.equal(s.claudeState, 'error');
});

test('unknown events do not change state', () => {
  const s = nextState({ hook_event_name: 'Whatever' }, prev, 100);
  assert.equal(s, null);
});
