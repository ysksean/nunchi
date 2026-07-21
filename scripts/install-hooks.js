#!/usr/bin/env node
'use strict';

/**
 * Register (or remove, with --uninstall) nunchi hooks in ~/.claude/settings.json.
 * Backs up the settings file before writing. Only touches entries whose command
 * contains the NUNCHI_MARK marker, so other hooks are never modified.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK_SCRIPT = path.join(__dirname, '..', 'bin', 'hook.js');
// Path-independent marker: appended as an (ignored) CLI flag so install/uninstall
// still match our entries even if the repo directory is moved or renamed.
const NUNCHI_MARK = '--nunchi-hook';
const EVENTS = [
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SessionStart',
  'SessionEnd',
];

const uninstall = process.argv.includes('--uninstall');

let settings = {};
if (fs.existsSync(SETTINGS)) {
  settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const backup = `${SETTINGS}.bak-${Date.now()}`;
  fs.copyFileSync(SETTINGS, backup);
  console.log(`backup: ${backup}`);
}

settings.hooks = settings.hooks || {};

const isOurs = (h) =>
  typeof h.command === 'string' &&
  (h.command.includes(NUNCHI_MARK) || h.command.includes('claude-pet/bin/hook.js'));

for (const event of EVENTS) {
  let matchers = settings.hooks[event] || [];

  // Strip our entries first (idempotent install, clean uninstall).
  matchers = matchers
    .map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !isOurs(h)) }))
    .filter((m) => m.hooks.length > 0);

  if (!uninstall) {
    matchers.push({ hooks: [{ type: 'command', command: `node "${HOOK_SCRIPT}" ${NUNCHI_MARK}` }] });
  }

  if (matchers.length > 0) settings.hooks[event] = matchers;
  else delete settings.hooks[event];
}

fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(uninstall ? 'nunchi hooks removed.' : 'nunchi hooks installed.');
console.log('Restart Claude Code sessions to apply.');
