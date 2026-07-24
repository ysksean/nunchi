'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  onState: (cb) => ipcRenderer.on('pet:state', (_e, state) => cb(state)),
  quit: () => ipcRenderer.send('pet:quit'),
  move: (x, y) => ipcRenderer.send('pet:move', x, y),
  resize: (w, h) => ipcRenderer.send('pet:resize', w, h),
  onSkins: (cb) => ipcRenderer.on('pet:skins', (_e, skins) => cb(skins)),
  onSkin: (cb) => ipcRenderer.on('pet:skin', (_e, name) => cb(name)),
  menu: (currentSkin) => ipcRenderer.send('pet:menu', currentSkin),
});
