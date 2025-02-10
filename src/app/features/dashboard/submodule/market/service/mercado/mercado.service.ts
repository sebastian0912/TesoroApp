import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class MercadoService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

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

  public getUser(): any {
    if (isPlatformBrowser(this.platformId)) {
      return JSON.parse(localStorage.getItem('user') || '{}');
    }
    return null;
  }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // verificar estado del codigo
  public verificarCodigo(codigo: string): Observable<string> {
    const headers = this.createAuthorizationHeader();
    return this.http.get<{ message: string }>(`${this.apiUrl}/Codigo/verificarestado/${codigo}`, { headers })
      .pipe(
        map(response => response.message),
        catchError(this.handleError)
      );
  }





  // Cambiar estado del codigo
  public cambiarEstadoCodigo(codigo: string): Observable<string> {
    const headers = this.createAuthorizationHeader();
    return this.http.put<{ message: string }>(`${this.apiUrl}/Codigo/cambiarestado/${codigo}`, {}, { headers })
      .pipe(
        map(response => response.message),
        catchError(this.handleError)
      );
  }

  // Escribe el codigo de ejecutado en el codigo de Autorizacion
  public escribirCodigo(codigo: string, cedula: string, valor: number): Observable<string> {
    const headers = this.createAuthorizationHeader();
    return this.http.post<{ message: string }>(`${this.apiUrl}/Codigo/escribircodigo`, { codigo, cedula, valor }, { headers })
      .pipe(
        map(response => response.message),
        catchError(this.handleError)
      );
  }

  // ejecutar mercado tienda
  async ejecutarMercadoTienda(
    codigo: string,
    cedula: string,
    monto: number,
    codigoDescontado: string,
    conceptoEjecutado: string,
    historial_id: number
  ): Promise<any> {

    const token = this.getToken();
    const user = this.getUser();
    const usernameLocal = `${user.primer_nombre} ${user.primer_apellido}`;
    if (!token) {
      throw new Error('No token found');
    }

    const fecha = new Date().toISOString().split('T')[0];

    const urlcompleta = `${this.apiUrl}/Codigo/ejecutarMercadoTienda`;

    const headers = this.createAuthorizationHeader().set('Content-Type', 'application/json');

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
      jwt: token
    };


    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, requestBody, { headers }).pipe(
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

    const token = this.getToken();
    const user = this.getUser();
    const usernameLocal = `${user.primer_nombre} ${user.primer_apellido}`;
    if (!token) {
      throw new Error('No token found');
    }

    const fecha = new Date().toISOString().split('T')[0];

    const urlcompleta = `${this.apiUrl}/Codigo/ejecutarMercadoTienda`;

    const headers = this.createAuthorizationHeader().set('Content-Type', 'application/json');

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
      jwt: token
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, requestBody, { headers }).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }




}
