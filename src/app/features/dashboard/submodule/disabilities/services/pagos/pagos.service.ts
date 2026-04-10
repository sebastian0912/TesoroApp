import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment.development';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PagosService {

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

  private handleError(error: any): Observable<never> {
    throw error;
  }

  async getUser(): Promise<any> {
    if (isPlatformBrowser(this.platformId)) {
      return JSON.parse(localStorage.getItem('user') || '{}');
    }
    return null;
  }

  // Buscar formas de pago por cedula
  public buscarFormasPago(cedula: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/FormasdePago/traerformasDePago/${cedula}`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Editar forma de pago
  async editarFormaPago(
    id: number,
    banco: any,
    nombre: string,
    centrodecosto: string,
    concepto: string,
    contrato: string,
    fechadepago: string,
    formadepago: string,
    valor: string
  ): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/FormasdePago/editarFormasdepago/${id}`;

    const headers = this.createAuthorizationHeader().set('Content-Type', 'application/json');

    const data = {
      banco: banco,
      nombre: nombre,
      centrodecosto: centrodecosto,
      concepto: concepto,
      contrato: contrato,
      fechadepago: fechadepago,
      formadepago: formadepago,
      valor: valor,
      jwt: token
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data, { headers }).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Eliminar forma de pago por id por metodo delete
  async eliminarFormaPago(id: number): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/FormasdePago/eliminarformadepago/${id}`;

    const headers = this.createAuthorizationHeader();

    try {
      const response = await firstValueFrom(this.http.delete<string>(urlcompleta, { headers }).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }


  // Subir archivo de formas de pago
  async subirExcelFormasPago(
    datos: any
  ): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/FormasdePago/crearformasDePago`;

    const headers = this.createAuthorizationHeader();

    const data = {
      datos: datos,
      mensaje: "mcuhos",
      jwt: token
    };
    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data, { headers }).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // ------------------------------------------------------------------------------------
  // ----------------------------------- Desprendibles -----------------------------------
  // ------------------------------------------------------------------------------------

  // Buscar formas de pago por cedula
  public buscarDesprendibles(cedula: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/Desprendibles/traerDesprendibles/${cedula}`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Subir archivo de desprendibles
  async subirExcelDesprendibles(
    datos: any
  ): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/Desprendibles/crear_desprendibles`;

    const headers = this.createAuthorizationHeader().set('Content-Type', 'application/json');

    const data = {
      datos: datos,
      mensaje: "mcuhos",
      jwt: token
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data, { headers }).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }


}
