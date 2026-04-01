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
  },
  pdf: {
    editExternal: (fileUrl) => ipcRenderer.invoke('pdf:edit-external', fileUrl),
    readFile: () => ipcRenderer.invoke('pdf:read-file'),
    finishEdit: () => ipcRenderer.invoke('pdf:finish-edit'),
    onFileChanged: (callback) => ipcRenderer.on('pdf:file-changed', (event, data) => callback(data))
  },
  db: {
    saveRequestQueue: (req) => ipcRenderer.invoke('db:save-request-queue', req),
    getPendingRequests: () => ipcRenderer.invoke('db:get-pending-requests'),
    deleteRequest: (id) => ipcRenderer.invoke('db:delete-request', id),
    cacheSave: (cacheData) => ipcRenderer.invoke('db:cache-save', cacheData),
    cacheGet: (url) => ipcRenderer.invoke('db:cache-get', url),
  }
});
