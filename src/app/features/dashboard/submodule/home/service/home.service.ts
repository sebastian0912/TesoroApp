import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../../../../environments/environment.development';

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










}
