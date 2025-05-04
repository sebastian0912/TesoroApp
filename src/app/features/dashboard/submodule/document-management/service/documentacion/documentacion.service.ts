import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class DocumentacionService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  private createAuthorizationHeader(): HttpHeaders {
    const token = this.getToken();
    return token
      ? new HttpHeaders().set('Authorization', token)
      : new HttpHeaders();
  }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Buscar en contratacion por cedula para sacar los numeros
  public mostrar_jerarquia_gestion_documental(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/gestion_documental/document-types/`, { headers })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  // traer todos los tags
  public mostrar_tags(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/gestion_documental/tags/`, { headers })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  // document-type/ put
  public editar_tipo_documento(id: number, data: any): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .put(`${this.apiUrl}/gestion_documental/document-types/${id}`, data, {
        headers,
      })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  // Agregar un nuevo tipo de documento (POST)
  public crear_tipo_documento(data: any): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .post(`${this.apiUrl}/gestion_documental/document-types-create/`, data, {
        headers,
      })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  //  document-search/
  public buscar_documentos(data: any): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/gestion_documental/document-search/`, {
        headers,
        params: data,
      })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  //  permisos/
  public mostrar_permisos(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/gestion_documental/permisos/`, { headers })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  // permisos/<int:pk>/
  public crear_permiso(data: {
    cedula: string;
    tipo_documental_id: number;
  }): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .post(`${this.apiUrl}/gestion_documental/permisos/`, data, { headers })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }




}
