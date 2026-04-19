import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '@/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VetadosService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  // Enviar reporte de candidato vetado
  enviarReporte(reporte: any, sede: string): Observable<any> {
    reporte.sede = sede;
    return this.http.post(`${this.apiUrl}/vetados/vetados/`, reporte,);
  }

  // Listar reportes de candidatos vetados
  listarReportesVetados(): Observable<any> {
    return this.http.get(`${this.apiUrl}/vetados/vetados`,);
  }

  // listar reportes de candidatos vetados por cedula
  listarReportesVetadosPorCedula(cedula: string): Observable<any> {

    return this.http.get(`${this.apiUrl}/vetados/vetados/${cedula}`,);
  }

  // Traer datos de nombre completo de candidato
  traerNombreCompletoCandidato(cedula: string): Observable<any> {

    return this.http.get(`${this.apiUrl}/gestion_contratacion/traerNombreCompletoCandidato/${cedula}`,);
  }

  // Eliminar reporte de candidato vetado
  eliminarReporte(id: string): Observable<any> {

    return this.http.delete(`${this.apiUrl}/vetados/vetados/delete/${id}`,);
  }

  // Actualizar reporte de candidato vetado
  async actualizarReporte(reporte: any, Categoria: any): Promise<Observable<any>> {
    let nombreRol = "";
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
    return this.http.get(`${this.apiUrl}/vetados/categorias`,);
  }

}
