import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';
import { FormGroup } from '@angular/forms';

export interface UploadFotoResponse {
  ok: boolean;
  id: number;
}

@Injectable({
  providedIn: 'root'
})
export class SeleccionService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private handleError(error: any): Observable<never> {
    return throwError(() => error);
  }

  // Método para generar el código de contratación
  // Mandar parte uno de la selección
  public crearSeleccionParteUnoCandidato(
    formData: any,
    cedula: any,
    seleccion?: any | null
  ): Observable<any> {
    // Normalizaciones rápidas
    const toInt = (v: any, def = 0) => {
      const n = parseInt(String(v ?? '').trim(), 10);
      return Number.isFinite(n) ? n : def;
    };
    const pick = (v: any, alt?: any) => (v ?? alt ?? '');

    const requestData: any = {
      numerodeceduladepersona: String(cedula).trim(),

      // Campos que el backend Parte 1 espera
      nombre_evaluador: pick(formData.nombre_evaluador),
      eps: pick(formData.eps),
      afp: pick(formData.afp),
      policivos: pick(formData.policivos),
      procuraduria: pick(formData.procuraduria),
      contraloria: pick(formData.contraloria),
      rama_judicial: pick(formData.ramaJudicial, formData.rama_judicial),
      sisben: pick(formData.sisben),
      ofac: pick(formData.ofac),
      medidas_correctivas: pick(formData.medidasCorrectivas, formData.medidas_correctivas),
      semanasCotizadas: toInt(formData.semanasCotizadas, 0),
    };

    // Actualiza si viene id; crea si no viene
    if (seleccion !== undefined && seleccion !== null) {
      requestData.seleccion = seleccion;
    }

    // IMPORTANTE: ya NO enviamos jwt crearSeleccionParteUnoCandidato
    return this.http
      .post(`${this.apiUrl}/Seleccion/crearSeleccionParteUnoCandidato`, requestData,)
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }


  public crearSeleccionParteDosCandidato(
    formData: any | FormGroup,
    cedula: any,
    seleccion?: any
  ): Observable<any> {
    // Debe incluir Authorization: Bearer <token>

    // Acepta FormGroup o plain object
    const raw: any = (formData && (formData as FormGroup).value)
      ? (formData as FormGroup).value
      : (formData || {});

    // ---- Normalizadores ----
    const normDate = (v: any): string => {
      if (!v) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10); // YYYY-MM-DD
      const s = String(v);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;                 // YYYY-MM-DD
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);         // DD/MM/YYYY
      if (m) {
        const [_, d, mo, y] = m;
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      const d2 = new Date(s);
      return isNaN(d2.getTime()) ? '' : d2.toISOString().slice(0, 10);
    };

    const normTime = (v: any): string | null => {
      if (!v) return null;
      let s = String(v).trim();

      // Soporta "HH:MM AM/PM" o "HH:MM"
      const ampm = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
      if (ampm) {
        let hh = parseInt(ampm[1], 10);
        const mm = parseInt(ampm[2], 10);
        const p = ampm[3].toUpperCase();
        if (p === 'PM' && hh < 12) hh += 12;
        if (p === 'AM' && hh === 12) hh = 0;
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }

      const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
      if (h24) {
        const hh = Math.min(23, Math.max(0, +h24[1]));
        const mm = Math.min(59, Math.max(0, +h24[2]));
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }
      return null;
    };

    const toIntOrNull = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // ---- Mapeo Angular → Backend ----
    const requestData: any = {
      numerodeceduladepersona: String(cedula).trim(),

      // Campos de Parte 2
      tipo: raw.tipo ?? '',
      centro_costo_entrevista: raw.empresaUsuaria ?? '', // antes "empresaUsuaria"
      cargo: raw.cargo ?? '',
      area_entrevista: raw.area ?? '',                   // antes "area"
      fecha_prueba_entrevista: normDate(raw.fechaPruebaEntrevista),
      hora_prueba_entrevista: normTime(raw.horaPruebaEntrevista),
      direccion_empresa: raw.direccionEmpresa ?? '',
      fechaIngreso: normDate(raw.fechaIngreso),
      salario: raw.salario != null ? String(raw.salario) : '',
    };

    // Si envías 'seleccion' (id del proceso), actualiza; si no, crea
    if (seleccion !== undefined && seleccion !== null) {
      requestData.seleccion = seleccion;
    }

    // IMPORTANTE: no enviamos jwt en el body; va en headers
    return this.http
      .post(`${this.apiUrl}/Seleccion/crearSeleccionparteDoscandidato`, requestData,)
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }



  // Mandar parte tres de la selección
  public crearSeleccionParteTresCandidato(
    formData: any | FormGroup,
    cedula: string,
    seleccion?: number | null
  ): Observable<any> {


    // Acepta FormGroup o plain object
    const raw: any = (formData && (formData as FormGroup).value)
      ? (formData as FormGroup).value
      : (formData || {});

    // Normalizaciones
    const examsArr: string[] = Array.isArray(raw.selectedExams)
      ? raw.selectedExams.filter((x: any) => !!x && String(x).trim() !== '')
      : [];

    // selectedExamsArray puede venir como [{aptoStatus:'APTO'}, ...] o solo ['APTO', ...]
    const aptosArr: string[] = Array.isArray(raw.selectedExamsArray)
      ? raw.selectedExamsArray
        .map((x: any) => (x && typeof x === 'object' ? x.aptoStatus : x))
        .filter((x: any) => !!x && String(x).trim() !== '')
        .map((x: any) => String(x).toUpperCase().trim())
      : [];

    const requestData: any = {
      numerodeceduladepersona: String(cedula),
      ips: raw.ips ?? '',
      ipslab: raw.ipsLab ?? raw.ipslab ?? '',       // ⇐ mapeo correcto
      examenes: examsArr.join(', '),                // ⇐ backend recibe texto
      aptosExamenes: aptosArr.join(', '),           // ⇐ backend recibe texto
    };

    // Solo incluir si trae valor; si no, se creará uno nuevo en el backend
    if (seleccion !== undefined && seleccion !== null) {
      requestData.seleccion = seleccion;
    }

    return this.http
      .post(`${this.apiUrl}/Seleccion/crearSeleccionparteTrescandidato`, requestData,)
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }


  // Mandar parte cuatro de la selección

  public guardarInfoPersonal(data: any): Observable<any> {

    return this.http.post(`${this.apiUrl}/entrevista/info-personal-alt/`, data,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // --- Guardar Entrevista ---
  // --- Guardar Observaciones ---
  // --- Guardar Vacantes ---
  // listado-candidatos/
  // exportar-candidatos-excel/
  // Buscar en contratacion por cedula para sacar los numeros
  public buscarEncontratacion(cedula: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/contratacion/traerNombreCompletoCandidatoSin/${cedula}`, {}).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // 'seleccion/<int:id>/'
}
