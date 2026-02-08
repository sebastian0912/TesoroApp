import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, lastValueFrom, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@/environments/environment';


@Injectable({
  providedIn: 'root'
})
export class PaymentsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Buscar formas de pago por cedula
  public buscarFormasPago(cedula: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/FormasdePago/traerformasDePago/${cedula}`).pipe(
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
    const urlcompleta = `${this.apiUrl}/FormasdePago/editarFormasdepago/${id}`;

    const data = {
      banco: banco,
      nombre: nombre,
      centrodecosto: centrodecosto,
      concepto: concepto,
      contrato: contrato,
      fechadepago: fechadepago,
      formadepago: formadepago,
      valor: valor,
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Eliminar forma de pago por id por metodo delete
  async eliminarFormaPago(id: number): Promise<any> {


    const urlcompleta = `${this.apiUrl}/FormasdePago/eliminarformadepago/${id}`;


    try {
      const response = await firstValueFrom(this.http.delete<string>(urlcompleta).pipe(
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
    const urlcompleta = `${this.apiUrl}/FormasdePago/crearformasDePago`;
    const data = {
      datos: datos,
      mensaje: "mcuhos",
    };
    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data).pipe(
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
    return this.http.get(`${this.apiUrl}/Desprendibles/traerDesprendibles/${cedula}`).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Subir archivo de desprendibles
  async subirExcelDesprendibles(
    datos: any
  ): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Desprendibles/crear_desprendibles`;


    const data = {
      datos: datos,
      mensaje: "mcuhos",
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  actualizarCorreosMasivos(payload: Array<{ numerodeceduladepersona: string; primercorreoelectronico: string }>): Promise<any> {
    const url = `${this.apiUrl}/contratacion/candidatos/emails/bulk-update`;
    return lastValueFrom(this.http.post(url, payload));
  }

}
