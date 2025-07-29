import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '@/environments/environment.development';
import { Observable } from 'rxjs';

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

}
