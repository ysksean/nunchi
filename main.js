'use strict';

const { app, BrowserWindow, Menu, Tray, nativeImage, screen, shell, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { STATE_FILE, readState } = require('./src/state');
const { allSkins, SKINS_DIR } = require('./src/skin');
const {
  installHooks,
  uninstallHooks,
  hooksInstalled,
  syncRuntime,
  detectTargets,
  TARGETS,
} = require('./src/hooks');
const { trayIconPng } = require('./src/tray-icon');

// Packaged: run the hook from a stable copy outside the (unexecutable) asar,
// so registered hooks survive the app moving or updating. Dev: use the repo.
function installHooksForApp(target) {
  const hookScript = app.isPackaged ? syncRuntime({ sourceRoot: app.getAppPath() }) : undefined;
  installHooks({ target, ...(hookScript ? { hookScript } : {}) });
}

const WIN_W = 180;
const WIN_H = 210;

let win = null;
let tray = null;
let currentSkinName = null;

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
  win.webContents.on('did-finish-load', () => {
    const { skins, errors } = allSkins();
    for (const e of errors) console.warn(`skipped skin ${e.file}: ${e.message}`);
    win.webContents.send('pet:skins', skins);
    push();
  });

  // watchFile (polling) survives the atomic rename the hook writer uses.
  fs.watchFile(STATE_FILE, { interval: 300 }, push);
  win.on('closed', () => {
    fs.unwatchFile(STATE_FILE);
    win = null;
  });
}

function showPet() {
  if (win && !win.isDestroyed()) {
    win.show();
    win.setAlwaysOnTop(true, 'screen-saver');
  }
  refreshTray();
}

function hidePet() {
  if (win && !win.isDestroyed()) win.hide();
  refreshTray();
}

// Menu shared by the tray and the pet's right-click. `forTray` adds
// app-level items (show/hide, login) that don't belong on the pet itself.
function buildMenu({ forTray }) {
  const { skins } = allSkins();
  const template = [];

  if (forTray) {
    const visible = win && !win.isDestroyed() && win.isVisible();
    template.push(
      { label: visible ? '펫 숨기기' : '펫 보이기', click: () => (visible ? hidePet() : showPet()) },
      { type: 'separator' }
    );
  }

  template.push({
    label: '스킨',
    submenu: skins.map((skin) => ({
      label: skin.name + (skin.author && skin.author !== 'nunchi' ? ` — ${skin.author}` : ''),
      type: 'radio',
      checked: skin.name === currentSkinName,
      click: () => {
        if (win && !win.isDestroyed()) win.webContents.send('pet:skin', skin.name);
      },
    })),
  });
  template.push(
    {
      label: '스킨 폴더 열기',
      click: () => {
        fs.mkdirSync(SKINS_DIR, { recursive: true });
        shell.openPath(SKINS_DIR);
      },
    },
    { label: '스킨 새로고침', click: () => win && !win.isDestroyed() && win.reload() },
    { type: 'separator' }
  );

  // One entry per agent found on this machine (Claude Code, Codex, …).
  const found = detectTargets();
  for (const target of found.length ? found : ['claude']) {
    const { label } = TARGETS[target];
    const on = hooksInstalled({ target });
    template.push({
      label: `${label} 훅 ${on ? '제거' : '설치'}`,
      click: () => {
        on ? uninstallHooks({ target }) : installHooksForApp(target);
        refreshTray();
      },
    });
  }

  if (forTray) {
    template.push({
      label: '로그인 시 자동 실행',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    });
    template.push({ type: 'separator' }, { label: 'nunchi 종료', click: () => app.quit() });
  }

  return Menu.buildFromTemplate(template);
}

function refreshTray() {
  if (tray) tray.setContextMenu(buildMenu({ forTray: true }));
}

function createTray() {
  const icon = nativeImage.createFromBuffer(trayIconPng(22));
  icon.setTemplateImage(true); // macOS recolors for light/dark menu bar
  tray = new Tray(icon);
  tray.setToolTip('nunchi');
  tray.on('click', () => tray.popUpContextMenu());
  refreshTray();
}

ipcMain.on('pet:quit', () => app.quit());
ipcMain.on('pet:hide', hidePet);
ipcMain.on('pet:skin-active', (_e, name) => {
  currentSkinName = name;
  refreshTray();
});
ipcMain.on('pet:move', (_e, x, y) => {
  if (win && !win.isDestroyed()) win.setPosition(x, y);
});
ipcMain.on('pet:menu', () => {
  if (win && !win.isDestroyed()) buildMenu({ forTray: false }).popup({ window: win });
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
  createTray();
});

// Menu-bar app: hiding the pet must not quit. The tray keeps nunchi alive;
// quit only from the tray's "nunchi 종료".
app.on('window-all-closed', () => {});
