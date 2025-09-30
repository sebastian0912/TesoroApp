import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@/environments/environment.development';

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
  consultarEstadosRobots(cedula: string): Observable<any> {

    return this.http.get(`${this.apiUrl}/EstadosRobots/sin_consultar`, {
      params: { cedula }
    }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

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




  // EstadosRobots/pendientes_por_oficina
  consultarEstadosRobotsPendientesPorOficina(): Observable<any> {

    return this.http.get(`${this.apiUrl}/EstadosRobots/pendientes_por_oficina`, {

    })
      .pipe(catchError(this.handleError));
  }

  // EstadosRobots/pendientes_generales
  consultarEstadosRobotsPendientesGenerales(): Observable<any> {
    return this.http.get(`${this.apiUrl}/EstadosRobots/pendientes_paquete`, {
    })
      .pipe(catchError(this.handleError));
  }

  actualizarPrioridad(paquete: string, prioridad: string): Observable<any> {
    const body = { paquete, prioridad };
    // esto debe retornar un HttpHeaders válido con Authorization

    return this.http.put(`${this.apiUrl}/EstadosRobots/actualizar-prioridad/`, body, {});
  }


  descargarZipPaquete(paquete: string, unir: boolean, orden: number[] = []): Observable<Blob> {

    const params = new HttpParams()
      .set('unir', unir.toString())
      .set('orden', orden.join(','));

    const url = `${this.apiUrl}/EstadosRobots/descargar-zip/${encodeURIComponent(paquete)}/`;

    return this.http.get(url, {
      params,
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }



}
