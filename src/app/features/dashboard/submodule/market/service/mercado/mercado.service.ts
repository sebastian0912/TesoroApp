import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

@Injectable({
  providedIn: 'root'
})
export class MercadoService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object, private utilityService: UtilityServiceService) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }
  // verificar estado del codigo
  // Cambiar estado del codigo
  // Escribe el codigo de ejecutado en el codigo de Autorizacion
  // ejecutar mercado tienda
  async ejecutarMercadoTienda(
    codigo: string,
    cedula: string,
    monto: number,
    codigoDescontado: string,
    conceptoEjecutado: string,
    historial_id: number
  ): Promise<any> {
    const user = this.utilityService.getUser();
    const usernameLocal = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;

    const fecha = new Date().toISOString().split('T')[0];

    const urlcompleta = `${this.apiUrl}/Codigo/ejecutarMercadoTienda`;

    const requestBody = {
      cedula: cedula,
      monto: monto,
      cuotas: 2,
      codigo: codigo,
      codigoDescontado: codigoDescontado,
      conceptoEjecutado: conceptoEjecutado,
      fecha: fecha,
      ejecutadoPor: usernameLocal,
      historial: historial_id,
    };


    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, requestBody).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // ejecutar mercado comercializadora
  async ejecutarMercadoComercializadora(
    codigo: string,
    cedula: string,
    monto: number,
    codigoDescontado: string,
    conceptoEjecutado: string,
    historial_id: number
  ): Promise<any> {
    const user = this.utilityService.getUser();
    const usernameLocal = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;

    const fecha = new Date().toISOString().split('T')[0];

    const urlcompleta = `${this.apiUrl}/Codigo/ejecutarMercadoComercializadora`;

    const requestBody = {
      cedula: cedula,
      monto: monto,
      cuotas: 2,
      codigo: codigo,
      codigoDescontado: codigoDescontado,
      conceptoEjecutado: conceptoEjecutado,
      fecha: fecha,
      ejecutadoPor: usernameLocal,
      historial: historial_id,
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, requestBody).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }




}
