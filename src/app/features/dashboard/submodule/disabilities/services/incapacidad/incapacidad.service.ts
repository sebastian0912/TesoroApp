import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Incapacidad } from '../../../models/incapacidad.model';
import { Reporte } from '../../../models/reporte.model';
import { environment } from '../../../../environments/environment.development';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  getIncapacidades(): Observable<Incapacidad[]> {
    return this.http.get<Incapacidad[]>(this.apiUrl);
  }

  getIncapacidad(id: number): Observable<Incapacidad> {
    return this.http.get<Incapacidad>(`${this.apiUrl}/${id}`);
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
  public traerDatosReporte(cedula: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/Incapacidades/datosReporte/${cedula}`, { headers })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }
  public traerDatosIncapacidad(cedula: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/Incapacidades/datosIncapacidad/${cedula}`, {
        headers,
      })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }
  public traerDatosLogs(cedula: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/Incapacidades/datosLogs/${cedula}`, { headers })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
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

  public traerTodosDatosIncapacidad(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/Incapacidades/traerTodasIncapacidades`, { headers })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }
  public traerTodosDatosReporte(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/Incapacidades/traerTodosReportes`, { headers })
      .pipe(
        map((response: any) => response),
        catchError(this.handleError)
      );
  }

  processFiles(files: FileList): Observable<any> {
    if (files.length !== 2) {
      return new Observable((observer) => {
        observer.error('Por favor, selecciona exactamente 2 archivos.');
      });
    }

    const fileData: { [key: string]: any[] } = {};
    const fileNames: { [key: string]: string } = {
      arl: '',
      sst: '',
    };
    const fileReaders: FileReader[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      fileReaders.push(reader);

      const fileName = file.name.toLowerCase();
      if (fileName.includes('arl')) {
        fileNames['arl'] = file.name;
      } else if (fileName.includes('sst')) {
        fileNames['sst'] = file.name;
      }

      reader.onload = (e: any) => {
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const key = fileName.includes('arl') ? 'arl' : 'sst';
        fileData[key] = data;

        // Si todos los archivos han sido procesados, envía los datos
        if (Object.keys(fileData).length === 2) {
          this.uploadFiles(fileData, fileNames).subscribe(
            (response) => {
              Swal.fire({
                title: 'Éxito',
                text: 'Datos enviados con éxito.',
                icon: 'success', // Ícono de éxito
                confirmButtonText: 'Aceptar',
              });
            },
            (error) => {
              Swal.fire({
                title: 'Error',
                text: 'Hubo un problema al enviar los datos. Por favor, intenta nuevamente.',
                icon: 'error', // Ícono de error
                confirmButtonText: 'Aceptar',
              });
            }
          );
        } else {
          Swal.fire({
            title: 'Archivos incompletos',
            text: 'Por favor, procesa y sube los archivos requeridos antes de enviar.',
            icon: 'warning', // Ícono de advertencia
            confirmButtonText: 'Aceptar',
          });
        }
      };

      reader.readAsBinaryString(file);
    }

    // Devuelve un observable vacío para evitar errores
    return new Observable();
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

  deleteIncapacidad(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  async subirExcelSST(datos: any): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/FormasdePago/crearformasDePago`;

    const headers = this.createAuthorizationHeader();

    const data = {
      datos: datos,
      mensaje: 'mcuhos',
      jwt: token,
    };
    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, data, { headers })
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  async subirExcelARL(datos: any): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/FormasdePago/crearformasDePago`;

    const headers = this.createAuthorizationHeader();

    const data = {
      datos: datos,
      mensaje: 'mcuhos',
      jwt: token,
    };
    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, data, { headers })
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
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

  traerTodosDocumentos(fechaInicio?: string): Observable<any[]> {
    const headers = this.createAuthorizationHeader();
    let url = `${this.apiUrl}/Incapacidades/descargarIncapacidades`;

    if (fechaInicio) {
      url += `?inicio=${fechaInicio}`;
      console.log('URL con fechaInicio:', url);
    }
    return this.http.get<any[]>(url, { headers });
  }

  traerTodosDocumentosPorRango(inicio: string, fin: string): Observable<any[]> {
    const headers = this.createAuthorizationHeader();
    const url = `${this.apiUrl}/Incapacidades/descargarIncapacidades?inicio=${inicio}&fin=${fin}`;
    return this.http.get<any[]>(url, { headers });
  }

  // Utiliza el método anterior para descargar y crear el ZIP desde base64
  async descargarTodoComoZip(fecha: string, sevenet: boolean) {
    const zip = new JSZip();
    const documentos = await firstValueFrom(this.traerTodosDocumentos(fecha));

    const carpetaPrincipal = zip.folder(`Incapacidad con la fecha ${fecha}`);
    const epsEspeciales = ['salud total', 'matual ser', 'mutual ser', 'eps sura', 'cajacopi', 'coosalud'];

    await Promise.all(
      documentos.map(doc => this.procesarDocumentoEnZip(doc, carpetaPrincipal!, epsEspeciales, sevenet))
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
      documentos.map(doc => this.procesarDocumentoEnZip(doc, carpetaPrincipal!, epsEspeciales, sevenet))
    );

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `incapacidades_${rango.inicio}_a_${rango.fin}.zip`);
  }


  private async procesarDocumentoEnZip(
  doc: any,
  carpetaPrincipal: JSZip,
  epsEspeciales: string[],
  sevenet: boolean = false
) {
  if (!doc.Numero_de_documento) return;

  const tiene = {
    incapacidad: !!doc.link_incapacidad,
    hc: !!doc.historial_clinico,
    soat: !!doc.soat,
    furat: !!doc.furat,
    furips: !!doc.furips,
    registroCivil: !!doc.registro_civil,
    registroNacido: !!doc.registro_de_nacido_vivo,
    formSaludTotal: !!doc.formulario_salud_total
  };

  if (!Object.values(tiene).some(Boolean)) return;

    const toPdfBytes = (base64: string) => {
    if (base64.startsWith("data:")) base64 = base64.split(",")[1];
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  };


  // Si sevenet es true → SOLO generar incapacidad, ignorar todo lo demás
  if (sevenet) {
    const epsName = (doc.nombre_eps || "Desconocida").trim();
    const epsFolder = carpetaPrincipal.folder(epsName);
    if (!epsFolder) return;

    const fechaObj = new Date(doc.marcaTemporal);
    const fechaFinal = `${String(fechaObj.getDate()).padStart(2, "0")}${
      String(fechaObj.getMonth() + 1).padStart(2, "0")
    }${fechaObj.getFullYear()}`;

    const baseNombre = `${doc.Numero_de_documento}_${fechaFinal}`;

    if (tiene.incapacidad) {
      epsFolder.file(`${baseNombre}.pdf`, toPdfBytes(doc.link_incapacidad));
    }

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

  // EPS especiales - PDFs separados
  if (esEpsEspecial) {
    const cedulaFolder = epsFolder.folder(doc.Numero_de_documento);
    if (!cedulaFolder) return;
    if (tiene.incapacidad) cedulaFolder.file(`${baseNombre}.pdf`, toPdfBytes(doc.link_incapacidad));
    if (tiene.hc) cedulaFolder.file(`${baseNombre}_HC.pdf`, toPdfBytes(doc.historial_clinico));
    if (tiene.soat) cedulaFolder.file(`${baseNombre}_SOAT.pdf`, toPdfBytes(doc.soat));
    if (tiene.furat) cedulaFolder.file(`${baseNombre}_FURAT.pdf`, toPdfBytes(doc.furat));
    if (tiene.furips) cedulaFolder.file(`${baseNombre}_FURIPS.pdf`, toPdfBytes(doc.furips));
    if (tiene.registroCivil) cedulaFolder.file(`${baseNombre}_REGISTRO_CIVIL.pdf`, toPdfBytes(doc.registro_civil));
    if (tiene.registroNacido) cedulaFolder.file(`${baseNombre}_REGISTRO_NACIDO_VIVO.pdf`, toPdfBytes(doc.registro_de_nacido_vivo));
    if (tiene.formSaludTotal) cedulaFolder.file(`${baseNombre}_FORMULARIO_SALUD_TOTAL.pdf`, toPdfBytes(doc.formulario_salud_total));
    return;
  }

  // Otras EPS - PDF combinado
  const mergedPdf = await PDFDocument.create();

  const agregarPagina = async (base64: string) => {
    if (!base64) return;
    try {
      const pdfBytes = toPdfBytes(base64);
      const pdf = await PDFDocument.load(pdfBytes);
      const paginas = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      paginas.forEach((p) => mergedPdf.addPage(p));
    } catch (error) {
      console.error("Error al fusionar PDF:", error);
    }
  };

  if (tiene.incapacidad) await agregarPagina(doc.link_incapacidad);
  if (tiene.hc) await agregarPagina(doc.historial_clinico);
  if (tiene.soat) await agregarPagina(doc.soat);
  if (tiene.furat) await agregarPagina(doc.furat);
  if (tiene.furips) await agregarPagina(doc.furips);
  if (tiene.registroCivil) await agregarPagina(doc.registro_civil);
  if (tiene.registroNacido) await agregarPagina(doc.registro_de_nacido_vivo);
  if (tiene.formSaludTotal) await agregarPagina(doc.formulario_salud_total);

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
