import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class ComercializadoraService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  public getUser(): any {
    if (isPlatformBrowser(this.platformId)) {
      return JSON.parse(localStorage.getItem('user') || '{}');
    }
    return null;
  }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Traer datos de la comercializadora por codigo
  traerComercializadoraPorCodigo(producto: any, codigo: string): any {
    // buscar en la base de datos la comercializadora por codigo
    let productoComercializadora = producto.find(
      (comercializadora: { codigo: string }) =>
        comercializadora.codigo === codigo
    );
    return productoComercializadora;
  }

  // Actualizar inventario con la cantidad vendida
  async ActualizarInventario(
    cantidadTotalVendida: string,
    codigo: string
  ): Promise<string> {

    const urlcompleta = `${this.apiUrl}/Comercio/jefedearea/ActualizarCantidadVendida/${codigo}`;


    const requestBody = {
      cantidadTotalVendida,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, requestBody)
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Traer datos de la comercializadora por codigo
  traerComercio(codigo: number): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/Comercio/comercio/${codigo}`)
      .pipe(catchError(this.handleError));
  }

  // Realizar envio de mercancia
  async enviarMercancia(
    codigo: string,
    destino: string,
    concepto: string,
    cantidadEnvio: string,
    valorUnidad: string,
    personaQueLleva: string,
    comentariosEnvio: string
  ): Promise<string> {


    const urlcompleta = `${this.apiUrl}/Comercio/Comercializadora/realizarenvio`;

    const requestBody = {
      cantidadEnvio,
      valorUnidad,
      concepto,
      codigo,
      destino,
      personaQueLleva,
      comentariosEnvio,
      PersonaEnvia: this.getUser().primer_nombre + ' ' + this.getUser().primer_apellido,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<{ message: string }>(urlcompleta, requestBody)
          .pipe(catchError(this.handleError))
      );
      return response.message;
    } catch (error_1) {
      throw error_1;
    }
  }

  // Editar envio de mercancia
  async EditarEnvio(
    codigo: string,
    destino: string,
    concepto: string,
    cantidadEnvio: string,
    valorUnidad: string
  ): Promise<string> {

    const urlcompleta = `${this.apiUrl}/Comercio/Comercializadora/editarEnvio/${codigo}`;


    const requestBody = {
      cantidadEnvio,
      valorUnidad,
      concepto,
      codigo,
      destino,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<{ message: string }>(urlcompleta, requestBody)
          .pipe(catchError(this.handleError))
      );
      return response.message;
    } catch (error_1) {
      throw error_1;
    }
  }

  // Recibir envio
  async RecibirEnvio(
    cantidadRecibida: string,
    PersonaRecibe: string,
    comentariosRecibido: string,
    codigo: string
  ): Promise<string> {


    const urlcompleta = `${this.apiUrl}/Comercio/jefedearea/recibirenvio/${codigo}`;


    const requestBody = {
      cantidadRecibida,
      PersonaRecibe,
      comentariosRecibido,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<{ message: string }>(urlcompleta, requestBody)
          .pipe(catchError(this.handleError))
      );
      return response.message;
    } catch (error_1) {
      throw error_1;
    }
  }

  // recibir mercancia
  async recibirMercancia(
    cod: any,
    cantidadRecibida: any,
    comentariosRecibido: any
  ): Promise<any> {

    const urlcompleta = `${this.apiUrl}/Comercio/jefedearea/recibirenvio/${cod}`;

    const PersonaRecibe =
      this.getUser().primer_nombre + ' ' + this.getUser().primer_apellido;
    const dataToSend = {
      cod,
      cantidadRecibida,
      PersonaRecibe,
      comentariosRecibido,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, dataToSend)
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // categorias/<int:id>
  async traerCategorias(int: number): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http
          .get(`${this.apiUrl}/opciones_formulario/categorias/${int}`)
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

}
