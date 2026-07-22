'use strict';

/**
 * Records assets/demo.gif by driving the renderer in an offscreen Electron
 * window: cycles moods, simulates pokes, then encodes captured frames.
 * Run: pnpm demo:record
 */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const W = 360;
const H = 420;
const FPS = 14;
const OUT = path.join(__dirname, '..', 'assets', 'demo.gif');
const KEYFRAME_DIR = path.join(__dirname, '..', 'assets', '.demo-frames');

// Runs inside the page: the demo storyline.
const TIMELINE = `
  (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const pet = document.getElementById('pet');
    const poke = async () => {
      const opts = { pointerId: 1, bubbles: true, screenX: 100, screenY: 100, clientX: 90, clientY: 120 };
      pet.dispatchEvent(new PointerEvent('pointerdown', opts));
      await sleep(240);
      pet.dispatchEvent(new PointerEvent('pointerup', opts));
    };
    await sleep(1400);
    setFace('angry');   await sleep(2400);
    setFace('happy');   await sleep(2000);
    setFace('neutral'); await sleep(700);
    await poke();       await sleep(900);
    await poke();       await sleep(1500);
    setFace('working'); await sleep(1800);
    setFace('done');    await sleep(2600);
    return 'end';
  })()
`;

function bgraToRgba(buf) {
  const out = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i += 4) {
    out[i] = buf[i + 2];
    out[i + 1] = buf[i + 1];
    out[i + 2] = buf[i];
    out[i + 3] = 255;
  }
  return out;
}

app.dock && app.dock.hide();
// Retina doubles capturePage output; force 1x so the GIF is exactly W x H.
app.commandLine.appendSwitch('force-device-scale-factor', '1');

process.on('unhandledRejection', (err) => {
  console.error('record-demo failed:', err);
  app.exit(1);
});
setTimeout(() => {
  console.error('record-demo timed out');
  app.exit(1);
}, 60000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: W,
    height: H,
    show: false,
    frame: false,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  win.webContents.setFrameRate(30);

  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  await win.webContents.insertCSS(
    `html, body { background: #2E2A26 !important; } #stage { zoom: 2; }`
  );

  const frames = [];
  let fw = 0;
  let fh = 0;
  const grab = setInterval(async () => {
    try {
      const img = await win.webContents.capturePage();
      const size = img.getSize();
      if (!fw) {
        fw = size.width;
        fh = size.height;
      }
      if (size.width === fw && size.height === fh) frames.push(img.getBitmap());
    } catch {
      /* window closing */
    }
  }, Math.round(1000 / FPS));

  await win.webContents.executeJavaScript(TIMELINE);
  clearInterval(grab);

  if (frames.length === 0) {
    console.error('no frames captured');
    app.exit(1);
    return;
  }
  console.log(`captured ${frames.length} frames at ${fw}x${fh}, encoding...`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.mkdirSync(KEYFRAME_DIR, { recursive: true });

  const gif = GIFEncoder();
  const delay = Math.round(1000 / FPS);
  frames.forEach((bgra) => {
    const rgba = bgraToRgba(bgra);
    const palette = quantize(rgba, 128);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, fw, fh, { palette, delay });
  });
  gif.finish();
  fs.writeFileSync(OUT, Buffer.from(gif.bytes()));

  // Dump a few keyframes as PNGs for eyeballing the result.
  const marks = [0.08, 0.25, 0.42, 0.62, 0.78, 0.95];
  for (const m of marks) {
    const i = Math.min(frames.length - 1, Math.floor(frames.length * m));
    const { nativeImage } = require('electron');
    const img = nativeImage.createFromBitmap(frames[i], { width: fw, height: fh });
    fs.writeFileSync(path.join(KEYFRAME_DIR, `frame-${String(i).padStart(3, '0')}.png`), img.toPNG());
  }

  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`wrote ${OUT} (${kb} KB, ${frames.length} frames @ ${FPS}fps)`);
  app.quit();
});
