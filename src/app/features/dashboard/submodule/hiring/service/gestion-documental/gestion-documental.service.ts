import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '@/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GestionDocumentalService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  // ------------------ DOCUMENTOS (CRUD) ------------------

  /**
   * Crea/actualiza un Document en gestion_documental.
   *
   * `owner_id` debe ser la cédula RAW (sin prefijo).
   * Si la persona NO es CC, hay que pasar `tipo_documento` (ej: "CE", "PPT");
   * el backend prefijará automáticamente owner_id con "x" para evitar
   * colisiones entre CC y non-CC con el mismo número de cédula.
   */
  guardarDocumento(
    title: any,
    owner_id: any,
    type: number,
    file: File,
    contract_number?: string,
    tipo_documento?: string
  ): Observable<any> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('owner_id', owner_id);
    formData.append('type', type.toString());
    formData.append('file', file);
    if (contract_number) formData.append('contract_number', contract_number);
    if (tipo_documento) formData.append('tipo_documento', tipo_documento);

    return this.http.post(
      `${this.apiUrl}/gestion_documental/documentos/`,
      formData
    );
  }

  /**
   * Obtiene documentos filtrados por cédula (obligatoria) y opcionalmente tipo o contrato.
   */
  getDocuments(cedula: string, type?: number, contract_number?: string): Observable<any> {
    let params = new HttpParams().set('cedula', cedula);
    if (type !== undefined && type !== null) {
      params = params.set('type', type.toString());
    }
    if (contract_number) {
      params = params.set('contract_number', contract_number);
    }
    return this.http.get(`${this.apiUrl}/gestion_documental/documentos/`, { params });
  }

  // Alias para compatibilidad regresiva (si es necesario)
  obtenerDocumentosPorTipo(owner_id: any, type: number, contract_number?: string): Observable<any> {
    return this.getDocuments(owner_id, type, contract_number);
  }

  consultarDocumentosPorCedulaYTipo(cedula: string, type?: number): Observable<any> {
    return this.getDocuments(cedula, type);
  }

  // ------------------ ZIP POR CÉDULAS + ORDEN ------------------

  /**
   * Descarga el ZIP de documentos unidos por cédula.
   *
   * Notas operativas:
   *  - `responseType: 'blob'` → el offlineInterceptor lo excluye del queue.
   *  - `timeout(15 min)` → el backend genera el ZIP en disco (puede tardar
   *    minutos si hay muchas cédulas). El timeout default de fetch es ~5min
   *    en Electron/Chromium y depende del SO; lo subimos explícitamente.
   *  - Si el server responde con un error JSON (no blob), lo capturamos en
   *    el catchError para devolver un Error con mensaje legible.
   *  - `observe: 'body'` (default) → recibimos el blob completo.
   */
  descargarZipPorCedulasYOrden(cedulas: number[], orden: number[]): Observable<Blob> {
    const body = { cedulas, orden };

    // 15 minutos: cota generosa. Si tarda más, hay algo realmente mal.
    const ZIP_TIMEOUT_MS = 15 * 60 * 1000;

    return this.http
      .post(`${this.apiUrl}/gestion_documental/descargar-zip`, body, {
        responseType: 'blob',
        // ⚠️ NO mandar `Accept: application/zip`: DRF (Django REST Framework)
        // hace content negotiation contra sus renderers configurados
        // (por default solo JSONRenderer). Si recibe un Accept específico
        // que NO matchea ningún renderer, devuelve 406 Not Acceptable
        // ("Could not satisfy the request Accept header").
        // Como esperamos un binario, lo correcto es `*/*`.
        headers: new HttpHeaders({
          'Accept': '*/*',
          'X-Requested-With': 'XMLHttpRequest',
        }),
      })
      .pipe(
        timeout({
          each: ZIP_TIMEOUT_MS,
          with: () => throwError(() => new Error(
            'La descarga tardó más de 15 min. Reintenta con menos cédulas a la vez.'
          )),
        }),
        catchError((err: unknown) => {
          // Si la respuesta de error es Blob, intentamos parsear el JSON
          // dentro para mostrar el mensaje real del backend.
          if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
            return new Observable<Blob>((sub) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                let detail = 'Error al generar el ZIP';
                try {
                  const parsed = JSON.parse(String(reader.result || '{}'));
                  detail = parsed?.error || parsed?.detail || detail;
                } catch { /* no era JSON */ }
                sub.error(new Error(detail));
              };
              reader.onerror = () => sub.error(new Error('Error al generar el ZIP'));
              reader.readAsText(err.error);
            });
          }
          return throwError(() => err);
        }),
      );
  }

  // ------------------ NUEVO: CHECKLIST DOCUMENTAL ------------------

  /**
   * POST /gestion_documental/documentos-checklist/
   * Envía SOLO cédulas; el backend usa los tipos por defecto si no envías 'tipos'.
   * @param cedulas array de cédulas (string|number) -> se envían como string
   * @param tipos   opcional para override puntual
   */
  getDocumentosChecklist(cedulas: Array<string | number>, tipos?: number[]): Observable<any> {
    const body: any = { cedulas: cedulas.map(String) };
    if (Array.isArray(tipos) && tipos.length) body.tipos = tipos;
    return this.http.post(
      `${this.apiUrl}/gestion_documental/documentos-checklist/`,
      body
    );
  }

  /**
   * GET /gestion_documental/documentos-checklist/?cedulas=...[,...]&tipos=...[,...]
   * Alternativa por querystring. Si omites 'tipos', el backend usará los defaults.
   */
  getDocumentosChecklistByGet(cedulas: Array<string | number>, tipos?: number[]): Observable<any> {
    let params = new HttpParams().set('cedulas', cedulas.map(String).join(','));
    if (Array.isArray(tipos) && tipos.length) {
      params = params.set('tipos', tipos.join(','));
    }
    return this.http.get(
      `${this.apiUrl}/gestion_documental/documentos-checklist/`,
      { params }
    );
  }

  /**
   * GET /gestion_contratacion/entrevistas/cedulas-por-oficina/
   * Devuelve cédulas únicas con entrevista en una de las sedes y dentro del rango.
   * Útil para la "consulta automática" del módulo de checklist documental.
   */
  getCedulasPorOficina(
    oficinas: string[],
    start?: string | null,
    end?: string | null,
  ): Observable<{ docs: string[]; count: number }> {
    let params = new HttpParams().set('oficinas', (oficinas ?? []).join(','));
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return this.http.get<{ docs: string[]; count: number }>(
      `${this.apiUrl}/gestion_contratacion/entrevistas/cedulas-por-oficina/`,
      { params },
    );
  }
}
