'use strict';

/**
 * Register / remove nunchi hooks for the supported coding agents.
 *
 * Claude Code (~/.claude/settings.json) and Codex (~/.codex/hooks.json) use the
 * same `hooks.<Event>[].hooks[]` shape and the same stdin payload fields, so one
 * implementation serves both — only the file path and event names differ.
 *
 * Shared by the CLI (scripts/install-hooks.js) and the menu-bar app. Only
 * entries carrying NUNCHI_MARK (or the legacy claude-pet path) are ever added or
 * removed — hooks belonging to other tools are preserved.
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
  'SubagentStart',
  'SubagentStop',
  'SessionStart',
  'SessionEnd',
];

const TARGETS = {
  claude: {
    label: 'Claude Code',
    settingsPath: path.join(os.homedir(), '.claude', 'settings.json'),
    events: EVENTS,
  },
  codex: {
    label: 'Codex',
    settingsPath: path.join(os.homedir(), '.codex', 'hooks.json'),
    // Codex names the approval event PermissionRequest and has no Notification.
    events: [
      'UserPromptSubmit',
      'PreToolUse',
      'PostToolUse',
      'PermissionRequest',
      'Stop',
      'SubagentStart',
      'SubagentStop',
      'SessionStart',
      'SessionEnd',
    ],
  },
};

function targetConfig(target = 'claude') {
  return TARGETS[target] || TARGETS.claude;
}

function defaultSettingsPath(target = 'claude') {
  return targetConfig(target).settingsPath;
}

/** Agents whose config directory exists on this machine. */
function detectTargets() {
  return Object.keys(TARGETS).filter((t) => fs.existsSync(path.dirname(TARGETS[t].settingsPath)));
}

function defaultHookScript() {
  return path.join(__dirname, '..', 'bin', 'hook.js');
}

function defaultRuntimeDir() {
  return path.join(os.homedir(), '.nunchi', 'runtime');
}

// The files the hook needs to run standalone, with their layout preserved so
// bin/hook.js's `../src/...` requires still resolve.
const RUNTIME_FILES = ['bin/hook.js', 'src/mood.js', 'src/state.js', 'src/gauge.js'];

/**
 * Copies the hook runtime out of the app bundle to a stable location so the
 * registered hook command keeps working after the app moves or updates (a
 * packaged .app keeps these inside app.asar, which `node` can't execute).
 * Returns the path to the runnable hook script.
 */
function syncRuntime({ sourceRoot, runtimeDir = defaultRuntimeDir() } = {}) {
  for (const rel of RUNTIME_FILES) {
    const dest = path.join(runtimeDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, rel), dest);
  }
  return path.join(runtimeDir, 'bin', 'hook.js');
}

const isOurs = (h) =>
  typeof h.command === 'string' &&
  (h.command.includes(NUNCHI_MARK) || h.command.includes('claude-pet/bin/hook.js'));

function readSettings(settingsPath) {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    // Missing file is normal (first install); a corrupt file is not — say so
    // before the rewrite drops whatever the user had configured.
    if (err.code !== 'ENOENT') {
      console.error(`nunchi: ${settingsPath} is not valid JSON (${err.message}); ` +
        `installing from scratch. A backup of the unreadable file is kept.`);
    }
    return {};
  }
}

function stripOurs(matchers) {
  return matchers
    .map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !isOurs(h)) }))
    .filter((m) => m.hooks.length > 0);
}

// How many settings backups to keep before pruning the oldest.
const BACKUP_KEEP = 3;

function write(settingsPath, settings) {
  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, `${settingsPath}.bak-${Date.now()}`);
    pruneBackups(settingsPath);
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

/** Keep only the newest BACKUP_KEEP `settings.json.bak-*` files. */
function pruneBackups(settingsPath) {
  const dir = path.dirname(settingsPath);
  const backups = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${path.basename(settingsPath)}.bak-`))
    .sort();
  for (const stale of backups.slice(0, Math.max(0, backups.length - BACKUP_KEEP))) {
    try {
      fs.unlinkSync(path.join(dir, stale));
    } catch {
      /* best effort */
    }
  }
}

/** True if our hook is registered for at least one event of this agent. */
function hooksInstalled({ target = 'claude', settingsPath = defaultSettingsPath(target) } = {}) {
  const hooks = readSettings(settingsPath).hooks || {};
  return targetConfig(target).events.some((e) =>
    (hooks[e] || []).some((m) => (m.hooks || []).some(isOurs))
  );
}

function installHooks({
  target = 'claude',
  settingsPath = defaultSettingsPath(target),
  hookScript = defaultHookScript(),
} = {}) {
  const settings = readSettings(settingsPath);
  settings.hooks = settings.hooks || {};
  const command = `node "${hookScript}" ${NUNCHI_MARK}`;

  for (const event of targetConfig(target).events) {
    const matchers = stripOurs(settings.hooks[event] || []);
    matchers.push({ hooks: [{ type: 'command', command }] });
    settings.hooks[event] = matchers;
  }
  write(settingsPath, settings);
}

function uninstallHooks({ target = 'claude', settingsPath = defaultSettingsPath(target) } = {}) {
  const settings = readSettings(settingsPath);
  settings.hooks = settings.hooks || {};

  // Sweep every known event name so a target switch can't strand our entries.
  const allEvents = new Set(Object.values(TARGETS).flatMap((t) => t.events));
  for (const event of allEvents) {
    if (!settings.hooks[event]) continue;
    const matchers = stripOurs(settings.hooks[event]);
    if (matchers.length) settings.hooks[event] = matchers;
    else delete settings.hooks[event];
  }
  write(settingsPath, settings);
}

module.exports = {
  installHooks,
  uninstallHooks,
  hooksInstalled,
  syncRuntime,
  detectTargets,
  defaultSettingsPath,
  defaultHookScript,
  defaultRuntimeDir,
  TARGETS,
  NUNCHI_MARK,
  EVENTS,
};
