const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const { autoUpdater } = require('electron-updater');
const { execFile } = require('child_process');
const { initDatabase, closeDatabase } = require('./electron-db');

let mainWindow = null;

// ─── Auto-updater config ───
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

let updateCheckInterval = null;
let updateRetryCount = 0;
const MAX_UPDATE_RETRIES = 5;
const UPDATE_RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// ─── Helpers ───
/** Envía un mensaje al renderer solo si la ventana existe y no está destruida */
function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send(channel, ...args);
  }
}

// ─── Window ───
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Necesario para sqlite3 nativo
    },
  });

  if (process.env.NODE_ENV === 'development') {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
    mainWindow.loadURL('http://localhost:4400');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, 'dist/tesoreria/browser/index.html'),
      { hash: '/' }
    );
  }

  mainWindow.maximize();

  mainWindow.on('closed', () => {
    cleanupPdfContext();
    mainWindow = null;
  });

  // Interceptar Ctrl+R / F5 para recargar preservando la ruta hash
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isReload =
      (input.control && input.key.toLowerCase() === 'r') || input.key === 'F5';
    if (isReload && process.env.NODE_ENV !== 'development') {
      event.preventDefault();
      const currentUrl = mainWindow.webContents.getURL();
      const hashIndex = currentUrl.indexOf('#');
      const currentHash = hashIndex !== -1 ? currentUrl.substring(hashIndex + 1) : '/';
      mainWindow.loadFile(
        path.join(__dirname, 'dist/tesoreria/browser/index.html'),
        { hash: currentHash }
      );
    }
  });

  // Abrir links externos en el navegador del sistema (no dentro de Electron)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Verificar actualizaciones solo en producción (con reintento)
  if (process.env.NODE_ENV !== 'development') {
    checkForUpdatesWithRetry();
  }
}

// ─── IPC: Versión y entorno ───
ipcMain.handle('version:get', () => {
  try {
    return require(path.resolve(__dirname, 'package.json')).version;
  } catch {
    return '0.0.0';
  }
});

ipcMain.handle('env:get', () => process.env.NODE_ENV || 'production');

// ─── Auto-updater: verificación con reintento ───
function checkForUpdatesWithRetry() {
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    autoUpdater.logger.warn('[updater] Fallo verificando actualizaciones:', err?.message || err);
    scheduleUpdateRetry();
  });
}

function scheduleUpdateRetry() {
  if (updateRetryCount >= MAX_UPDATE_RETRIES) {
    autoUpdater.logger.warn(`[updater] Se alcanzó el máximo de reintentos (${MAX_UPDATE_RETRIES}).`);
    return;
  }
  if (updateCheckInterval) clearTimeout(updateCheckInterval);
  updateRetryCount++;
  autoUpdater.logger.info(`[updater] Reintento ${updateRetryCount}/${MAX_UPDATE_RETRIES} en ${UPDATE_RETRY_INTERVAL_MS / 1000}s`);
  updateCheckInterval = setTimeout(() => checkForUpdatesWithRetry(), UPDATE_RETRY_INTERVAL_MS);
}

// ─── Auto-updater events ───
autoUpdater.on('update-available', (info) => {
  // Detener reintentos — ya encontramos una actualización
  if (updateCheckInterval) { clearTimeout(updateCheckInterval); updateCheckInterval = null; }
  updateRetryCount = 0;
  sendToRenderer('update-available', { version: info?.version || '' });
});

autoUpdater.on('download-progress', (progressObj) =>
  sendToRenderer('update-progress', {
    percent: progressObj.percent,
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total,
  })
);

autoUpdater.on('update-downloaded', (info) => {
  autoUpdater.logger.info('[updater] Actualización descargada:', info?.version);
  sendToRenderer('update-downloaded');
  // Único punto de quitAndInstall — el renderer ya no lo duplica
  setTimeout(() => autoUpdater.quitAndInstall(false, true), 4000);
});

autoUpdater.on('error', (error) => {
  autoUpdater.logger.error('[updater] Error:', error?.message || error);
  sendToRenderer('update-error', { message: error?.message || String(error) });
  // Reintentar después del error
  scheduleUpdateRetry();
});

autoUpdater.on('update-not-available', () => {
  autoUpdater.logger.info('[updater] No hay actualizaciones disponibles.');
  // Limpiar reintentos
  updateRetryCount = 0;
  if (updateCheckInterval) { clearTimeout(updateCheckInterval); updateCheckInterval = null; }
});

ipcMain.on('restart-app', () => autoUpdater.quitAndInstall(false, true));

// ─── App lifecycle ───
app.on('ready', () => {
  initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  cleanupPdfContext();
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ─── IPC: Huella dactilar ───
ipcMain.handle('fingerprint:get', async () => {
  const csharpAppPath =
    process.env.NODE_ENV === 'development'
      ? path.join(__dirname, 'csharp', 'UareUSampleCSharp_CaptureOnly.exe')
      : path.join(process.resourcesPath, 'csharp', 'UareUSampleCSharp_CaptureOnly.exe');

  // Verificar que el ejecutable existe antes de intentar ejecutarlo
  if (!fs.existsSync(csharpAppPath)) {
    return { success: false, error: `Ejecutable no encontrado: ${csharpAppPath}` };
  }

  return new Promise((resolve) => {
    execFile(csharpAppPath, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: error.killed
            ? 'La captura de huella excedió el tiempo límite (30s).'
            : stderr || error.message || 'Error desconocido al capturar huella.',
        });
        return;
      }

      const match = stdout.match(/DATA:\s*(.+)/);
      if (match) {
        resolve({ success: true, data: match[1].trim() });
      } else {
        resolve({ success: false, error: 'No se recibió una imagen válida del lector.' });
      }
    });
  });
});

// ─── IPC: PDF External Editor ───
let currentEditingFile = null;
let fileWatcher = null;
let debounceTimer = null;

function cleanupPdfContext() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (fileWatcher) {
    try { fileWatcher.close(); } catch { /* ya cerrado */ }
    fileWatcher = null;
  }
  if (currentEditingFile && fs.existsSync(currentEditingFile)) {
    try { fs.unlinkSync(currentEditingFile); } catch { /* puede estar bloqueado */ }
    currentEditingFile = null;
  }
}

/** Descarga un archivo por HTTP/HTTPS con soporte de un redirect */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      // Seguir un redirect
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        response.resume();
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(); });
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

ipcMain.handle('pdf:edit-external', async (_event, fileUrl) => {
  try {
    cleanupPdfContext();

    const tmpDir = path.join(os.tmpdir(), 'tesoreria-pdf-edit');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `edit_${Date.now()}.pdf`);

    await downloadFile(fileUrl, tmpFile);
    currentEditingFile = tmpFile;

    const initialStats = fs.statSync(tmpFile);
    let lastSize = initialStats.size;

    // Abrir con el editor PDF del sistema
    const result = await shell.openPath(tmpFile);
    if (result) return { success: false, error: result };

    // Vigilar cambios con debounce
    fileWatcher = fs.watch(tmpFile, (eventType) => {
      if (eventType !== 'change') return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          if (!fs.existsSync(tmpFile)) return;
          const stats = fs.statSync(tmpFile);
          if (stats.size !== lastSize || stats.size > 0) {
            lastSize = stats.size;
            const modifiedBytes = fs.readFileSync(tmpFile);
            sendToRenderer('pdf:file-changed', {
              filePath: tmpFile,
              bytes: modifiedBytes.toString('base64'),
            });
          }
        } catch { /* archivo puede estar bloqueado por el editor */ }
      }, 800);
    });

    return { success: true, filePath: tmpFile };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('pdf:read-file', async () => {
  if (!currentEditingFile || !fs.existsSync(currentEditingFile)) {
    return { success: false, error: 'No hay archivo en edición.' };
  }
  try {
    const bytes = fs.readFileSync(currentEditingFile);
    return { success: true, bytes: bytes.toString('base64') };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('pdf:finish-edit', async () => {
  cleanupPdfContext();
  return { success: true };
});
