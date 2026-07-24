'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  sanitizeSvg,
  validateSkin,
  builtinSkins,
  loadSkinsFrom,
  resolveSkinSource,
} = require('../src/skin');

function tmpSkinDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nunchi-skins-'));
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return dir;
}

test('keeps allowed shapes and drawing attributes', () => {
  const { svg } = sanitizeSvg(
    '<g id="body"><path d="M10 10 L20 20" fill="#F7F0E6" stroke-width="2"/>' +
      '<ellipse cx="34" cy="82" rx="9" ry="5.5" opacity="0.8"/></g>'
  );
  assert.match(svg, /<path d="M10 10 L20 20" fill="#F7F0E6" stroke-width="2"\/>/);
  assert.match(svg, /<ellipse cx="34" cy="82" rx="9" ry="5.5" opacity="0.8"\/>/);
  assert.match(svg, /^<g>/);
});

test('drops script elements with their content', () => {
  const { svg, dropped } = sanitizeSvg('<g><script>fetch("http://evil")</script><path d="M0 0"/></g>');
  assert.doesNotMatch(svg, /script|fetch|evil/i);
  assert.match(svg, /<path d="M0 0"\/>/);
  assert.ok(dropped.includes('script'));
});

test('drops event handler attributes regardless of case', () => {
  const { svg } = sanitizeSvg('<path d="M0 0" onclick="alert(1)" ONLOAD="steal()" onPointerDown="x()"/>');
  assert.doesNotMatch(svg, /onclick|onload|onpointerdown|alert|steal/i);
  assert.match(svg, /<path d="M0 0"\/>/);
});

test('drops foreignObject and everything inside it', () => {
  const { svg, dropped } = sanitizeSvg(
    '<g><foreignObject><body><img src=x onerror="alert(1)"></body></foreignObject><circle r="5"/></g>'
  );
  assert.doesNotMatch(svg, /foreignobject|img|onerror/i);
  assert.match(svg, /<circle r="5"\/>/);
  assert.ok(dropped.includes('foreignObject'));
});

test('drops external and script-bearing references', () => {
  const a = sanitizeSvg('<image href="https://evil.example/track.png" x="0" y="0"/>');
  assert.equal(a.svg, '');
  const b = sanitizeSvg('<use href="#x"/><use xlink:href="https://evil.example/x.svg#y"/>');
  assert.equal(b.svg, '');
  const c = sanitizeSvg('<path d="M0 0" fill="url(https://evil.example/p)"/>');
  assert.doesNotMatch(c.svg, /evil/i);
});

test('drops javascript: values anywhere', () => {
  const { svg } = sanitizeSvg('<a href="javascript:alert(1)"><path d="M0 0" fill="javascript:alert(2)"/></a>');
  assert.doesNotMatch(svg, /javascript:/i);
});

test('drops style elements and style attributes', () => {
  const { svg } = sanitizeSvg(
    '<g><style>@import url(https://evil.example/x.css)</style><path d="M0 0" style="background:url(https://evil.example/p)"/></g>'
  );
  assert.doesNotMatch(svg, /style|import|evil/i);
  assert.match(svg, /<path d="M0 0"\/>/);
});

test('drops unknown elements entirely', () => {
  const { svg, dropped } = sanitizeSvg('<iframe src="https://evil.example"></iframe><path d="M0 0"/>');
  assert.equal(svg, '<path d="M0 0"/>');
  assert.ok(dropped.includes('iframe'));
});

test('escapes attribute values so markup cannot break out', () => {
  const { svg } = sanitizeSvg('<path d="M0 0&quot;/&gt;&lt;script&gt;alert(1)&lt;/script&gt;"/>');
  assert.doesNotMatch(svg, /<script/i);
});

test('rejects oversized input', () => {
  assert.throws(() => sanitizeSvg('<path d="M0 0"/>'.repeat(20000)), /too large|too many/i);
});

test('unwraps a full svg document so pasted files still work', () => {
  const { svg } = sanitizeSvg(
    '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 150">' +
      '<path d="M20 78 Z" fill="#F7F0E6"/></svg>'
  );
  assert.equal(svg, '<path d="M20 78 Z" fill="#F7F0E6"/>');
});

test('validateSkin accepts a well-formed skin', () => {
  const skin = validateSkin({
    name: 'ghost',
    author: 'ysksean',
    bodySvg: '<path d="M20 78 Q20 26 70 26 Z" fill="#F7F0E6"/>',
    palette: { cheek: '#F6C2BC', faceInk: '#2d2418' },
  });
  assert.equal(skin.name, 'ghost');
  assert.equal(skin.palette.cheek, '#F6C2BC');
  assert.match(skin.bodySvg, /^<path /);
});

test('validateSkin rejects missing name and empty body', () => {
  assert.throws(() => validateSkin({ bodySvg: '<path d="M0 0"/>' }), /name/i);
  assert.throws(() => validateSkin({ name: 'x', bodySvg: '<script>alert(1)</script>' }), /empty|no drawable/i);
});

test('validateSkin reports what it stripped so callers can warn', () => {
  const skin = validateSkin({
    name: 'sneaky',
    bodySvg: '<rect x="10" y="10" width="10" height="10" onload="steal()"/><script>x()</script>',
  });
  assert.deepEqual(skin.dropped, ['script']);
  assert.doesNotMatch(skin.bodySvg, /onload|script/i);
});

test('validateSkin rejects non-hex palette values', () => {
  assert.throws(
    () => validateSkin({ name: 'x', bodySvg: '<path d="M0 0"/>', palette: { cheek: 'url(https://evil)' } }),
    /palette|hex/i
  );
});

test('validateSkin rejects unsafe skin names', () => {
  assert.throws(() => validateSkin({ name: '../../etc/passwd', bodySvg: '<path d="M0 0"/>' }), /name/i);
});

test('builtin skins are present and valid', () => {
  const names = builtinSkins().map((s) => s.name);
  assert.deepEqual(names, ['ghost', 'cat', 'slime', 'hamster']);
  for (const skin of builtinSkins()) {
    assert.doesNotThrow(() => validateSkin(skin));
    assert.ok(skin.bodySvg.length > 0);
  }
});

test('loadSkinsFrom reads user skins and skips broken ones', () => {
  const dir = tmpSkinDir({
    'good.json': { name: 'good', bodySvg: '<circle cx="70" cy="80" r="50" fill="#88AACC"/>' },
    'evil.json': { name: 'evil', bodySvg: '<script>alert(1)</script>' },
    'broken.json': '{ not json',
    'notes.txt': 'ignored',
  });

  const { skins, errors } = loadSkinsFrom(dir);

  assert.deepEqual(skins.map((s) => s.name), ['good']);
  assert.equal(errors.length, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveSkinSource maps a bare name onto the registry', () => {
  const { url, name } = resolveSkinSource('pixel-fox');
  assert.equal(name, 'pixel-fox');
  assert.match(url, /^https:\/\/raw\.githubusercontent\.com\/.+\/pixel-fox\.json$/);
});

test('resolveSkinSource accepts explicit https urls', () => {
  const { url } = resolveSkinSource('https://example.com/skins/fox.json');
  assert.equal(url, 'https://example.com/skins/fox.json');
});

test('resolveSkinSource rejects insecure or unsafe sources', () => {
  assert.throws(() => resolveSkinSource('http://example.com/fox.json'), /https/i);
  assert.throws(() => resolveSkinSource('file:///etc/passwd'), /https/i);
  assert.throws(() => resolveSkinSource('../../etc/passwd'), /name/i);
});

test('loadSkinsFrom returns empty for a missing directory', () => {
  const { skins, errors } = loadSkinsFrom(path.join(os.tmpdir(), 'nunchi-does-not-exist-xyz'));
  assert.deepEqual(skins, []);
  assert.deepEqual(errors, []);
});
