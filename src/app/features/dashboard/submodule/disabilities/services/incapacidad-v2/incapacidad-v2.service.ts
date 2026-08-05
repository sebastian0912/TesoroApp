import { Injectable, computed, inject, signal } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';

import { environment } from '@/environments/environment';
import { getLocalStorageItem } from '../../../../../../core/utils/safe-storage';
import {
  CatalogosIncapacidad,
  CodigoDiagnostico,
  CrearIncapacidadV2Request,
  DatosContratacionResponse,
  EmpleadoBusqueda,
  FiltrosIncapacidadV2,
  IncapacidadResumen,
  IncapacidadV2,
  IpsBusqueda,
  Page,
  ResultadoPromocion,
  SubidaSoporteResponse,
  TipoSoporte,
  ValidacionResponse,
  ValidarIncapacidadRequest,
} from '../../models/incapacidad-v2.model';

/**
 * Mapeo `TipoSoporte` -> `legacy_field` que entiende el endpoint multipart
 * de documentos (`POST /Incapacidades/{consecutivo}/documentos/upload`).
 *
 * VERIFICADO contra el backend:
 *   - ms-hr `IncapacidadDocumentService.LEGACY_TO_TYPE_CODE`, que delega en
 *   - commons `DocumentTypeCodes.INCAPACIDAD_LEGACY_FIELD_TO_CODE`.
 * Coincide exactamente con el mapeo del contrato. `soat` tambien es un
 * legacy_field valido en el backend, pero SOAT no es un `TipoSoporte` de la
 * v2, por eso no aparece aqui.
 */
export const LEGACY_FIELD_POR_SOPORTE: Readonly<Record<TipoSoporte, string>> = {
  INCAPACIDAD_MEDICA: 'link_incapacidad',
  HISTORIAL_CLINICO: 'historial_clinico',
  REGISTRO_CIVIL: 'registro_civil',
  REGISTRO_NACIDO_VIVO: 'registro_de_nacido_vivo',
  FURAT: 'furat',
  FURIPS: 'furips',
  FORMULARIO_SALUD_TOTAL: 'formulario_salud_total',
};

/** Ordenamiento para `listar()`. `campo,direccion` estilo Spring Data. */
export interface OrdenListado {
  campo: string;
  direccion?: 'asc' | 'desc';
}

/**
 * Servicio unico de Incapacidades v2.
 *
 * Principios:
 *  - NO se traga los errores: cualquier fallo HTTP se propaga tal cual para
 *    que la vista decida como mostrarlo. La UNICA excepcion deliberada es
 *    `promoverAValidada`, donde el 409 es una respuesta de negocio esperada
 *    y se traduce a `{ ok: false, motivosBloqueo }`.
 *  - El estado que expone son SIGNALS (la app es ZONELESS). Nada de
 *    `BehaviorSubject` para estado de UI.
 *  - Los catalogos se piden UNA sola vez por sesion y quedan cacheados.
 */
@Injectable({ providedIn: 'root' })
export class IncapacidadV2Service {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly base = `${environment.apiUrl}/Incapacidades/v2`;

  // ── Cache de catalogos ────────────────────────────────────────────────
  private readonly _catalogos = signal<CatalogosIncapacidad | null>(null);
  private readonly _cargandoCatalogos = signal(false);

  /** Catalogos ya cacheados (`null` mientras no se hayan pedido). */
  readonly catalogosCache = this._catalogos.asReadonly();
  /** `true` mientras la peticion de catalogos esta en vuelo. */
  readonly cargandoCatalogos = this._cargandoCatalogos.asReadonly();
  /** `true` cuando los catalogos ya estan disponibles. */
  readonly catalogosListos = computed(() => this._catalogos() !== null);

  /** Peticion en vuelo compartida, para que N componentes no disparen N GET. */
  private peticionCatalogos$: Observable<CatalogosIncapacidad> | null = null;

  // ── Cabeceras ─────────────────────────────────────────────────────────

  /**
   * Token desde `localStorage` (SSR-safe via `getLocalStorageItem`).
   * Mismo criterio que el `IncapacidadService` actual.
   */
  private getToken(): string | null {
    return getLocalStorageItem('token');
  }

  /**
   * Cabecera `Authorization`.
   * NOTA: `core/interceptors/auth.interceptor.ts` tambien la inyecta (y le
   * antepone `Bearer ` si falta), asi que en runtime la del interceptor gana.
   * Se deja aqui por consistencia con el resto de servicios del modulo y
   * para que el servicio siga siendo usable sin el interceptor (tests).
   */
  private cabeceras(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders().set('Authorization', token) : new HttpHeaders();
  }

  /** Cabeceras para cuerpos JSON. NO usar en multipart. */
  private cabecerasJson(): HttpHeaders {
    return this.cabeceras().set('Content-Type', 'application/json');
  }

  // ── Validacion (stateless) ────────────────────────────────────────────

  /**
   * `POST /Incapacidades/v2/validar`.
   *
   * Motor de reglas SIN persistencia: se puede llamar en cada cambio del
   * formulario. Devuelve dias, responsable de pago, traslapes, soportes
   * exigidos y alertas.
   */
  validar(req: ValidarIncapacidadRequest): Observable<ValidacionResponse> {
    return this.http.post<ValidacionResponse>(`${this.base}/validar`, req, {
      headers: this.cabecerasJson(),
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────

  /** `POST /Incapacidades/v2` -> 201. */
  crear(req: CrearIncapacidadV2Request): Observable<IncapacidadV2> {
    return this.http.post<IncapacidadV2>(this.base, req, {
      headers: this.cabecerasJson(),
    });
  }

  /** `PUT /Incapacidades/v2/{id}`. */
  actualizar(id: number, req: CrearIncapacidadV2Request): Observable<IncapacidadV2> {
    return this.http.put<IncapacidadV2>(`${this.base}/${id}`, req, {
      headers: this.cabecerasJson(),
    });
  }

  /** `GET /Incapacidades/v2/{id}`. */
  obtener(id: number): Observable<IncapacidadV2> {
    return this.http.get<IncapacidadV2>(`${this.base}/${id}`, {
      headers: this.cabeceras(),
    });
  }

  /** `DELETE /Incapacidades/v2/{id}` -> 204. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, {
      headers: this.cabeceras(),
    });
  }

  /**
   * `POST /Incapacidades/v2/{id}/validar` — promueve la incapacidad a VALIDADA.
   *
   * Contrato: `200` = promovida; `409` = bloqueada, con
   * `{ motivosBloqueo: string[] }` en el cuerpo.
   *
   * El 409 NO se propaga como error porque es una respuesta de negocio
   * esperada: se normaliza a `{ ok: false, motivosBloqueo }`. Cualquier
   * otro codigo (401, 404, 500...) SI se propaga.
   */
  promoverAValidada(id: number): Observable<ResultadoPromocion> {
    return this.http
      .post<IncapacidadV2 | null>(`${this.base}/${id}/validar`, {}, {
        headers: this.cabecerasJson(),
      })
      .pipe(
        map((resp): ResultadoPromocion => ({
          ok: true,
          motivosBloqueo: [],
          incapacidad: resp ?? undefined,
        })),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 409) {
            return of<ResultadoPromocion>({
              ok: false,
              motivosBloqueo: this.extraerMotivosBloqueo(error),
            });
          }
          return throwError(() => error);
        }),
      );
  }

  /** Lee `motivosBloqueo` del cuerpo del 409 tolerando cuerpo string o nulo. */
  private extraerMotivosBloqueo(error: HttpErrorResponse): string[] {
    const cuerpo: unknown = error.error;

    if (cuerpo && typeof cuerpo === 'object') {
      const motivos = (cuerpo as { motivosBloqueo?: unknown }).motivosBloqueo;
      if (Array.isArray(motivos)) {
        return motivos.map((m) => String(m)).filter((m) => m.length > 0);
      }
      const mensaje = (cuerpo as { message?: unknown }).message;
      if (typeof mensaje === 'string' && mensaje) return [mensaje];
    }

    if (typeof cuerpo === 'string' && cuerpo.trim()) {
      // Algunos proxies devuelven el JSON como texto plano.
      try {
        const parseado: unknown = JSON.parse(cuerpo);
        if (parseado && typeof parseado === 'object') {
          const motivos = (parseado as { motivosBloqueo?: unknown }).motivosBloqueo;
          if (Array.isArray(motivos)) return motivos.map((m) => String(m));
        }
      } catch {
        /* no era JSON: se usa el texto tal cual */
      }
      return [cuerpo.trim()];
    }

    return ['La incapacidad no cumple los requisitos para ser validada.'];
  }

  // ── Listado paginado ──────────────────────────────────────────────────

  /**
   * `GET /Incapacidades/v2` -> `Page<IncapacidadResumen>`.
   *
   * @param filtros filtros opcionales; los vacios NO se envian.
   * @param page indice base 0.
   * @param size tamano de pagina.
   * @param sort ordenamiento (`{ campo, direccion }`) o cadena `campo,desc`.
   */
  listar(
    filtros: FiltrosIncapacidadV2 = {},
    page = 0,
    size = 20,
    sort?: OrdenListado | string,
  ): Observable<Page<IncapacidadResumen>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size));

    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor === null || valor === undefined) continue;
      const texto = String(valor).trim();
      if (!texto) continue;
      params = params.set(clave, texto);
    }

    if (sort) {
      const textoSort =
        typeof sort === 'string' ? sort : `${sort.campo},${sort.direccion ?? 'asc'}`;
      if (textoSort.trim()) params = params.set('sort', textoSort.trim());
    }

    return this.http.get<Page<IncapacidadResumen>>(this.base, {
      headers: this.cabeceras(),
      params,
    });
  }

  // ── Catalogos (cacheados en un signal) ────────────────────────────────

  /**
   * `GET /Incapacidades/v2/catalogos`.
   *
   * Se pide UNA sola vez por sesion:
   *  - si ya hay cache, devuelve el valor cacheado sin tocar la red;
   *  - si hay una peticion en vuelo, la comparte (`shareReplay`), asi que
   *    N componentes suscritos a la vez producen UN solo GET.
   *
   * Los errores se propagan (y se limpia la peticion en vuelo para permitir
   * un reintento posterior).
   */
  catalogos(): Observable<CatalogosIncapacidad> {
    const cacheado = this._catalogos();
    if (cacheado) return of(cacheado);

    if (!this.peticionCatalogos$) {
      this._cargandoCatalogos.set(true);
      this.peticionCatalogos$ = this.http
        .get<CatalogosIncapacidad>(`${this.base}/catalogos`, { headers: this.cabeceras() })
        .pipe(
          tap((resp) => this._catalogos.set(resp)),
          catchError((error: unknown) => {
            // Se libera la peticion fallida para poder reintentar.
            this.peticionCatalogos$ = null;
            return throwError(() => error);
          }),
          finalize(() => this._cargandoCatalogos.set(false)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.peticionCatalogos$;
  }

  /** Descarta la cache de catalogos (util tras un cambio administrativo). */
  invalidarCatalogos(): void {
    this._catalogos.set(null);
    this.peticionCatalogos$ = null;
  }

  // ── Endpoints de contratacion reutilizados ────────────────────────────

  /**
   * `GET /contratacion/empleados/buscar?q=&limit=`.
   * Autocomplete de empleados por cedula o nombre.
   */
  buscarEmpleados(q: string, limit = 15): Observable<EmpleadoBusqueda[]> {
    const params = new HttpParams().set('q', q ?? '').set('limit', String(limit));
    return this.http.get<EmpleadoBusqueda[]>(
      `${this.apiUrl}/contratacion/empleados/buscar`,
      { headers: this.cabeceras(), params },
    );
  }

  /**
   * `GET /contratacion/datosIncapacidadContratacion/{cedula}`.
   * Trae `datos_basicos`, `contratacion` y `afp` para autocompletar el
   * formulario. OJO con los avisos del modelo: `afp.afp` (no `afc`),
   * `fecha_nacimiento` en dos formatos, EPS con espacios finales.
   */
  datosContratacion(cedula: string): Observable<DatosContratacionResponse> {
    return this.http.get<DatosContratacionResponse>(
      `${this.apiUrl}/contratacion/datosIncapacidadContratacion/${encodeURIComponent(cedula)}`,
      { headers: this.cabeceras() },
    );
  }

  /** `GET /Incapacidades/codigos-diagnostico/search?q=&limit=` (CIE-10). */
  buscarCodigosDiagnostico(q: string, limit = 20): Observable<CodigoDiagnostico[]> {
    const params = new HttpParams().set('q', q ?? '').set('limit', String(limit));
    return this.http.get<CodigoDiagnostico[]>(
      `${this.apiUrl}/Incapacidades/codigos-diagnostico/search`,
      { headers: this.cabeceras(), params },
    );
  }

  /** `GET /Incapacidades/ips/search?q=&limit=`. */
  buscarIps(q: string, limit = 20): Observable<IpsBusqueda[]> {
    const params = new HttpParams().set('q', q ?? '').set('limit', String(limit));
    return this.http.get<IpsBusqueda[]>(`${this.apiUrl}/Incapacidades/ips/search`, {
      headers: this.cabeceras(),
      params,
    });
  }

  // ── Soportes (multipart legacy) ───────────────────────────────────────

  /**
   * Sube un soporte a `POST /Incapacidades/{consecutivoOId}/documentos/upload`.
   *
   * El endpoint es el legacy de gestion documental y espera un multipart con
   * `legacy_field` + `file`. El `legacy_field` sale de
   * {@link LEGACY_FIELD_POR_SOPORTE} (verificado contra
   * `DocumentTypeCodes.INCAPACIDAD_LEGACY_FIELD_TO_CODE` en commons).
   *
   * NO se pone `Content-Type` a mano: el navegador debe generar el boundary.
   *
   * @param consecutivoOId consecutivo del sistema (o id) de la incapacidad.
   * @param tipoSoporte tipo de soporte de la v2.
   * @param file archivo a subir.
   */
  subirSoporte(
    consecutivoOId: string | number,
    tipoSoporte: TipoSoporte,
    file: File,
  ): Observable<SubidaSoporteResponse> {
    const legacyField = LEGACY_FIELD_POR_SOPORTE[tipoSoporte];
    if (!legacyField) {
      return throwError(
        () => new Error(`Tipo de soporte no soportado por el endpoint legacy: ${tipoSoporte}`),
      );
    }

    const cuerpo = new FormData();
    cuerpo.append('legacy_field', legacyField);
    cuerpo.append('file', file, file.name);

    const url = `${this.apiUrl}/Incapacidades/${encodeURIComponent(String(consecutivoOId))}/documentos/upload`;
    return this.http.post<SubidaSoporteResponse>(url, cuerpo, {
      headers: this.cabeceras(),
    });
  }

  /**
   * Resuelve la URL absoluta de un documento devuelto por el backend, que
   * puede venir relativa (`/media/...`).
   */
  urlAbsolutaDocumento(rutaRelativa: string | null | undefined): string {
    if (!rutaRelativa) return '';
    if (/^https?:\/\//i.test(rutaRelativa)) return rutaRelativa;
    const base = (this.apiUrl || '').replace(/\/+$/, '');
    const ruta = rutaRelativa.startsWith('/') ? rutaRelativa : `/${rutaRelativa}`;
    return base + ruta;
  }
}
