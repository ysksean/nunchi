#!/usr/bin/env node
'use strict';

/**
 * Register (or remove, with --uninstall) nunchi hooks in ~/.claude/settings.json.
 * Thin CLI over src/hooks.js so the app and the command line stay in sync.
 */

const { installHooks, uninstallHooks, defaultSettingsPath } = require('../src/hooks');

const uninstall = process.argv.includes('--uninstall');

if (uninstall) uninstallHooks();
else installHooks();

console.log(`settings: ${defaultSettingsPath()}`);
console.log(uninstall ? 'nunchi hooks removed.' : 'nunchi hooks installed.');
console.log('Restart Claude Code sessions to apply.');
