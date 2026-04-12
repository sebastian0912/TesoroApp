const { contextBridge, ipcRenderer } = require('electron');

// Canales permitidos — cualquier canal fuera de esta lista será bloqueado
const ALLOWED_INVOKE = new Set([
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
  'db:cache-get-all-urls',
  'db:mark-request-status',
]);

const ALLOWED_SEND = new Set([
  'restart-app',
]);

const ALLOWED_RECEIVE = new Set([
  'update-available',
  'update-progress',
  'update-downloaded',
  'update-error',
  'pdf:file-changed',
]);

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      if (ALLOWED_SEND.has(channel)) ipcRenderer.send(channel, data);
    },
    on: (channel, func) => {
      if (!ALLOWED_RECEIVE.has(channel)) return () => {};
      const subscription = (_event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    removeAllListeners: (channel) => {
      if (ALLOWED_RECEIVE.has(channel)) ipcRenderer.removeAllListeners(channel);
    },
    invoke: (channel, ...args) => {
      if (ALLOWED_INVOKE.has(channel)) return ipcRenderer.invoke(channel, ...args);
      return Promise.reject(new Error(`Canal IPC bloqueado: ${channel}`));
    },
  },
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
    cacheGetAllUrls: () => ipcRenderer.invoke('db:cache-get-all-urls'),
    markRequestStatus: (data) => ipcRenderer.invoke('db:mark-request-status', data),
  },
});
