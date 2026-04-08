const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { execFile } = require('child_process'); // Asegúrate de importar execFile aquí
const { initDatabase } = require('./electron-db');

// Removed global ELECTRON_DISABLE_SECURITY_WARNINGS to enforce CSP in production
let mainWindow;

autoUpdater.autoDownload = true; // Descargar automáticamente

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false, // Más seguro deshabilitarlo
    }
  });

  if (process.env.NODE_ENV === 'development') {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'; // Suppress CSP only in Dev
    mainWindow.loadURL('http://localhost:4400');
    mainWindow.webContents.openDevTools();
  } else {
    // FIX D3: Use loadFile with hash option for proper routing in prod
    mainWindow.loadFile(path.join(__dirname, 'dist/tesoreria/browser/index.html'), { hash: '/' });
  }

  mainWindow.maximize();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Intercept Ctrl+R / F5 to reload properly (native reload loses index.html path)
  // Preserves the current hash route so the user stays on the same page
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isReload =
      (input.control && input.key.toLowerCase() === 'r') ||
      input.key === 'F5';
    if (isReload && process.env.NODE_ENV !== 'development') {
      event.preventDefault();
      // Extract current hash route from the URL (e.g. "/#/dashboard" → "/dashboard")
      const currentUrl = mainWindow.webContents.getURL();
      const hashIndex = currentUrl.indexOf('#');
      const currentHash = hashIndex !== -1 ? currentUrl.substring(hashIndex + 1) : '/';
      mainWindow.loadFile(
        path.join(__dirname, 'dist/tesoreria/browser/index.html'),
        { hash: currentHash }
      );
    }
  });

  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// IPC para obtener versión y entorno
ipcMain.handle('version:get', () => {
  return require(path.resolve(__dirname, 'package.json')).version;
});

ipcMain.handle('env:get', () => {
  return process.env.NODE_ENV || 'production';
});

// Manejadores de actualizaciones
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-progress', progressObj);
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 3000); // Espera 3 segundos antes de reiniciar
});

autoUpdater.on('error', (error) => {
  mainWindow.webContents.send('update-error', error);
});

// Forzar la instalación sin preguntar
ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

app.on('ready', () => {
  initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});


ipcMain.handle('fingerprint:get', async (event) => {
  return new Promise((resolve, reject) => {
    let csharpAppPath;

    if (process.env.NODE_ENV === 'development') {
      // En desarrollo, el archivo está en el mismo directorio del código
      csharpAppPath = path.join(__dirname, 'csharp', 'UareUSampleCSharp_CaptureOnly.exe');
    } else {
      // En producción, el ejecutable debe estar en la carpeta "resources"
      csharpAppPath = path.join(process.resourcesPath, 'csharp', 'UareUSampleCSharp_CaptureOnly.exe');
    }

    execFile(csharpAppPath, (error, stdout, stderr) => {
      if (error) {
        reject({ error: stderr });
        return;
      }

      const match = stdout.match(/DATA:\s*(.+)/);
      if (match) {
        const base64Image = match[1].trim();
        resolve({ success: true, data: base64Image });
      } else {
        reject({ error: 'No se recibió una imagen en Base64.' });
      }
    });
  });
});

// ─── PDF External Editor ─────────────────────────────────
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const { shell } = require('electron');

let currentEditingFile = null;
let fileWatcher = null;

function cleanupPdfContext() {
  if (fileWatcher) {
    if (typeof fileWatcher.close === 'function') fileWatcher.close();
    else clearInterval(fileWatcher); // Fallback if it was setInterval
    fileWatcher = null;
  }
  if (currentEditingFile && fs.existsSync(currentEditingFile)) {
    try { fs.unlinkSync(currentEditingFile); } catch (e) { }
    currentEditingFile = null;
  }
}

ipcMain.handle('pdf:edit-external', async (event, fileUrl) => {
  try {
    // Si el usuario abre otro PDF sin haber cerrado el anterior,
    // limpiamos explícitamente el reloj de memoria previo para evitar fugas.
    cleanupPdfContext();
    // 1. Create temp file path
    const tmpDir = path.join(os.tmpdir(), 'tesoreria-pdf-edit');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpFile = path.join(tmpDir, `edit_${Date.now()}.pdf`);

    // 2. Download PDF from URL
    await new Promise((resolve, reject) => {
      const client = fileUrl.startsWith('https') ? https : http;
      const req = client.get(fileUrl, (response) => {
        // Follow redirects
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

    // 3. Get the initial file stats for comparison
    const initialStats = fs.statSync(tmpFile);
    const initialSize = initialStats.size;
    const initialMtime = initialStats.mtimeMs;

    // 4. Open with system default PDF editor (e.g. Adobe Acrobat)
    const result = await shell.openPath(tmpFile);
    if (result) {
      // result is non-empty string on error
      return { success: false, error: result };
    }

    // 5. Watch the file for changes (Event-Driven for CPU efficiency)
    if (fileWatcher) {
      if (typeof fileWatcher.close === 'function') fileWatcher.close();
    }
    
    let lastSize = initialSize;
    let debounceTimer = null;
    
    fileWatcher = fs.watch(tmpFile, (eventType) => {
      if (eventType === 'change') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          try {
            if (!fs.existsSync(tmpFile)) return;
            const stats = fs.statSync(tmpFile);
            
            if (stats.size !== lastSize || stats.size > 0) {
              lastSize = stats.size;
              const modifiedBytes = fs.readFileSync(tmpFile);
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('pdf:file-changed', {
                  filePath: tmpFile,
                  bytes: modifiedBytes.toString('base64')
                });
              }
            }
          } catch (e) { /* file may be locked by Adobe */ }
        }, 800); // Debounce to allow Acrobat to finish writing
      }
    });

    return { success: true, filePath: tmpFile };
  } catch (err) {
    return { success: false, error: err.message };
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
