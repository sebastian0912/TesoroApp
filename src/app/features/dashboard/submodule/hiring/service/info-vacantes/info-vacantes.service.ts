import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '@/environments/environment.development';
import { Observable } from 'rxjs';

export type EstadoField =
  | 'pre_registro'
  | 'entrevistado'
  | 'prueba_tecnica'
  | 'examenes_medicos'
  | 'contratado';

export interface EstadoResponse {
  id: number;
  updated_at: string;
  // el backend devuelve solo el campo cambiado, por eso lo dejamos index signature:
  [k: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class InfoVacantesService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  // Servicio: Cambia el tipo de respuesta a 'json'
  descargarChecklistJson(startDate: Date, endDate: Date): Observable<any> {
    const url = `${this.apiUrl}/entrevista/checklist/excel/`;

    let params = new HttpParams();
    if (startDate) {
      params = params.set('start_date', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      params = params.set('end_date', endDate.toISOString().split('T')[0]);
    }

    return this.http.get(url, { params, responseType: 'json' });
  }

  // vacantes-por-numero/<str:numero>/
  getVacantesPorNumero(numero: string): Observable<any> {
    const url = `${this.apiUrl}/entrevista/vacantes-por-numero/${numero}/`;
    return this.http.get(url);
  }


  // -----------------------
  // NUEVO: Estado individual (APIView)
  // PATCH /vacantes-aplicantes/:id/estado/:field/
  // - Si envías {value: true|false}, lo fija
  // - Si envías {}, hace toggle
  // -----------------------
  setEstadoVacanteAplicante(
    id: number,
    field: EstadoField,
    value?: boolean
  ): Observable<EstadoResponse> {
    const url = `${this.apiUrl}/entrevista/cambioestado/${id}/estado/${field}/`;
    const body = value === undefined ? {} : { value };
    return this.http.patch<EstadoResponse>(url, body);
  }

  /** Atajo para toggle sin pasar value */
  toggleEstadoVacanteAplicante(id: number, field: EstadoField): Observable<EstadoResponse> {
    return this.setEstadoVacanteAplicante(id, field);
  }

}
