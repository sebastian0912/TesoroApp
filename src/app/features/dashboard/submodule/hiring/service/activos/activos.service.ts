import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class ActivosService {

  private apiUrl = environment.apiUrl + '/activos'; // URL del endpoint

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  private getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  private createAuthorizationHeader(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders().set('Authorization', token) : new HttpHeaders();
  }


  private handleError(error: any): Observable<never> {
    console.error('Error en la solicitud:', error);
    return throwError(() => error);
  }

  /**
   * Método para cargar datos de activos o retiros al backend
   * @param tipo Tipo de datos: 'activos' o 'retiros'
   * @param datos Array de objetos procesados desde el archivo Excel
   * @returns Observable con la respuesta del backend
   */
  cargarDatos(tipo: 'activos' | 'retiros', datos: any[]): Observable<any> {
    const headers = this.createAuthorizationHeader();
    const body = {
      tipo,
      datos
    };

    return this.http.post(`${this.apiUrl}/cargar_activos_retirados/`, body, { headers }).pipe(
      catchError(this.handleError)
    );
  }


  // listar_activos/
  listarActivos(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/listar_activos/`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

}
