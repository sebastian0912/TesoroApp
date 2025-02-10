import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class UtilityServiceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Maneja errores de las peticiones HTTP.
   */
  private handleError(error: any): Observable<never> {
    return throwError(() => new Error(error.message || 'Server Error'));
  }

  /**
   * Obtiene el usuario almacenado en `localStorage`, verificando si se está ejecutando en el navegador.
   */
  getUser(): any {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    }
    return null;
  }

  /**
   * Trae la lista de sucursales.
   */
  traerSucursales(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/Sucursal/sucursal`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Edita la sede de un usuario.
   * @param ceduladelapersona Identificación de la persona.
   * @param sucursalacambiar Sucursal a asignar.
   */
  editarSede(
    ceduladelapersona: string,
    sucursalacambiar: string
  ): Observable<any> {
    const urlcompleta = `${this.apiUrl}/usuarios/cambiodesucursal`;
    const requestBody = { ceduladelapersona, sucursalacambiar };

    return this.http
      .post<string>(urlcompleta, requestBody)
      .pipe(catchError(this.handleError));
  }

  traerUsuarios(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/usuarios/usuarios`)
      .pipe(catchError(this.handleError));
  }

  traerInventarioProductos(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/Comercio/comercio`)
      .pipe(catchError(this.handleError));
  }

  // Traer datos de la comercializadora por codigo
  traerComercializadoraPorCodigo(producto: any, codigo: string): any {
    // buscar en la base de datos la comercializadora por codigo
    let productoComercializadora = producto.find(
      (comercializadora: { codigo: string }) =>
        comercializadora.codigo === codigo
    );
    return productoComercializadora;
  }

  // verificar cedula si pertenece al codigo
  public verificarCedulaCodigo(
    codigo: string,
    cedula: string
  ): Observable<string> {
    return this.http
      .get<{ message: string }>(
        `${this.apiUrl}/Codigo/verificarCedula/${cedula}/${codigo}`
      )
      .pipe(
        map((response) => response.message),
        catchError(this.handleError)
      );
  }

  // verificar monto del codigo
  public verificarMontoCodigo(codigo: any, monto: number): boolean {
    if (parseInt(codigo.codigo[0].monto) < monto) {
      return false;
    }
    return true;
  }

  // Buscar operario por cedula
  async buscarOperarioPorCedula(cedula: string): Promise<any> {
    return this.http
      .get(`${this.apiUrl}/contratacion/buscarCandidato/${cedula}`)
      .pipe(catchError(this.handleError));
  }


  traerAutorizaciones(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Codigo/codigos`)
      .pipe(catchError(this.handleError));
  }
}
