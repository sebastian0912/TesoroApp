// src/app/services/fincas.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, shareReplay, tap } from 'rxjs/operators';
import { environment } from '@/environments/environment';
import { getLocalStorageItem, setLocalStorageItem } from '../../../../../../core/utils/safe-storage';

export interface FincaItem {
  /** Nombre limpio del centro de costo. Es lo que se guarda en la vacante. */
  finca: string;
  /**
   * Lo que se muestra y se busca en el autocomplete.
   *
   * Igual a `finca`, salvo cuando el nombre existe en más de una razón social
   * —SAN CARLOS está en Apoyo y en Tu Alianza y son sitios distintos—: ahí
   * llega como "SAN CARLOS (FLORES IPANEMA S.A.S)" para poder elegir cuál es.
   */
  label?: string;
  empresa: string;
  direccion: string;
  temporal: string;
}

/** Etiqueta a mostrar; cae al nombre si el backend aún no manda `label`. */
export function etiquetaFinca(i: FincaItem): string {
  return (i.label || i.finca || '').trim();
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

  /**
   * Solo nombres de finca (útil para autocompletar).
   *
   * El listado COMPLETO (sin `search`) se cachea unos minutos: es el catálogo
   * que piden los autocompletes al abrir cada diálogo de vacante y no cambia
   * dentro de una sesión de trabajo. Las búsquedas con `search` van directo.
   * (Los campos `memCache`/`cacheKey` estaban declarados desde antes pero
   * nunca se conectaron; esta es la caché que faltaba.)
   */
  listFincas(search?: string): Observable<FincaItem[]> {
    if (search) {
      const params = new HttpParams().set('search', search);
      return this.http.get<FincaItem[]>(this.base, { params }).pipe(
        catchError(err => throwError(() => err))
      );
    }

    const ahora = Date.now();
    if (!this.listaCache || ahora - this.listaCacheTs > FincasService.LISTA_TTL_MS) {
      this.listaCache = this.http.get<FincaItem[]>(this.base).pipe(
        tap(items => { this.memCache = items; this.setToLS(items); }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.listaCacheTs = ahora;
      // Un error no se cachea; el próximo interesado reintenta.
      this.listaCache.subscribe({ error: () => { this.listaCache = null; } });
    }
    return this.listaCache;
  }

  private listaCache: Observable<FincaItem[]> | null = null;
  private listaCacheTs = 0;
  private static readonly LISTA_TTL_MS = 5 * 60_000;

  /**
   * Etiquetas para el autocomplete. Se usa `label` y no `finca` porque los
   * nombres repetidos entre razones sociales llegan desambiguados; con `finca`
   * a secas aparecían dos opciones idénticas y no había forma de saber cuál era
   * la de Apoyo y cuál la de Tu Alianza.
   */
  listNombreFincas(search?: string): Observable<string[]> {
    return this.listFincas(search).pipe(
      map((items: FincaItem[]) =>
        Array.from(new Set(items.map(etiquetaFinca))).filter(Boolean)
      )
    );
  }

  /**
   * Busca una finca por lo que se ve en el autocomplete (case-insensitive).
   *
   * Cruza primero contra `label` —que es único— y solo después contra `finca`,
   * para que escribir el nombre a mano siga funcionando cuando no hay ambigüedad.
   */
  getFincaByNombre(nombre: string): Observable<FincaItem | undefined> {
    const q = (nombre || '').trim().toLowerCase();
    if (!q) return of(undefined);
    return this.listFincas(nombre).pipe(
      map((items: FincaItem[]) =>
        items.find(i => etiquetaFinca(i).toLowerCase() === q)
        ?? items.find(i => (i.finca || '').trim().toLowerCase() === q)
      )
    );
  }

  // ================= Helpers de cache =================
  private getFromLS(): FincaItem[] | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = getLocalStorageItem(this.cacheKey);
      return raw ? (JSON.parse(raw) as FincaItem[]) : null;
    } catch {
      return null;
    }
  }

  private setToLS(data: FincaItem[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      setLocalStorageItem(this.cacheKey, JSON.stringify(data));
    } catch { /* noop */ }
  }
}
