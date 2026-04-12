const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app, ipcMain } = require('electron');

let db = null;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'tesoro_offline.db');

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[electron-db] Error abriendo base de datos:', err.message);
    } else {
      console.log('[electron-db] SQLite conectado:', dbPath);
      createTables();
    }
  });

  setupIpcHandlers();
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) console.error('[electron-db] Error cerrando DB:', err.message);
      else console.log('[electron-db] DB cerrada correctamente.');
    });
    db = null;
  }
}

function createTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        body TEXT,
        headers TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending'
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS api_cache (
        url TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

function setupIpcHandlers() {
  // --- Cola de solicitudes pendientes ---
  ipcMain.handle('db:save-request-queue', (_event, { method, url, body, headers }) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.run(
        'INSERT INTO sync_queue (method, url, body, headers) VALUES (?, ?, ?, ?)',
        [method, url, body, headers],
        function (err) {
          if (err) return reject(err.message);
          resolve({ success: true, id: this.lastID });
        }
      );
    });
  });

  ipcMain.handle('db:get-pending-requests', () => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.all(
        "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY timestamp ASC",
        [],
        (err, rows) => {
          if (err) return reject(err.message);
          resolve(rows);
        }
      );
    });
  });

  ipcMain.handle('db:delete-request', (_event, id) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.run('DELETE FROM sync_queue WHERE id = ?', [id], function (err) {
        if (err) return reject(err.message);
        resolve({ success: true, changes: this.changes });
      });
    });
  });

  // --- Caché de lecturas ---
  ipcMain.handle('db:cache-save', (_event, { url, data }) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.run(
        `INSERT INTO api_cache (url, data, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(url) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP`,
        [url, data],
        function (err) {
          if (err) return reject(err.message);
          resolve({ success: true });
        }
      );
    });
  });

  ipcMain.handle('db:cache-get', (_event, url) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.get('SELECT data FROM api_cache WHERE url = ?', [url], (err, row) => {
        if (err) return reject(err.message);
        try {
          resolve(row ? JSON.parse(row.data) : null);
        } catch {
          resolve(null);
        }
      });
    });
  });

  // --- Obtener todas las URLs cacheadas (para refresh masivo) ---
  ipcMain.handle('db:cache-get-all-urls', () => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.all('SELECT url FROM api_cache ORDER BY updated_at DESC', [], (err, rows) => {
        if (err) return reject(err.message);
        resolve(rows ? rows.map(r => r.url) : []);
      });
    });
  });

  // --- Actualizar estado de una solicitud en cola ---
  ipcMain.handle('db:mark-request-status', (_event, { id, status }) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.run('UPDATE sync_queue SET status = ? WHERE id = ?', [status, id], function (err) {
        if (err) return reject(err.message);
        resolve({ success: true, changes: this.changes });
      });
    });
  });
}

module.exports = { initDatabase, closeDatabase };
