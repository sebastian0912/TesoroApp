/**
 * Tipos compartidos entre el adaptador Electron (SQLite vía IPC) y el
 * adaptador web (IndexedDB nativo). El resto del código solo ve IOfflineDb —
 * nunca window.electron directamente.
 */

export interface SyncQueueItem {
  id: number;
  method: string;
  url: string;
  body: string | null;
  headers: string | null;
  timestamp: string;
  status: 'pending' | 'failed' | string;
  body_type?: 'json' | 'multipart';
  idempotency_key?: string | null;
  user_id?: string | null;
  last_error?: string | null;
  attempt_count?: number;
}

/** Archivo adjunto a una request multipart encolada. base64_data ya viene listo para
 *  reconstruir el Blob — el adaptador resuelve el almacenamiento (disco vs IDB). */
export interface StoredFile {
  id: number;
  field_name: string;
  file_name: string;
  mime_type: string | null;
  base64_data: string;
}

export interface OfflineDbResult {
  success: boolean;
  id?: number;
  error?: string;
}

export interface SaveRequestQueuePayload {
  method: string;
  url: string;
  body: string | null;
  headers: null;
  idempotencyKey: string;
  userId: string | null;
}

export interface MultipartFilePayload {
  fieldName: string;
  fileName: string;
  mimeType: string | null;
  base64: string;
}

export interface SaveMultipartPayload {
  method: string;
  url: string;
  headers: null;
  formFields: { name: string; value: string }[];
  files: MultipartFilePayload[];
  idempotencyKey: string;
  userId: string | null;
}

export interface CacheDbEntry {
  url: string;
  updated_at: string;
}

/**
 * Interfaz común para ambas implementaciones de almacenamiento offline.
 * Electron usa SQLite (IPC al proceso principal).
 * Web/PWA usa IndexedDB nativo.
 */
export interface IOfflineDb {
  // ── Cola de escritura ──
  saveRequestQueue(payload: SaveRequestQueuePayload): Promise<OfflineDbResult>;
  saveMultipartRequest(payload: SaveMultipartPayload): Promise<OfflineDbResult>;
  getPendingRequests(opts?: { userId?: string | null }): Promise<SyncQueueItem[]>;
  getFailedRequests(opts?: { userId?: string | null }): Promise<SyncQueueItem[]>;
  getRequestFiles(requestId: number): Promise<StoredFile[]>;
  markRequestStatus(data: { id: number; status: string; error?: string }): Promise<void>;
  deleteRequest(id: number): Promise<void>;
  retryRequest(id: number): Promise<void>;
  discardRequest(id: number): Promise<void>;

  // ── Caché de GETs ──
  cacheSave(data: { url: string; data: string }): Promise<void>;
  cacheGet(url: string): Promise<unknown>;
  cacheGetAllUrls(): Promise<string[]>;
  cacheGetAllEntries(): Promise<CacheDbEntry[]>;
  cacheInvalidatePrefix(prefix: string): Promise<void>;

  // ── Limpieza ──
  clearCache(): Promise<void>;
  clearQueue(): Promise<void>;
  clearUserData(): Promise<void>;
}
