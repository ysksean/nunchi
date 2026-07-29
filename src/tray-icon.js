'use strict';

/**
 * Builds the menu-bar tray icon at runtime — a tiny ghost silhouette — so we
 * don't ship a binary asset. Returns a black+alpha template PNG buffer that
 * macOS recolors for light/dark menu bars.
 */

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
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Coverage of the ghost shape at normalized (x, y) in [0,1], supersampled.
function ghostAlpha(x, y) {
  const cx = 0.5;
  const r = 0.33;
  const midY = 0.52;
  const botY = 0.76;

  let inside = false;
  if (y >= 0.14 && y <= midY) {
    // domed head
    inside = (x - cx) ** 2 + (y - midY) ** 2 <= r * r;
  } else if (y > midY && y <= botY) {
    inside = Math.abs(x - cx) <= r; // straight sides
  } else if (y > botY) {
    // three rounded feet
    for (const fx of [cx - 0.22, cx, cx + 0.22]) {
      if ((x - fx) ** 2 + (y - botY) ** 2 <= 0.11 * 0.11) inside = true;
    }
  }
  if (!inside) return 0;

  // punch out two eyes
  for (const ex of [cx - 0.13, cx + 0.13]) {
    if ((x - ex) ** 2 + (y - 0.44) ** 2 <= 0.055 * 0.055) return 0;
  }
  return 1;
}

function trayIconPng(size = 22, ss = 3) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / size;
          const y = (py + (sy + 0.5) / ss) / size;
          hits += ghostAlpha(x, y);
        }
      }
      const a = Math.round((hits / (ss * ss)) * 255);
      const i = (py * size + px) * 4;
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = a;
    }
  }
  return encodePng(rgba, size, size);
}

module.exports = { trayIconPng };
