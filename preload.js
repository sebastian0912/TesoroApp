const { contextBridge, ipcRenderer } = require('electron');

// ─── Whitelist de canales IPC ────────────────────────────────────────────
// Mejor práctica Electron: NUNCA exponer send/invoke/on genéricos.
// Solo se permiten los canales que realmente usa el renderer.
const SEND_CHANNELS = new Set([
  'restart-app',
]);

const INVOKE_CHANNELS = new Set([
  'version:get',
  'env:get',
  'fingerprint:get',
  'pdf:edit-external',
  'pdf:read-file',
  'pdf:finish-edit',
  'db:save-request-queue',
  'db:get-pending-requests',
  'db:delete-request',
  'db:cache-save',
  'db:cache-get',
]);

const ON_CHANNELS = new Set([
  'update-available',
  'update-progress',
  'update-downloaded',
  'update-error',
  'pdf:file-changed',
]);

// API compatible con la ya usada por el renderer (window.electron.ipcRenderer.*)
// pero validando canales antes de cruzar el bridge.
const safeIpc = {
  send: (channel, data) => {
    if (SEND_CHANNELS.has(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`[preload] send canal no permitido: ${channel}`);
    }
  },
  invoke: (channel, ...args) => {
    if (INVOKE_CHANNELS.has(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`[preload] invoke canal no permitido: ${channel}`));
  },
  on: (channel, func) => {
    if (!ON_CHANNELS.has(channel)) {
      console.warn(`[preload] on canal no permitido: ${channel}`);
      return () => { /* noop */ };
    }
    const subscription = (_event, ...args) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  removeAllListeners: (channel) => {
    if (ON_CHANNELS.has(channel)) ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: safeIpc,
  version: {
    get: () => ipcRenderer.invoke('version:get'),
  },
  env: {
    get: () => ipcRenderer.invoke('env:get'),
  },
  fingerprint: {
    get: () => ipcRenderer.invoke('fingerprint:get'),
  },
  pdf: {
    editExternal: (fileUrl) => ipcRenderer.invoke('pdf:edit-external', fileUrl),
    readFile: () => ipcRenderer.invoke('pdf:read-file'),
    finishEdit: () => ipcRenderer.invoke('pdf:finish-edit'),
    onFileChanged: (callback) => {
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on('pdf:file-changed', subscription);
      return () => ipcRenderer.removeListener('pdf:file-changed', subscription);
    },
  },
  db: {
    saveRequestQueue: (req) => ipcRenderer.invoke('db:save-request-queue', req),
    getPendingRequests: () => ipcRenderer.invoke('db:get-pending-requests'),
    deleteRequest: (id) => ipcRenderer.invoke('db:delete-request', id),
    cacheSave: (cacheData) => ipcRenderer.invoke('db:cache-save', cacheData),
    cacheGet: (url) => ipcRenderer.invoke('db:cache-get', url),
  },
});
