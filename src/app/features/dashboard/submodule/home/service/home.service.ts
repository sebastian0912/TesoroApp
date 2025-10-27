import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../../../../environments/environment.development';

type Granularidad = 'dia' | 'semana' | 'mes';

@Injectable({
  providedIn: 'root'
})
export class HomeService {


  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  traerHistorialInformePersona(
    fechaInicio: string,
    fechaFin: string,
    user: string,
    excel: boolean = false
  ): Observable<any> {
    let params = new HttpParams()
      .set('nombre', user)
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    if (excel) {
      params = params.set('excel', '1');
      // Para descargar archivo, hay que cambiar responseType
      return this.http.get(`${this.apiUrl}/Historial/informe`, {
        params,
        responseType: 'blob'
      })
        .pipe(catchError(this.handleError));
    }

    return this.http.get(`${this.apiUrl}/Historial/informe`, { params })
      .pipe(catchError(this.handleError));
  }

  traerHistorialInformeSoloFecha(
    fechaInicio: string,
    fechaFin: string,
    excel: boolean = false
  ): Observable<any> {
    let params = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    if (excel) {
      params = params.set('excel', '1');
      // Para descargar archivo, hay que cambiar responseType
      return this.http.get(`${this.apiUrl}/Historial/informeFecha`, {
        params,
        responseType: 'blob'
      })
        .pipe(catchError(this.handleError));
    }

    return this.http.get(`${this.apiUrl}/Historial/informeFecha`, { params })
      .pipe(catchError(this.handleError));
  }



  traerTraladosPorFecha(): Observable<any> {
    return this.http.get(`${this.apiUrl}/traslados/traer_todo_base_general`)
      .pipe(catchError(this.handleError));
  }

  traerEmpleados(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Datosbase/datosbase`)
      .pipe(catchError(this.handleError));
  }

  traerAutorizaciones(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Codigo/codigos`)
      .pipe(catchError(this.handleError));
  }

  traerUsuarios(): Observable<any> {
    return this.http.get(`${this.apiUrl}/usuarios/usuarios`)
      .pipe(catchError(this.handleError));
  }

  contarAutorizacionesActivas(codigos: any): number {
    return codigos.filter((codigo: { estado: boolean; }) => codigo.estado === true).length;
  }

  contarRol(usuarios: any, rol: string): number {
    return usuarios.filter((usuario: { rol: string; }) => usuario.rol === rol).length;
  }

  traerAutorizacionesPorUsuario(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Codigo/roles/codigosactivos`)
      .pipe(catchError(this.handleError));
  }

  traerInventarioProductos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Comercio/comercio`)
      .pipe(catchError(this.handleError));
  }

  async traerTralados(concepto: any, nombre: string): Promise<Observable<any>> {
    const ano = new Date().getFullYear();
    if (concepto === 'Todos') {
      return this.http.get(`${this.apiUrl}/traslados/traer_todo_base_general?ano=${encodeURIComponent(ano.toString())}`)
        .pipe(catchError(this.handleError));
    } else {
      const url = `${this.apiUrl}/traslados/buscar-filtro/?responsable=${encodeURIComponent(nombre)}&ano=${encodeURIComponent(ano.toString())}`;
      return this.http.get(url).pipe(catchError(this.handleError));
    }
  }

  // buscar-aceptados/
  traerTraladosAceptados(nombre: string): any {
    const ano = new Date().getFullYear();
    const url = `${this.apiUrl}/traslados/buscar-aceptados/?responsable=${encodeURIComponent(nombre)}&ano=${encodeURIComponent(ano.toString())}`;
    return this.http.get(url).pipe(catchError(this.handleError));
  }



  // Método para enviar Estados Robots de forma masiva
  enviarEstadosRobots(datos: any[]): Observable<any> {
    const url = `${this.apiUrl}/EstadosRobots/cargar_excel`; // Ajusta según tu endpoint real

    // Construir el body con JWT y los datos
    const body = {
      datos   // Los datos que quieres enviar al backend
    };

    return this.http.post(url, body).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }



  /**
   * Promedios globales por estado, opcionalmente filtrados por oficina y granularidad.
   * GET /robot/tiempos/promedios/?granularidad=dia|semana|mes&oficina=SUBA
   */
  getPromedios(granularidad?: Granularidad, oficina?: string): Observable<any> {
    let params = new HttpParams();
    if (granularidad) params = params.set('granularidad', granularidad);
    if (oficina) params = params.set('oficina', oficina);

    const url = `${this.apiUrl}/EstadosRobots/promedios/`;
    return this.http.get<any>(url, { params });
  }

  /**
   * Resumen agregado (hoy / semana / mes) en un solo payload.
   * GET /robot/tiempos/promedios/resumen/?oficina=SUBA
   */
  getPromediosResumen(oficina?: string): Observable<any> {
    let params = new HttpParams();
    if (oficina) params = params.set('oficina', oficina);

    const url = `${this.apiUrl}/EstadosRobots/promedios/resumen/`;
    return this.http.get<any>(url, { params });
  }

  /**
   * Promedios para todas las granularidades en una llamada.
   * GET /robot/tiempos/promedios/todos/?oficina=SUBA
   */
  getPromediosTodos(oficina?: string): Observable<any> {
    let params = new HttpParams();
    if (oficina) params = params.set('oficina', oficina);

    const url = `${this.apiUrl}/EstadosRobots/promedios/todos/`;
    return this.http.get<any>(url, { params });
  }

  /**
   * Promedios para un estado específico (Adress, Policivo, Ofac, etc.).
   * GET /robot/tiempos/promedios/estado/{estado}/?granularidad=mes&oficina=SUBA
   */
  getPromedioPorEstado(estado: string, granularidad?: Granularidad, oficina?: string): Observable<any> {
    let params = new HttpParams();
    if (granularidad) params = params.set('granularidad', granularidad);
    if (oficina) params = params.set('oficina', oficina);

    const url = `${this.apiUrl}/EstadosRobots/promedios/estado/${encodeURIComponent(estado)}/`;
    return this.http.get<any>(url, { params });
  }


 /**
   * GET /EstadosRobots/periodos-unificado/?format=combined
   * Filtros (opcionales):
   * - oficina: "SUBA,FACA_PRINCIPAL"  (OR por icontains)
   * - paquete: "Vacantes"
   * - robot:   "NombreDelRobot"
   *
   * Respuesta (todo junto):
   * {
   *   rango: {...},
   *   dia:    { promedios:{}, finalizados:{}, pendientes:{}, muestra_registros_corte: N, estados_por_oficina:{...} },
   *   semana: { ... },
   *   mes:    { ... }
   * }
   */
  getRobotPeriodosUnificado(
    opts?: { oficina?: string; paquete?: string; robot?: string }
  ): Observable<any> {
    let params = new HttpParams().set('format', 'combined');
    if (opts?.oficina) params = params.set('oficina', opts.oficina);
    if (opts?.paquete) params = params.set('paquete', opts.paquete);
    if (opts?.robot)   params = params.set('robot', opts.robot);

    const url = `${this.apiUrl}/EstadosRobots/periodos-unificado/`;
    return this.http.get<any>(url, { params });
  }

  // ===== Compatibilidad con tus nombres previos (redirigen al unificado) =====

  getEstadosPorOficinaPeriodos(
    opts?: { oficina?: string; paquete?: string; robot?: string }
  ): Observable<any> {
    return this.getRobotPeriodosUnificado(opts);
  }

  getEstadosPorOficinaPeriodosArgs(
    oficina?: string,
    paquete?: string,
    robot?: string,
  ): Observable<any> {
    return this.getRobotPeriodosUnificado({ oficina, paquete, robot });
  }

}
