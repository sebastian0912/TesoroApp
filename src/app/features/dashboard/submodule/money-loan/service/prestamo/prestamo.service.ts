import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment.development';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

@Injectable({
  providedIn: 'root',
})
export class PrestamoService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private utilityService: UtilityServiceService
  ) {}

  private handleError(error: any): Observable<never> {
    throw error;
  }

  async ejecutarPrestamoCalamidad(
    codigo: string,
    cedula: string,
    monto: number,
    codigoDescontado: string,
    conceptoEjecutado: string,
    historial_id: number,
    cuotas: number
  ): Promise<any> {
    const user = this.utilityService.getUser();
    const usernameLocal = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;

    const fecha = new Date().toISOString().split('T')[0];

    const urlcompleta = `${this.apiUrl}/Codigo/ejecutarPrestamoCalamidad`;

    const requestBody = {
      cedula: cedula,
      monto: monto,
      cuotas: cuotas,
      codigo: codigo,
      codigoDescontado: codigoDescontado,
      conceptoEjecutado: conceptoEjecutado,
      fecha: fecha,
      ejecutadoPor: usernameLocal,
      historial: historial_id,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<any>(urlcompleta, requestBody)
          .pipe(catchError(this.handleError))
      );
      return response; // No necesitas llamar a response.json() porque response ya es un objeto JSON
    } catch (error) {
      throw error;
    }
  }

  async ejecutarPrestamoParaHacer(
    codigo: string,
    cedula: string,
    monto: number,
    codigoDescontado: string,
    conceptoEjecutado: string,
    historial_id: number,
    cuotas: number
  ): Promise<any> {
    const user = this.utilityService.getUser();
    const usernameLocal = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;

    const fecha = new Date().toISOString().split('T')[0];

    const urlcompleta = `${this.apiUrl}/Codigo/ejecutarPrestamoParaHacer`;

    const requestBody = {
      cedula: cedula,
      monto: monto,
      cuotas: cuotas,
      codigo: codigo,
      codigoDescontado: codigoDescontado,
      conceptoEjecutado: conceptoEjecutado,
      fecha: fecha,
      ejecutadoPor: usernameLocal,
      historial: historial_id,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<any>(urlcompleta, requestBody)
          .pipe(catchError(this.handleError))
      );
      return response; // No necesitas llamar a response.json() porque response ya es un objeto JSON
    } catch (error) {
      throw error;
    }
  }
}
