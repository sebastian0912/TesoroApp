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

  /**
   * Pago y transporte de la finca, tal como los tiene el maestro de centros de
   * costo. Llegan en `null` cuando NO valen lo mismo en todos los subcentros de
   * esa finca: ahí no hay un valor que se pueda dar por bueno y lo digita quien
   * publica la vacante.
   *
   * Importan porque el mismo nombre en dos razones sociales es otro sitio y
   * otro pago: SAN CARLOS de Apoyo y SAN CARLOS de Tu Alianza no comparten ni
   * salario ni auxilio.
   */
  salario?: number | null;
  auxilio_transporte?: boolean | null;
  ruta?: boolean | null;
  valor_transporte?: number | null;
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
   * TODAS las fincas del maestro que se llaman así (case-insensitive).
   *
   * Cruza primero contra `label` —que es único— y solo si eso no da nada contra
   * `finca`, para que escribir el nombre a mano siga funcionando.
   *
   * Devuelve varias cuando el nombre existe en más de una razón social
   * ("SAN CARLOS" a secas son dos sitios). Quien llama tiene que decidir cuál
   * es: entre las dos cambia la empresa, la dirección, la temporal —y con ella
   * la hoja de labores— y el pago; quedarse con la primera llenaba la vacante
   * con los datos del sitio equivocado.
   */
  buscarFincasPorNombre(nombre: string): Observable<FincaItem[]> {
    const q = (nombre || '').trim().toLowerCase();
    if (!q) return of([]);
    return this.listFincas(nombre).pipe(
      map((items: FincaItem[]) => {
        const porLabel = items.filter(i => etiquetaFinca(i).toLowerCase() === q);
        return porLabel.length
          ? porLabel
          : items.filter(i => (i.finca || '').trim().toLowerCase() === q);
      })
    );
  }

  /**
   * Busca una finca por lo que se ve en el autocomplete (case-insensitive).
   *
   * Con un nombre ambiguo devuelve `undefined` en vez de una de las dos: ver
   * `buscarFincasPorNombre`.
   */
  getFincaByNombre(nombre: string): Observable<FincaItem | undefined> {
    return this.buscarFincasPorNombre(nombre).pipe(
      map((items: FincaItem[]) => (items.length === 1 ? items[0] : undefined))
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
