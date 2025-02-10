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

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // traer historial de operario
  getHistorialOperario(cedula: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/Historial/tesoreria/${cedula}`,).pipe(
      catchError(this.handleError)
    );
  }

  // traer historial comercializadora y tesorero
  getHistorialComercializadoraTesorero(): Observable<any> {
    return this.http.get(`${this.apiUrl}/HistorialModificaciones/Comercializadora/verModificaciones`).pipe(
      catchError(this.handleError)
    );
  }





}
