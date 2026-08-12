import {
  IOfflineDb, SyncQueueItem, StoredFile, OfflineDbResult,
  CacheDbEntry, SaveRequestQueuePayload, SaveMultipartPayload,
} from './offline-db.types';

/**
 * Adaptador que implementa IOfflineDb delegando al bridge Electron (IPC → SQLite
 * en el proceso main). Los archivos multipart se guardan a disco vía
 * electron.offline.saveUpload; getRequestFiles los lee y devuelve base64_data
 * listo para que rebuildFormData no tenga que conocer rutas de disco.
 */
export class ElectronDbAdapter implements IOfflineDb {
  private get el(): any { return (window as any).electron; }

  async saveRequestQueue(p: SaveRequestQueuePayload): Promise<OfflineDbResult> {
    const res = await this.el.db.saveRequestQueue({
      method: p.method, url: p.url, body: p.body,
      headers: null, idempotencyKey: p.idempotencyKey, userId: p.userId,
    });
    return res ?? { success: false, error: 'Sin respuesta de IPC' };
  }

  async saveMultipartRequest(p: SaveMultipartPayload): Promise<OfflineDbResult> {
    const stored: { fieldName: string; fileName: string; mimeType: string | null; storedPath: string }[] = [];
    try {
      for (const f of p.files) {
        const res = await this.el.offline.saveUpload({
          base64: f.base64,
          fileName: f.fileName,
          mimeType: f.mimeType ?? 'application/octet-stream',
        });
        if (!res?.success || !res.storedPath) {
          throw new Error(res?.error ?? 'saveUpload falló sin mensaje');
        }
        stored.push({ fieldName: f.fieldName, fileName: f.fileName, mimeType: f.mimeType, storedPath: res.storedPath });
      }

      const saveRes = await this.el.db.saveMultipartRequest({
        method: p.method, url: p.url, headers: null,
        formFields: p.formFields,
        files: stored,
        idempotencyKey: p.idempotencyKey, userId: p.userId,
      });
      if (!saveRes?.success) throw new Error(saveRes?.error ?? 'saveMultipartRequest falló');
      return saveRes;
    } catch (e) {
      // Rollback: borrar archivos que ya se escribieron a disco
      for (const s of stored) {
        this.el.offline.deleteUpload(s.storedPath).catch(() => {});
      }
      throw e;
    }
  }

  async getPendingRequests(opts?: { userId?: string | null }): Promise<SyncQueueItem[]> {
    return (await this.el.db.getPendingRequests({ userId: opts?.userId })) ?? [];
  }

  async getFailedRequests(opts?: { userId?: string | null }): Promise<SyncQueueItem[]> {
    return (await this.el.db.getFailedRequests({ userId: opts?.userId })) ?? [];
  }

  /**
   * Devuelve los archivos de una request multipart con base64_data ya resuelto
   * (leyendo de disco via electron.offline.readUpload). El resto del código
   * no necesita saber que hay rutas de disco involucradas.
   */
  async getRequestFiles(requestId: number): Promise<StoredFile[]> {
    const raw = (await this.el.db.getRequestFiles(requestId)) ?? [];
    const result: StoredFile[] = [];
    for (const f of raw) {
      let base64 = '';
      try {
        const res = await this.el.offline.readUpload(f.stored_path);
        if (res?.success && res.base64) base64 = res.base64;
      } catch { /* dejar vacío — rebuildFormData devolverá null */ }
      result.push({
        id: f.id,
        field_name: f.field_name,
        file_name: f.file_name,
        mime_type: f.mime_type,
        base64_data: base64,
      });
    }
    return result;
  }

  async markRequestStatus(data: { id: number; status: string; error?: string }): Promise<void> {
    await this.el.db.markRequestStatus(data);
  }

  async deleteRequest(id: number): Promise<void> {
    await this.el.db.deleteRequest(id);
  }

  async retryRequest(id: number): Promise<void> {
    await this.el.db.retryRequest(id);
  }

  async discardRequest(id: number): Promise<void> {
    await this.el.db.discardRequest(id);
  }

  async cacheSave(data: { url: string; data: string }): Promise<void> {
    await this.el.db.cacheSave({ url: data.url, data: data.data });
  }

  async cacheGet(url: string): Promise<unknown> {
    const cached = await this.el.db.cacheGet(url);
    if (!cached) return null;
    // El proceso main puede devolver el objeto ya parseado o un string JSON.
    if (typeof cached === 'string') {
      try { return JSON.parse(cached); } catch { return null; }
    }
    return cached;
  }

  async cacheGetAllUrls(): Promise<string[]> {
    return (await this.el.db.cacheGetAllUrls()) ?? [];
  }

  async cacheGetAllEntries(): Promise<CacheDbEntry[]> {
    return (await this.el.db.cacheGetAllEntries()) ?? [];
  }

  async cacheInvalidatePrefix(prefix: string): Promise<void> {
    await this.el.db.cacheInvalidatePrefix(prefix);
  }

  async clearCache(): Promise<void> {
    await this.el.db.clearCache();
  }

  async clearQueue(): Promise<void> {
    await this.el.db.clearQueue();
  }

  async clearUserData(): Promise<void> {
    await this.el.db.clearUserData();
  }
}
