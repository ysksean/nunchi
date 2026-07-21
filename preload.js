'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  onState: (cb) => ipcRenderer.on('pet:state', (_e, state) => cb(state)),
  quit: () => ipcRenderer.send('pet:quit'),
});
