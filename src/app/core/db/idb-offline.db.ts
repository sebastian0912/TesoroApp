import {
  IOfflineDb, SyncQueueItem, StoredFile, OfflineDbResult,
  CacheDbEntry, SaveRequestQueuePayload, SaveMultipartPayload,
} from './offline-db.types';

const DB_NAME = 'tesoro-offline-v1';
const DB_VERSION = 1;

/**
 * Envuelve un IDBRequest en una Promise (para operaciones de un solo paso).
 * NO uses esto entre dos operaciones de la misma transacción con await —
 * la transacción puede auto-commitearse en el microtask de espera.
 */
function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * Recorre todos los registros de un cursor SIN cruzar un await entre
 * iteraciones — los callbacks se encadenan sincrónicamente para que
 * la transacción nunca llegue a auto-commitearse.
 */
function cursorAll<T>(r: IDBRequest<IDBCursorWithValue | null>): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const rows: T[] = [];
    r.onsuccess = () => {
      const c = r.result;
      if (c) { rows.push(c.value as T); c.continue(); }
      else resolve(rows);
    };
    r.onerror = () => reject(r.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);

    open.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('sync_queue')) {
        const sq = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        sq.createIndex('by_status', 'status', { unique: false });
        sq.createIndex('by_user', 'user_id', { unique: false });
      }

      if (!db.objectStoreNames.contains('sync_queue_files')) {
        const sqf = db.createObjectStore('sync_queue_files', { keyPath: 'id', autoIncrement: true });
        sqf.createIndex('by_request', 'request_id', { unique: false });
      }

      if (!db.objectStoreNames.contains('api_cache')) {
        db.createObjectStore('api_cache', { keyPath: 'url' });
      }
    };

    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('IDB bloqueado por otra pestaña'));
  });
}

const nowStr = () =>
  new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

export class IdbOfflineDb implements IOfflineDb {
  private dbP: Promise<IDBDatabase> = openDb();
  private async getDb(): Promise<IDBDatabase> { return this.dbP; }

  async saveRequestQueue(p: SaveRequestQueuePayload): Promise<OfflineDbResult> {
    try {
      const db = await this.getDb();
      const tx = db.transaction('sync_queue', 'readwrite');
      // Única operación → un solo IDBRequest → await es seguro aquí
      const id = await req(tx.objectStore('sync_queue').add({
        method: p.method, url: p.url, body: p.body, headers: null,
        timestamp: nowStr(), status: 'pending', body_type: 'json',
        idempotency_key: p.idempotencyKey, user_id: p.userId,
        last_error: null, attempt_count: 0,
      }));
      return { success: true, id: id as number };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  }

  async saveMultipartRequest(p: SaveMultipartPayload): Promise<OfflineDbResult> {
    // Transacciones separadas: queue item primero, luego cada archivo.
    // Si falla algún archivo, borramos la fila de queue (rollback manual).
    let queueId: number | undefined;
    try {
      const db = await this.getDb();
      {
        const tx = db.transaction('sync_queue', 'readwrite');
        queueId = await req(tx.objectStore('sync_queue').add({
          method: p.method, url: p.url, body: JSON.stringify(p.formFields),
          headers: null, timestamp: nowStr(), status: 'pending',
          body_type: 'multipart', idempotency_key: p.idempotencyKey,
          user_id: p.userId, last_error: null, attempt_count: 0,
        })) as number;
      }
      for (const f of p.files) {
        const tx = db.transaction('sync_queue_files', 'readwrite');
        await req(tx.objectStore('sync_queue_files').add({
          request_id: queueId,
          field_name: f.fieldName,
          file_name: f.fileName,
          mime_type: f.mimeType,
          base64_data: f.base64,
        }));
      }
      return { success: true, id: queueId };
    } catch (e: any) {
      if (queueId !== undefined) {
        try {
          const db = await this.getDb();
          const tx = db.transaction('sync_queue', 'readwrite');
          await req(tx.objectStore('sync_queue').delete(queueId));
        } catch { /* noop */ }
      }
      return { success: false, error: e?.message };
    }
  }

  async getPendingRequests(opts?: { userId?: string | null }): Promise<SyncQueueItem[]> {
    const db = await this.getDb();
    const tx = db.transaction('sync_queue', 'readonly');
    const all: SyncQueueItem[] = await cursorAll(
      tx.objectStore('sync_queue').index('by_status').openCursor('pending')
    );
    return opts?.userId ? all.filter(r => r.user_id === opts.userId) : all;
  }

  async getFailedRequests(opts?: { userId?: string | null }): Promise<SyncQueueItem[]> {
    const db = await this.getDb();
    const tx = db.transaction('sync_queue', 'readonly');
    const all: SyncQueueItem[] = await cursorAll(
      tx.objectStore('sync_queue').index('by_status').openCursor('failed')
    );
    return opts?.userId ? all.filter(r => r.user_id === opts.userId) : all;
  }

  async getRequestFiles(requestId: number): Promise<StoredFile[]> {
    const db = await this.getDb();
    const tx = db.transaction('sync_queue_files', 'readonly');
    const rows: any[] = await cursorAll(
      tx.objectStore('sync_queue_files').index('by_request').openCursor(requestId)
    );
    return rows.map(r => ({
      id: r.id, field_name: r.field_name, file_name: r.file_name,
      mime_type: r.mime_type, base64_data: r.base64_data,
    }));
  }

  /**
   * CORRECTO: get + put en la misma transacción usando callbacks, no await entre ellos.
   * Si usáramos dos await separados, la TX podría auto-commitearse entre medio.
   */
  async markRequestStatus(data: { id: number; status: string; error?: string }): Promise<void> {
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      const getR = store.get(data.id);
      getR.onsuccess = () => {
        const item = getR.result;
        if (!item) return; // no existe, tx.oncomplete igual resuelve
        item.status = data.status;
        if (data.error !== undefined) {
          item.last_error = data.error;
          item.attempt_count = (item.attempt_count || 0) + 1;
        }
        store.put(item); // lanza el segundo request dentro de la misma TX
      };
      getR.onerror = () => reject(getR.error);
    });
  }

  /**
   * CORRECTO: usa cursor.delete() dentro del propio cursor para no cruzar
   * await entre iteraciones sobre la misma transacción.
   */
  async deleteRequest(id: number): Promise<void> {
    const db = await this.getDb();

    // 1) Borrar archivos con cursor.delete() — una sola TX continua
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sync_queue_files', 'readwrite');
      const store = tx.objectStore('sync_queue_files');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      const curR = store.index('by_request').openCursor(id);
      curR.onsuccess = () => {
        const c = curR.result;
        if (c) { c.delete(); c.continue(); }
      };
      curR.onerror = () => reject(curR.error);
    });

    // 2) Borrar fila de queue — TX separada, operación única
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('sync_queue').delete(id);
    });
  }

  async retryRequest(id: number): Promise<void> {
    await this.markRequestStatus({ id, status: 'pending' });
  }

  async discardRequest(id: number): Promise<void> {
    await this.deleteRequest(id);
  }

  async cacheSave(data: { url: string; data: string }): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction('api_cache', 'readwrite');
    await req(tx.objectStore('api_cache').put({
      url: data.url, data: data.data, updated_at: nowStr(),
    }));
  }

  async cacheGet(url: string): Promise<unknown> {
    const db = await this.getDb();
    const tx = db.transaction('api_cache', 'readonly');
    const row: any = await req(tx.objectStore('api_cache').get(url));
    if (!row) return null;
    try { return JSON.parse(row.data); } catch { return null; }
  }

  async cacheGetAllUrls(): Promise<string[]> {
    const db = await this.getDb();
    const tx = db.transaction('api_cache', 'readonly');
    const rows: any[] = await req(tx.objectStore('api_cache').getAll());
    return rows
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .map(r => r.url);
  }

  async cacheGetAllEntries(): Promise<CacheDbEntry[]> {
    const db = await this.getDb();
    const tx = db.transaction('api_cache', 'readonly');
    const rows: any[] = await req(tx.objectStore('api_cache').getAll());
    return rows
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .map(r => ({ url: r.url, updated_at: r.updated_at }));
  }

  /**
   * CORRECTO: recorre el store con cursor y borra en el mismo callback.
   * No usar getAll() + loop de await delete() — TX se cerraría entre medio.
   */
  async cacheInvalidatePrefix(prefix: string): Promise<void> {
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('api_cache', 'readwrite');
      const store = tx.objectStore('api_cache');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      const curR = store.openCursor();
      curR.onsuccess = () => {
        const c = curR.result;
        if (c) {
          if ((c.key as string).includes(prefix)) c.delete();
          c.continue();
        }
      };
      curR.onerror = () => reject(curR.error);
    });
  }

  async clearCache(): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('api_cache', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('api_cache').clear();
    });
  }

  async clearQueue(): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('sync_queue').clear();
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sync_queue_files', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('sync_queue_files').clear();
    });
  }

  async clearUserData(): Promise<void> {
    await this.clearCache();
    await this.clearQueue();
  }
}
