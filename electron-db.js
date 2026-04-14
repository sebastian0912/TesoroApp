const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app, ipcMain } = require('electron');

let db;

function initDatabase() {
  // Configurar la base de datos en la carpeta de datos del usuario (AppData) para asegurar persistencia
  const dbPath = path.join(app.getPath('userData'), 'tesoro_offline.db');
  
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database', err.message);
    } else {
      console.log('Connected to the SQLite database.');
      createTables();
    }
  });

  setupIpcHandlers();
}

function createTables() {
  // Tabla para encolar peticiones de escritura (POST, PUT, DELETE)
  const createQueueTable = `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      body TEXT,
      headers TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending'
    );
  `;

  // Tabla para caché de datos (GET)
  const createCacheTable = `
    CREATE TABLE IF NOT EXISTS api_cache (
      url TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.run(createQueueTable);
  db.run(createCacheTable);
}

function setupIpcHandlers() {
  // --- Colas de Solicitudes Pendientes ---
  ipcMain.handle('db:save-request-queue', (event, { method, url, body, headers }) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT INTO sync_queue (method, url, body, headers) VALUES (?, ?, ?, ?)');
      stmt.run([method, url, body, headers], function (err) {
        if (err) return reject(err.message);
        resolve({ success: true, id: this.lastID });
      });
      stmt.finalize();
    });
  });

  ipcMain.handle('db:get-pending-requests', () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY timestamp ASC", [], (err, rows) => {
        if (err) return reject(err.message);
        resolve(rows);
      });
    });
  });

  ipcMain.handle('db:delete-request', (event, id) => {
    return new Promise((resolve, reject) => {
      db.run("DELETE FROM sync_queue WHERE id = ?", [id], function (err) {
        if (err) return reject(err.message);
        resolve({ success: true, changes: this.changes });
      });
    });
  });

  // --- Caché Dinámico de Lecturas (Online) ---
  ipcMain.handle('db:cache-save', (event, { url, data }) => {
    return new Promise((resolve, reject) => {
      // Upsert: Si ya existe, lo actualiza
      const stmt = db.prepare(`
        INSERT INTO api_cache (url, data, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(url) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP
      `);
      stmt.run([url, data], function (err) {
        if (err) return reject(err.message);
        resolve({ success: true });
      });
      stmt.finalize();
    });
  });

  ipcMain.handle('db:cache-get', (event, url) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT data FROM api_cache WHERE url = ?", [url], (err, row) => {
        if (err) return reject(err.message);
        if (!row) return resolve(null);
        try {
          resolve(JSON.parse(row.data));
        } catch (parseErr) {
          console.warn('[db] cache entry corrupto para', url, parseErr.message);
          resolve(null);
        }
      });
    });
  });
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) console.error('[db] error al cerrar:', err.message);
    });
    db = null;
  }
}

module.exports = { initDatabase, closeDatabase };
