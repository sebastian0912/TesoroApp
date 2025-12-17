import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment.development';

// ----------------------------
// Keys
// ----------------------------
export type PdfKey =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo'
  | 'union';

// si en la UI quieres "any" como opción, que sea SOLO de UI
export type PdfKeyUI = PdfKey | 'any';

// ----------------------------
// Response por 1 PDF (por_pdf[pdf])
// ----------------------------
export type ProgresoRow = {
  prioridad: string;
  total: number;
  llevas: number;
  faltan: number;
};

export type ProgresoPrioridadesResponse = {
  pdf: PdfKey;
  type_ids: number[];
  total: number;
  llevas: number;
  faltan: number;
  por_prioridad: ProgresoRow[];
};

// ----------------------------
// Response ALL (caso 2)
// ----------------------------
export type ProgresoPrioridadesAllResponse = {
  scope: 'global';
  total_registros: number;
  por_pdf: Record<PdfKey, ProgresoPrioridadesResponse>;
};

/** ✅ Respuesta esperada de /full/ (ajústala si tu backend devuelve algo distinto) */
export interface RobotFullRow {
  oficina: string | null;
  robot: string | null;
  cedula: string | null;
  tipo_documento: string | null;

  estado_adress: string | null;
  apellido_adress: string | null;
  entidad_adress: string | null;
  pdf_adress: string | null;
  fecha_adress: string | null;

  estado_policivo: string | null;
  anotacion_policivo: string | null;
  pdf_policivo: string | null;

  estado_ofac: string | null;
  anotacion_ofac: string | null;
  pdf_ofac: string | null;

  estado_contraloria: string | null;
  anotacion_contraloria: string | null;
  pdf_contraloria: string | null;

  estado_sisben: string | null;
  tipo_sisben: string | null;
  pdf_sisben: string | null;
  fecha_sisben: string | null;

  estado_procuraduria: string | null;
  anotacion_procuraduria: string | null;
  pdf_procuraduria: string | null;

  estado_fondo_pension: string | null;
  entidad_fondo_pension: string | null;
  pdf_fondo_pension: string | null;
  fecha_fondo_pension: string | null;

  estado_union: string | null;
  union_pdf: string | null;
  fecha_union_pdf: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class RobotsService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private handleError(error: any): Observable<never> {
    return throwError(() => error);
  }

  // --------------------------------------------
  // Helpers
  // --------------------------------------------
  private normalizePdfKey(pdf: string | null | undefined): PdfKey {
    const key = (pdf || 'adress').trim().toLowerCase();

    if (key === 'adres' || key === 'address') return 'adress';
    if (key === 'policivos') return 'policivo';
    if (key === 'afp' || key === 'fondo_pension' || key === 'fondopension' || key === 'pension') return 'fondo';

    // fallback: si llega uno inválido, no rompas (pero ajusta si prefieres throw)
    const allowed: PdfKey[] = ['adress', 'policivo', 'ofac', 'contraloria', 'sisben', 'procuraduria', 'fondo', 'union'];
    return (allowed.includes(key as PdfKey) ? (key as PdfKey) : 'adress');
  }

  // ---------------------------------------------------------------------------
  // ✅ 1) GET /Robots/full/
  // ---------------------------------------------------------------------------
  getRobotsFull(options?: {
    params?: Record<string, string | number | boolean | null | undefined>;
    headers?: Record<string, string>;
    observeResponse?: boolean;
  }): Observable<RobotFullRow[] | HttpResponse<RobotFullRow[]>> {
    const url = `${this.apiUrl}/Robots/full/`;

    let httpParams = new HttpParams();
    const rawParams = options?.params ?? {};
    Object.entries(rawParams).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return;
      httpParams = httpParams.set(k, String(v));
    });

    const httpHeaders = new HttpHeaders(options?.headers ?? {});

    if (options?.observeResponse) {
      return this.http
        .get<RobotFullRow[]>(url, { params: httpParams, headers: httpHeaders, observe: 'response' })
        .pipe(catchError((e) => this.handleError(e)));
    }

    return this.http
      .get<RobotFullRow[]>(url, { params: httpParams, headers: httpHeaders })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 2) GET /Robots/progreso-prioridades/  (CASO 2: TODO EN UN JSON)
  // ---------------------------------------------------------------------------
  getProgresoPrioridadesAll(
    options?: { headers?: Record<string, string> }
  ): Observable<ProgresoPrioridadesAllResponse> {
    const url = `${this.apiUrl}/Robots/progreso-prioridades/`;
    const headers = new HttpHeaders(options?.headers ?? {});

    return this.http
      .get<ProgresoPrioridadesAllResponse>(url, { headers })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 3) (Opcional) Si aún necesitas: traer un solo bloque desde el ALL
  //     (sin pegarle al backend otra vez)
  // ---------------------------------------------------------------------------
  pickProgresoFromAll(all: ProgresoPrioridadesAllResponse, pdf: string): ProgresoPrioridadesResponse | null {
    const key = this.normalizePdfKey(pdf);
    return all?.por_pdf?.[key] ?? null;
  }

}
