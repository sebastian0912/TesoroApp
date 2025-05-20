const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { execFile } = require('child_process'); // Asegúrate de importar execFile aquí

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
    mainWindow.loadURL('http://localhost:4400');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`file://${path.join(__dirname, 'dist/tesoreria/browser/index.html')}`);
  }

  mainWindow.maximize();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevenir recargas no controladas
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      event.preventDefault();
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

app.on('ready', createWindow);

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
        console.error(`Error al ejecutar el archivo C#: ${stderr}`);
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
