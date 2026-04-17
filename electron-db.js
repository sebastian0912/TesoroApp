const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app, ipcMain } = require('electron');
const log = require('electron-log');

let db = null;

function uploadsDir() {
  return path.resolve(app.getPath('userData'), 'offline-uploads');
}

// Borra un archivo de offline-uploads validando que el path esté dentro del
// directorio permitido. Cualquier ruta fuera se ignora.
function safeUnlink(storedPath) {
  if (typeof storedPath !== 'string' || !storedPath.length) return;
  const dir = uploadsDir();
  const resolved = path.resolve(storedPath);
  if (!resolved.startsWith(dir + path.sep)) return;
  try { if (fs.existsSync(resolved)) fs.unlinkSync(resolved); } catch { /* noop */ }
}

// Versión actual del esquema. Subir este número cuando se agregue un ALTER/CREATE
// nuevo en `migrations` abajo. El sistema aplica migraciones faltantes en orden.
const CURRENT_SCHEMA_VERSION = 2;

// Cada migración corre dentro de una transacción. No modificar migraciones ya
// publicadas; solo agregar nuevas con la siguiente versión consecutiva.
const migrations = {
  1: (runAsync) => Promise.all([
    runAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        body TEXT,
        headers TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending'
      )
    `),
    runAsync(`
      CREATE TABLE IF NOT EXISTS api_cache (
        url TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `),
  ]),
  // v2: soporte para uploads offline con FormData (multipart). El body de la
  // request guarda solo los campos no-file en JSON; cada File real se persiste
  // como archivo en `userData/offline-uploads/` y se referencia desde
  // sync_queue_files. Al hacer replay se reconstruye el FormData en runtime.
  2: async (runAsync) => {
    await runAsync(`ALTER TABLE sync_queue ADD COLUMN body_type TEXT DEFAULT 'json'`);
    await runAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT,
        stored_path TEXT NOT NULL,
        FOREIGN KEY(request_id) REFERENCES sync_queue(id) ON DELETE CASCADE
      )
    `);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_files_request ON sync_queue_files(request_id)`);
  },
};

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'tesoro_offline.db');
  // Crea el directorio para uploads offline si no existe.
  try {
    const upDir = uploadsDir();
    if (!fs.existsSync(upDir)) fs.mkdirSync(upDir, { recursive: true });
  } catch (e) {
    log.warn('[electron-db] No se pudo crear offline-uploads:', e.message);
  }

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      log.error('[electron-db] Error abriendo base de datos:', err.message);
      return;
    }
    log.info('[electron-db] SQLite conectado:', dbPath);
    // Imprescindible para que ON DELETE CASCADE limpie sync_queue_files al
    // borrar una request padre.
    db.run('PRAGMA foreign_keys = ON');
    runMigrations().catch((e) => log.error('[electron-db] Migración falló:', e));
  });

  setupIpcHandlers();
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function runMigrations() {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const row = await getAsync(`SELECT value FROM _meta WHERE key = 'schema_version'`);
  const fromVersion = row ? parseInt(row.value, 10) || 0 : 0;

  if (fromVersion >= CURRENT_SCHEMA_VERSION) {
    log.info(`[electron-db] Esquema en v${fromVersion}, sin migraciones pendientes.`);
    return;
  }

  log.info(`[electron-db] Migrando esquema v${fromVersion} → v${CURRENT_SCHEMA_VERSION}`);
  for (let v = fromVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v];
    if (!step) {
      log.warn(`[electron-db] No hay migración definida para v${v}, se omite.`);
      continue;
    }
    await step(runAsync);
    await runAsync(
      `INSERT INTO _meta (key, value) VALUES ('schema_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [String(v)]
    );
    log.info(`[electron-db] Migración a v${v} aplicada.`);
  }
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) log.error('[electron-db] Error cerrando DB:', err.message);
      else log.info('[electron-db] DB cerrada correctamente.');
    });
    db = null;
  }
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
      // Primero localiza los archivos asociados para borrarlos del disco; el
      // CASCADE de FK se encarga de las filas de sync_queue_files al hacer DELETE.
      db.all(
        'SELECT stored_path FROM sync_queue_files WHERE request_id = ?',
        [id],
        (selErr, rows) => {
          // Si la tabla no existiera (migración antigua), seguimos sin files.
          const files = selErr ? [] : (rows || []);
          for (const row of files) safeUnlink(row.stored_path);
          db.run('DELETE FROM sync_queue WHERE id = ?', [id], function (delErr) {
            if (delErr) return reject(delErr.message);
            resolve({ success: true, changes: this.changes });
          });
        }
      );
    });
  });

  // Encola una request multipart: campos no-file en JSON dentro de sync_queue,
  // y referencias a los archivos previamente persistidos a disco en
  // sync_queue_files. Todo en una transacción para no dejar huérfanos.
  ipcMain.handle('db:save-multipart-request', (_event, payload) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      const { method, url, headers, formFields, files } = payload || {};
      if (!method || !url) return reject('method/url requeridos');

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
          `INSERT INTO sync_queue (method, url, body, headers, body_type)
           VALUES (?, ?, ?, ?, 'multipart')`,
          [method, url, JSON.stringify(formFields || []), headers || null],
          function (err) {
            if (err) {
              db.run('ROLLBACK');
              return reject(err.message);
            }
            const requestId = this.lastID;
            const list = Array.isArray(files) ? files : [];
            if (list.length === 0) {
              db.run('COMMIT');
              return resolve({ success: true, id: requestId });
            }
            const stmt = db.prepare(
              `INSERT INTO sync_queue_files
               (request_id, field_name, file_name, mime_type, stored_path)
               VALUES (?, ?, ?, ?, ?)`
            );
            let pending = list.length;
            let aborted = false;
            for (const f of list) {
              stmt.run(
                [requestId, f.fieldName, f.fileName, f.mimeType || null, f.storedPath],
                (insErr) => {
                  if (aborted) return;
                  if (insErr) {
                    aborted = true;
                    stmt.finalize(() => db.run('ROLLBACK', () => reject(insErr.message)));
                    return;
                  }
                  pending--;
                  if (pending === 0) {
                    stmt.finalize((finErr) => {
                      if (finErr) {
                        db.run('ROLLBACK');
                        return reject(finErr.message);
                      }
                      db.run('COMMIT');
                      resolve({ success: true, id: requestId });
                    });
                  }
                }
              );
            }
          }
        );
      });
    });
  });

  ipcMain.handle('db:get-request-files', (_event, requestId) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.all(
        `SELECT id, field_name, file_name, mime_type, stored_path
         FROM sync_queue_files WHERE request_id = ?`,
        [requestId],
        (err, rows) => {
          if (err) return reject(err.message);
          resolve(rows || []);
        }
      );
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
  const ALLOWED_STATUSES = new Set(['pending', 'failed', 'synced']);

  // Wipe completo del estado privado del usuario. Se usa al hacer logout
  // (manual o forzado por 401) para que un segundo usuario del mismo equipo
  // no vea datos cacheados del anterior. Incluye:
  //   - api_cache (respuestas GET cacheadas)
  //   - sync_queue + sync_queue_files (cola pendiente; CASCADE limpia files)
  //   - offline-uploads/ en disco (archivos adjuntos persistidos)
  ipcMain.handle('db:clear-user-data', () => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');

      // Primero recogemos los paths de disco para borrarlos antes del DELETE
      // (después del DELETE no sabríamos qué borrar porque CASCADE ya los quitó).
      db.all('SELECT stored_path FROM sync_queue_files', [], (selErr, rows) => {
        const files = selErr ? [] : (rows || []);
        for (const row of files) safeUnlink(row.stored_path);

        // Fallback: si quedaron huérfanos por crashes, barremos el directorio.
        try {
          const dir = uploadsDir();
          if (fs.existsSync(dir)) {
            for (const entry of fs.readdirSync(dir)) {
              safeUnlink(path.join(dir, entry));
            }
          }
        } catch { /* noop */ }

        db.serialize(() => {
          db.run('DELETE FROM sync_queue');
          db.run('DELETE FROM api_cache', function (delErr) {
            if (delErr) return reject(delErr.message);
            resolve({ success: true });
          });
        });
      });
    });
  });

  ipcMain.handle('db:mark-request-status', (_event, { id, status }) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      if (!ALLOWED_STATUSES.has(status)) return reject(`Estado no permitido: ${status}`);

      const updateRow = () => {
        db.run('UPDATE sync_queue SET status = ? WHERE id = ?', [status, id], function (err) {
          if (err) return reject(err.message);
          resolve({ success: true, changes: this.changes });
        });
      };

      // Si la request queda como 'failed' ya no se reintenta nunca, así que
      // libera los archivos del disco para no acumular basura. La fila se
      // mantiene para auditoría (la borrará el usuario manualmente o un
      // cleanup futuro).
      if (status === 'failed') {
        db.all(
          'SELECT stored_path FROM sync_queue_files WHERE request_id = ?',
          [id],
          (selErr, rows) => {
            const files = selErr ? [] : (rows || []);
            for (const row of files) safeUnlink(row.stored_path);
            db.run('DELETE FROM sync_queue_files WHERE request_id = ?', [id], () => updateRow());
          }
        );
      } else {
        updateRow();
      }
    });
  });
}

module.exports = { initDatabase, closeDatabase };
