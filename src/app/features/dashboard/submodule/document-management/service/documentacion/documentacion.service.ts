import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Buscar en contratacion por cedula para sacar los numeros
  public mostrar_jerarquia_gestion_documental(): Observable<any> {

    return this.http
      .get(`${this.apiUrl}/gestion_documental/document-types/`, )
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  // traer todos los tags
  public mostrar_tags(): Observable<any> {

    return this.http
      .get(`${this.apiUrl}/gestion_documental/tags/`, )
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  // document-type/ put
  public editar_tipo_documento(id: number, data: any): Observable<any> {

    return this.http
      .put(`${this.apiUrl}/gestion_documental/document-types/${id}`, data, )
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  // Agregar un nuevo tipo de documento (POST)
  public crear_tipo_documento(data: any): Observable<any> {

    return this.http
      .post(`${this.apiUrl}/gestion_documental/document-types-create/`, data, )
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  //  document-search/
  public buscar_documentos(data: any): Observable<any> {

    return this.http
      .get(`${this.apiUrl}/gestion_documental/document-search/`, {
        params: data,
      })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  //  permisos/
  public mostrar_permisos(): Observable<any> {

    return this.http
      .get(`${this.apiUrl}/gestion_documental/permisos/`, )
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

    return this.http
      .post(`${this.apiUrl}/gestion_documental/permisos/`, data, )
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }




}
