'use strict';

/**
 * Generates build/icon.png (1024²) — the cream ghost on a dark squircle —
 * which electron-builder turns into the .icns/.ico app icons. Dependency-free
 * PNG encoder so the build has no native image tooling.
 * Run: pnpm make:icon
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex('#2A2620');
const CREAM = hex('#F7F0E6');
const INK = hex('#2D2418');
const BLUSH = hex('#F6C2BC');

// Rounded-rect coverage (squircle-ish) in pixel space.
function roundRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
    if ((x < x0 + r || x > x1 - r) && (y < y0 + r || y > y1 - r)) {
      return dx * dx + dy * dy <= r * r ? 1 : 0;
    }
    return 1;
  }
  return 0;
}

// Ghost body in local [0,1]².
function ghostBody(gx, gy) {
  const r = 0.33;
  const midY = 0.5;
  const botY = 0.74;
  if (gy >= 0.12 && gy <= midY) return (gx - 0.5) ** 2 + (gy - midY) ** 2 <= r * r;
  if (gy > midY && gy <= botY) return Math.abs(gx - 0.5) <= r;
  if (gy > botY) {
    for (const fx of [0.28, 0.5, 0.72]) if ((gx - fx) ** 2 + (gy - botY) ** 2 <= 0.11 * 0.11) return true;
  }
  return false;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const pad = size * 0.06;
  const rr = size * 0.235;
  const gx0 = size * 0.24;
  const gy0 = size * 0.2;
  const gspan = size * 0.52;

  const put = (i, rgb, a) => {
    rgba[i] = rgb[0];
    rgba[i + 1] = rgb[1];
    rgba[i + 2] = rgb[2];
    rgba[i + 3] = a;
  };

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      // background squircle (supersampled edges)
      let bgc = 0;
      for (const oy of [0.25, 0.75]) for (const ox of [0.25, 0.75]) bgc += roundRect(px + ox, py + oy, pad, pad, size - pad, size - pad, rr);
      bgc /= 4;
      if (bgc <= 0) {
        put(i, BG, 0);
        continue;
      }
      put(i, BG, Math.round(bgc * 255));

      // ghost local coords
      const gx = (px - gx0) / gspan;
      const gy = (py - gy0) / gspan;
      if (gx < -0.1 || gx > 1.1 || gy < -0.1 || gy > 1.1) continue;

      let body = 0;
      for (const oy of [0.25, 0.75]) for (const ox of [0.25, 0.75]) body += ghostBody(gx + (ox - 0.5) / gspan, gy + (oy - 0.5) / gspan) ? 1 : 0;
      body /= 4;
      if (body <= 0) continue;
      put(i, CREAM, 255);

      // blush
      for (const bx of [0.26, 0.74]) {
        if (((gx - bx) / 0.1) ** 2 + ((gy - 0.56) / 0.06) ** 2 <= 1) put(i, BLUSH, 255);
      }
      // eyes
      for (const ex of [0.37, 0.63]) {
        if ((gx - ex) ** 2 + (gy - 0.45) ** 2 <= 0.052 * 0.052) put(i, INK, 255);
      }
      // smile: lower arc of a circle centered above
      const d = Math.hypot(gx - 0.5, gy - 0.52);
      if (gy > 0.58 && d >= 0.13 && d <= 0.16) put(i, INK, 255);
    }
  }
  return encodePng(rgba, size, size);
}

const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, render(1024));
console.log('wrote ' + out);
