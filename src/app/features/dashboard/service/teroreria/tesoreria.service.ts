import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class TesoreriaService {

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

  // Añadir empleados
  async añadirEmpleado(
    datos: any
  ): Promise<any> {

    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/Datosbase/datosbase`;

    const headers = this.createAuthorizationHeader().set('Content-Type', 'application/json');

    const requestBody = {
      datos,
      mensaje: "muchos",
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

  // Eliminar empleados
  async eliminarEmpleados(cedulaEmpleado: string): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/Datosbase/eliminardatos/${cedulaEmpleado}`;

    const headers = this.createAuthorizationHeader();

    try {
      const response = await firstValueFrom(this.http.delete(urlcompleta, { headers }).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar empleados
  async actualizarEmpleado(
    cedulaEmpleado: string,
    saldos: string
  ): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/Datosbase/actualizarSaldos/${cedulaEmpleado}`;
    const headers = this.createAuthorizationHeader().set('Content-Type', 'application/json');

    const requestBody = {
      saldos,
      jwt: token
    };

    try {
      const response = await firstValueFrom(this.http.post(urlcompleta, requestBody, { headers }).pipe(
        catchError(this.handleError)
      ));

      return response;
    } catch (error) {
      throw error;
    }
  }

  // Valores en 0
  async resetearValoresQuincena(): Promise<any> {

    const token = this.getToken();
    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/Datosbase/reiniciarValores`;
    const headers = this.createAuthorizationHeader().set('Content-Type', 'application/json');

    const requestBody = {
      jwt: token
    };

    try {
      const response = await firstValueFrom(this.http.post(urlcompleta, requestBody, { headers }).pipe(
        catchError(this.handleError)
      ));

      return response;
    } catch (error) {
      throw error;
    }
  }

  // Traer todo datos base
  async traerDatosBase(base: any, ceduladelapersona: string): Promise<any[]> {
    base = base.filter((item: any) => item.numero_de_documento === ceduladelapersona);
    return base;
  }

  async traerDatosbaseGeneral(): Promise<any[]> {
    const headers = this.createAuthorizationHeader();
    const response = await firstValueFrom(
      this.http.get<any>(`${this.apiUrl}/Datosbase/tesoreria`, { headers }).pipe(
        catchError(this.handleError)
      )
    );
    return response.datosbase || [];
  }

  // traer historial
  async traerHistorial(): Promise<any[]> {
    const headers = this.createAuthorizationHeader();
    const response = await firstValueFrom(
      this.http.get<any>(`${this.apiUrl}/Datosbase/tesoreria`, { headers }).pipe(
        catchError(this.handleError)
      )
    );
    return response.datosbase || [];
  }

  // Verficar si el empleado puede ser eliminado
  verificaInfo(datos: any): boolean {
    // verificar que no tenga saldos pendientes
    const sumaTotal =
      parseInt(datos.mercados) +
      parseInt(datos.prestamoParaDescontar) +
      parseInt(datos.casino) +
      parseInt(datos.valoranchetas) +
      parseInt(datos.fondo) +
      parseInt(datos.carnet) +
      parseInt(datos.seguroFunerario) +
      parseInt(datos.anticipoLiquidacion) +
      parseInt(datos.cuentas);

    if (sumaTotal > 0) {
      return false;
    }
    else {
      return true;
    }

  }


  traerHistorialPorFecha(fechaInicio: string, fechaFin: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    const user = this.getUser();
    const nombre = `${user.primer_nombre} ${user.primer_apellido}`;

    const params = new HttpParams()
      .set('nombre', nombre)
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    return this.http.get(`${this.apiUrl}/Historial/informeFecha`, { headers, params })
      .pipe(catchError(this.handleError));
  }





}
