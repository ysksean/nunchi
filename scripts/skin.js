#!/usr/bin/env node
'use strict';

/**
 * Skin manager: list, add and remove nunchi skins.
 *
 *   pnpm skin list
 *   pnpm skin use <name>
 *   pnpm skin add <name|https url>
 *   pnpm skin remove <name>
 *
 * Downloads are sanitized and validated before they ever touch disk, so a
 * hostile skin file cannot smuggle markup into the pet window.
 */

const fs = require('fs');
const path = require('path');
const {
  allSkins,
  builtinSkins,
  loadSkinsFrom,
  resolveSkinSource,
  validateSkin,
  readSkinPref,
  writeSkinPref,
  SKINS_DIR,
  MAX_INPUT_BYTES,
} = require('../src/skin');

const [command, arg] = process.argv.slice(2);

function list() {
  const builtin = new Set(builtinSkins().map((s) => s.name));
  const active = readSkinPref();
  const { skins, errors } = allSkins();
  for (const skin of skins) {
    const origin = builtin.has(skin.name) ? 'builtin' : `user${skin.author ? ` · ${skin.author}` : ''}`;
    const mark = skin.name === active ? '*' : ' ';
    console.log(`${mark} ${skin.name.padEnd(16)} ${origin}`);
  }
  for (const e of errors) console.warn(`  ! ${path.basename(e.file)}: ${e.message}`);
  console.log(`\n설치 위치: ${SKINS_DIR}`);
}

function use(name) {
  const { skins } = allSkins();
  if (!skins.some((s) => s.name === name)) {
    throw new Error(`없는 스킨입니다: ${name} — pnpm skin list로 확인하세요`);
  }
  writeSkinPref(name);
  console.log(`적용: ${name} (실행 중인 펫에 바로 반영됩니다)`);
}

async function add(source) {
  const { url, name } = resolveSkinSource(source);
  console.log(`내려받는 중: ${url}`);

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`다운로드 실패 (HTTP ${res.status})`);

  const body = await res.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_INPUT_BYTES * 2) {
    throw new Error('스킨 파일이 너무 큽니다');
  }

  const skin = validateSkin(JSON.parse(body));
  if (skin.dropped.length) {
    console.warn(`경고: 허용되지 않은 요소를 제거했습니다 → ${skin.dropped.join(', ')}`);
  }
  fs.mkdirSync(SKINS_DIR, { recursive: true });
  const dest = path.join(SKINS_DIR, `${skin.name}.json`);
  fs.writeFileSync(dest, JSON.stringify(skin, null, 2) + '\n');

  console.log(`설치 완료: ${skin.name} → ${dest}`);
  if (skin.name !== name) console.log(`(파일명 기준 이름은 ${name}였지만 매니페스트의 ${skin.name}을 사용합니다)`);
  console.log('펫을 우클릭해 스킨을 고르세요. 실행 중이면 "스킨 새로고침"을 누르면 됩니다.');
}

function remove(name) {
  const { skins } = loadSkinsFrom(SKINS_DIR);
  if (!skins.some((s) => s.name === name)) throw new Error(`설치된 스킨이 아닙니다: ${name}`);
  fs.rmSync(path.join(SKINS_DIR, `${name}.json`), { force: true });
  console.log(`삭제 완료: ${name}`);
}

async function main() {
  switch (command) {
    case 'list':
      return list();
    case 'use':
      if (!arg) throw new Error('사용법: pnpm skin use <name>');
      return use(arg);
    case 'add':
      if (!arg) throw new Error('사용법: pnpm skin add <name|https url>');
      return add(arg);
    case 'remove':
      if (!arg) throw new Error('사용법: pnpm skin remove <name>');
      return remove(arg);
    default:
      console.log('사용법:\n  pnpm skin list\n  pnpm skin use <name>\n  pnpm skin add <name|https url>\n  pnpm skin remove <name>');
  }
}

main().catch((err) => {
  console.error(`오류: ${err.message}`);
  process.exit(1);
});
