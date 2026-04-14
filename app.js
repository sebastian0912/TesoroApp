const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');
const { initDatabase, closeDatabase } = require('./electron-db');

// autoUpdater se inicializa perezosamente: require('electron-updater')
// construye NsisUpdater al primer acceso y necesita que `app` ya esté vivo.
let _autoUpdater = null;
function getAutoUpdater() {
  if (!_autoUpdater) _autoUpdater = require('electron-updater').autoUpdater;
  return _autoUpdater;
}

const isDev = process.env.NODE_ENV === 'development';

// Suppress CSP/security warnings only while developing (evita ruido en DevTools).
if (isDev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// ─── Single instance lock (best practice Electron) ───────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

let mainWindow = null;

// Utilidad: enviar al renderer solo si la ventana sigue viva.
function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    icon: path.join(__dirname, 'public', 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  // Sin barra de menú nativa (evita atajos como ver código fuente).
  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:4400');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/tesoreria/browser/index.html'), { hash: '/' });
  }

  // ─── Hardening de navegación ───────────────────────────────────────────
  // Bloquear navegaciones fuera del origen local; las externas abren en el navegador del SO.
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    const current = mainWindow.webContents.getURL();
    try {
      const currentOrigin = new URL(current).origin;
      const targetOrigin = new URL(targetUrl).origin;
      if (currentOrigin !== targetOrigin) {
        event.preventDefault();
        shell.openExternal(targetUrl).catch(() => { /* noop */ });
      }
    } catch {
      event.preventDefault();
    }
  });

  // window.open siempre va al navegador del sistema, nunca crea otra BrowserWindow.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => { /* noop */ });
    }
    return { action: 'deny' };
  });

  // Bloquear creación de webviews y forzar config segura si alguno aparece.
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    event.preventDefault();
  });

  // Ctrl+R / F5 en producción: loadFile no maneja el refresh nativo correctamente,
  // así que lo reemplazamos conservando la ruta hash actual.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isReload =
      (input.control && input.key && input.key.toLowerCase() === 'r') ||
      input.key === 'F5';
    if (isReload && !isDev) {
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (!isDev) {
    getAutoUpdater().checkForUpdatesAndNotify().catch((err) => {
      console.error('[autoUpdater] checkForUpdatesAndNotify failed:', err);
    });
  }
}

// ─── IPC ──────────────────────────────────────────────────────────────────
ipcMain.handle('version:get', () => {
  return require(path.resolve(__dirname, 'package.json')).version;
});

ipcMain.handle('env:get', () => {
  return process.env.NODE_ENV || 'production';
});

ipcMain.on('restart-app', () => {
  getAutoUpdater().quitAndInstall();
});

ipcMain.handle('fingerprint:get', async () => {
  return new Promise((resolve, reject) => {
    const csharpAppPath = isDev
      ? path.join(__dirname, 'csharp', 'UareUSampleCSharp_CaptureOnly.exe')
      : path.join(process.resourcesPath, 'csharp', 'UareUSampleCSharp_CaptureOnly.exe');

    execFile(csharpAppPath, (error, stdout, stderr) => {
      if (error) {
        reject({ error: stderr || error.message });
        return;
      }
      const match = stdout.match(/DATA:\s*(.+)/);
      if (match) {
        resolve({ success: true, data: match[1].trim() });
      } else {
        reject({ error: 'No se recibió una imagen en Base64.' });
      }
    });
  });
});

// ─── autoUpdater ──────────────────────────────────────────────────────────
// Se registran listeners sólo cuando app está listo (evita cargar electron-updater
// antes de tiempo, lo que rompería con Electron 34 + electron-updater 6).
function registerAutoUpdaterListeners() {
  const au = getAutoUpdater();
  au.autoDownload = true;
  au.on('update-available', () => sendToRenderer('update-available'));
  au.on('download-progress', (progressObj) => sendToRenderer('update-progress', progressObj));
  au.on('update-downloaded', () => {
    sendToRenderer('update-downloaded');
    setTimeout(() => {
      try { au.quitAndInstall(); } catch (e) { console.error('quitAndInstall:', e); }
    }, 3000);
  });
  au.on('error', (error) => {
    sendToRenderer('update-error', error ? (error.message || String(error)) : 'unknown');
  });
}

// ─── PDF editor externo ───────────────────────────────────────────────────
let currentEditingFile = null;
let fileWatcher = null;
let pdfDebounceTimer = null;

function cleanupPdfContext() {
  if (pdfDebounceTimer) {
    clearTimeout(pdfDebounceTimer);
    pdfDebounceTimer = null;
  }
  if (fileWatcher) {
    if (typeof fileWatcher.close === 'function') fileWatcher.close();
    else clearInterval(fileWatcher);
    fileWatcher = null;
  }
  if (currentEditingFile && fs.existsSync(currentEditingFile)) {
    try { fs.unlinkSync(currentEditingFile); } catch { /* noop */ }
  }
  currentEditingFile = null;
}

ipcMain.handle('pdf:edit-external', async (_event, fileUrl) => {
  try {
    if (typeof fileUrl !== 'string' || !/^https?:\/\//i.test(fileUrl)) {
      return { success: false, error: 'URL inválida' };
    }
    cleanupPdfContext();

    const tmpDir = path.join(os.tmpdir(), 'tesoreria-pdf-edit');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `edit_${Date.now()}.pdf`);

    await new Promise((resolve, reject) => {
      const client = fileUrl.startsWith('https') ? https : http;
      const req = client.get(fileUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectClient = response.headers.location.startsWith('https') ? https : http;
          redirectClient.get(response.headers.location, (res2) => {
            const fileStream = fs.createWriteStream(tmpFile);
            res2.pipe(fileStream);
            fileStream.on('finish', () => { fileStream.close(); resolve(); });
            fileStream.on('error', reject);
          }).on('error', reject);
          return;
        }
        const fileStream = fs.createWriteStream(tmpFile);
        response.pipe(fileStream);
        fileStream.on('finish', () => { fileStream.close(); resolve(); });
        fileStream.on('error', reject);
      });
      req.on('error', reject);
    });

    currentEditingFile = tmpFile;

    const initialSize = fs.statSync(tmpFile).size;
    const openErr = await shell.openPath(tmpFile);
    if (openErr) return { success: false, error: openErr };

    let lastSize = initialSize;
    fileWatcher = fs.watch(tmpFile, (eventType) => {
      if (eventType !== 'change') return;
      if (pdfDebounceTimer) clearTimeout(pdfDebounceTimer);
      pdfDebounceTimer = setTimeout(() => {
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
        } catch { /* archivo puede estar bloqueado por Acrobat */ }
      }, 800);
    });

    return { success: true, filePath: tmpFile };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('pdf:read-file', async () => {
  if (currentEditingFile && fs.existsSync(currentEditingFile)) {
    try {
      const bytes = fs.readFileSync(currentEditingFile);
      return { success: true, bytes: bytes.toString('base64') };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: 'No file being edited' };
});

ipcMain.handle('pdf:finish-edit', async () => {
  cleanupPdfContext();
  return { success: true };
});

// ─── Lifecycle ────────────────────────────────────────────────────────────
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  initDatabase();
  if (!isDev) registerAutoUpdaterListeners();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cleanupPdfContext();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  cleanupPdfContext();
  closeDatabase();
});

// Endurece webContents: bloquea permisos del navegador por defecto (cámara, mic, etc.)
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => { /* noop */ });
    return { action: 'deny' };
  });
});
