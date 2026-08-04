'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const {
  installHooks,
  uninstallHooks,
  hooksInstalled,
  syncRuntime,
  TARGETS,
  NUNCHI_MARK,
  EVENTS,
} = require('../src/hooks');

const REPO_ROOT = path.join(__dirname, '..');

function tmpSettings(initial) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nunchi-hooks-'));
  const file = path.join(dir, 'settings.json');
  if (initial !== undefined) fs.writeFileSync(file, JSON.stringify(initial));
  return { file, dir };
}

test('installHooks registers every event pointing at the hook script', () => {
  const { file } = tmpSettings();
  installHooks({ settingsPath: file, hookScript: '/opt/nunchi/bin/hook.js' });

  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(Object.keys(s.hooks).sort(), [...EVENTS].sort());
  const cmd = s.hooks.Stop[0].hooks[0].command;
  assert.match(cmd, /\/opt\/nunchi\/bin\/hook\.js/);
  assert.match(cmd, new RegExp(NUNCHI_MARK));
});

test('installHooks is idempotent — no duplicate entries', () => {
  const { file } = tmpSettings();
  installHooks({ settingsPath: file, hookScript: '/x/hook.js' });
  installHooks({ settingsPath: file, hookScript: '/x/hook.js' });

  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(s.hooks.Stop.length, 1);
  assert.equal(s.hooks.Stop[0].hooks.length, 1);
});

test('installHooks preserves unrelated user hooks', () => {
  const { file } = tmpSettings({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] },
    other: 'keep me',
  });
  installHooks({ settingsPath: file, hookScript: '/x/hook.js' });

  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(s.other, 'keep me');
  const cmds = s.hooks.Stop.flatMap((m) => m.hooks.map((h) => h.command));
  assert.ok(cmds.some((c) => c.includes('echo mine')));
  assert.ok(cmds.some((c) => c.includes(NUNCHI_MARK)));
});

test('uninstallHooks removes only our entries', () => {
  const { file } = tmpSettings({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] },
  });
  installHooks({ settingsPath: file, hookScript: '/x/hook.js' });
  uninstallHooks({ settingsPath: file });

  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cmds = (s.hooks.Stop || []).flatMap((m) => m.hooks.map((h) => h.command));
  assert.ok(cmds.some((c) => c.includes('echo mine')));
  assert.ok(!cmds.some((c) => c.includes(NUNCHI_MARK)));
});

test('uninstallHooks also strips legacy claude-pet entries', () => {
  const { file } = tmpSettings({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node "/old/claude-pet/bin/hook.js"' }] }] },
  });
  uninstallHooks({ settingsPath: file });

  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(!s.hooks || !s.hooks.Stop);
});

test('hooksInstalled reflects state', () => {
  const { file } = tmpSettings();
  assert.equal(hooksInstalled({ settingsPath: file }), false);
  installHooks({ settingsPath: file, hookScript: '/x/hook.js' });
  assert.equal(hooksInstalled({ settingsPath: file }), true);
  uninstallHooks({ settingsPath: file });
  assert.equal(hooksInstalled({ settingsPath: file }), false);
});

test('codex target registers its own event names', () => {
  const { file } = tmpSettings();
  installHooks({ settingsPath: file, hookScript: '/x/hook.js', target: 'codex' });

  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const events = Object.keys(s.hooks);
  assert.ok(events.includes('PermissionRequest'), 'codex uses PermissionRequest');
  assert.ok(!events.includes('Notification'), 'codex has no Notification event');
  assert.match(s.hooks.UserPromptSubmit[0].hooks[0].command, new RegExp(NUNCHI_MARK));
});

test('claude target keeps Notification and omits codex-only events', () => {
  const { file } = tmpSettings();
  installHooks({ settingsPath: file, hookScript: '/x/hook.js', target: 'claude' });

  const events = Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).hooks);
  assert.ok(events.includes('Notification'));
  assert.ok(!events.includes('PermissionRequest'));
});

test('installing into codex preserves other tools hooks', () => {
  const { file } = tmpSettings({
    hooks: {
      PreToolUse: [
        { matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'python security_check.py', timeout: 3000 }] },
      ],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'sh other-tool.sh', timeout: 10 }] }],
    },
  });
  installHooks({ settingsPath: file, hookScript: '/x/hook.js', target: 'codex' });

  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const pre = s.hooks.PreToolUse.flatMap((m) => m.hooks.map((h) => h.command));
  assert.ok(pre.some((c) => c.includes('security_check.py')), 'kept security hook');
  // matcher-scoped entries keep their matcher
  assert.equal(s.hooks.PreToolUse[0].matcher, 'Write|Edit');
  const ups = s.hooks.UserPromptSubmit.flatMap((m) => m.hooks.map((h) => h.command));
  assert.ok(ups.some((c) => c.includes('other-tool.sh')), 'kept other tool');
  assert.ok(ups.some((c) => c.includes(NUNCHI_MARK)), 'added ours');
});

test('uninstalling codex leaves other tools intact', () => {
  const { file } = tmpSettings({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'sh other-tool.sh' }] }] },
  });
  installHooks({ settingsPath: file, hookScript: '/x/hook.js', target: 'codex' });
  uninstallHooks({ settingsPath: file, target: 'codex' });

  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cmds = (s.hooks.Stop || []).flatMap((m) => m.hooks.map((h) => h.command));
  assert.deepEqual(cmds, ['sh other-tool.sh']);
});

test('TARGETS exposes both agents with distinct paths', () => {
  assert.ok(TARGETS.claude.settingsPath.includes('.claude'));
  assert.ok(TARGETS.codex.settingsPath.includes('.codex'));
  assert.ok(TARGETS.codex.events.includes('PermissionRequest'));
});

test('syncRuntime copies the hook runtime and it actually runs', () => {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nunchi-rt-'));
  const hookScript = syncRuntime({ sourceRoot: REPO_ROOT, runtimeDir });

  assert.ok(fs.existsSync(hookScript));
  assert.ok(fs.existsSync(path.join(runtimeDir, 'src', 'mood.js')));
  assert.ok(fs.existsSync(path.join(runtimeDir, 'src', 'state.js')));

  // The copied hook must run standalone (its ../src requires resolve).
  const out = cp.execSync(`node "${hookScript}" ${NUNCHI_MARK}`, {
    input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: '좋아 고마워' }),
    env: { ...process.env, HOME: runtimeDir },
  });
  assert.doesNotThrow(() => out); // no crash
  const state = JSON.parse(fs.readFileSync(path.join(runtimeDir, '.nunchi', 'state.json'), 'utf8'));
  assert.equal(state.mood, 'happy');
  fs.rmSync(runtimeDir, { recursive: true, force: true });
});

test('installHooks backs up an existing settings file', () => {
  const { file, dir } = tmpSettings({ hooks: {} });
  installHooks({ settingsPath: file, hookScript: '/x/hook.js' });
  const backups = fs.readdirSync(dir).filter((f) => f.includes('.bak-'));
  assert.equal(backups.length, 1);
});
