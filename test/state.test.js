'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'bin', 'hook.js');

function makeHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nunchi-state-'));
}

async function withHome(fn) {
  const home = makeHome();
  try {
    return await fn(home);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('concurrent writers from two agents never crash and never lose counts', async () => {
  await withHome(async (home) => {
    const N = 12;
    const errors = [];
    await Promise.all(
      Array.from({ length: N }, () => {
        const k = cp.spawn(process.execPath, [HOOK, '--nunchi-hook'], {
          env: { ...process.env, HOME: home },
          stdio: ['pipe', 'ignore', 'pipe'],
        });
        return new Promise((resolve) => {
          let err = '';
          k.stderr.on('data', (d) => (err += d));
          k.on('close', (code) => {
            if (code !== 0) errors.push(err.split('\n')[0] || `exit ${code}`);
            resolve();
          });
          k.stdin.end(JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: '고마워 완벽해' }));
        });
      })
    );

    assert.deepEqual(errors, [], 'no hook should crash');
    const state = JSON.parse(fs.readFileSync(path.join(home, '.nunchi', 'state.json'), 'utf8'));
    assert.equal(state.gauge.counts.happy, N, 'every prompt must be counted');
  });
});

test('a stale lock does not wedge writes forever', async () => {
  await withHome(async (home) => {
    const dir = path.join(home, '.nunchi');
    fs.mkdirSync(dir, { recursive: true });
    // Simulate a crashed writer that left its lock behind.
    fs.writeFileSync(path.join(dir, 'state.json.lock'), String(process.pid));
    const old = Date.now() - 60_000;
    fs.utimesSync(path.join(dir, 'state.json.lock'), old / 1000, old / 1000);

    const r = cp.spawnSync(process.execPath, [HOOK, '--nunchi-hook'], {
      env: { ...process.env, HOME: home },
      input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: '고마워' }),
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(r.status, 0, r.stderr);
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    assert.equal(state.mood, 'happy');
  });
});
