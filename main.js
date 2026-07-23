'use strict';

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { STATE_FILE, readState } = require('./src/state');

const WIN_W = 180;
const WIN_H = 210;

let win = null;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: workArea.x + workArea.width - WIN_W - 24,
    y: workArea.y + workArea.height - WIN_H - 24,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const push = () => {
    if (win && !win.isDestroyed()) win.webContents.send('pet:state', readState());
  };
  win.webContents.on('did-finish-load', push);

  // watchFile (polling) survives the atomic rename the hook writer uses.
  fs.watchFile(STATE_FILE, { interval: 300 }, push);
  win.on('closed', () => {
    fs.unwatchFile(STATE_FILE);
    win = null;
  });
}

ipcMain.on('pet:quit', () => app.quit());
ipcMain.on('pet:move', (_e, x, y) => {
  if (win && !win.isDestroyed()) win.setPosition(x, y);
});
ipcMain.on('pet:resize', (_e, w, h) => {
  if (!win || win.isDestroyed()) return;
  // Anchor the bottom edge so the pet's feet stay put while scaling.
  const b = win.getBounds();
  win.setBounds({ x: b.x, y: b.y + (b.height - h), width: w, height: h });
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
