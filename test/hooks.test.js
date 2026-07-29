'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { installHooks, uninstallHooks, hooksInstalled, NUNCHI_MARK, EVENTS } = require('../src/hooks');

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

test('installHooks backs up an existing settings file', () => {
  const { file, dir } = tmpSettings({ hooks: {} });
  installHooks({ settingsPath: file, hookScript: '/x/hook.js' });
  const backups = fs.readdirSync(dir).filter((f) => f.includes('.bak-'));
  assert.equal(backups.length, 1);
});
