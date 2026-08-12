import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RobotsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // EstadosRobots
  // Método para enviar Estados Robots de forma masiva
  enviarEstadosRobots(datos: any[]): Observable<any> {
    const url = `${this.apiUrl}/EstadosRobots/cargar_excel`; // Ajusta según tu endpoint real

    // Construir el body con JWT y los datos
    const body = {
      datos   // Los datos que quieres enviar al backend
    };

    return this.http.post(url, body, {}).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }




  /**
   * Resultados que YA consultó el robot para una persona, normalizados a los
   * valores que acepta el formulario de antecedentes.
   *
   * `campos[x].valor === null` significa que el robot no dejó un veredicto
   * interpretable (p.ej. procuraduría en "Consultado", que solo indica que la
   * consulta corrió). Ese caso NO se autocompleta: lo decide una persona.
   */
  getResultadosAntecedentes(cedula: string, tipoDocumento?: string | null): Observable<ResultadosAntecedentes> {
    let params = new HttpParams().set('cedula', cedula);
    if (tipoDocumento) params = params.set('tipo_documento', tipoDocumento);

    return this.http
      .get<ResultadosAntecedentes>(`${this.apiUrl}/Robots/resultados-antecedentes/`, { params })
      .pipe(catchError(this.handleError));
  }

  /**
   * Re-abre AHORA las 8 fuentes de antecedentes para que la flota vuelva a
   * consultar y suba PDFs nuevos.
   *
   * Cuesta una pasada completa de la flota (con gasto de 2captcha): confirmar
   * antes de llamar.
   *
   * Vive en /EstadosRobots y no bajo /gestion_contratacion porque el estado de
   * la cola de robots es de ms-automation; ms-hr no lo puede tocar.
   */
  forzarConsultaAntecedentes(payload: {
    tipo_doc?: string | null;
    numero_documento?: string | null;
    oficina?: string | null;
  }): Observable<RespuestaForzarConsulta> {
    return this.http
      .post<RespuestaForzarConsulta>(`${this.apiUrl}/EstadosRobots/forzar-consulta-antecedentes`, payload)
      .pipe(catchError(this.handleError));
  }

  /**
   * Re-abre UNA sola fuente (no las 8).
   *
   * Es lo que usa el botón "Forzar consultar" del documento vencido:
   * re-consultar las 8 cuesta una pasada completa de la flota y 2captcha de más
   * cuando solo está viejo un PDF.
   */
  forzarConsultaFuente(payload: {
    numero_documento: string;
    tipo_doc?: string | null;
    fuente: FuenteAntecedentes;
    oficina?: string | null;
  }): Observable<RespuestaForzarConsulta> {
    return this.http
      .post<RespuestaForzarConsulta>(`${this.apiUrl}/EstadosRobots/forzar-consulta-fuente`, payload)
      .pipe(catchError(this.handleError));
  }

  // EstadosRobots/pendientes_por_oficina
  // EstadosRobots/pendientes_generales
}

/** Una fuente consultada por el robot. */
export interface ResultadoRobotCampo {
  /** Valor listo para el formulario, o null si no es interpretable. */
  valor: string | number | null;
  /** Texto crudo que devolvió la fuente, para mostrar procedencia. */
  crudo: string | null;
  fecha: string | null;
  marca_temporal: string | null;
}

export interface ResultadosAntecedentes {
  cedula: string;
  tipo_documento?: string | null;
  encontrado: boolean;
  fecha_ultima_modificacion?: string | null;
  campos: Partial<Record<
    'policivos' | 'ofac' | 'procuraduria' | 'contraloria'
    | 'eps' | 'afp' | 'sisben' | 'medidas_correctivas',
    ResultadoRobotCampo
  >>;
}

/** Las 8 fuentes que consulta la flota. */
export type FuenteAntecedentes =
  | 'adress' | 'policivo' | 'ofac' | 'contraloria'
  | 'sisben' | 'procuraduria' | 'fondo_pension' | 'medidas_correctivas';

export interface RespuestaForzarConsulta {
  ok: boolean;
  numero_documento?: string;
  tipo_documento?: string;
  fuente?: string;
  action?: string;
  /** false cuando ya estaba en cola: no se pisó el ciclo en vuelo. */
  reabierto?: boolean;
  mensaje?: string;
}
