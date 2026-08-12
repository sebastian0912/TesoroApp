import { Injectable } from '@angular/core';
import { IOfflineDb } from './offline-db.types';
import { ElectronDbAdapter } from './electron-db.adapter';
import { IdbOfflineDb } from './idb-offline.db';

/**
 * Punto de inyección único para el almacenamiento offline.
 * En Electron delega al puente IPC (SQLite en el proceso main).
 * En web/PWA/mobile usa IndexedDB nativo.
 *
 * El resto del código inyecta este servicio y usa `offlineDb.db`
 * sin saber qué backend hay debajo.
 */
@Injectable({ providedIn: 'root' })
export class OfflineDbService {
  readonly db: IOfflineDb;
  readonly isElectron: boolean;

  constructor() {
    this.isElectron = !!(window as any).electron?.db;
    this.db = this.isElectron ? new ElectronDbAdapter() : new IdbOfflineDb();
  }
}
