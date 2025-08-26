import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '@/environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class VetadosService {

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
    return token ? new HttpHeaders().set('Authorization', `${token}`) : new HttpHeaders();
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

  // Enviar reporte de candidato vetado
  enviarReporte(reporte: any, sede: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    reporte.jwt = this.getToken();
    reporte.sede = sede;
    return this.http.post(`${this.apiUrl}/vetados/vetados/`, reporte, { headers });
  }

  // Listar reportes de candidatos vetados
  listarReportesVetados(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/vetados/vetados`, { headers });
  }

  // listar reportes de candidatos vetados por cedula
  listarReportesVetadosPorCedula(cedula: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/vetados/vetados/${cedula}`, { headers });
  }

  // Traer datos de nombre completo de candidato
  traerNombreCompletoCandidato(cedula: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/contratacion/traerNombreCompletoCandidato/${cedula}`, { headers });
  }

  // Eliminar reporte de candidato vetado
  eliminarReporte(id: string): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.delete(`${this.apiUrl}/vetados/vetados/delete/${id}`, { headers });
  }

  // Actualizar reporte de candidato vetado
  async actualizarReporte(reporte: any, Categoria: any): Promise<Observable<any>> {
    let nombreRol = "";
    await this.getUser().then((data: any) => {
      nombreRol = data.primer_nombre + " " + data.primer_apellido + " - " + data.rol;
    });
    Categoria.jwt = this.getToken();
    Categoria.autorizado_por = nombreRol;

    // cambiar de id a categoria_id de categoria
    Categoria.categoria_id = Categoria.id;

    return this.http.put(`${this.apiUrl}/vetados/vetados/update/${reporte.id}`, Categoria);
  }

  uploadReporte901(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<any>(`${this.apiUrl}/vetados/bulk-upload/`, fd);
  }


  //------------------------ categorias ------------------------
  // Listar categorias de vetados
  listarCategorias(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/vetados/categorias`, { headers });
  }

}
