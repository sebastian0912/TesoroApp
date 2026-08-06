// src/app/features/positions/services/positions.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { environment } from '@/environments/environment';

export interface Cargo {
  nombre: string;           // PK
  porcentaje_arl: number;   // 0..100
}

export interface CargoListParams {
  q?: string;
  porcentaje_arl?: number;  // exacto (0..100)
  arl?: number;             // alias permitido por el backend (exacto)
  arl_min?: number;         // rango mínimo (0..100)
  arl_max?: number;         // rango máximo (0..100)
}

export interface CargoImportResult {
  ok: boolean;
  creados: number;
  actualizados: number;
  filas_sin_nombre: number;
  errores: Array<{ row: number; nombre: string; error: string }>;
}

@Injectable({ providedIn: 'root' })
export class PositionsService {
  private readonly http = inject(HttpClient);
  /** Ajusta si tu API tiene prefijo distinto */
  private readonly base = `${environment.apiUrl}/gestion_cargos/cargos/`;

  // ---------- LIST ----------
  /**
   * El listado COMPLETO (sin filtros) se cachea: es el catálogo que piden los
   * autocompletes de cargo al abrir cada diálogo de vacante. Cualquier
   * mutación de cargos lo invalida; las consultas con filtros van directo.
   */
  list(params?: CargoListParams): Observable<Cargo[]> {
    const sinFiltros = !params || Object.values(params).every(v => v === undefined || v === null || v === '');
    if (!sinFiltros) {
      return this.http.get<Cargo[]>(this.base, { params: this.buildParams(params) });
    }

    const ahora = Date.now();
    if (!this.listaCache || ahora - this.listaCacheTs > PositionsService.LISTA_TTL_MS) {
      this.listaCache = this.http.get<Cargo[]>(this.base).pipe(
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.listaCacheTs = ahora;
      this.listaCache.subscribe({ error: () => { this.listaCache = null; } });
    }
    return this.listaCache;
  }

  private listaCache: Observable<Cargo[]> | null = null;
  private listaCacheTs = 0;
  private static readonly LISTA_TTL_MS = 5 * 60_000;

  /** El catálogo cambió: la próxima lectura debe ir al servidor. */
  private invalidarLista(): void {
    this.listaCache = null;
    this.listaCacheTs = 0;
  }

  // ---------- RETRIEVE ----------
  get(nombre: string): Observable<Cargo> {
    return this.http.get<Cargo>(this.base + encodeURIComponent(nombre) + '/');
  }

  // ---------- CREATE ----------
  create(body: Cargo): Observable<Cargo> {
    return this.http.post<Cargo>(this.base, body).pipe(tap(() => this.invalidarLista()));
  }

  // ---------- UPDATE (nota: no cambia el PK 'nombre') ----------
  update(nombre: string, body: Partial<Cargo>): Observable<Cargo> {
    return this.http.put<Cargo>(this.base + encodeURIComponent(nombre) + '/', body)
      .pipe(tap(() => this.invalidarLista()));
  }

  // ---------- PATCH ----------
  patch(nombre: string, body: Partial<Cargo>): Observable<Cargo> {
    return this.http.patch<Cargo>(this.base + encodeURIComponent(nombre) + '/', body)
      .pipe(tap(() => this.invalidarLista()));
  }

  // ---------- DELETE ----------
  remove(nombre: string): Observable<void> {
    return this.http.delete<void>(this.base + encodeURIComponent(nombre) + '/')
      .pipe(tap(() => this.invalidarLista()));
  }

  // ---------- IMPORTAR EXCEL ----------
  importExcel(file: File | Blob): Observable<CargoImportResult> {
    const form = new FormData();
    form.append('file', file, (file as any).name || 'cargos.xlsx');
    return this.http.post<CargoImportResult>(this.base + 'importar-excel/', form)
      .pipe(tap(() => this.invalidarLista()));
  }

  // ---------- EXPORTAR EXCEL (Blob) ----------
  exportExcel(params?: CargoListParams): Observable<Blob> {
    return this.http.get(this.base + 'exportar-excel/', {
      params: this.buildParams(params),
      responseType: 'blob'
    });
  }

  // ---------- Helper: descargar directo ----------
  downloadExcel(params?: CargoListParams, filename = this.makeFilename()): void {
    this.exportExcel(params).subscribe({
      next: (blob: any) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
      },
    });
  }

  // ---------- Helpers ----------
  private buildParams(params?: CargoListParams): HttpParams {
    let p = new HttpParams();
    if (!params) return p;

    const setNum = (key: string, val?: number) => {
      if (val !== undefined && val !== null && !Number.isNaN(val)) {
        p = p.set(key, String(val));
      }
    };

    if (params.q) p = p.set('q', params.q);
    setNum('porcentaje_arl', params.porcentaje_arl);
    setNum('arl', params.arl);           // alias aceptado por el backend
    setNum('arl_min', params.arl_min);
    setNum('arl_max', params.arl_max);

    return p;
  }

  private makeFilename(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `cargos_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`;
  }
}
