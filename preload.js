const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  },
  version: {
    get: () => ipcRenderer.invoke('version:get')
  },
  env: {
    get: () => ipcRenderer.invoke('env:get')  // Nuevo método para obtener el entorno
  },
  fingerprint: {
    get: () => ipcRenderer.invoke('fingerprint:get')
  }
});
