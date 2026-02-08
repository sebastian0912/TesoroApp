import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { firstValueFrom, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TrasladosService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Buscar traslados por responsable
  getTrasladosPorResponsable(fullName: string): Observable<any> {
    const ano = new Date().getFullYear();
    const url = `${this.apiUrl}/traslados/buscar-filtro/?responsable=${encodeURIComponent(fullName)}&ano=${ano}`;

    return this.http.get<any>(url).pipe(
      catchError(this.handleError)
    );
  }


  // Cambiar correo
  async cambiarCorreo(codigo: string, usernameLocal: string): Promise<any> {
    const urlcompleta = `${this.apiUrl}/traslados/asignar-correo`;
    const requestBody = {
      codigo_traslado: codigo,
      responsable: usernameLocal,
    };
    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, requestBody)
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Cambiar estado
  async cambiarEstado(
    codigo_traslado: any,
    estado_del_traslado: any,
    fecha_efectividad: any,
    numero_radicado: any,
    cantidad_beneficiarios: any,
    observacion_estado: any,
    eps_trasladada: any
  ): Promise<any> {
    const urlcompleta = `${this.apiUrl}/traslados/actualizar_estado/`;

    const requestBody = {
      codigo_traslado: codigo_traslado,
      estado_del_traslado: estado_del_traslado,
      fecha_efectividad: fecha_efectividad,
      numero_radicado: numero_radicado,
      cantidad_beneficiarios: cantidad_beneficiarios,
      observacion_estado: observacion_estado,
      eps_trasladada: eps_trasladada,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, requestBody)
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Autoasignar traslado
  async autoasignarTraslado(usernameLocal: string): Promise<any> {

    const urlcompleta = `${this.apiUrl}/traslados/actualizar_datos/`;

    const requestBody = {
      responsable: usernameLocal,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, requestBody)
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Cuantos traslados disponibles
  cuantosTrasladosDisponibles(): Observable<any> {
    const url = `${this.apiUrl}/traslados/cuantos_traslados/`;
    return this.http.get(url).pipe(catchError(this.handleError));
  }

  // Cuantos traslados disponibles
  traerTodosLosCorreos(usernameLocal: string): Observable<any> {
    const url = `${this.apiUrl
      }/traslados/traer_todo_correos_raul?responsable=${encodeURIComponent(
        usernameLocal
      )}`;
    return this.http.get(url).pipe(catchError(this.handleError));
  }

  // obtener-solicitud-por-codigo/<int:codigo_traslado>/
  traerSolicitudPorCodigo(codigo: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/traslados/obtener-solicitud-por-codigo/${codigo}/`)
      .pipe(catchError(this.handleError));
  }

  // obtener-cedula-escaneada/<str:numero_cedula>/
  traerCedulaEscaneada(numeroCedula: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/traslados/obtener-cedula-escaneada/${numeroCedula}/`)
      .pipe(catchError(this.handleError));
  }

  // buscar/<str:id>
  buscarAfiliacionPorId(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/traslados/buscar-por-cedula/${id}/`)
      .pipe(catchError(this.handleError));
  }

}
