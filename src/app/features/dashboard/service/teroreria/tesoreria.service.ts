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

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Añadir empleados
  async añadirEmpleado(
    datos: any
  ): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/datosbase`;
    
    const requestBody = {
      datos,
      mensaje: "muchos",
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

  // Eliminar empleados (desactivar en lugar de eliminar físicamente)
  async eliminarEmpleados(cedulaEmpleado: string): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/retirar/${cedulaEmpleado}`;
    return firstValueFrom(
      this.http.delete(urlcompleta).pipe(
        catchError(error => {
          console.error('Error eliminando el empleado:', error);
          throw error;
        })
      )
    );
  }

  async actualizarEstado(numero_de_documento: string, cambios: { bloqueado?: boolean; activo?: boolean; fechaBloqueo?: string | null }): Promise<any> {
    const url = `${this.apiUrl}/Datosbase/actualizar-estados/${numero_de_documento}/`;

    return firstValueFrom(
      this.http.patch(url, cambios).pipe(
        catchError(error => {
          console.error('Error actualizando estado:', error);
          throw error;
        })
      )
    );
  }



  async bloquearEmpleado(numero_de_documento: string, estado: boolean, fechaBloqueo: string | null): Promise<any> {
    const url = `${this.apiUrl}/Datosbase/actualizar-estados/${numero_de_documento}/`;

    return firstValueFrom(
      this.http.patch(url, { bloqueado: estado, fechaBloqueo }).pipe(
        catchError(error => {
          console.error('Error actualizando estado de bloqueo:', error);
          throw error;
        })
      )
    );
  }



  // Actualizar empleados
  async actualizarEmpleado(
    cedulaEmpleado: string,
    saldos: string
  ): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/actualizarSaldos/${cedulaEmpleado}`;

    const requestBody = {
      saldos,
    };

    try {
      const response = await firstValueFrom(this.http.post(urlcompleta, requestBody).pipe(
        catchError(this.handleError)
      ));

      return response;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar salgo pendiente
  async actualizarSaldoPendienteEmpleado(
    cedulaEmpleado: string,
    saldoPendiente: string
  ): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/actualizar-saldo-pendiente/${cedulaEmpleado}/`;

    const requestBody = {
      saldoPendiente,
    };

    try {
      const response = await firstValueFrom(this.http.post(urlcompleta, requestBody).pipe(
        catchError(this.handleError)
      ));

      return response;
    } catch (error) {
      throw error;
    }
  }

  // Valores en 0
  async resetearValoresQuincena(): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/reiniciarValores`;

    return firstValueFrom(
      this.http.post(urlcompleta, {}).pipe(
        catchError(error => {
          console.error('Error al reiniciar valores de la quincena:', error);
          throw error;
        })
      )
    );
  }


  // Traer todo datos base
  async traerDatosBase(base: any, ceduladelapersona: string): Promise<any[]> {
    base = base.filter((item: any) => item.numero_de_documento === ceduladelapersona);
    return base;
  }

  async traerDatosbaseGeneral(): Promise<any[]> {
    const response = await firstValueFrom(
      this.http.get<any>(`${this.apiUrl}/Datosbase/tesoreria`).pipe(
        catchError(this.handleError)
      )
    );
    return response.datosbase || [];
  }

  // traer historial
  async traerHistorial(): Promise<any[]> {
    const response = await firstValueFrom(
      this.http.get<any>(`${this.apiUrl}/Datosbase/tesoreria`).pipe(
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


  traerHistorialPorFecha(fechaInicio: string, fechaFin: string, nombre: string): Observable<any> {
    const params = new HttpParams()
      .set('nombre', nombre)
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    return this.http.get(`${this.apiUrl}/Historial/informeFecha`, { params })
      .pipe(catchError(this.handleError));
  }

  // tesoreria/cambioEstado
  async actualizarEstadoQuincena(estado: boolean): Promise<any> {
    const url = `${this.apiUrl}/usuarios/tesoreria/cambioEstado`;

    return firstValueFrom(
      this.http.post(url, { estado }).pipe(
        catchError(error => {
          console.error('Error cambiando estado:', error);
          throw error;
        })
      )
    );
  }





}
