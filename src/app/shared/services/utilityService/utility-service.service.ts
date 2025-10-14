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
    return this.http.get(`${this.apiUrl}/gestion_admin/sedes`);
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
   * Variante directa cuando ya tienes el UUID del usuario.
   */
  cambiarSedePorUsuarioId(
    usuarioId: string,
    sedeId: string | null
  ): Observable<{ ok: boolean; changed: boolean; sede_id: string | null; sede: string | null; }> {
    const body = sedeId ? { sede: sedeId } : { sede: null };
    return this.http.post<{
      ok: boolean; changed: boolean; sede_id: string | null; sede: string | null;
    }>(`${this.apiUrl}/gestion_admin/usuarios/${usuarioId}/cambiar_sede/`, body);
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


  /** Normaliza para comparar: sin acentos, minúsculas, un solo espacio */
  _normKey(s: string): string {
    return (s ?? '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /** normaliza para comparar: sin acentos, minúsculas */
  normKey(s: string): string {
    return (s ?? '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /** String del backend ("A, B, C") -> array mapeado a tu catálogo */
  parseMultiToCatalog(input: string | string[] | null | undefined, catalog: readonly string[]): string[] {
    const catMap = new Map<string, string>(catalog.map(v => [this.normKey(v), v]));
    const tokens = Array.isArray(input)
      ? input
      : String(input ?? '')
        .split(/[,\uFF0C;|/]+/) // coma, punto y coma, pipes, slash…
        .map(s => s.trim())
        .filter(Boolean);

    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of tokens) {
      const k = this.normKey(raw);
      const canon = catMap.get(k);
      if (!canon) continue;          // ignora lo que no esté en tu catálogo
      const dk = this.normKey(canon);
      if (seen.has(dk)) continue;    // evita duplicados
      seen.add(dk);
      out.push(canon);
    }
    return out;
  }



}
