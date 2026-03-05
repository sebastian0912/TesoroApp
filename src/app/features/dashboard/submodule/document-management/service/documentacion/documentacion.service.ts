import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DocumentacionService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  guardarDocumento(
    title: any,
    owner_id: any,
    type: number,
    file: File,
    contract_number?: string
  ): Observable<any> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('owner_id', owner_id);
    formData.append('type', type.toString());
    formData.append('file', file);
    if (contract_number) formData.append('contract_number', contract_number);

    return this.http.post(
      `${this.apiUrl}/gestion_documental/documentos/`,
      formData
    );
  }

  // Buscar en contratacion por cedula para sacar los numeros
  public mostrar_jerarquia_gestion_documental(): Observable<any> {

    return this.http
      .get(`${this.apiUrl}/gestion_documental/document-types/`,)
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }



  // document-type/ put
  public editar_tipo_documento(id: number, data: any): Observable<any> {

    return this.http
      .put(`${this.apiUrl}/gestion_documental/document-types/${id}`, data,)
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  // Agregar un nuevo tipo de documento (POST)
  public crear_tipo_documento(data: any): Observable<any> {

    return this.http
      .post(`${this.apiUrl}/gestion_documental/document-types-create/`, data,)
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
      .get(`${this.apiUrl}/gestion_documental/permisos/`,)
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
      .post(`${this.apiUrl}/gestion_documental/permisos/`, data,)
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  actualizarDocumento(
    title: string,
    owner_id: string,
    type: number,
    file: Blob,
    filename: string,
    contract_number?: string
  ): Observable<any> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('owner_id', owner_id);
    formData.append('type', type.toString());
    formData.append('file', file, filename);
    if (contract_number) formData.append('contract_number', contract_number);

    return this.http
      .post(`${this.apiUrl}/gestion_documental/documentos/`, formData)
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  bulkZipUpload(
    zipFile: File,
    opts?: { contract_from_filename?: boolean; default_contract?: string }
  ): Observable<any> {
    const form = new FormData();
    form.append('zip_file', zipFile, zipFile.name);
    if (opts?.contract_from_filename !== undefined) {
      form.append('contract_from_filename', String(!!opts.contract_from_filename));
    }
    if (opts?.default_contract) {
      form.append('default_contract', opts.default_contract);
    }

    // si tu backend expone directamente /bulk-zip-upload/ en la raíz de apiUrl:
    const url = `${this.apiUrl}/gestion_documental/bulk-zip-upload/`;
    // si lo tienes con prefijo (ej. /api/gestion-documental/bulk-zip-upload/), ajusta arriba.

    return this.http.post<any>(url, form);
    // no pongas Content-Type: multipart/form-data manualmente;
    // HttpClient gestiona boundary y headers automáticamente.
  }



}
