'use strict';

/**
 * Register / remove nunchi hooks in Claude Code's settings.json.
 *
 * Shared by the CLI (scripts/install-hooks.js) and the menu-bar app so both
 * touch settings the same way. Only entries carrying NUNCHI_MARK (or the legacy
 * claude-pet path) are ever added or removed — unrelated hooks are preserved.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// Path-independent marker: appended as an (ignored) CLI flag so install/uninstall
// still match our entries even if the app or repo directory moves.
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

function defaultSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function defaultHookScript() {
  return path.join(__dirname, '..', 'bin', 'hook.js');
}

const isOurs = (h) =>
  typeof h.command === 'string' &&
  (h.command.includes(NUNCHI_MARK) || h.command.includes('claude-pet/bin/hook.js'));

function readSettings(settingsPath) {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

function stripOurs(matchers) {
  return matchers
    .map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !isOurs(h)) }))
    .filter((m) => m.hooks.length > 0);
}

function write(settingsPath, settings) {
  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, `${settingsPath}.bak-${Date.now()}`);
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

/** True if our hook is registered for at least one event. */
function hooksInstalled({ settingsPath = defaultSettingsPath() } = {}) {
  const settings = readSettings(settingsPath);
  const hooks = settings.hooks || {};
  return EVENTS.some((e) => (hooks[e] || []).some((m) => (m.hooks || []).some(isOurs)));
}

function installHooks({ settingsPath = defaultSettingsPath(), hookScript = defaultHookScript() } = {}) {
  const settings = readSettings(settingsPath);
  settings.hooks = settings.hooks || {};
  const command = `node "${hookScript}" ${NUNCHI_MARK}`;

  for (const event of EVENTS) {
    const matchers = stripOurs(settings.hooks[event] || []);
    matchers.push({ hooks: [{ type: 'command', command }] });
    settings.hooks[event] = matchers;
  }
  write(settingsPath, settings);
}

function uninstallHooks({ settingsPath = defaultSettingsPath() } = {}) {
  const settings = readSettings(settingsPath);
  settings.hooks = settings.hooks || {};

  for (const event of EVENTS) {
    const matchers = stripOurs(settings.hooks[event] || []);
    if (matchers.length) settings.hooks[event] = matchers;
    else delete settings.hooks[event];
  }
  write(settingsPath, settings);
}

module.exports = {
  installHooks,
  uninstallHooks,
  hooksInstalled,
  defaultSettingsPath,
  defaultHookScript,
  NUNCHI_MARK,
  EVENTS,
};
