import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '@/environments/environment';
import { isPlatformBrowser } from '@angular/common';

export interface CandidatoUpsertPayload {
  tipoDoc: string;
  numeroCedula: string;

  pApellido?: string;
  sApellido?: string;
  pNombre?: string;
  sNombre?: string;
  genero?: string;

  correo?: string;
  numCelular?: string;
  numWha?: string;

  departamento?: string;
  ciudad?: string;
  estadoCivil?: string;

  direccionResidencia?: string;
  barrio?: string;

  fechaExpedicionCc?: string;
  departamentoExpedicionCc?: string;
  municipioExpedicionCc?: string;
  lugarNacimientoDepartamento?: string;
  lugarNacimientoMunicipio?: string;

  rh?: string;
  zurdoDiestro?: string;

  tiempoResidenciaZona?: string;
  lugarAnteriorResidencia?: string;
  razonCambioResidencia?: string;
  zonasConocidas?: string;
  preferenciaResidencia?: string;

  fechaNacimiento?: string;
  estudiaActualmente?: string | boolean;

  familiarEmergencia?: string;
  parentescoFamiliarEmergencia?: string;
  direccionFamiliarEmergencia?: string;
  barrioFamiliarEmergencia?: string;
  telefonoFamiliarEmergencia?: string;
  ocupacionFamiliarEmergencia?: string;

  oficina?: string;

  escolaridad?: string;
  estudiosExtra?: string;
  nombreInstitucion?: string;
  anoFinalizacion?: string; // ISO
  tituloObtenido?: string;

  chaqueta?: string | number;
  pantalon?: string | number;
  camisa?: string | number;
  calzado?: string | number;

  nombreConyugue?: string;
  apellidoConyugue?: string;
  numDocIdentidadConyugue?: string;
  viveConElConyugue?: string;
  direccionConyugue?: string;
  telefonoConyugue?: string;
  barrioMunicipioConyugue?: string;
  ocupacionConyugue?: string;

  nombrePadre?: string;
  vivePadre?: boolean;
  ocupacionPadre?: string;
  direccionPadre?: string;
  telefonoPadre?: string;
  barrioPadre?: string;

  nombreMadre?: string;
  viveMadre?: boolean;
  ocupacionMadre?: string;
  direccionMadre?: string;
  telefonoMadre?: string;
  barrioMadre?: string;

  nombreReferenciaPersonal1?: string;
  telefonoReferenciaPersonal1?: string;
  ocupacionReferenciaPersonal1?: string;
  tiempoConoceReferenciaPersonal1?: string;
  direccionReferenciaPersonal1?: string;

  nombreReferenciaPersonal2?: string;
  telefonoReferenciaPersonal2?: string;
  ocupacionReferenciaPersonal2?: string;
  tiempoConoceReferenciaPersonal2?: string;
  direccionReferenciaPersonal2?: string;

  nombreReferenciaFamiliar1?: string;
  telefonoReferenciaFamiliar1?: string;
  ocupacionReferenciaFamiliar1?: string;
  parentescoReferenciaFamiliar1?: string;
  tiempoConoceReferenciaFamiliar1?: string;
  direccionReferenciaFamiliar1?: string;

  nombreReferenciaFamiliar2?: string;
  telefonoReferenciaFamiliar2?: string;
  ocupacionReferenciaFamiliar2?: string;
  parentescoReferenciaFamiliar2?: string;
  tiempoConoceReferenciaFamiliar2?: string;
  direccionReferenciaFamiliar2?: string;

  nombreExpeLaboral1Empresa?: string;
  direccionEmpresa1?: string;
  telefonosEmpresa1?: string;
  nombreJefeEmpresa1?: string;
  fechaRetiroEmpresa1?: string;
  motivoRetiroEmpresa1?: string;
  cargoEmpresa1?: string;

  empresas_laborado?: string;
  labores_realizadas?: string;

  rendimiento?: string;
  porqueRendimiento?: string;

  familiaConUnSoloIngreso?: boolean;
  numHabitaciones?: string | number;
  numPersonasPorHabitacion?: string | number;
  tipoVivienda2p?: string;
  caracteristicasVivienda?: string;

  malentendido?: string;
  experienciaLaboral?: boolean;

  porqueLofelicitarian?: string;
  areaExperiencia?: string;
  areaCultivoPoscosecha?: string;

  laboresRealizadas?: string;
  tiempoExperiencia?: string;

  actividadesDi?: string;
  numHijosDependientes?: number;
  cuidadorHijos?: string;

  experienciaSignificativa?: string;
  motivacion?: string;

  fuenteVacante?: string;
  expectativasDeVida?: string;
  servicios?: string;
  tipoVivienda?: string;
  personasConQuienConvive?: string;
  personas_a_cargo?: string;

  hijos?: any[]; // si luego los manejas
}

export interface CandidatoUpsertResponse {
  ok: boolean;
  created: boolean;
  candidato_id: number;
  tipo_doc: string;
  numero_documento: string;
}



// ===== Listado y filtros generales =====
export interface ListOptions {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  /** Filtros adicionales (coinciden con filterset_fields del DRF o cualquier campo) */
  filters?: Record<string, any>;
}

type TipoBio = 'firma' | 'huella' | 'foto';

/** Payload aceptado por /procesos/seleccion y /procesos/seleccion-by-document */
export interface AntecedentesPayload {
  eps?: string | null;
  afp?: string | null;
  policivos?: string | null;
  procuraduria?: string | null;
  contraloria?: string | null;
  ramaJudicial?: string | null;
  sisben?: string | null;
  ofac?: string | null;
  medidasCorrectivas?: string | number | null; // "CUMPLE" | "NO CUMPLE" | número | ''
  semanasCotizadas?: number | null;
}

export interface ProcesoSeleccionResponse {
  procesoSeleccion: AntecedentesPayload;
}

// ===== Examen médico =====
/** Bloque que espera el backend (los arrays van como JSON.stringify([...])) */
export interface ExamenMedicoUpsertPayload {
  ips?: string | null;
  ips_lab?: string | null;
  /** JSON.stringify([...]) */
  examenes?: string | null;
  /** JSON.stringify([{ aptoStatus: 'APTO' | 'NO APTO' }, ...]) */
  resultados?: string | null;
}

// ===== Contrato: control de generación de código =====
/**
 * Si generar_codigo = true, sede_abbr es obligatorio.
 * Si generar_codigo = false, puedes omitir el bloque o enviar sede_abbr opcional.
 */
export type ContratoCodigoRequest =
  | { generar_codigo: true; sede_abbr: string }
  | { generar_codigo: false; sede_abbr?: string };

// ===== Request principal: /procesos/update-by-document/ =====
export interface ProcesoUpdateByDocumentRequest {
  numero_documento: string;
  publicacion?: number | null;
  vacante_tipo?: string | null;
  vacante_salario?: string | null;
  prueba_tecnica?: boolean;
  autorizado?: boolean;
  vacante_fecha_prueba?: string | null;

  // ✅ nuevos
  contratado?: boolean;
  contrato_detalle?: {
    forma_de_pago?: string | null;
    numero_para_pagos?: string | null;
    identification_number_tarjeta?: string | null; // New field
    seguro_funerario?: boolean | null;
    Ccentro_de_costos?: string | null;
    porcentaje_arl?: number | null;
    cesantias?: string | null;
    subcentro_de_costos?: string | null;
    grupo?: string | null;
    categoria?: string | null;
    operacion?: string | null;
    horas_extras?: boolean | null;
    desea_trasladarse?: boolean | null;
    seleccion_eps?: string | null;
    contrasenia_asignada?: string | null;
  };

  examen_medico?: ExamenMedicoUpsertPayload;
  ips?: string | null;
  ips_lab?: string | null;
  examenes?: string | null;
  resultados?: string | null;

  contrato?: ContratoCodigoRequest;
}


// ===== DTO que devuelve el backend para un Proceso =====
export interface ProcesoDto {
  id: number;
  entrevista: number; // o un objeto según tu serializer; ajusta si hace falta
  publicacion: number | null;
  vacante_tipo: string | null;
  vacante_salario: string | null;
  prueba_tecnica: boolean;
  prueba_tecnica_at: string | null;
  autorizado: boolean;
  autorizado_at: string | null;

  /** Campo inyectado por backend cuando se genera o ya existía */
  contrato_codigo?: string | null;

  /** Permite campos adicionales del serializer sin romper el tipado */
  [k: string]: any;
}

// ===== Respuesta del endpoint /procesos/update-by-document/ =====
export interface UpdateByDocumentResponse {
  message: 'updated';
  proceso: ProcesoDto;
}

export interface ProcesoMini {
  id: number;
  oficina: string | null;
  entrevista_created_at: string; // ISO
  aplica_o_no_aplica: string | null;
  motivo_no_aplica: string | null;
  motivo_espera: string | null;
  detalle: string | null;
}

export interface EnEsperaItem {
  tipo_doc: string | null;
  numero_documento: string;         // texto
  apellidos_nombres: string | null;
  tiene_experiencia: 'SI' | 'NO';
  barrio: string | null;
  area_experiencia: string | null;
  celular: string | null;
  whatsapp: string | null;
  motivo_espera: string | null;
}

export interface CandidatoRecienteItem {
  candidato_id: number;
  tipo_doc: string | null;
  numero_documento: string;
  primer_nombre: string | null;
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  apellidos_nombres: string | null;
  celular: string | null;
  whatsapp: string | null;
  oficina: string | null;
  updated_at: string | null;  // ISO
  // Progreso del formulario web (tu_alianza_web / Tu-Apo-Web):
  // 0 = sin iniciar, 1 = guardó datos básicos, 5 = envió formulario completo.
  formulario_paso?: number;
  formulario_completo?: boolean;
  // Atendido por el evaluador en TesoroApp:
  atendido_at?: string | null;  // ISO; null si nunca lo han atendido
  atendido_hoy?: boolean;       // true si atendido_at cae dentro del día local actual
}

export type RangoFechas = { start: string | Date; end: string | Date };


@Injectable({ providedIn: 'root' })
export class RegistroProcesoContratacion {
  private apiUrl = (environment.apiUrl || '').replace(/\/$/, '');
  private base = `${this.apiUrl}/gestion_contratacion`;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  /**
   * POST /gestion_contratacion/candidatos/upsert/
   * - Backend: upsert idempotente (crea o actualiza, sin duplicar).
   */
  upsertCandidato(payload: CandidatoUpsertPayload): Observable<CandidatoUpsertResponse> {
    const url = `${this.base}/candidatos/upsert/`;

    // (Opcional) Evitar llamadas desde SSR si aplica
    if (!isPlatformBrowser(this.platformId)) {
      return new Observable<CandidatoUpsertResponse>((sub) => {
        sub.next({
          ok: false,
          created: false,
          candidato_id: 0,
          tipo_doc: payload.tipoDoc,
          numero_documento: payload.numeroCedula,
        });
        sub.complete();
      });
    }

    return this.http.post<CandidatoUpsertResponse>(url, payload);
  }

  /** Obtiene el Excel como Blob (con filtro opcional por oficina). */
  getEntrevistasExcel(range: RangoFechas, oficina?: string | string[]): Observable<Blob> {
    const start = this.formatDate(range.start);
    const end = this.formatDate(range.end);

    let params = new HttpParams().set('start', start).set('end', end);
    if (oficina) {
      const ofi = Array.isArray(oficina) ? oficina.join(',') : oficina;
      if (ofi.trim()) params = params.set('oficina', ofi.trim());
    }

    return this.http.get(`${this.base}/reporte/entrevistas-excel`, {
      params,
      responseType: 'blob'
    });
  }

  /**
   * GET /gestion_contratacion/candidatos/recientes/?limit=N&oficina=X
   * Lista por última actividad (consulta o llenado del formulario) DESC.
   * Idempotente por día en backend.
   */
  getCandidatosRecientes(limit: number = 50, oficina?: string | string[]): Observable<CandidatoRecienteItem[]> {
    let params = new HttpParams().set('limit', String(Math.max(1, Math.min(limit, 200))));
    if (oficina) {
      const ofi = Array.isArray(oficina) ? oficina.join(',') : oficina;
      if (ofi.trim()) params = params.set('oficina', ofi.trim());
    }
    return this.http.get<CandidatoRecienteItem[]>(this.url('candidatos/recientes'), { params })
      .pipe(this.handle$());
  }

  /**
   * POST /gestion_contratacion/candidatos/mark-attended/
   * Marca al candidato como atendido hoy (atendido_at = now()).
   * Tras marcar, en la lista de recientes baja al final del día.
   */
  markAttended(payload: { tipo_doc?: string | null; numero_documento?: string | null; candidato_id?: number }): Observable<{
    ok: boolean;
    candidato_id: number;
    tipo_doc: string;
    numero_documento: string;
    atendido_at: string;
  }> {
    return this.http.post<any>(this.url('candidatos/mark-attended'), payload).pipe(this.handle$());
  }

  getUltimosEnEspera(oficina?: string | string[]): Observable<EnEsperaItem[]> {
    let options: { params?: HttpParams } = {};

    if (oficina && oficina.length) {
      const valor = Array.isArray(oficina) ? oficina.join(',') : oficina;
      options.params = new HttpParams().set('oficina', valor);
    }

    return this.http.get<EnEsperaItem[]>(
      `${this.base}/reporte/ultimos-en-espera`,
      options
    );
  }

  /**
   * GET /reporte/turnos-excel/?start=YYYY-MM-DD&end=YYYY-MM-DD&oficina=...
   * Descarga el Excel "profesional" del listado de turnos por orden de llegada
   * (filtra por last_activity_at). Tipos de datos consistentes para que VLOOKUP
   * y comparaciones funcionen sin sorpresas.
   */
  downloadTurnosExcel(
    range: RangoFechas,
    oficina?: string | string[],
    filename?: string
  ): Observable<void> {
    const start = this.formatDate(range.start);
    const end = this.formatDate(range.end);

    let params = new HttpParams().set('start', start).set('end', end);
    if (oficina) {
      const ofi = Array.isArray(oficina) ? oficina.join(',') : oficina;
      if (ofi.trim()) params = params.set('oficina', ofi.trim());
    }

    return this.http.get(`${this.base}/reporte/turnos-excel/`, {
      params,
      responseType: 'blob'
    }).pipe(
      tap(blob => {
        if (!isPlatformBrowser(this.platformId)) return;
        const finalName = this.safeFilename(
          filename || (start === end ? `turnos_${start}.xlsx` : `turnos_${start}_a_${end}.xlsx`)
        );
        this.triggerDownload(blob, finalName);
      }),
      map(() => undefined)
    );
  }

  /** Descarga directa del Excel (sin leer headers) y con filtro opcional por oficina. */
  downloadEntrevistasExcel(
    range: RangoFechas,
    oficina?: string | string[],
    filename?: string
  ): Observable<void> {
    const start = this.formatDate(range.start);
    const end = this.formatDate(range.end);

    let params = new HttpParams().set('start', start).set('end', end);
    if (oficina) {
      const ofi = Array.isArray(oficina) ? oficina.join(',') : oficina;
      if (ofi.trim()) params = params.set('oficina', ofi.trim());
    }

    return this.http.get(`${this.base}/reporte/entrevistas-excel`, {
      params,
      responseType: 'blob'
    }).pipe(
      tap(blob => {
        if (!isPlatformBrowser(this.platformId)) return;
        const finalName = this.safeFilename(filename || `entrevistas_${start}_a_${end}.xlsx`);
        this.triggerDownload(blob, finalName);
      }),
      map(() => undefined)
    );
  }


  // ===== Helpers =====

  private formatDate(d: string | Date): string {
    if (typeof d === 'string') return d;
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private safeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]+/g, '_');
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  // =========================================================
  // Helpers genéricos
  // =========================================================
  private url(resource: string): string {
    return `${this.base}/${resource.replace(/^\//, '')}/`;
  }

  private buildParams(opts?: ListOptions): HttpParams {
    let params = new HttpParams();
    if (!opts) return params;

    const { page, page_size, search, ordering, filters } = opts;
    if (page != null) params = params.set('page', String(page));
    if (page_size != null) params = params.set('page_size', String(page_size));
    if (search) params = params.set('search', search);
    if (ordering) params = params.set('ordering', ordering);

    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v == null) return;
        if (Array.isArray(v)) {
          v.forEach((vv) => { if (vv != null) params = params.append(k, String(vv)); });
        } else {
          params = params.set(k, String(v));
        }
      });
    }
    return params;
  }

  private handle$<T>() {
    return (source: Observable<T>) =>
      source.pipe(
        map((resp) => resp),
        catchError((err) => throwError(() => err))
      );
  }

  // =========================================================
  // CANDIDATOS (incluye tu mapeo/upper original)
  // =========================================================
  /** Back-compat: usa tu mapeo + upper salvo email/password */
  guardarInfoPersonal(form: any): Observable<any> {
    return this.createCandidatoFromForm(form);
  }

  /** Crea candidato con payload mapeado desde tu form (incluye entrevistas y asignación de turno en backend) */
  createCandidatoFromForm(form: any): Observable<any> {
    const payload = this.buildCandidatoPayload(form);
    const upperPayload = this.uppercaseDeepExcept(payload, new Set(['email', 'correo_electronico', 'password']));
    return this.http.post(this.url('candidatos'), upperPayload).pipe(this.handle$());
  }

  upsertCandidatoByDocumento(data: any): Observable<any> {
    const upper = this.uppercaseDeepExcept(data, new Set(['email', 'correo_electronico', 'password']));
    return this.http.patch(this.url('candidatos/by-document-upsert'), upper).pipe(this.handle$());
  }

  /** Comodín: arma el payload desde el form y opcionalmente un proceso (p.ej. {entrevistado:true}) */
  upsertCandidatoByDocumentoFromForm(form: any, proceso?: any): Observable<any> {
    const payload = this.buildCandidatoPayload(form, proceso);
    const upper = this.uppercaseDeepExcept(payload, new Set(['email', 'correo_electronico', 'password']));
    return this.http.patch(this.url('candidatos/by-document-upsert'), upper).pipe(this.handle$());
  }

  // ===================== CANDIDATOS =====================

  // contratacion/candidatos-tabla/
  listCandidatosTabla(opts?: ListOptions): Observable<any[]> {
    return this.http
      .get<any[]>(this.url('contratacion/candidatos-tabla'), { params: this.buildParams(opts) })
      .pipe(this.handle$());
  }

  // Lista básica (serializer simple)
  listCandidatos(opts?: ListOptions): Observable<any[]> {
    return this.http
      .get<any[]>(this.url('candidatos'), { params: this.buildParams(opts) })
      .pipe(this.handle$());
  }

  // Lista completa (incluye relaciones) => usa ?full=1
  listCandidatosFull(opts?: ListOptions): Observable<any[]> {
    let params = this.buildParams(opts);
    params = params.set('full', '1');
    return this.http
      .get<any[]>(this.url('candidatos'), { params })
      .pipe(this.handle$());
  }

  // Detalle por ID (básico o completo con ?full=1)
  getCandidato(id: number | string, full = false): Observable<any> {
    let params = new HttpParams();
    if (full) {
      params = params.set('full', '1');
      params = params.set('include_queue', '1');
    }
    return this.http
      .get<any>(this.url(`candidatos/${id}`), { params })
      .pipe(this.handle$());
  }

  //
  // 1) Versión PATH: /candidatos/by-document/<numero_documento>?full=1
  //
  getCandidatoPorDocumento(numeroDocumento: string, full = false) {
    const safe = encodeURIComponent((numeroDocumento ?? '').trim());
    let params = new HttpParams();
    if (full) {
      params = params.set('full', '1');
      params = params.set('include_queue', '1');
    }

    return this.http
      .get<any>(this.url(`candidatos/by-document/${safe}`), { params })
      .pipe(this.handle$());
  }

  //
  // 2) Versión QUERY: /candidatos/by-document?numero_documento=<>&full=1
  //    (útil si no quieres enviar el documento en el path)
  //
  getCandidatoPorDocumentoQ(numeroDocumento: string, full = false) {
    let params = new HttpParams().set('numero_documento', (numeroDocumento ?? '').trim());
    if (full) {
      params = params.set('full', '1');
      params = params.set('include_queue', '1');
    }

    return this.http
      .get<any>(this.url('candidatos/by-document'), { params })
      .pipe(this.handle$());
  }

  // Crear (payload ya preparado)
  createCandidato(data: any): Observable<any> {
    return this.http.post(this.url('candidatos'), data).pipe(this.handle$());
  }

  // Actualizar total
  updateCandidato(id: number | string, data: any): Observable<any> {
    return this.http.put(this.url(`candidatos/${id}`), data).pipe(this.handle$());
  }

  // Actualización parcial
  patchCandidato(id: number | string, data: any): Observable<any> {
    return this.http.patch(this.url(`candidatos/${id}`), data).pipe(this.handle$());
  }

  // Eliminar
  deleteCandidato(id: number | string): Observable<any> {
    return this.http.delete(this.url(`candidatos/${id}`)).pipe(this.handle$());
  }


  // =========================================================
  // VIVIENDAS
  // =========================================================
  listViviendas(opts?: ListOptions) { return this.http.get(this.url('viviendas'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getVivienda(id: number | string) { return this.http.get(this.url(`viviendas/${id}`)).pipe(this.handle$()); }
  createVivienda(data: any) { return this.http.post(this.url('viviendas'), data).pipe(this.handle$()); }
  updateVivienda(id: number | string, data: any) { return this.http.put(this.url(`viviendas/${id}`), data).pipe(this.handle$()); }
  patchVivienda(id: number | string, data: any) { return this.http.patch(this.url(`viviendas/${id}`), data).pipe(this.handle$()); }
  deleteVivienda(id: number | string) { return this.http.delete(this.url(`viviendas/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // DOTACIONES
  // =========================================================
  listDotaciones(opts?: ListOptions) { return this.http.get(this.url('dotaciones'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getDotacion(id: number | string) { return this.http.get(this.url(`dotaciones/${id}`)).pipe(this.handle$()); }
  createDotacion(data: any) { return this.http.post(this.url('dotaciones'), data).pipe(this.handle$()); }
  updateDotacion(id: number | string, data: any) { return this.http.put(this.url(`dotaciones/${id}`), data).pipe(this.handle$()); }
  patchDotacion(id: number | string, data: any) { return this.http.patch(this.url(`dotaciones/${id}`), data).pipe(this.handle$()); }
  deleteDotacion(id: number | string) { return this.http.delete(this.url(`dotaciones/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // EXPERIENCIAS RESUMEN (experiencias-resumen)
  // =========================================================
  listExperienciasResumen(opts?: ListOptions) { return this.http.get(this.url('experiencias-resumen'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getExperienciaResumen(id: number | string) { return this.http.get(this.url(`experiencias-resumen/${id}`)).pipe(this.handle$()); }
  createExperienciaResumen(data: any) { return this.http.post(this.url('experiencias-resumen'), data).pipe(this.handle$()); }
  updateExperienciaResumen(id: number | string, data: any) { return this.http.put(this.url(`experiencias-resumen/${id}`), data).pipe(this.handle$()); }
  patchExperienciaResumen(id: number | string, data: any) { return this.http.patch(this.url(`experiencias-resumen/${id}`), data).pipe(this.handle$()); }
  deleteExperienciaResumen(id: number | string) { return this.http.delete(this.url(`experiencias-resumen/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // EVALUACIONES
  // =========================================================
  listEvaluaciones(opts?: ListOptions) { return this.http.get(this.url('evaluaciones'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getEvaluacion(id: number | string) { return this.http.get(this.url(`evaluaciones/${id}`)).pipe(this.handle$()); }
  createEvaluacion(data: any) { return this.http.post(this.url('evaluaciones'), data).pipe(this.handle$()); }
  updateEvaluacion(id: number | string, data: any) { return this.http.put(this.url(`evaluaciones/${id}`), data).pipe(this.handle$()); }
  patchEvaluacion(id: number | string, data: any) { return this.http.patch(this.url(`evaluaciones/${id}`), data).pipe(this.handle$()); }
  deleteEvaluacion(id: number | string) { return this.http.delete(this.url(`evaluaciones/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // CONTACTOS
  // =========================================================
  listContactos(opts?: ListOptions) { return this.http.get(this.url('contactos'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getContacto(id: number | string) { return this.http.get(this.url(`contactos/${id}`)).pipe(this.handle$()); }
  createContacto(data: any) { return this.http.post(this.url('contactos'), data).pipe(this.handle$()); }
  updateContacto(id: number | string, data: any) { return this.http.put(this.url(`contactos/${id}`), data).pipe(this.handle$()); }
  patchContacto(id: number | string, data: any) { return this.http.patch(this.url(`contactos/${id}`), data).pipe(this.handle$()); }
  deleteContacto(id: number | string) { return this.http.delete(this.url(`contactos/${id}`)).pipe(this.handle$()); }

  confirmarContacto(candidatoId: number | string, payload: { correo_confirmado?: boolean, whatsapp_confirmado?: boolean }): Observable<any> {
    return this.http.patch(this.url(`candidatos/${candidatoId}/confirmar-contacto`), payload).pipe(this.handle$());
  }

  // =========================================================
  // RESIDENCIAS
  // =========================================================
  listResidencias(opts?: ListOptions) { return this.http.get(this.url('residencias'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getResidencia(id: number | string) { return this.http.get(this.url(`residencias/${id}`)).pipe(this.handle$()); }
  createResidencia(data: any) { return this.http.post(this.url('residencias'), data).pipe(this.handle$()); }
  updateResidencia(id: number | string, data: any) { return this.http.put(this.url(`residencias/${id}`), data).pipe(this.handle$()); }
  patchResidencia(id: number | string, data: any) { return this.http.patch(this.url(`residencias/${id}`), data).pipe(this.handle$()); }
  deleteResidencia(id: number | string) { return this.http.delete(this.url(`residencias/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // INFO-CC (info-cc)
  // =========================================================
  listInfoCc(opts?: ListOptions) { return this.http.get(this.url('info-cc'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getInfoCc(id: number | string) { return this.http.get(this.url(`info-cc/${id}`)).pipe(this.handle$()); }
  createInfoCc(data: any) { return this.http.post(this.url('info-cc'), data).pipe(this.handle$()); }
  updateInfoCc(id: number | string, data: any) { return this.http.put(this.url(`info-cc/${id}`), data).pipe(this.handle$()); }
  patchInfoCc(id: number | string, data: any) { return this.http.patch(this.url(`info-cc/${id}`), data).pipe(this.handle$()); }
  deleteInfoCc(id: number | string) { return this.http.delete(this.url(`info-cc/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // FORMACIONES
  // =========================================================
  listFormaciones(opts?: ListOptions) { return this.http.get(this.url('formaciones'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getFormacion(id: number | string) { return this.http.get(this.url(`formaciones/${id}`)).pipe(this.handle$()); }
  createFormacion(data: any) { return this.http.post(this.url('formaciones'), data).pipe(this.handle$()); }
  updateFormacion(id: number | string, data: any) { return this.http.put(this.url(`formaciones/${id}`), data).pipe(this.handle$()); }
  patchFormacion(id: number | string, data: any) { return this.http.patch(this.url(`formaciones/${id}`), data).pipe(this.handle$()); }
  deleteFormacion(id: number | string) { return this.http.delete(this.url(`formaciones/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // EXPERIENCIAS (laborales)
  // =========================================================
  listExperiencias(opts?: ListOptions) { return this.http.get(this.url('experiencias'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getExperiencia(id: number | string) { return this.http.get(this.url(`experiencias/${id}`)).pipe(this.handle$()); }
  createExperiencia(data: any) { return this.http.post(this.url('experiencias'), data).pipe(this.handle$()); }
  updateExperiencia(id: number | string, data: any) { return this.http.put(this.url(`experiencias/${id}`), data).pipe(this.handle$()); }
  patchExperiencia(id: number | string, data: any) { return this.http.patch(this.url(`experiencias/${id}`), data).pipe(this.handle$()); }
  deleteExperiencia(id: number | string) { return this.http.delete(this.url(`experiencias/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // HIJOS
  // =========================================================
  listHijos(opts?: ListOptions) { return this.http.get(this.url('hijos'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getHijo(id: number | string) { return this.http.get(this.url(`hijos/${id}`)).pipe(this.handle$()); }
  createHijo(data: any) { return this.http.post(this.url('hijos'), data).pipe(this.handle$()); }
  updateHijo(id: number | string, data: any) { return this.http.put(this.url(`hijos/${id}`), data).pipe(this.handle$()); }
  patchHijo(id: number | string, data: any) { return this.http.patch(this.url(`hijos/${id}`), data).pipe(this.handle$()); }
  deleteHijo(id: number | string) { return this.http.delete(this.url(`hijos/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // FAMILIARES
  // =========================================================
  listFamiliares(opts?: ListOptions) { return this.http.get(this.url('familiares'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getFamiliar(id: number | string) { return this.http.get(this.url(`familiares/${id}`)).pipe(this.handle$()); }
  createFamiliar(data: any) { return this.http.post(this.url('familiares'), data).pipe(this.handle$()); }
  updateFamiliar(id: number | string, data: any) { return this.http.put(this.url(`familiares/${id}`), data).pipe(this.handle$()); }
  patchFamiliar(id: number | string, data: any) { return this.http.patch(this.url(`familiares/${id}`), data).pipe(this.handle$()); }
  deleteFamiliar(id: number | string) { return this.http.delete(this.url(`familiares/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // REFERENCIAS
  // =========================================================
  listReferencias(opts?: ListOptions) { return this.http.get(this.url('referencias'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getReferencia(id: number | string) { return this.http.get(this.url(`referencias/${id}`)).pipe(this.handle$()); }
  createReferencia(data: any) { return this.http.post(this.url('referencias'), data).pipe(this.handle$()); }
  updateReferencia(id: number | string, data: any) { return this.http.put(this.url(`referencias/${id}`), data).pipe(this.handle$()); }
  patchReferencia(id: number | string, data: any) { return this.http.patch(this.url(`referencias/${id}`), data).pipe(this.handle$()); }
  deleteReferencia(id: number | string) { return this.http.delete(this.url(`referencias/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // ENTREVISTAS
  // =========================================================
  listEntrevistas(opts?: ListOptions) { return this.http.get(this.url('entrevistas'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getEntrevista(id: number | string) { return this.http.get(this.url(`entrevistas/${id}`)).pipe(this.handle$()); }
  createEntrevista(data: any) { return this.http.post(this.url('entrevistas'), data).pipe(this.handle$()); }
  updateEntrevista(id: number | string, data: any) { return this.http.put(this.url(`entrevistas/${id}`), data).pipe(this.handle$()); }
  patchEntrevista(id: number | string, data: any) { return this.http.patch(this.url(`entrevistas/${id}`), data).pipe(this.handle$()); }
  deleteEntrevista(id: number | string) { return this.http.delete(this.url(`entrevistas/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // PROCESOS (ProcesoCandidato)
  // =========================================================
  listProcesos(opts?: ListOptions) { return this.http.get(this.url('procesos'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getProceso(id: number | string) { return this.http.get(this.url(`procesos/${id}`)).pipe(this.handle$()); }
  createProceso(data: any) { return this.http.post(this.url('procesos'), data).pipe(this.handle$()); }
  updateProceso(id: number | string, data: any) { return this.http.put(this.url(`procesos/${id}`), data).pipe(this.handle$()); }
  patchProceso(id: number | string, data: any) { return this.http.patch(this.url(`procesos/${id}`), data).pipe(this.handle$()); }
  deleteProceso(id: number | string) { return this.http.delete(this.url(`procesos/${id}`)).pipe(this.handle$()); }

  listProcesosMiniByDocumento(numeroDocumento: string, onlyLatest = false) {
    const params: any = { numero_documento: numeroDocumento };
    if (onlyLatest) params.latest = 1;

    // Normalizamos SIEMPRE a array de any[]
    return this.http
      .get<any | any[]>(this.url('procesos/by-document-min'), { params })
      .pipe(
        map(v => Array.isArray(v) ? v : (v ? [v] : [])),
        this.handle$() // conserva tu manejador de errores
      );
  }



  // =========================================================
  // ANTECEDENTES DE PROCESO
  // =========================================================
  listAntecedentesProceso(opts?: ListOptions) { return this.http.get(this.url('antecedentes-proceso'), { params: this.buildParams(opts) }).pipe(this.handle$()); }
  getAntecedenteProceso(id: number | string) { return this.http.get(this.url(`antecedentes-proceso/${id}`)).pipe(this.handle$()); }
  createAntecedenteProceso(data: any) { return this.http.post(this.url('antecedentes-proceso'), data).pipe(this.handle$()); }
  updateAntecedenteProceso(id: number | string, data: any) { return this.http.put(this.url(`antecedentes-proceso/${id}`), data).pipe(this.handle$()); }
  patchAntecedenteProceso(id: number | string, data: any) { return this.http.patch(this.url(`antecedentes-proceso/${id}`), data).pipe(this.handle$()); }
  deleteAntecedenteProceso(id: number | string) { return this.http.delete(this.url(`antecedentes-proceso/${id}`)).pipe(this.handle$()); }

  // =========================================================
  // BIOMETRÍA (multipart)
  // =========================================================
  /** Lista (puedes filtrar por cédula con search si quieres) */
  listBiometria(opts?: ListOptions) {
    return this.http
      .get(this.url('biometria'), { params: this.buildParams(opts) })
      .pipe(this.handle$());
  }

  /** Obtiene la biometría de un candidato por cédula */
  getBiometriaPorCedula(numero_documento: string | number) {
    return this.http
      .get(this.url(`biometria/${encodeURIComponent(String(numero_documento))}`))
      .pipe(this.handle$());
  }

  /** Upload genérico por tipo (FIRMA | HUELLA | FOTO) */
  uploadBiometria(
    tipo: TipoBio,
    numero_documento: string | number,
    file: File,
    consent?: {
      consentimiento_hash?: string;
      consentimiento_version?: string;
      consentimiento_timestamp?: string;
      user_agent?: string;
      image_hash?: string;
    },
  ) {
    const fd = new FormData();
    fd.append('numero_documento', String(numero_documento));
    fd.append('file', file);

    // Append consent metadata if provided
    if (consent) {
      Object.entries(consent).forEach(([k, v]) => {
        if (v != null) fd.append(k, v);
      });
    }

    // POST /biometria/upload/{tipo}
    return this.http
      .post(this.url(`biometria/upload/${tipo}`), fd)
      .pipe(this.handle$());
  }

  /** Azúcar sintáctico */
  uploadFirma(numero_documento: string | number, file: File) {
    return this.uploadBiometria('firma', numero_documento, file);
  }
  uploadHuella(
    numero_documento: string | number,
    file: File,
    consent?: {
      consentimiento_hash?: string;
      consentimiento_version?: string;
      consentimiento_timestamp?: string;
      user_agent?: string;
      image_hash?: string;
    },
  ) {
    return this.uploadBiometria('huella', numero_documento, file, consent);
  }
  uploadFoto(numero_documento: string | number, file: File) {
    return this.uploadBiometria('foto', numero_documento, file);
  }

  // =========================================================
  // Placeholder que tenías
  // =========================================================
  crearActualizarCandidato(_form: any): Observable<any> {
    return of({ ok: true });
  }

  // =========================================================
  // ================== MAPEOS ORIGINALES ====================
  // =========================================================
  buildCandidatoPayload(f: any, proceso?: any) {
    const get = (a: string, b?: string) => (f?.[a] ?? (b ? f?.[b] : undefined));

    // ===== Candidato base =====
    const candidatoBase = this.clean({
      tipo_doc: get('tipo_doc', 'tipoDoc'),
      numero_documento: get('numero_documento', 'numero_de_documento'),
      primer_nombre: get('primer_nombre', 'primerNombre'),
      segundo_nombre: get('segundo_nombre', 'segundoNombre'),
      primer_apellido: get('primer_apellido', 'primerApellido'),
      segundo_apellido: get('segundo_apellido', 'segundoApellido'),
      sexo: get('sexo', 'genero'),
      fecha_nacimiento: this.toYYYYMMDD(get('fecha_nacimiento', 'fechaNacimiento')),
      estado_civil: get('estado_civil', 'estadoCivil'),
      nombreReferenciaFamiliar1: get('nombreReferenciaFamiliar1'),
      parentescoReferenciaFamiliar1: get('parentescoReferenciaFamiliar1'),
      nombreReferenciaFamiliar2: get('nombreReferenciaFamiliar2'),
      parentescoReferenciaFamiliar2: get('parentescoReferenciaFamiliar2'),
    });

    // ===== Contacto =====
    const contacto = this.nonEmpty({
      email: get('correo_electronico'),
      celular: get('celular', 'numeroCelular'),
      whatsapp: get('whatsapp', 'numeroWhatsapp'),
    });

    // ===== Residencia =====
    const residencia = this.nonEmpty({
      direccion: get('direccion_de_residencia', 'direccion'),
      barrio: get('barrio'),
      hace_cuanto_vive: get('hace_cuanto_vive', 'tiempoResidencia'),
    });

    // ===== Vivienda =====
    const personasVive = get('personas_con_quien_convive', 'conQuienViveChecks');
    const vivienda = this.nonEmpty({
      personas_con_quien_convive: Array.isArray(personasVive) ? personasVive.join(', ') : personasVive,
      responsable_hijos: get('cuidadorHijos') ? String(get('cuidadorHijos')) : undefined,
      estudia_actualmente: typeof get('estudiaActualmente') === 'boolean' ? get('estudiaActualmente') : undefined,
    });

    // ===== Info CC =====
    const info_cc = this.nonEmpty({
      fecha_expedicion: this.toYYYYMMDD(get('fecha_expedicion', 'fechaExpedicion')),
      mpio_expedicion: get('mpio_expedicion', 'municipioExpedicion'),
      mpio_nacimiento: get('mpio_nacimiento', 'lugarNacimiento'),
    });

    // ===== Experiencia (resumen) =====
    const experienciaFlores = get('experienciaFlores');
    const tiene_experiencia = typeof experienciaFlores === 'string'
      ? experienciaFlores === 'Sí'
      : !!get('tiene_experiencia');

    let area: string | null =
      get('area_cultivo_poscosecha') ??
      get('area_experiencia') ??
      get('tipoExperienciaFlores') ?? null;

    if (get('tipoExperienciaFlores') === 'OTROS' && get('otroExperiencia')) {
      area = String(get('otroExperiencia'));
    }

    const experiencia_resumen = this.nonEmpty({
      tiene_experiencia,
      area_experiencia: area,
      area_cultivo_poscosecha: area,
    });

    // ===== Formaciones (simple) =====
    const formaciones = get('nivel')
      ? [{ nivel: get('nivel'), institucion: null, titulo_obtenido: null, anio_finalizacion: null }]
      : undefined;

    // ===== Experiencias (laborales) =====
    const experienciasSrc = Array.isArray(get('experiencias')) ? get('experiencias') : [];
    const experiencias = experienciasSrc
      .map((e: any) => this.clean({
        empresa: e?.empresa,
        tiempo_trabajado: e?.tiempo_trabajado ?? e?.tiempo,
        labores_realizadas: e?.labores_realizadas ?? e?.labores,
        labores_principales: e?.labores_principales,
      }))
      .filter((e: any) => !!e.empresa);

    // ===== Hijos =====
    const hijosSrc = Array.isArray(get('hijos')) ? get('hijos') : [];
    const hijos = hijosSrc
      .map((h: any) =>
        this.clean({
          numero_de_documento: h?.numero_de_documento ?? h?.numeroDocumento ?? h?.doc,
          fecha_nac: this.toYYYYMMDD(h?.fecha_nac ?? h?.fechaNacimiento),
        })
      )
      .filter((h: any) => !!h.numero_de_documento && !!h.fecha_nac);

    // ===== Entrevistas =====
    // Estos SÍ son de Entrevista en tu modelo:
    // - como_se_entero
    // - referenciado
    // - nombre_referenciado
    // (además de oficina, y opcionalmente: como_se_proyecta, cuenta_experiencia_flores, tipo_experiencia_flores)
    const entrevistas = this.compact([
      this.nonEmpty({
        oficina: get('oficina'),
        como_se_entero: get('comoSeEntero'),
        referenciado: get('referenciado'),
        nombre_referenciado: get('nombreReferenciado'),
        // opcionales soportados por el modelo
        como_se_proyecta: get('como_se_proyecta', 'proyeccion1Ano'),
        cuenta_experiencia_flores: tiene_experiencia ? 'SI' : 'NO',
        tipo_experiencia_flores: area,
      }),
    ]);

    // ===== Proceso (desde el formulario) =====
    // Campos del proceso que pueden venir “sueltos” en el form con distintos nombres.
    const procesoFromForm = this.nonEmpty({
      publicacion: get('publicacion') ?? get('publicacion_id'),
      vacante_tipo: get('vacante_tipo') ?? get('vacanteTipo'),
      vacante_salario: get('vacante_salario') ?? get('vacanteSalario'),

      nombre_evaluador: get('nombre_evaluador') ?? get('nombreEvaluador'),
      aplica_o_no_aplica: get('aplicaObservacion') ?? get('aplicaObservacion'),
      motivo_no_aplica: get('motivo_no_aplica') ?? get('motivoNoAplica'),
      motivo_espera: get('motivo_espera') ?? get('motivoEspera'),
      detalle: get('detalle'),

      // Etapas (sólo si son booleanos reales en el form)
      pre_registro: typeof get('pre_registro') === 'boolean' ? get('pre_registro') : undefined,
      entrevistado: typeof get('entrevistado') === 'boolean' ? get('entrevistado') : undefined,
      prueba_tecnica: typeof get('prueba_tecnica') === 'boolean' ? get('prueba_tecnica') : undefined,
      autorizado: typeof get('autorizado') === 'boolean' ? get('autorizado') : undefined,
      examenes_medicos: typeof get('examenes_medicos') === 'boolean' ? get('examenes_medicos') : undefined,
      contratado: typeof get('contratado') === 'boolean' ? get('contratado') : undefined,
      ingreso: typeof get('ingreso') === 'boolean' ? get('ingreso') : undefined,
      rechazado: typeof get('rechazado') === 'boolean' ? get('rechazado') : undefined,
    });

    // Mezclamos con el `proceso` que venga por parámetro (el parámetro tiene prioridad)
    const procesoMerged = (() => {
      const pArg = (proceso && Object.keys(proceso).length) ? proceso : undefined;
      if (!pArg && !procesoFromForm) return undefined;
      return { ...(procesoFromForm || {}), ...(pArg || {}) };
    })();

    // ===== Evaluacion (Opcional) =====
    const evaluacion = this.nonEmpty({
      relacion_familiar: get('relacionFamiliar'),
      rendimiento_laboral: get('desempenoLaboral'),
       porque_lo_felicitarian: get('felicitaciones'),
      malentendido: get('situacionConflictiva'),
      actividades_diarias: get('actividadesDiferentes'),
    });

    // ===== Payload final =====
    const payload: any = this.clean({
      ...candidatoBase,
      password: get('password'),
      contacto,
      residencia,
      vivienda,
      info_cc,
      experiencia_resumen,
      formaciones,
      experiencias: experiencias.length ? experiencias : undefined,
      hijos: hijos.length ? hijos : undefined,
      entrevistas,
      evaluacion,
      // solo añadimos 'proceso' si hay algo
      proceso: procesoMerged,
    });

    return payload;
  }





  // ================== HELPERS ==================
  /** Uppercase profundo excepto ciertas claves (case-insensitive). */
  private uppercaseDeepExcept<T>(data: T, skipKeys: Set<string>): T {
    const skip = new Set(Array.from(skipKeys).map(k => k.toLowerCase()));

    const walk = (val: any, keyHint?: string): any => {
      if (val == null) return val;

      if (typeof val === 'string') {
        if (keyHint && skip.has(keyHint.toLowerCase())) return val;
        return val.toLocaleUpperCase('es-CO');
      }
      if (Array.isArray(val)) return val.map((v) => walk(v));
      if (typeof val === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(val)) out[k] = walk(v, k);
        return out;
      }
      return val;
    };

    return walk(data) as T;
  }

  /** Copia sin claves undefined */
  private clean<T extends object>(obj: T): T {
    const out: any = Array.isArray(obj) ? [] : {};
    Object.entries(obj as any).forEach(([k, v]) => {
      if (v === undefined) return;
      out[k] = v;
    });
    return out as T;
  }

  /** `undefined` si el objeto queda vacío */
  private nonEmpty<T extends object | null | undefined>(obj: T): T | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const entries = Object.entries(obj as any).filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) as any : undefined;
  }

  /** Filtra nulos/undefined */
  private compact<T>(arr: (T | null | undefined)[]): T[] {
    return (arr || []).filter(Boolean) as T[];
  }

  /** YYYY-MM-DD */
  private toYYYYMMDD(v: any): string | undefined {
    if (!v) return undefined;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v);
    return s.length > 10 ? s.slice(0, 10) : s;
  }



  /** Obtiene los antecedentes (selección) actuales de un proceso */
  getSeleccion(procesoId: number | string) {
    return this.http
      .get<ProcesoSeleccionResponse>(this.url(`procesos/${procesoId}/seleccion`))
      .pipe(this.handle$());
  }

  /** Upsert de antecedentes por ID de proceso (POST o PATCH funcionan) */
  upsertSeleccion(
    procesoId: number | string,
    payload: AntecedentesPayload,
    method: 'post' | 'patch' = 'post'
  ) {
    const clean = this.clean(payload);
    // Evitamos tocar números; strings se van en mayúscula (útil para "CUMPLE"/"NO CUMPLE")
    const data = this.uppercaseDeepExcept(clean, new Set(['semanasCotizadas']));
    const req$ = method === 'patch'
      ? this.http.patch(this.url(`procesos/${procesoId}/seleccion`), data)
      : this.http.post(this.url(`procesos/${procesoId}/seleccion`), data);
    return req$.pipe(this.handle$());
  }

  /**
   * Upsert de antecedentes enviando el número de documento (y opcionalmente proceso_id).
   * Si no envías proceso_id, el backend abre/usa el proceso abierto de la última entrevista.
   */
  upsertSeleccionByDocumento(
    numeroDocumento: string,
    payload: AntecedentesPayload,
    procesoId?: number | string
  ) {
    const body: any = {
      numero_documento: (numeroDocumento ?? '').trim(),
      ...(procesoId != null ? { proceso_id: procesoId } : {}),
      ...this.clean(payload),
    };
    const data = this.uppercaseDeepExcept(body, new Set(['semanasCotizadas']));
    return this.http
      .post<{ message: string; proceso_id: number; procesoSeleccion: AntecedentesPayload }>(
        this.url('procesos/seleccion-by-document'),
        data
      )
      .pipe(this.handle$());
  }

  updateProcesoByDocumento(
    body: ProcesoUpdateByDocumentRequest,
    method: 'POST' | 'PATCH' = 'POST'
  ): Observable<UpdateByDocumentResponse> {
    const url = `${this.base}/procesos/update-by-document/`;
    return method === 'POST'
      ? this.http.post<UpdateByDocumentResponse>(url, body)
      : this.http.patch<UpdateByDocumentResponse>(url, body);
  }

}
