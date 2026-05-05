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
// directorio permitido. Cualquier ruta fuera se ignora. También se rechaza
// cualquier symlink/junction (defensa contra escalada por path traversal del
// renderer comprometido o de archivos plantados por otro proceso).
function safeUnlink(storedPath) {
  if (typeof storedPath !== 'string' || !storedPath.length) return;
  const dir = uploadsDir();
  const resolved = path.resolve(storedPath);
  if (!resolved.startsWith(dir + path.sep)) return;
  try {
    if (!fs.existsSync(resolved)) return;
    const st = fs.lstatSync(resolved);
    if (!st.isFile() || st.isSymbolicLink()) return;
    fs.unlinkSync(resolved);
  } catch { /* noop */ }
}

// Versión actual del esquema. Subir este número cuando se agregue un ALTER/CREATE
// nuevo en `migrations` abajo. El sistema aplica migraciones faltantes en orden.
const CURRENT_SCHEMA_VERSION = 3;

// Helper: agrega columna solo si no existe (migraciones idempotentes).
async function ensureColumn(runAsync, getAllAsyncFn, table, column, definition) {
  const cols = await getAllAsyncFn(`PRAGMA table_info(${table})`);
  const exists = (cols || []).some(c => c.name === column);
  if (!exists) {
    await runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

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
  2: async (runAsync, getAllAsyncFn) => {
    await ensureColumn(runAsync, getAllAsyncFn, 'sync_queue', 'body_type', `TEXT DEFAULT 'json'`);
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
  // v3: idempotencia + multi-usuario + diagnóstico de fallos.
  //   - idempotency_key: permite que el backend deduplique replays cuando un
  //     crash mid-replay deja la fila sin borrar y al siguiente boot se
  //     reproduce. Hoy se envía como header X-Idempotency-Key; el backend
  //     debería persistirlo y rechazar duplicados (TODO backend).
  //   - user_id: el sync service filtra por usuario actual para que un
  //     segundo usuario en el mismo equipo NO reproduzca la cola del primero
  //     con su propio token.
  //   - last_error / attempt_count: observabilidad para la UI de cola.
  3: async (runAsync, getAllAsyncFn) => {
    await ensureColumn(runAsync, getAllAsyncFn, 'sync_queue', 'idempotency_key', 'TEXT');
    await ensureColumn(runAsync, getAllAsyncFn, 'sync_queue', 'user_id', 'TEXT');
    await ensureColumn(runAsync, getAllAsyncFn, 'sync_queue', 'last_error', 'TEXT');
    await ensureColumn(runAsync, getAllAsyncFn, 'sync_queue', 'attempt_count', 'INTEGER DEFAULT 0');
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue(user_id)`);
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

  db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
      log.error('[electron-db] Error abriendo base de datos:', err.message);
      return;
    }
    log.info('[electron-db] SQLite conectado:', dbPath);
    // Imprescindible para que ON DELETE CASCADE limpie sync_queue_files al
    // borrar una request padre.
    db.run('PRAGMA foreign_keys = ON');
    // secure_delete sobreescribe páginas borradas con ceros: defensa contra
    // recuperación de PII desde el .db tras un clearUserData.
    db.run('PRAGMA secure_delete = ON');
    try {
      await runMigrations();
    } catch (e) {
      log.error('[electron-db] Migración falló:', e);
      return;
    }
    // GC de archivos huérfanos: si la app crasheó entre offline:save-upload y
    // db:save-multipart-request, hay binarios en disco sin fila en SQLite.
    // Recuperarlos no es posible (los datos del FormData se perdieron), pero
    // sí impedimos que se acumulen y llenen el disco.
    try {
      await gcOrphanUploads();
    } catch (e) {
      log.warn('[electron-db] GC de uploads falló:', e && e.message ? e.message : e);
    }
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

function getAllAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
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

  log.info(`[electron-db] Migrando esquema v${fromVersion} -> v${CURRENT_SCHEMA_VERSION}`);
  for (let v = fromVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v];
    if (!step) {
      log.warn(`[electron-db] No hay migración definida para v${v}, se omite.`);
      continue;
    }
    // Cada migración recibe runAsync + getAllAsync para poder hacer checks
    // idempotentes (PRAGMA table_info) antes de ALTER. Si la migración falla
    // a la mitad, el siguiente boot la reintenta entera; al ser idempotente
    // los pasos ya aplicados se omiten en vez de re-fallar.
    await step(runAsync, getAllAsync);
    await runAsync(
      `INSERT INTO _meta (key, value) VALUES ('schema_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [String(v)]
    );
    log.info(`[electron-db] Migración a v${v} aplicada.`);
  }
}

// Limpia archivos en offline-uploads/ que no estén referenciados por ninguna
// fila de sync_queue_files. Se ejecuta al boot. Si la app crashea entre
// offline:save-upload (escribe disco) y db:save-multipart-request (INSERT),
// los archivos quedaban como basura permanente.
//
// Defensa en profundidad: además de safeUnlink (que valida prefix + lstat),
// confinamos cada path resuelto al directorio antes de tocar.
async function gcOrphanUploads() {
  const dir = uploadsDir();
  if (!fs.existsSync(dir)) return;
  const dirResolved = path.resolve(dir);

  let onDisk;
  try {
    onDisk = fs.readdirSync(dir).map(f => path.resolve(path.join(dir, f)));
  } catch (e) {
    log.warn('[electron-db] gcOrphanUploads readdir falló:', e.message);
    return;
  }
  if (onDisk.length === 0) return;

  let referenced;
  try {
    const rows = await getAllAsync('SELECT stored_path FROM sync_queue_files');
    referenced = new Set((rows || []).map(r => path.resolve(r.stored_path)));
  } catch (e) {
    log.warn('[electron-db] gcOrphanUploads SELECT falló:', e.message);
    return;
  }

  let removed = 0;
  for (const p of onDisk) {
    // Defensa: si el listing por algún motivo trae paths fuera del dir
    // (no debería, pero el FS no es confiable), saltarlo.
    if (!p.startsWith(dirResolved + path.sep)) continue;
    if (!referenced.has(p)) {
      safeUnlink(p);
      removed++;
    }
  }
  if (removed > 0) log.info(`[electron-db] GC: ${removed} archivo(s) huérfano(s) eliminados.`);
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
  ipcMain.handle('db:save-request-queue', (_event, payload) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      const { method, url, body, headers, idempotencyKey, userId } = payload || {};
      if (!method || !url) return reject('method/url requeridos');
      db.run(
        `INSERT INTO sync_queue (method, url, body, headers, idempotency_key, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [method, url, body || null, headers || null, idempotencyKey || null, userId || null],
        function (err) {
          if (err) return reject(err.message);
          resolve({ success: true, id: this.lastID });
        }
      );
    });
  });

  ipcMain.handle('db:get-pending-requests', (_event, opts) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      // Si llega userId, filtramos para que un segundo usuario no reproduzca
      // la cola del anterior. Si no llega, devolvemos todo (compat retro).
      const userId = opts && typeof opts === 'object' ? opts.userId : null;
      const sql = userId
        ? `SELECT * FROM sync_queue WHERE status = 'pending' AND (user_id IS NULL OR user_id = ?) ORDER BY timestamp ASC`
        : `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY timestamp ASC`;
      const params = userId ? [userId] : [];
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err.message);
        resolve(rows);
      });
    });
  });

  // Lista las requests fallidas para que la UI las exponga al usuario y le
  // permita "Reintentar" o "Descartar". Antes vivían silenciosamente en la
  // tabla sin forma de recuperarlas.
  ipcMain.handle('db:get-failed-requests', (_event, opts) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      const userId = opts && typeof opts === 'object' ? opts.userId : null;
      const sql = userId
        ? `SELECT * FROM sync_queue WHERE status = 'failed' AND (user_id IS NULL OR user_id = ?) ORDER BY timestamp DESC`
        : `SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY timestamp DESC`;
      const params = userId ? [userId] : [];
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err.message);
        resolve(rows || []);
      });
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

  // Reintentar una request fallida: pone status de vuelta en 'pending' y
  // resetea last_error. attempt_count se mantiene como contador histórico.
  // El sync service la levantará en el próximo `syncQueue()`. NO dispara
  // replay aquí (responsabilidad del renderer llamar syncQueue() después).
  ipcMain.handle('db:retry-request', (_event, id) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.run(
        `UPDATE sync_queue SET status = 'pending', last_error = NULL WHERE id = ?`,
        [id],
        function (err) {
          if (err) return reject(err.message);
          resolve({ success: true, changes: this.changes });
        }
      );
    });
  });

  // Descartar una request fallida: borra fila + archivos asociados. Es la
  // operación destructiva consciente que reemplaza al borrado automático que
  // antes hacía mark-request-status('failed').
  ipcMain.handle('db:discard-request', (_event, id) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.all(
        'SELECT stored_path FROM sync_queue_files WHERE request_id = ?',
        [id],
        (selErr, rows) => {
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
      const { method, url, headers, formFields, files, idempotencyKey, userId } = payload || {};
      if (!method || !url) return reject('method/url requeridos');

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
          `INSERT INTO sync_queue (method, url, body, headers, body_type, idempotency_key, user_id)
           VALUES (?, ?, ?, ?, 'multipart', ?, ?)`,
          [method, url, JSON.stringify(formFields || []), headers || null, idempotencyKey || null, userId || null],
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
          // No loggeamos `url` (puede contener cédulas u otros datos PII);
          // basta con un identificador truncado.
          const short = (url || '').slice(0, 80);
          console.warn('[db] cache entry corrupto en url ~', short, parseErr.message);
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

  // Invalida entradas del cache cuyo URL contiene el prefix dado. Se usa
  // tras reproducir con éxito un POST/PUT/PATCH/DELETE para que el GET
  // listador del recurso padre se refresque desde el server.
  //
  // Defensa: se exige prefix con al menos 3 caracteres reales (no solo
  // wildcards) para que un caller comprometido no pueda usar este canal
  // como nuke total del cache (eso ya existe explícito en db:clear-cache).
  ipcMain.handle('db:cache-invalidate-prefix', (_event, prefix) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      if (typeof prefix !== 'string' || prefix.length < 3) {
        return resolve({ success: true, changes: 0 });
      }
      // Rechazar prefijos compuestos solo de wildcards/whitespace.
      if (/^[%_*\s]+$/.test(prefix)) {
        return resolve({ success: true, changes: 0 });
      }
      const pattern = `%${prefix}%`;
      db.run('DELETE FROM api_cache WHERE url LIKE ?', [pattern], function (err) {
        if (err) return reject(err.message);
        resolve({ success: true, changes: this.changes });
      });
    });
  });

  // --- Actualizar estado de una solicitud en cola ---
  const ALLOWED_STATUSES = new Set(['pending', 'failed', 'synced']);

  // Limpia SOLO el cache de respuestas GET. Se invoca en 401 (token expirado)
  // para que el siguiente login no muestre datos del usuario anterior, sin
  // tocar la cola de mutaciones pendientes (esas son del usuario y deben
  // sobrevivir al re-login del mismo usuario; el sync filtrará por user_id).
  ipcMain.handle('db:clear-cache', () => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.run('DELETE FROM api_cache', function (err) {
        if (err) return reject(err.message);
        // VACUUM compacta y reduce recuperación de páginas borradas.
        db.run('VACUUM', () => resolve({ success: true }));
      });
    });
  });

  // Wipe explícito de la cola de mutaciones. Solo se llama en logout MANUAL
  // del usuario y previa confirmación en la UI (puede haber pendientes que
  // se perderían). En 401 NO se llama; usar db:clear-cache.
  ipcMain.handle('db:clear-queue', () => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');

      // Recogemos paths de disco antes del DELETE; CASCADE borra las filas de
      // sync_queue_files pero no los archivos.
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

        db.run('DELETE FROM sync_queue', function (delErr) {
          if (delErr) return reject(delErr.message);
          resolve({ success: true });
        });
      });
    });
  });

  // Wipe completo (cache + cola). Mantenido por compatibilidad con cualquier
  // caller existente. Internamente compone clear-cache + clear-queue.
  ipcMain.handle('db:clear-user-data', () => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      db.all('SELECT stored_path FROM sync_queue_files', [], (selErr, rows) => {
        const files = selErr ? [] : (rows || []);
        for (const row of files) safeUnlink(row.stored_path);
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
            db.run('VACUUM', () => resolve({ success: true }));
          });
        });
      });
    });
  });

  ipcMain.handle('db:mark-request-status', (_event, payload) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject('DB no inicializada');
      const { id, status, error: lastError } = payload || {};
      if (!ALLOWED_STATUSES.has(status)) return reject(`Estado no permitido: ${status}`);

      // IMPORTANTE: a partir de v3 NO borramos los archivos del disco al marcar
      // como 'failed'. Antes se borraban "para liberar disco", lo que impedía
      // al usuario reintentar la request con datos corregidos y, peor, perdía
      // el contenido sin aviso. Los archivos solo se borran al hacer
      // db:discard-request (acción explícita del usuario) o db:delete-request
      // (replay exitoso).
      const sql = lastError
        ? `UPDATE sync_queue SET status = ?, last_error = ?, attempt_count = COALESCE(attempt_count,0) + 1 WHERE id = ?`
        : `UPDATE sync_queue SET status = ?, attempt_count = COALESCE(attempt_count,0) + 1 WHERE id = ?`;
      const params = lastError ? [status, String(lastError).slice(0, 1000), id] : [status, id];

      db.run(sql, params, function (err) {
        if (err) return reject(err.message);
        resolve({ success: true, changes: this.changes });
      });
    });
  });
}

module.exports = { initDatabase, closeDatabase };
