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




  // EstadosRobots/pendientes_por_oficina
  // EstadosRobots/pendientes_generales
}
