import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HistorialService {

  private apiUrl = environment.apiUrl;

  private readonly TRANSACCIONES_URL = `${this.apiUrl}/gestion_tesoreria/transacciones/`;
  private readonly PERSONAS_URL = `${this.apiUrl}/gestion_tesoreria/personas/`;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Traer estado de PersonaTesoreria por documento
  getPersonaTesoreriaStatus(numeroDocumento: string): Observable<any> {
    return this.http.get(`${this.PERSONAS_URL}${encodeURIComponent(numeroDocumento)}/status/`).pipe(
      catchError(this.handleError)
    );
  }

  // Traer historial de transacciones por documento
  getHistorialTransaccionesPorDocumento(numeroDocumento: string): Observable<any> {
    return this.http.get(`${this.TRANSACCIONES_URL}?numero_documento=${encodeURIComponent(numeroDocumento)}`).pipe(
      catchError(this.handleError)
    );
  }

  // Traer historial comercializadora y tesorero
  getHistorialComercializadoraTesorero(): Observable<any> {
    return this.http.get(`${this.apiUrl}/HistorialModificaciones/Comercializadora/verModificaciones`).pipe(
      catchError(this.handleError)
    );
  }

}
