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
  ) {}

  // ------------------ DOCUMENTOS (CRUD) ------------------

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

  obtenerDocumentosPorTipo(
    owner_id: any,
    type: number,
    contract_number?: string,
  ): Observable<any> {
    let params = new HttpParams().set('cedula', owner_id);
    if (contract_number) params = params.set('contract_number', contract_number);
    params = params.set('type', type.toString());

    return this.http.get(`${this.apiUrl}/gestion_documental/documentos/`, { params });
  }

  consultarDocumentosPorCedulaYTipo(cedula: string, type?: number): Observable<any> {
    let params = new HttpParams().set('cedula', cedula);
    if (type !== undefined && type !== null) {
      params = params.set('type', type.toString());
    }
    return this.http.get(`${this.apiUrl}/gestion_documental/documentos/`, { params });
  }

  // ------------------ ZIP POR CÉDULAS + ORDEN ------------------

  descargarZipPorCedulasYOrden(cedulas: number[], orden: number[]): Observable<Blob> {
    const body = { cedulas, orden };
    return this.http.post(
      `${this.apiUrl}/gestion_documental/descargar-zip`,
      body,
      { responseType: 'blob' } // descarga de archivo
    );
  }

  // ------------------ NUEVO: CHECKLIST DOCUMENTAL ------------------

  /**
   * POST /gestion_documental/documentos-checklist/
   * Envía SOLO cédulas; el backend usa los tipos por defecto si no envías 'tipos'.
   * @param cedulas array de cédulas (string|number) -> se envían como string
   * @param tipos   opcional para override puntual
   */
  getDocumentosChecklist(cedulas: Array<string | number>, tipos?: number[]): Observable<any> {
    const body: any = { cedulas: cedulas.map(String) };
    if (Array.isArray(tipos) && tipos.length) body.tipos = tipos;
    return this.http.post(
      `${this.apiUrl}/gestion_documental/documentos-checklist/`,
      body
    );
  }

  /**
   * GET /gestion_documental/documentos-checklist/?cedulas=...[,...]&tipos=...[,...]
   * Alternativa por querystring. Si omites 'tipos', el backend usará los defaults.
   */
  getDocumentosChecklistByGet(cedulas: Array<string | number>, tipos?: number[]): Observable<any> {
    let params = new HttpParams().set('cedulas', cedulas.map(String).join(','));
    if (Array.isArray(tipos) && tipos.length) {
      params = params.set('tipos', tipos.join(','));
    }
    return this.http.get(
      `${this.apiUrl}/gestion_documental/documentos-checklist/`,
      { params }
    );
  }
}
