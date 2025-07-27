import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class SeleccionService {

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

  private handleError(error: any): Observable<never> {
    return throwError(() => error);
  }

  async getUser(): Promise<any> {
    if (isPlatformBrowser(this.platformId)) {
      return JSON.parse(localStorage.getItem('user') || '{}');
    }
    return null;
  }

  // Método para generar el código de contratación
  public generarCodigoContratacion(officePrefix: string, cedula: string): Observable<any> {
    const headers = this.createAuthorizationHeader();

    // Agregar el prefijo de oficina y cedula como parámetros de la query string
    let params = new HttpParams()
      .set('office_prefix', officePrefix)
      .set('cedula', cedula);  // Añadir cedula al parámetro
    return this.http.get(`${this.apiUrl}/contratacion/generarCodigoContratacion/`, { headers, params }).pipe(
      map((response: any) => response),  // Procesa la respuesta
      catchError(this.handleError)       // Manejo de errores
    );
  }

  // Mandar parte uno de la selección
  public crearSeleccionParteUnoCandidato(formData: any, cedula: string, numeroContrato: string): Observable<any> {
    const headers = this.createAuthorizationHeader();

    // Mapear los nombres de los campos del formulario a los nombres esperados por Django
    const requestData = {
      numerodeceduladepersona: cedula,        // Cédula
      codigo_contrato: numeroContrato,        // Número de contrato
      eps: formData.eps,
      afp: formData.afp,
      policivos: formData.policivos,
      procuraduria: formData.procuraduria,
      contraloria: formData.contraloria,
      rama_judicial: formData.ramaJudicial,   // Nombre mapeado
      medidas_correctivas: formData.medidasCorrectivas, // Nombre mapeado
      area_aplica: formData.area_aplica,
      sisben: formData.sisben,
      ofac: formData.ofac,
      revisionAntecedentes: formData.revisionAntecedentes,
      jwt: this.getToken()
    };

    // Realizar la solicitud POST al backend
    return this.http.post(`${this.apiUrl}/Seleccion/crearSeleccionParteUnoCandidato`, requestData, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }


  // Mandar parte dos de la selección
  public crearSeleccionParteDosCandidato(formData: any, cedula: string, numeroContrato: string): Observable<any> {
    const headers = this.createAuthorizationHeader();

    // Transformar hora a formato de 24 horas
    let hora = formData.horaPruebaEntrevista;
    let [horaParte, periodo] = hora.split(' '); // Dividir la hora y el periodo (AM/PM)
    let [horas, minutos] = horaParte.split(':').map(Number); // Obtener horas y minutos como números

    if (periodo === 'PM' && horas < 12) {
      // Sumar 12 a las horas si es PM (excepto para 12 PM que ya es correcto)
      horas += 12;
    } else if (periodo === 'AM' && horas === 12) {
      // Convertir 12 AM a 00
      horas = 0;
    }

    // Formatear la hora a 'HH:MM'
    const horaFinal = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
    formData.horaPruebaEntrevista = horaFinal;

    // Mapear los nombres de los campos del formulario a los nombres esperados por Django
    const requestData = {
      numerodeceduladepersona: cedula,  // Cédula
      codigo_contrato: numeroContrato,  // Número de contrato
      fecha_prueba_entrevista: formData.fechaPruebaEntrevista,
      hora_prueba_entrevista: formData.horaPruebaEntrevista,
      direccion_empresa: formData.direccionEmpresa,
      area_entrevista: formData.areaEntrevista,
      cargo: formData.cargo,
      centro_costo_entrevista: formData.centroCosto,
      jwt: this.getToken(),
      vacante: formData.vacante,

    };
    return this.http.post(`${this.apiUrl}/Seleccion/crearSeleccionparteDoscandidato`, requestData, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }



  // Mandar parte tres de la selección
  public crearSeleccionParteTresCandidato(formData: any, cedula: string, numeroContrato: string): Observable<any> {
    const headers = this.createAuthorizationHeader();

    // Mapear los nombres de los campos del formulario a los nombres esperados por Django
    const requestData = {
      numerodeceduladepersona: cedula,              // Cédula
      codigo_contrato: numeroContrato,              // Número de contrato
      ips: formData.ips,
      ipslab: formData.ipsLab,                      // Mapeo correcto
      examenes: formData.selectedExams,
      aptosExamenes: formData.selectedExamsArray,
    };

    return this.http.post(`${this.apiUrl}/Seleccion/crearSeleccionparteTrescandidato`, requestData, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }


  // Mandar parte cuatro de la selección
  public crearSeleccionParteCuatroCandidato(formData: any, cedula: string, numeroContrato: string): Observable<any> {
    const headers = this.createAuthorizationHeader();

    // Mapear los nombres de los campos del formulario a los nombres esperados por Django
    const requestData = {
      numerodeceduladepersona: cedula,              // Cédula
      codigo_contrato: numeroContrato,              // Número de contrato
      empresa_usuario: formData.empresaUsuaria,     // Mapeo correcto
      fecha_ingreso_usuario: formData.fechaIngreso, // Mapeo correcto
      salario: formData.salario,
      aux_transporte: formData.auxTransporte,       // Mapeo correcto
      rodamiento: formData.rodamiento,
      aux_movilidad: formData.auxMovilidad,         // Mapeo correcto
      bonificacion: formData.bonificacion
    };

    return this.http.post(`${this.apiUrl}/Seleccion/crearSeleccionparteCuatrocandidato`, requestData, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }



  public guardarInfoPersonal(data: any): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.post(`${this.apiUrl}/entrevista/info-personal-alt/`, data, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // --- Guardar Entrevista ---
  public guardarEntrevista(data: any): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.post(`${this.apiUrl}/entrevista/entrevista/`, data, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // --- Guardar Observaciones ---
  public guardarObservaciones(data: any): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.post(`${this.apiUrl}/entrevista/observaciones/`, data, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // --- Guardar Vacantes ---
  public guardarVacantes(data: any): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.post(`${this.apiUrl}/entrevista/vacantes/`, data, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // listado-candidatos/
  public getCandidatos(): Observable<any> {
    const headers = this.createAuthorizationHeader();
    return this.http.get(`${this.apiUrl}/entrevista/listado-candidatos/`, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  // exportar-candidatos-excel/
  public exportarCandidatosExcel(rangoFechas: { start: string; end: string }): Observable<Blob> {
    const headers = this.createAuthorizationHeader();
    return this.http.post(`${this.apiUrl}/entrevista/exportar-candidatos-excel/`, rangoFechas, {
      headers,
      responseType: 'blob',
    }).pipe(
      catchError(this.handleError)
    );
  }

  public exportarCandidatosPorOficinaExcel(payload: { start: string; end: string; oficina: string }): Observable<Blob> {
    const headers = this.createAuthorizationHeader();
    return this.http.post(`${this.apiUrl}/entrevista/exportar-candidatos-por-oficina-excel/`, payload, {
      headers,
      responseType: 'blob',
    }).pipe(
      catchError(this.handleError)
    );
  }


  // Buscar en contratacion por cedula para sacar los numeros
  public buscarEncontratacion(cedula: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/contratacion/traerNombreCompletoCandidatoSin/${cedula}`, {}).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }


}
