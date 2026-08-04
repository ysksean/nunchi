#!/usr/bin/env node
'use strict';

/**
 * Register (or remove, with --uninstall) nunchi hooks for the coding agents
 * found on this machine. Thin CLI over src/hooks.js so the app and the command
 * line stay in sync.
 *
 * Usage:
 *   node scripts/install-hooks.js              # all detected agents
 *   node scripts/install-hooks.js --codex      # just Codex
 *   node scripts/install-hooks.js --uninstall  # remove from all
 */

const { installHooks, uninstallHooks, detectTargets, TARGETS } = require('../src/hooks');

const args = process.argv.slice(2);
const uninstall = args.includes('--uninstall');

const explicit = Object.keys(TARGETS).filter((t) => args.includes(`--${t}`));
const targets = explicit.length ? explicit : detectTargets();

if (!targets.length) {
  console.log('설치할 에이전트를 찾지 못했습니다 (~/.claude 또는 ~/.codex 없음).');
  process.exit(0);
}

for (const target of targets) {
  const { label, settingsPath } = TARGETS[target];
  if (uninstall) uninstallHooks({ target });
  else installHooks({ target });
  console.log(`${uninstall ? '제거' : '설치'}: ${label} → ${settingsPath}`);
}

console.log(`${targets.length}개 에이전트 완료. 세션을 다시 시작하면 적용됩니다.`);
