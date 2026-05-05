import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Incapacidad } from '../../models/incapacidad.model';
import { environment } from '@/environments/environment';

type Reporte = any;
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, forkJoin, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { PDFDocument } from "pdf-lib";

@Injectable({
  providedIn: 'root',
})
export class IncapacidadService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }
  private handleError(error: any): Observable<never> {
    throw error;
  }

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

  createIncapacidad(incapacidad: Incapacidad): Observable<Incapacidad> {
    const urlcompleta = `${this.apiUrl}/Incapacidades/crearIncapacidad`;
    const headers = this.createAuthorizationHeader().set(
      'Content-Type',
      'application/json'
    );
    console.log('Incapacidad a crear:', incapacidad);
    return this.http.post<Incapacidad>(urlcompleta, incapacidad, { headers });
  }
  createReporte(reporte: Reporte): Observable<Incapacidad> {
    const urlcompleta = `${this.apiUrl}/Incapacidades/crearReporte`;
    const headers = this.createAuthorizationHeader().set(
      'Content-Type',
      'application/json'
    );

    return this.http.post<Incapacidad>(urlcompleta, reporte, { headers });
  }

  updateIncapacidad(
    id: number,
    incapacidad: Incapacidad
  ): Observable<Incapacidad> {
    const urlcompleta = `${this.apiUrl}/Incapacidades/modificarIncapacidad`;
    const headers = this.createAuthorizationHeader().set(
      'Content-Type',
      'application/json'
    );
    return this.http.put<Incapacidad>(`${urlcompleta}/${id}`, incapacidad, {
      headers,
    });
  }
  buscar(query: string): Observable<any> {
    const urlcompleta = `${this.apiUrl}/Incapacidades/busqueda`;
    const headers = this.createAuthorizationHeader().set(
      'Content-Type',
      'application/json'
    );

    // Asegúrate de enviar la consulta como un objeto JSON
    const body = { query }; // Correcto: enviamos un objeto JSON con la clave 'query'

    return this.http.post<any>(urlcompleta, body, { headers });
  }

  public traerDatosListas(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/Incapacidades/traerTodaslistas`, { headers })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  public traerTodosDatosIncapacidad(
    opts?: { cedula?: string; page?: number; pageSize?: number }
  ): Observable<any> {
    const headers = this.createAuthorizationHeader();
    let params = new HttpParams();
    if (opts?.cedula) params = params.set('cedula', opts.cedula);
    if (opts?.page != null) params = params.set('page', String(opts.page));
    if (opts?.pageSize != null) params = params.set('page_size', String(opts.pageSize));
    return this.http
      .get(`${this.apiUrl}/Incapacidades/traerTodasIncapacidades`, { headers, params })
      .pipe(
        map((response: any) => {
          // Si el backend devuelve paginación, regresa response.data; si no, el array completo
          if (response && Array.isArray(response.data)) return response.data;
          return response;
        }),
        catchError(this.handleError)
      );
  }

  public traerTodosDatosReporte(
    opts?: { cedula?: string; page?: number; pageSize?: number }
  ): Observable<any> {
    const headers = this.createAuthorizationHeader();
    let params = new HttpParams();
    if (opts?.cedula) params = params.set('cedula', opts.cedula);
    if (opts?.page != null) params = params.set('page', String(opts.page));
    if (opts?.pageSize != null) params = params.set('page_size', String(opts.pageSize));
    return this.http
      .get(`${this.apiUrl}/Incapacidades/traerTodosReportes`, { headers, params })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  /**
   * Autocomplete server-side de códigos de diagnóstico.
   * Rápido gracias al índice idx_codigodiag_codigo + idx_codigodiag_descripcion.
   * @param q texto mínimo 1 char
   * @param limit máx resultados (default 20, máx 100)
   */
  public buscarCodigosDiagnostico(q: string, limit = 20): Observable<Array<{ codigo: string; descripcion: string }>> {
    const headers = this.createAuthorizationHeader();
    const params = new HttpParams()
      .set('q', q || '')
      .set('limit', String(limit));
    return this.http
      .get<Array<{ codigo: string; descripcion: string }>>(
        `${this.apiUrl}/Incapacidades/codigos-diagnostico/search`,
        { headers, params }
      )
      .pipe(catchError(this.handleError));
  }

  /**
   * Autocomplete server-side de IPS (por NIT o nombre).
   */
  public buscarIps(q: string, limit = 20): Observable<Array<{ nit: string; nombre: string }>> {
    const headers = this.createAuthorizationHeader();
    const params = new HttpParams()
      .set('q', q || '')
      .set('limit', String(limit));
    return this.http
      .get<Array<{ nit: string; nombre: string }>>(
        `${this.apiUrl}/Incapacidades/ips/search`,
        { headers, params }
      )
      .pipe(catchError(this.handleError));
  }

  public traerTodosDocumentos(fecha: string): Observable<any[]> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get<any[]>(`${this.apiUrl}/Incapacidades/traerTodosDocumentos/${fecha}`, { headers })
      .pipe(catchError(this.handleError));
  }

  public traerTodosDocumentosPorRango(inicio: string, fin: string): Observable<any[]> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get<any[]>(`${this.apiUrl}/Incapacidades/traerTodosDocumentosPorRango?inicio=${inicio}&fin=${fin}`, { headers })
      .pipe(catchError(this.handleError));
  }

  /**
   * Sube un PDF al endpoint multipart de gestion_documental:
   *   POST /Incapacidades/<consecutivoSistema>/documentos/upload
   *
   * @param consecutivoSistema  consecutivo de la incapacidad (path)
   * @param legacyField         uno de:
   *   link_incapacidad, historial_clinico, furat, soat, furips,
   *   registro_civil, registro_de_nacido_vivo, formulario_salud_total
   * @param file                el File a subir
   */
  uploadDocumento(
    consecutivoSistema: string,
    legacyField: string,
    file: File,
  ): Promise<any> {
    const url = `${this.apiUrl}/Incapacidades/${encodeURIComponent(consecutivoSistema)}/documentos/upload`;
    const fd = new FormData();
    fd.append('legacy_field', legacyField);
    fd.append('file', file, file.name);
    const headers = this.createAuthorizationHeader();
    return firstValueFrom(this.http.post(url, fd, { headers }));
  }

  /**
   * Lista los documentos de gestion_documental vinculados a una incapacidad.
   * Devuelve `{ consecutivoSistema, documentos: [{file_url, sha256, ...}] }`.
   */
  listarDocumentos(consecutivoSistema: string): Observable<any> {
    const url = `${this.apiUrl}/Incapacidades/${encodeURIComponent(consecutivoSistema)}/documentos`;
    const headers = this.createAuthorizationHeader();
    return this.http.get<any>(url, { headers });
  }

  uploadFiles(
    fileData: { [key: string]: any[] },
    fileNames: { [key: string]: string }
  ): Observable<any> {
    const archivos = Object.keys(fileData).map((key) => ({
      name: fileNames[key],
      data: fileData[key],
    }));

    // Crear un array de solicitudes HTTP usando `forkJoin`
    const requests = archivos.map((archivo) => {
      const headers = this.createAuthorizationHeader();
      return this.http.post<any>(
        `${this.apiUrl}/Incapacidades/uploadFile`,
        archivo,
        { headers }
      );
    });

    // Usar `forkJoin` para ejecutar todas las solicitudes en paralelo y retornar sus respuestas
    return forkJoin(requests).pipe(
      map((responses) => {
        console.log('Todas las respuestas:', responses);
        // Procesar todas las respuestas aquí si es necesario
        return responses; // Retorna todas las respuestas juntas como un array
      }),
      catchError((error) => {
        // Manejar errores aquí
        Swal.fire({
          icon: 'error',
          title: 'Error al subir los archivos',
          text: 'Ocurrió un error al subir los archivos, por favor intenta de nuevo.',
        });
        return error;
      })
    );
  }

  // actualizar-codigos-diagnostico/
  // Servicio en Angular (IncapacidadService)
  async actualizarCodigosDiagnostico(datos: any[]): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No token found');
    }

    // URL correcta de la API Django
    const urlcompleta = `${this.apiUrl}/Incapacidades/actualizar-codigos-diagnostico/`;

    // Encabezados con autorización
    const headers = this.createAuthorizationHeader();

    try {
      // Hacemos la solicitud POST a la API Django
      const response = await firstValueFrom(
        this.http
          .post(urlcompleta, datos, { headers })
          .pipe(catchError(this.handleError))
      );

      console.log('✅ Respuesta del servidor:', response);
      return response;
    } catch (error) {
      console.error('❌ Error en la solicitud:', error);
      throw error;
    }
  }

  // Utiliza el método anterior para descargar y crear el ZIP desde base64
  async descargarTodoComoZip(fecha: string, sevenet: boolean) {
    const zip = new JSZip();
    const documentos = await firstValueFrom(this.traerTodosDocumentos(fecha));

    const carpetaPrincipal = zip.folder(`Incapacidad con la fecha ${fecha}`);
    const epsEspeciales = ['salud total', 'matual ser', 'mutual ser', 'eps sura', 'cajacopi', 'coosalud'];

    await Promise.all(
      (documentos ?? []).map((doc: any) => this.procesarDocumentoEnZip(doc, carpetaPrincipal!, epsEspeciales, sevenet))
    );

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `incapacidades_${fecha}.zip`);
  }


  async descargarZipPorRango(rango: { inicio: string; fin: string }, sevenet: boolean) {
    const zip = new JSZip();
    const documentos = await firstValueFrom(
      this.traerTodosDocumentosPorRango(rango.inicio, rango.fin)
    );

    const carpetaPrincipal = zip.folder(`Incapacidad desde ${rango.inicio} hasta ${rango.fin}`);
    const epsEspeciales = ['salud total', 'matual ser', 'mutual ser', 'eps sura', 'cajacopi', 'coosalud'];

    await Promise.all(
      (documentos ?? []).map((doc: any) => this.procesarDocumentoEnZip(doc, carpetaPrincipal!, epsEspeciales, sevenet))
    );

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `incapacidades_${rango.inicio}_a_${rango.fin}.zip`);
  }


  /**
   * Resuelve la URL absoluta del archivo desde gestion_documental.
   * El backend devuelve `file_url` como ruta relativa (`/media/...`).
   */
  private resolveDocUrl(rawUrl: string | undefined | null): string {
    if (!rawUrl) return '';
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    const base = (this.apiUrl || '').replace(/\/+$/, '');
    const path = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
    return base + path;
  }

  /**
   * Descarga un PDF desde gestion_documental y devuelve sus bytes.
   * Usa el token de autorización para que el endpoint de gestion_documental
   * autorice la descarga.
   */
  private async fetchPdfBytes(rawUrl: string): Promise<Uint8Array | null> {
    const url = this.resolveDocUrl(rawUrl);
    if (!url) return null;
    try {
      const token = this.getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = token;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        console.warn('fetchPdfBytes', resp.status, url);
        return null;
      }
      const buf = await resp.arrayBuffer();
      return new Uint8Array(buf);
    } catch (e) {
      console.error('Error descargando PDF', url, e);
      return null;
    }
  }

  private async procesarDocumentoEnZip(
  doc: any,
  carpetaPrincipal: JSZip,
  epsEspeciales: string[],
  sevenet: boolean = false
) {
  if (!doc.Numero_de_documento) return;

  // Cada *_doc puede ser objeto {file_url, sha256, ...} o null
  const docs = {
    incapacidad: doc.link_incapacidad_doc as { file_url?: string } | null,
    hc: doc.historial_clinico_doc as { file_url?: string } | null,
    soat: doc.soat_doc as { file_url?: string } | null,
    furat: doc.furat_doc as { file_url?: string } | null,
    furips: doc.furips_doc as { file_url?: string } | null,
    registroCivil: doc.registro_civil_doc as { file_url?: string } | null,
    registroNacido: doc.registro_de_nacido_vivo_doc as { file_url?: string } | null,
    formSaludTotal: doc.formulario_salud_total_doc as { file_url?: string } | null,
  };

  const hasAny = Object.values(docs).some(d => !!(d && d.file_url));
  if (!hasAny) return;

  // sevenet: solo el PDF de la incapacidad
  if (sevenet) {
    if (!docs.incapacidad?.file_url) return;
    const epsName = (doc.nombre_eps || "Desconocida").trim();
    const epsFolder = carpetaPrincipal.folder(epsName);
    if (!epsFolder) return;

    const fechaObj = new Date(doc.marcaTemporal);
    const fechaFinal = `${String(fechaObj.getDate()).padStart(2, "0")}${
      String(fechaObj.getMonth() + 1).padStart(2, "0")
    }${fechaObj.getFullYear()}`;
    const baseNombre = `${doc.Numero_de_documento}_${fechaFinal}`;

    const bytes = await this.fetchPdfBytes(docs.incapacidad.file_url);
    if (bytes) epsFolder.file(`${baseNombre}.pdf`, bytes);
    return;
  }

  const epsName = (doc.nombre_eps || "Desconocida").trim();
  const epsNormalizada = epsName.toLowerCase();
  const esEpsEspecial = epsEspeciales.includes(epsNormalizada);

  const epsFolder = carpetaPrincipal.folder(epsName);
  if (!epsFolder) return;

  const fechaObj = new Date(doc.marcaTemporal);
  const fechaFinal = `${String(fechaObj.getDate()).padStart(2, "0")}${
    String(fechaObj.getMonth() + 1).padStart(2, "0")
  }${fechaObj.getFullYear()}`;
  const baseNombre = `${doc.Numero_de_documento}_${fechaFinal}`;

  // EPS especiales: PDFs separados en carpeta del trabajador
  if (esEpsEspecial) {
    const cedulaFolder = epsFolder.folder(doc.Numero_de_documento);
    if (!cedulaFolder) return;
    const addToCedula = async (entry: { file_url?: string } | null, name: string) => {
      if (!entry?.file_url) return;
      const bytes = await this.fetchPdfBytes(entry.file_url);
      if (bytes) cedulaFolder.file(name, bytes);
    };
    await addToCedula(docs.incapacidad,    `${baseNombre}.pdf`);
    await addToCedula(docs.hc,             `${baseNombre}_HC.pdf`);
    await addToCedula(docs.soat,           `${baseNombre}_SOAT.pdf`);
    await addToCedula(docs.furat,          `${baseNombre}_FURAT.pdf`);
    await addToCedula(docs.furips,         `${baseNombre}_FURIPS.pdf`);
    await addToCedula(docs.registroCivil,  `${baseNombre}_REGISTRO_CIVIL.pdf`);
    await addToCedula(docs.registroNacido, `${baseNombre}_REGISTRO_NACIDO_VIVO.pdf`);
    await addToCedula(docs.formSaludTotal, `${baseNombre}_FORMULARIO_SALUD_TOTAL.pdf`);
    return;
  }

  // Otras EPS: combinar todo en un PDF
  const mergedPdf = await PDFDocument.create();

  const agregarPagina = async (entry: { file_url?: string } | null) => {
    if (!entry?.file_url) return;
    const pdfBytes = await this.fetchPdfBytes(entry.file_url);
    if (!pdfBytes) return;
    try {
      const pdf = await PDFDocument.load(pdfBytes);
      const paginas = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      paginas.forEach((p) => mergedPdf.addPage(p));
    } catch (error) {
      console.error("Error al fusionar PDF:", error);
    }
  };

  await agregarPagina(docs.incapacidad);
  await agregarPagina(docs.hc);
  await agregarPagina(docs.soat);
  await agregarPagina(docs.furat);
  await agregarPagina(docs.furips);
  await agregarPagina(docs.registroCivil);
  await agregarPagina(docs.registroNacido);
  await agregarPagina(docs.formSaludTotal);

  const mergedPdfBytes = await mergedPdf.save();
  epsFolder.file(`${baseNombre}_COMPLETO.pdf`, mergedPdfBytes);
}
  verificarIncapacidadPrevia(cedula : string, fechaInicio: string, codigo: string): Observable<boolean> {
    const headers = this.createAuthorizationHeader();
    const url = `${this.apiUrl}/Incapacidades/verificarIncapacidadPrevia?cedula=${cedula}&fechaInicio=${fechaInicio}&codigo=${codigo}`;
    return this.http.get<{ existe: boolean }>(url, { headers }).pipe(
      map(response => response.existe),
      catchError(this.handleError)
    );
  }
}
