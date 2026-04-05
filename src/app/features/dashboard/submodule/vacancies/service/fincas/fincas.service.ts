// src/app/services/fincas.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '@/environments/environment';

export interface FincaItem {
  finca: string;
  empresa: string;
  direccion: string;
  temporal: string;
}

@Injectable({ providedIn: 'root' })
export class FincasService {
  private apiUrl = environment.apiUrl; // ej: https://tuservidor/api
  private readonly base = `${this.apiUrl}/gestion_centros_costos/fincas/`;
  private readonly cacheKey = 'fincas:list:v1';
  private memCache: FincaItem[] | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) { }

  /** Solo nombres de finca (útil para autocompletar). */
  listNombreFincas(search?: string): Observable<string[]> {
    return this.listFincas(search).pipe(
      map(items =>
        Array.from(new Set(items.map(i => (i.finca || '').trim().toString()))).filter(Boolean)
      )
    );
  }

  /** Busca una finca por nombre exacto (case-insensitive). */
  getFincaByNombre(nombre: string): Observable<FincaItem | undefined> {
    const q = (nombre || '').trim();
    if (!q) return of(undefined);
    return this.listFincas(q).pipe(
      map(items => items.find(i => (i.finca || '').toLowerCase() === q.toLowerCase()))
    );
  }

  // ================= Helpers de cache =================
  private getFromLS(): FincaItem[] | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(this.cacheKey);
      return raw ? (JSON.parse(raw) as FincaItem[]) : null;
    } catch {
      return null;
    }
  }

  private setToLS(data: FincaItem[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch { /* noop */ }
  }
}
