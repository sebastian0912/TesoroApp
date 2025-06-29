import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '@/environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class GestionDocumentalService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  private getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  private createAuthorizationHeader(): HttpHeaders {
    const token = this.getToken();
    return token
      ? new HttpHeaders().set('Authorization', `${token}`)
      : new HttpHeaders();
  }

  async getUser(): Promise<any> {
    if (isPlatformBrowser(this.platformId)) {
      const user = localStorage.getItem('user');
      if (user) {
        return JSON.parse(user);
      }
    }
    return null;
  }

  // Método para subir un documento
  guardarDocumento(
    title: any,
    owner_id: string,
    type: number,
    file: File,
    contract_number?: string // Hacer que el número de contrato sea opcional
  ): Observable<any> {
    const formData = new FormData();
    formData.append('title', title); // Nombre del archivo
    formData.append('owner_id', owner_id); // Cédula
    formData.append('type', type.toString()); // Tipo de documento (entero)
    formData.append('file', file); // Archivo PDF
    // Solo agregar el número de contrato si está presente
    if (contract_number) {
      formData.append('contract_number', contract_number);
    }

    const headers = this.createAuthorizationHeader();

    return this.http.post(
      `${this.apiUrl}/gestion_documental/documentos/`,
      formData,
      {
        headers,
      }
    );
  }

  // Nuevo método para obtener documentos por tipo documental
  obtenerDocumentosPorTipo(
    owner_id: string,
    contract_number: string,
    type: number
  ): Observable<any> {
    const headers = this.createAuthorizationHeader();

    // Preparar los parámetros de la solicitud
    let params = new HttpParams();
    params = params.append('cedula', owner_id);
    params = params.append('contract_number', contract_number);
    params = params.append('type', type.toString()); // Agregar el tipo documental

    return this.http.get(`${this.apiUrl}/gestion_documental/documentos/`, {
      headers,
      params,
    });
  }


consultarDocumentosPorCedulaYTipo(cedula: string, type?: number): Observable<any> {
  let params = new HttpParams().set('cedula', cedula);
  if (type !== undefined && type !== null) {
    params = params.set('type', type.toString());
  }

  return this.http.get(
    `${this.apiUrl}/gestion_documental/documentos/`,
    { params }
  );
}




}
