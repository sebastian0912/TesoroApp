import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class VacantesService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  private createAuthorizationHeader(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders().set('Authorization', token) : new HttpHeaders();
  }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  async getUser(): Promise<any> {
    if (isPlatformBrowser(this.platformId)) {
      const user = localStorage.getItem('user');
      if (user) {
        return JSON.parse(user);
      }
    }
    return null;
  }

  // Listar los cargos
  public listarCargos(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/infoCentrosCosto/sublabores/`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Listar centro de costos
  public listarCentrosCostos(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/infoCentrosCosto/listar-centros-costo/`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // centro-costos/
  public filtrarFinca(costo: string): Observable<any> {
    if (!costo) return of([]); // Si el costo está vacío, devolver un array vacío
    const headers = this.createAuthorizationHeader();
    const params = new HttpParams().set('centro_costo_carnet', costo.trim()); // Crear parámetros limpios

    return this.http.get(`${this.apiUrl}/infoCentrosCosto/centro-costos/`, { headers, params }).pipe(
      map((response: any) => response.data || []), // Extraer data de la respuesta
      catchError(error => {
        console.error('Error al filtrar finca:', error);
        return of([]); // En caso de error, devolver un array vacío
      })
    );
  }


  // Enviar los datos de la vacante
  enviarVacante(vacanteData: any): Observable<any> {
    // agergar el token a vacanteData
    const headers = this.createAuthorizationHeader();
    return this.http.post(`${this.apiUrl}/publicacion/publicaciones/`, vacanteData, { headers }).pipe(
      map((response: any) => response),
      catchError((error: any) => {
        return throwError(error);
      })
    );
  }

  // Listar vacantes
  listarVacantes(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/publicacion/publicaciones`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Eliminar vacante por ID
  eliminarVacante(id: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.delete(`${this.apiUrl}/publicacion/eliminarVacante/${id}`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Actualizar vacante por id
  actualizarVacante(id: string, vacanteData: any): Observable<any> {
    vacanteData.jwt = this.getToken();
    return this.http.post(`${this.apiUrl}/publicacion/editarVacante/${id}`, vacanteData).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Obtener vacante por id
  obtenerVacante(id: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/publicacion/publicaciones/${id}`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // -------------------------------------------------------------------
  // ----------------------- CENTROS DE COSTOS  ------------------------
  //--------------------------------------------------------------------

  // Obtener centros de costos agrupados por empresa usuaria y finca
  public obtenerCentrosCostos(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/infoCentrosCosto/centros-costos/`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Obtener sublabores
  public obtenerSublabores(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/infoCentrosCosto/sublabores/`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // Crear detalles laborales
  public crearDetalleLaboral(datos: any): Observable<any> {
    const headers = this.createAuthorizationHeader();
    const payload = {
      jwt: this.getToken(),
      datos: datos // Array de objetos de detalle laboral
    };

    return this.http.post(`${this.apiUrl}/infoCentrosCosto/crear-detalle-laboral/`, payload, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }


  // Obtener detalles laborales por empresa, finca y sublabor
  public obtenerDetalleLaboral(empresaUsuaria: string, finca: string, sublabor: string): Observable<any> {
    const headers = this.createAuthorizationHeader();

    // Construir los parámetros de la solicitud
    const params = new HttpParams()
      .set('empresa_usuaria', empresaUsuaria)
      .set('finca', finca)
      .set('sublabor', sublabor);

    // Hacer la solicitud GET
    return this.http.get(`${this.apiUrl}/infoCentrosCosto/detalle-laboral/`, { headers, params }).pipe(
      map((response: any) => response),  // Procesar la respuesta
      catchError(this.handleError)       // Manejar errores
    );
  }


}
