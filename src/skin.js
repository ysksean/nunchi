'use strict';

/**
 * Skin format: strict SVG sanitizing and validation.
 *
 * Skins are untrusted input that ends up inside the Electron renderer, so the
 * sanitizer never edits the input — it parses, keeps only whitelisted elements
 * and attributes, and re-serializes from scratch. Anything unrecognized is
 * dropped along with its subtree.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_INPUT_BYTES = 64 * 1024;
const MAX_NODES = 500;

const ALLOWED_ELEMENTS = new Set([
  'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline',
]);

const ALLOWED_ATTRS = new Set([
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'points', 'transform',
  'fill', 'fill-opacity', 'fill-rule', 'opacity',
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray',
]);

// Containers we unwrap instead of dropping, so a pasted full SVG file still
// yields its shapes. The wrapper itself is discarded along with its attributes.
const TRANSPARENT_ELEMENTS = new Set(['svg']);

// Values that could pull in remote content or execute — dropped outright.
const UNSAFE_VALUE = /url\s*\(|javascript:|data:|expression\s*\(|[<>]/i;

const TAG_RE = /<(\/?)\s*([a-zA-Z][\w.:-]*)((?:'[^']*'|"[^"]*"|[^>'"])*)>/g;
const ATTR_RE = /([a-zA-Z_:][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function escapeAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function keptAttributes(rest) {
  const out = [];
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(rest)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] || '';
    if (!ALLOWED_ATTRS.has(name)) continue;
    if (UNSAFE_VALUE.test(value)) continue;
    out.push(`${name}="${escapeAttr(value)}"`);
  }
  return out;
}

/**
 * @param {string} input untrusted SVG fragment
 * @returns {{svg: string, dropped: string[]}} re-serialized safe markup
 */
function sanitizeSvg(input) {
  if (typeof input !== 'string') return { svg: '', dropped: [] };
  if (Buffer.byteLength(input, 'utf8') > MAX_INPUT_BYTES) {
    throw new Error('skin body too large');
  }

  const dropped = new Set();
  const out = [];
  const openStack = [];
  let nodes = 0;
  let skipDepth = 0;
  let skipTag = '';
  let m;

  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(input)) !== null) {
    const closing = m[1] === '/';
    const tag = m[2];
    const rest = m[3] || '';
    const selfClosing = /\/\s*$/.test(rest);

    if (skipDepth > 0) {
      if (tag === skipTag) {
        if (closing) skipDepth -= 1;
        else if (!selfClosing) skipDepth += 1;
      }
      continue;
    }

    if (TRANSPARENT_ELEMENTS.has(tag)) continue;

    if (!ALLOWED_ELEMENTS.has(tag)) {
      dropped.add(tag);
      if (!closing && !selfClosing) {
        skipDepth = 1;
        skipTag = tag;
      }
      continue;
    }

    if (closing) {
      if (openStack.length && openStack[openStack.length - 1] === tag) {
        openStack.pop();
        out.push(`</${tag}>`);
      }
      continue;
    }

    if ((nodes += 1) > MAX_NODES) throw new Error('skin body has too many nodes');

    const attrs = keptAttributes(rest);
    const head = attrs.length ? `<${tag} ${attrs.join(' ')}` : `<${tag}`;
    if (selfClosing) {
      out.push(`${head}/>`);
    } else {
      openStack.push(tag);
      out.push(`${head}>`);
    }
  }

  while (openStack.length) out.push(`</${openStack.pop()}>`);
  return { svg: out.join(''), dropped: [...dropped] };
}

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,30}$/i;
const HEX_RE = /^#[0-9a-f]{3,8}$/i;

/**
 * @param {object} skin raw parsed skin JSON
 * @returns {{name: string, author: string, bodySvg: string, palette: object}}
 */
function validateSkin(skin) {
  if (!skin || typeof skin !== 'object') throw new Error('skin must be an object');
  if (typeof skin.name !== 'string' || !NAME_RE.test(skin.name)) {
    throw new Error('skin name must be 1-31 chars of letters, digits or hyphens');
  }

  const { svg, dropped } = sanitizeSvg(typeof skin.bodySvg === 'string' ? skin.bodySvg : '');
  if (!svg) throw new Error(`skin "${skin.name}" has no drawable shapes after sanitizing`);

  const palette = {};
  for (const [key, value] of Object.entries(skin.palette || {})) {
    if (typeof value !== 'string' || !HEX_RE.test(value)) {
      throw new Error(`skin palette.${key} must be a hex color`);
    }
    palette[key] = value;
  }

  return {
    name: skin.name,
    author: typeof skin.author === 'string' ? skin.author.slice(0, 60) : '',
    bodySvg: svg,
    palette,
    dropped,
  };
}

/**
 * Bundled skins. Bodies are drawn against the same 140x150 viewBox as the face
 * layer, which owns eyes (y~68), mouth (y~88) and cheeks (x 34 / 106, y~82).
 */
function builtinSkins() {
  return [
    {
      name: 'ghost',
      author: 'nunchi',
      bodySvg:
        '<path d="M70 24 Q66 10 76 8" stroke="#D8C7B2" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
        '<path d="M20 78 Q20 26 70 26 Q120 26 120 78 L120 118 Q110 129 100 120 Q90 131 80 121 ' +
        'Q70 132 60 121 Q50 131 40 120 Q30 129 20 118 Z" fill="#F7F0E6" stroke="#E7DAC7" stroke-width="2"/>',
      palette: { cheek: '#F6C2BC', faceInk: '#2d2418' },
    },
    {
      name: 'cat',
      author: 'nunchi',
      bodySvg:
        '<path d="M112 130 Q137 127 134 105 Q132 93 121 97" stroke="#E08A63" stroke-width="10" fill="none" stroke-linecap="round"/>' +
        '<path d="M30 52 Q22 20 40 16 Q56 20 62 42 Z" fill="#F0A279"/>' +
        '<path d="M36 46 Q32 27 42 24 Q52 28 55 42 Z" fill="#F7C4AE"/>' +
        '<path d="M110 52 Q118 20 100 16 Q84 20 78 42 Z" fill="#F0A279"/>' +
        '<path d="M104 46 Q108 27 98 24 Q88 28 85 42 Z" fill="#F7C4AE"/>' +
        '<path d="M70 26 C106 26 126 52 126 86 C126 120 102 138 70 138 C38 138 14 120 14 86 C14 52 34 26 70 26 Z" fill="#F0A279"/>' +
        '<ellipse cx="70" cy="112" rx="26" ry="18" fill="#FBD9C6" opacity="0.55"/>' +
        '<ellipse cx="50" cy="137" rx="13" ry="7" fill="#E08A63"/>' +
        '<ellipse cx="90" cy="137" rx="13" ry="7" fill="#E08A63"/>' +
        '<path d="M14 76 L28 79 M14 88 L28 86" stroke="#D4794F" stroke-width="2.2" stroke-linecap="round" opacity="0.65"/>' +
        '<path d="M126 76 L112 79 M126 88 L112 86" stroke="#D4794F" stroke-width="2.2" stroke-linecap="round" opacity="0.65"/>',
      palette: { cheek: '#F5A98F', faceInk: '#3B2A21' },
    },
    {
      name: 'slime',
      author: 'nunchi',
      bodySvg:
        '<ellipse cx="70" cy="139" rx="54" ry="7" fill="#4FA98D" opacity="0.28"/>' +
        '<circle cx="104" cy="20" r="5" fill="#8FE0C6" opacity="0.85"/>' +
        '<circle cx="116" cy="32" r="3" fill="#8FE0C6" opacity="0.6"/>' +
        '<path d="M70 32 C98 32 114 50 122 74 C130 98 136 126 118 134 C99 142 41 142 22 134 ' +
        'C4 126 10 98 18 74 C26 50 42 32 70 32 Z" fill="#8FE0C6"/>' +
        '<ellipse cx="48" cy="52" rx="16" ry="9" fill="#ffffff" opacity="0.5" transform="rotate(-28 48 52)"/>' +
        '<circle cx="104" cy="106" r="7" fill="#ffffff" opacity="0.22"/>' +
        '<circle cx="92" cy="120" r="4.5" fill="#ffffff" opacity="0.16"/>' +
        '<circle cx="30" cy="112" r="5" fill="#ffffff" opacity="0.18"/>',
      palette: { cheek: '#F0A0A8', faceInk: '#1E4A3D' },
    },
    {
      name: 'hamster',
      author: 'nunchi',
      bodySvg:
        '<circle cx="36" cy="34" r="14" fill="#EDBE8E"/><circle cx="36" cy="34" r="8" fill="#F5AFA2"/>' +
        '<circle cx="104" cy="34" r="14" fill="#EDBE8E"/><circle cx="104" cy="34" r="8" fill="#F5AFA2"/>' +
        '<ellipse cx="26" cy="88" rx="15" ry="14" fill="#F5CFA0"/>' +
        '<ellipse cx="114" cy="88" rx="15" ry="14" fill="#F5CFA0"/>' +
        '<path d="M70 26 C108 26 128 54 128 90 C128 122 104 140 70 140 C36 140 12 122 12 90 C12 54 32 26 70 26 Z" fill="#F5CFA0"/>' +
        '<ellipse cx="70" cy="118" rx="28" ry="20" fill="#FDF0DC"/>' +
        '<ellipse cx="55" cy="136" rx="10" ry="6" fill="#E8B98F"/>' +
        '<ellipse cx="85" cy="136" rx="10" ry="6" fill="#E8B98F"/>',
      palette: { cheek: '#F3A9A0', faceInk: '#4A3524' },
    },
  ];
}

/**
 * Reads every *.json skin in a directory. Invalid skins are collected as
 * errors rather than thrown, so one bad file can't stop the pet from starting.
 */
function loadSkinsFrom(dir) {
  const skins = [];
  const errors = [];
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return { skins, errors };
  }

  for (const entry of entries.sort()) {
    if (!entry.endsWith('.json')) continue;
    const file = path.join(dir, entry);
    try {
      skins.push(validateSkin(JSON.parse(fs.readFileSync(file, 'utf8'))));
    } catch (err) {
      errors.push({ file, message: err.message });
    }
  }
  return { skins, errors };
}

const SKINS_DIR = path.join(os.homedir(), '.nunchi', 'skins');
const REGISTRY_BASE = 'https://raw.githubusercontent.com/ysksean/nunchi-skins/main/skins';

/**
 * Turns a CLI argument into a download source. Bare names resolve against the
 * community registry; anything else must be an explicit https URL.
 * @param {string} arg skin name or https URL
 */
function resolveSkinSource(arg) {
  const value = String(arg || '').trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    if (!value.toLowerCase().startsWith('https://')) {
      throw new Error('skin sources must use https');
    }
    const name = path.basename(new URL(value).pathname).replace(/\.json$/i, '');
    return { url: value, name };
  }
  if (!NAME_RE.test(value)) {
    throw new Error('skin name must be 1-31 chars of letters, digits or hyphens');
  }
  return { url: `${REGISTRY_BASE}/${value}.json`, name: value };
}

/** Built-in skins plus user skins; a user skin may override a built-in by name. */
function allSkins() {
  const { skins, errors } = loadSkinsFrom(SKINS_DIR);
  const byName = new Map(builtinSkins().map((s) => [s.name, validateSkin(s)]));
  for (const skin of skins) byName.set(skin.name, skin);
  return { skins: [...byName.values()], errors };
}

module.exports = {
  sanitizeSvg,
  validateSkin,
  builtinSkins,
  loadSkinsFrom,
  allSkins,
  resolveSkinSource,
  SKINS_DIR,
  REGISTRY_BASE,
  MAX_INPUT_BYTES,
  MAX_NODES,
};
