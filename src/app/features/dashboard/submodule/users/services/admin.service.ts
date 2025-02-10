import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

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

  public getUser(): any {
    if (isPlatformBrowser(this.platformId)) {
      return JSON.parse(localStorage.getItem('user') || '{}');
    }
    return null;
  }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Traer roles
  traerRoles(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http
      .get(`${this.apiUrl}/usuarios/roles/`, { headers })
      .pipe(catchError(this.handleError));
  }

  // Traer sucursales
  traerSucursales(): any {
    const headers = this.createAuthorizationHeader();

    return this.http
      .get(`${this.apiUrl}/Sucursal/sucursal`, { headers })
      .pipe(catchError(this.handleError));
  }

  // Editar rol
  async editarRol(
    ceduladelapersona: string,
    rolacambiar: string
  ): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/usuarios/administrador/cambioRol`;

    const headers = this.createAuthorizationHeader().set(
      'Content-Type',
      'application/json'
    );

    const requestBody = {
      ceduladelapersona,
      rolacambiar,
      jwt: token,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, requestBody, { headers })
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Eliminar usuario
  async eliminarUsuario(cedulaEmpleado: string): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/usuarios/administrador/eliminarUsuario/${cedulaEmpleado}`;

    const headers = this.createAuthorizationHeader();

    try {
      const response = await firstValueFrom(
        this.http
          .delete(urlcompleta, { headers })
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Editar correo administrativo
  async reAsignarCorreoAdministrativo(
    primernombre: string,
    segundonombre: string,
    primerapellido: string,
    segundoapellido: string,
    newpassword: string,
    correo_electronico: string,
    numero_de_documento: string
  ): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/usuarios/cambiarDatosUsuario`;

    const headers = this.createAuthorizationHeader().set(
      'Content-Type',
      'application/json'
    );

    const requestBody = {
      primernombre,
      segundonombre,
      primerapellido,
      segundoapellido,
      newpassword,
      correo_electronico,
      numero_de_documento,
      jwt: token,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, requestBody, { headers })
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Editar sede
  async editarSede(
    ceduladelapersona: string,
    sucursalacambiar: string
  ): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/usuarios/cambiodesucursal`;

    const headers = this.createAuthorizationHeader().set(
      'Content-Type',
      'application/json'
    );

    const requestBody = {
      ceduladelapersona,
      sucursalacambiar,
      jwt: token,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, requestBody, { headers })
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Subir correos masivos
  async subirCorreosMasivos(datos: any): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/traslados/cargar-correos-raul`;

    const headers = this.createAuthorizationHeader().set(
      'Content-Type',
      'application/json'
    );

    const requestBody = {
      datos,
      jwt: token,
    };

    try {
      const response = await firstValueFrom(
        this.http
          .post<string>(urlcompleta, requestBody, { headers })
          .pipe(catchError(this.handleError))
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Subir cedulas
  async subirCedulasMasivas(datos: any): Promise<any> {
    const token = this.getToken();

    if (!token) {
      throw new Error('No token found');
    }

    const urlcompleta = `${this.apiUrl}/traslados/cargar-cedulas`;

    const headers = this.createAuthorizationHeader().set(
      'Content-Type',
      'application/json'
    );

    const requestBody = {
      datos,
      mensaje: 'muchos',
      jwt: token,
    };

    try {
      const response = await firstValueFrom(
        this.http.post<string>(urlcompleta, requestBody, { headers }).pipe(
          catchError((error) => {
            return throwError(error);
          })
        )
      );
      return response;
    } catch (error) {
      throw error;
    }
  }
}
