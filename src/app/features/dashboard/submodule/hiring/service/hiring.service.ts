import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@/environments/environment';


@Injectable({
  providedIn: 'root'
})
export class HiringService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private handleError(error: any): Observable<never> {
    return throwError(() => error);
  }

  // Buscar en contratacion por cedula para sacar los numeros
  public buscarEncontratacion(cedula: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/contratacion/buscarCandidato/${cedula}`,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Buscar en contratacion por cedula para sacar los datos bio
  public buscarEncontratacionDatosBiometricos(cedula: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/contratacion/candidato/${cedula}`,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // check-contract/<str:codigo_contrato>/
  public checkContract(codigo_contrato: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/contratacion/check-contract/${codigo_contrato}/`,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  //
  public buscarEnContratacionFormulario(): Observable<any> {
    return this.http.get(`${this.apiUrl}/contratacion/buscarPorMarcaTemporal/`,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Buscar datos seleccion  /Seleccion/traerDatosSeleccion/{cedula}
  public traerDatosSeleccion(cedula: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/Seleccion/traerDatosSeleccion/${cedula}`,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Servicio para traer datos de contratación
  public traerDatosContratacion(cedula: string, contrato: string): Observable<any> {
    const url = `${this.apiUrl}/contratacion/traerDatosContratacion/${cedula}/${contrato}`;
    // Realizar la solicitud GET
    return this.http.get(url,).pipe(
      map((response: any) => response), // Mapear la respuesta directamente
      catchError(this.handleError) // Manejar errores
    );
  }





  public traerDatosEncontratacion(cedula: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/contratacion/datosIncapacidadContratacion/${cedula}`,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Editar en contratacion el correo y el telefono
  async editarContratacion_Cedula_Correo(
    id: string,
    primercorreoelectronico: string,
    celular: string,
  ): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Ausentismos/editarAusentismosCedCorreo/${id}`;
    const data = {
      celular: celular,
      primercorreoelectronico: primercorreoelectronico,
    };
    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data,).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  //
  async subirContratacionAuditoria(
    datos: any
  ): Promise<any> {
    const urlcompleta = `${this.apiUrl}/contratacion/subidadeusuariosarchivoAuditoriaexcel`;
    const data = {
      datos: datos,
      mensaje: "mcuhos",
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data,).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Subir archivo de contratacion
  async subirContratacion(
    datos: any
  ): Promise<any> {

    const urlcompleta = `${this.apiUrl}/contratacion/subidadeusuariosarchivoexcel`;

    const data = {
      datos: datos,
      mensaje: "mcuhos",
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data,).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Subir archivo de contratacion para validar
  async subirContratacionValidar(
    datos: any
  ): Promise<any> {

    const urlcompleta = `${this.apiUrl}/contratacion/validarExcelContratacion`;

    const data = {
      datos: datos,
      mensaje: "mcuhos",
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data,).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Generar el excel de arl
  async generarExcelArl(
    datos: any
  ): Promise<any> {
    const urlcompleta = `${this.apiUrl}/contratacion/validarDatos/`;

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

  // Cargar una única cédula
  async cargarCedula(dato: any): Promise<any> {
    const urlcompleta = `${this.apiUrl}/traslados/cargar-cedula`;

    const data = {
      dato: dato,
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data,).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }


  // Enviar archivos de traslados
  async enviarTraslado(data: any): Promise<any> {
    const urlcompleta = `${this.apiUrl}/traslados/formulario-solicitud`;

    // Crear FormData y agregar los datos
    const formData = new FormData();
    formData.append('numero_cedula', data.numero_cedula);
    formData.append('eps_a_trasladar', data.eps_a_trasladar);
    formData.append('solicitud_traslado', data.solicitud_traslado);

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, formData, {
      }).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // actualizarProcesoContratacion (data)
  async actualizarProcesoContratacion(data: any): Promise<any> {
    const urlcompleta = `${this.apiUrl}/contratacion/actualizarProcesoContratacion/`;

    const data2 = {
      ...data,
    };
    delete data2.traslado; // Eliminar campo innecesario
    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data2,).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }


  // --------------------------------------------------------------------------------------------
  // ------------------------- Métodos para el módulo de reportes --------------------------------

  // Subir reporte completo
  async cargarReporte(datos: any): Promise<any> {
    const urlcompleta = `${this.apiUrl}/reportes/cargarReporte`;

    const data = {
      ...datos, // Todos los campos que envías, como cedulas, traslados, etc.
    };

    try {
      const response = await firstValueFrom(this.http.post<string>(urlcompleta, data,).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }



  public obtenerTodosLosReportes(nombre: string): Observable<any> {
    // Usar una sola ruta para obtener todos o filtrar por nombre
    const url = nombre === 'todos'
      ? `${this.apiUrl}/reportes/obtenerReportes`
      : `${this.apiUrl}/reportes/obtenerReportes/${nombre}`;

    return this.http.get(url,).pipe(
      map((response: any) => response),  // Mapea la respuesta
      catchError(this.handleError)       // Manejo de errores
    );
  }


  public obtenerReportesPorFechas(start: string, end: string): Observable<any> {
    const params = { start, end };  // Parámetros para enviar el rango de fechas

    return this.http.get(`${this.apiUrl}/reportes/obtenerReportesFechas`, { params }).pipe(
      map((response: any) => response),  // Mapea la respuesta
      catchError(this.handleError)       // Manejo de errores
    );
  }


  public obtenerReportesPorFechasCentroCosto(start: string, end: string): Observable<any> {
    const params = { start, end };  // Parámetros para enviar el rango de fechas
    return this.http.get(`${this.apiUrl}/contratacion/descargarReporteFechaIngresoCentroCosto/`, { params }).pipe(
      map((response: any) => response),  // Mapea la respuesta
      catchError(this.handleError)       // Manejo de errores
    );
  }

  public descargarReporteFechaIngresoCentroCostoFincas(start: string, end: string): Observable<Blob> {
    const params = { start, end };

    return this.http.get(`${this.apiUrl}/contratacion/descargarReporteFechaIngresoCentroCostoFincas/`, {
      params,
      responseType: 'blob'  // Indicar que esperamos un archivo binario
    }).pipe(
      map((response: Blob) => response),  // Mapea la respuesta a un blob
      catchError(this.handleError)        // Manejo de errores
    );
  }

  //--------------------------------------------------------------------------------------------
  // ------------------------- Métodos para el módulo de reportes de errores --------------------------------
  // --------------------------------------------------------------------------------------------

  async enviarErroresValidacion(
    payload: {
      errores: {
        registro: string; errores: any[];
      }[];
      responsable: string;
      tipo: string;
    },

  ): Promise<any> {

    const urlcompleta = `${this.apiUrl}/contratacion/guardarErroresValidacion`;  // Asegúrate de que este sea el endpoint correcto

    const data = {
      errores: payload.errores,
      responsable: payload.responsable,
      tipo: payload.tipo,
    };

    try {
      const response = await firstValueFrom(
        this.http.post<string>(urlcompleta, data,).pipe(
          catchError((error) => {
            return throwError(() => new Error('Error en la solicitud al guardar errores de validación'));
          })
        )
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Obtener base contratacion por rango de fechas
  public obtenerBaseContratacionPorFechas(start: string, end: string): Observable<Blob> {

    const params = { start, end };

    // Indicamos que el responseType será 'blob' para manejar archivos binarios
    return this.http.get(`${this.apiUrl}/contratacion/descargarReporte/`, {
      params,
      responseType: 'blob'  // Tipo de respuesta como Blob
    }).pipe(
      map((response: Blob) => response),  // Mapea la respuesta a Blob
      catchError(this.handleError)        // Manejo de errores
    );
  }



  //--------------------------------------------------------------------------------------------
  // ------------------------- Métodos para validar informacion contratacion --------------------------------
  // --------------------------------------------------------------------------------------------


  // Validar información de contratación
  async validarInformacionContratacion(payload: {
    numeroCedula: string;
    codigoContrato: string;
    nombreQuienValidoInformacion: string;
    fechaHoraValidacion: string;
    primerApellido: string;
    segundoApellido: string;
    primerNombre: string;
    segundoNombre: string;
    fechaNacimiento: string;
    fechaExpedicionCC: string;
  }): Promise<any> {
    const urlcompleta = `${this.apiUrl}/contratacion/datosCandidatoYProceso/`; // Endpoint correcto de tu API



    try {
      const response = await firstValueFrom(
        this.http.post(urlcompleta, payload,).pipe(
          catchError((error) => {
            return throwError(() => new Error('Error al validar información de contratación'));
          })
        )
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  async guardarOActualizarContratacion(data: any): Promise<any> {

    const urlcompleta = `${this.apiUrl}/contratacion/guardar-o-actualizar-contratacion/`;

    // Agregar el token JWT a los datos
    const dataConToken = {
      ...data,
    };

    try {
      const response = await firstValueFrom(
        this.http.post<string>(urlcompleta, dataConToken,).pipe(
          catchError(this.handleError)
        )
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // contratacion/traerCompletoContratacion/<str:codigo_contrato>/
  public traerCompletoContratacion(codigo_contrato: string): Observable<any> {

    return this.http.get(`${this.apiUrl}/contratacion/traerCompletoContratacion/${codigo_contrato}/`,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // -------------------------
  // Módulo de Ausentismos
  // -------------------------

  public obtenerAusentismos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/gestion_ausentismios/ausentismos/`,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  async gestionarAusentismo(id: string | number, data: any): Promise<any> {
    const url = `${this.apiUrl}/gestion_ausentismios/ausentismos/${id}/gestionar/`;
    try {
      const response = await firstValueFrom(this.http.patch<any>(url, data).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  async enviarNotificacionMasivaAusentismos(ids: (string | number)[], plantilla_id?: number | null): Promise<any> {
    const url = `${this.apiUrl}/gestion_ausentismios/ausentismos/notificar-masivo/`;
    const payload: any = { ids };
    if (plantilla_id) {
      payload.plantilla_id = plantilla_id;
    }
    try {
      const response = await firstValueFrom(this.http.post<any>(url, payload).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  async subirAusentismosExcel(file: File): Promise<any> {
    const url = `${this.apiUrl}/gestion_ausentismios/ausentismos/importar-excel/`;
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await firstValueFrom(this.http.post<any>(url, formData).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // -------------------------
  // Módulo de Ausentismos NUEVOS
  // -------------------------

  public obtenerAusentismosNuevos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/gestion_ausentismios/ausentismos-nuevos/`,).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  async gestionarAusentismoNuevo(id: string | number, data: any): Promise<any> {
    const url = `${this.apiUrl}/gestion_ausentismios/ausentismos-nuevos/${id}/gestionar/`;
    try {
      const response = await firstValueFrom(this.http.patch<any>(url, data).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  async enviarNotificacionMasivaAusentismosNuevos(ids: (string | number)[], plantilla_id?: number | null): Promise<any> {
    const url = `${this.apiUrl}/gestion_ausentismios/ausentismos-nuevos/notificar-masivo/`;
    const payload: any = { ids };
    if (plantilla_id) {
      payload.plantilla_id = plantilla_id;
    }
    try {
      const response = await firstValueFrom(this.http.post<any>(url, payload).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  async subirAusentismosNuevosExcel(file: File): Promise<any> {
    const url = `${this.apiUrl}/gestion_ausentismios/ausentismos-nuevos/importar-excel/`;
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await firstValueFrom(this.http.post<any>(url, formData).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  descargarPlantillaAusentismosNuevos(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/gestion_ausentismios/ausentismos-nuevos/descargar-plantilla/`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  // -------------------------
  // Módulo de Mensajes Predeterminados
  // -------------------------

  public obtenerMensajes(tipo?: string): Observable<any> {
    let url = `${this.apiUrl}/gestion_ausentismios/mensajes/`;
    if (tipo) {
      // Si el backend permite filtrado por tipo
      url += `?tipo=${tipo}`;
    }
    return this.http.get(url).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  async crearMensaje(data: any): Promise<any> {
    const url = `${this.apiUrl}/gestion_ausentismios/mensajes/`;
    try {
      return await firstValueFrom(this.http.post<any>(url, data).pipe(catchError(this.handleError)));
    } catch (error) { throw error; }
  }

  async actualizarMensaje(id: string | number, data: any): Promise<any> {
    const url = `${this.apiUrl}/gestion_ausentismios/mensajes/${id}/`;
    try {
      return await firstValueFrom(this.http.patch<any>(url, data).pipe(catchError(this.handleError)));
    } catch (error) { throw error; }
  }

  async eliminarMensaje(id: string | number): Promise<any> {
    const url = `${this.apiUrl}/gestion_ausentismios/mensajes/${id}/`;
    try {
      return await firstValueFrom(this.http.delete<any>(url).pipe(catchError(this.handleError)));
    } catch (error) { throw error; }
  }
}
