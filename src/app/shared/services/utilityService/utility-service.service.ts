import { EventEmitter, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class UtilityServiceService {
  private apiUrl = environment.apiUrl;
  // 🔔 EventEmitter para comunicar entre padre e hijo
  nextStep: EventEmitter<void> = new EventEmitter<void>();

  constructor(private http: HttpClient) { }

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
    return this.http.get(`${this.apiUrl}/Sucursal/sucursal`);
  }

  traerSucursales2(): Observable<any> {
    return this.http.get(`${this.apiUrl}/gestion_admin/sedes`);
  }

  // traer empresas
  traerEmpresas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/gestion_admin/empresas`);
  }

  // traer roles
  traerRoles(): Observable<any> {
    return this.http.get(`${this.apiUrl}/gestion_admin/roles`);
  }

  // traer permisos
  traerPermisos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/gestion_admin/permisos`);
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

    return this.http.post<string>(urlcompleta, requestBody);
  }

  traerUsuarios(): Observable<any> {
    return this.http.get(`${this.apiUrl}/usuarios/usuarios`);
  }

  getAllUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/gestion_admin/usuarios`);
  }

  traerInventarioProductos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Comercio/comercio`);
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
      .pipe(map((response) => response.message));
  }

  // Verificar monto del código
  public verificarMontoCodigo(codigo: any, monto: number, rol?: string): boolean {
    // 🔹 Validar si codigo y codigo.codigo[0] existen
    if (!codigo || !codigo.codigo || !codigo.codigo[0]) {
      return false;
    }

    // 🔹 Convertir a número para asegurar cálculos correctos
    const montoCodigo = parseInt(codigo.codigo[0].monto, 10);
    if (isNaN(montoCodigo)) {
      return false;
    }

    // 🔹 Evaluar según el rol
    if (rol?.toLowerCase() === 'tienda') {
      // Se permite un excedente de 50,000 si el rol es "TIENDA"
      return montoCodigo >= (monto - 50000);
    }

    // Para otros roles, el monto no debe superar el disponible
    return montoCodigo >= monto;
  }

  // Buscar operario por cedula
  async buscarOperarioPorCedula(cedula: string): Promise<any> {
    return this.http.get(`${this.apiUrl}/contratacion/buscarCandidato/${cedula}`);
  }

  traerAutorizaciones(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Codigo/codigos`);
  }

  public obtenerCodigosContrato(cedula: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/contratacion/contratos/${cedula}/`).pipe(
      map((response: any) => response)
    );
  }
}
