import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';

export type EstadoField =
  | 'preseleccionado'
  | 'contratado';

export interface EstadoResponse {
  id: number;
  preseleccionados?: string[];
  contratados?: string[];
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class VacantesService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Listar los cargos
  // Listar centro de costos
  // centro-costos/
  // Enviar los datos de la vacante
  enviarVacante(vacanteData: any): Observable<any> {
    // agergar el token a vacanteData

    return this.http.post(`${this.apiUrl}/publicacion/publicaciones/`, vacanteData).pipe(
      map((response: any) => response),
      catchError((error: any) => {
        return throwError(error);
      })
    );
  }

  // Listar vacantes
  listarVacantes(): Observable<any> {

    return this.http.get(`${this.apiUrl}/publicacion/publicaciones`).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Eliminar vacante por ID
  eliminarVacante(id: string): Observable<any> {

    return this.http.delete(`${this.apiUrl}/publicacion/eliminarVacante/${id}`).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Actualizar vacante por id
  actualizarVacante(id: string, vacanteData: any): Observable<any> {

    return this.http.post(`${this.apiUrl}/publicacion/editarVacante/${id}`, vacanteData).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Obtener vacante por id
  obtenerVacante(id: string): Observable<any> {

    return this.http.get(`${this.apiUrl}/publicacion/publicaciones/${id}`).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  getVacantesPorOficina(nombreOficina: string): Observable<any[]> {
    const url = `${this.apiUrl}/publicacion/vacantes-por-nombre-oficina/${encodeURIComponent(nombreOficina)}/`;
    return this.http.get<any[]>(url);
  }


  // -----------------------
  // NUEVO: Estado individual (APIView)
  // PATCH /vacantes-aplicantes/:id/estado/:field/
  // - Si envías {value: true|false}, lo fija
  // - Si envías {}, hace toggle
  // -----------------------

  setEstadoVacanteAplicante(
    id: any,
    field: EstadoField,
    cedula: any
  ): Observable<EstadoResponse> {
    const url = `${this.apiUrl}/publicacion/cambioestado/${id}/estado/${field}/`;
    const body = { cedula, op: 'add' }; // siempre add
    return this.http.patch<EstadoResponse>(url, body);
  }

  // -------------------------------------------------------------------
  // ----------------------- CENTROS DE COSTOS  ------------------------
  //--------------------------------------------------------------------

  // Obtener centros de costos agrupados por empresa usuaria y finca
  // Obtener sublabores
  // Crear detalles laborales
  // Obtener detalles laborales por empresa, finca y sublabor
}
