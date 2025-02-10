const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

autoUpdater.autoDownload = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: true,
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:4300');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.removeMenu();
    mainWindow.loadURL(`file://${path.join(__dirname, 'dist/tesoreria-angular-electron-actualizacion/browser/index.html')}`);
  }

  mainWindow.maximize();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Evento para manejar recargas de página
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    mainWindow.loadURL(url);
  });

  autoUpdater.checkForUpdatesAndNotify();
}

ipcMain.handle('version:get', () => {
  const packageJson = require(path.resolve(__dirname, 'package.json'));
  return packageJson.version;
});

ipcMain.handle('env:get', () => {
  return process.env.NODE_ENV || 'production';
});

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-downloaded');
});

autoUpdater.on('update-not-available', () => {
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('error', (error) => {
  mainWindow.webContents.send('update-error', error);
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
