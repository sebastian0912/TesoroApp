import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment.development';

export interface SaldosMasivoRow {
  cedula: string;
  saldos?: string | null;
  fondos?: string | null;
}

export interface SaldosMasivoResponse {
  message: 'success' | 'error';
  total_recibidos: number;
  actualizados: number;
  sin_cambios: number;
  no_encontrados: string[];
  errores: number;
  detalles: Array<{ documento: string; ok: boolean; cambios?: any; error?: string }>;
}

export interface DatosbasePage<T = any> {
  total_general: number;
  total_activos: number;
  limit: number;
  offset: number;
  datosbase: T[];
}

export interface DatosbaseItem {
  numero_de_documento: string;

  codigo?: string | null;
  nombre?: string | null;
  ingreso?: string | null;
  temporal?: string | null;
  finca?: string | null;
  salario?: string | null;
  saldos?: string | null;
  fondos?: string | null;
  mercados?: string | null;
  cuotasMercados?: string | null;
  prestamoParaDescontar?: string | null;
  cuotasPrestamosParaDescontar?: string | null;
  casino?: string | null;
  valoranchetas?: string | null;
  cuotasAnchetas?: string | null;
  fondo?: string | null;
  carnet?: string | null;
  seguroFunerario?: string | null;
  prestamoParaHacer?: string | null;
  cuotasPrestamoParahacer?: string | null;
  anticipoLiquidacion?: string | null;
  cuentas?: string | null;

  bloqueado?: boolean;
  fechaBloqueo?: string | null;
  observacion_bloqueo?: string | null;
  observacion_desbloqueo?: string | null;
  fechaDesbloqueo?: string | null;

  activo?: boolean;
  saldoPendiente?: string | null;
}

export interface DatosbaseSingleResponse<T = DatosbaseItem> {
  datosbase: T[]; // backend devuelve [row]
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class TesoreriaService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  private handleError(error: any) {
    return throwError(() => error);
  }

  // Añadir empleados
  async añadirEmpleado(datos: any): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/datosbase`;
    const requestBody = { datos, mensaje: 'muchos' };

    return firstValueFrom(
      this.http.post<any>(urlcompleta, requestBody).pipe(
        catchError(this.handleError)
      )
    );
  }

  // Eliminar empleados
  async eliminarEmpleados(cedulaEmpleado: string): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/eliminardatos/${encodeURIComponent(cedulaEmpleado)}`;
    return firstValueFrom(
      this.http.delete<any>(urlcompleta).pipe(
        catchError(this.handleError)
      )
    );
  }

  async actualizarDatosbaseCompleto(id: string, payload: DatosbaseItem): Promise<any> {
    const url = `${this.apiUrl}/Datosbase/datosbase/${encodeURIComponent(id)}`;

    // OJO: tu backend espera TODAS las llaves en el PUT (por cómo usas jd['campo'])
    return firstValueFrom(
      this.http.put<any>(url, payload).pipe(
        catchError(this.handleError)
      )
    );
  }


  async actualizarEstado(
    numero_de_documento: string,
    cambios: {
      bloqueado?: boolean;
      activo?: boolean;
      fechaBloqueo?: string | null;
      fechaDesbloqueo?: string | null;
      observacion_bloqueo?: string;
      observacion_desbloqueo?: string;
    }
  ): Promise<any> {
    const url = `${this.apiUrl}/Datosbase/actualizar-estados/${encodeURIComponent(numero_de_documento)}/`;
    return firstValueFrom(
      this.http.patch<any>(url, cambios).pipe(
        catchError(this.handleError)
      )
    );
  }

  // Masivo estados
  async actualizarEstadosMasivo(payload: {
    documentos: string[];
    activo?: boolean;
    bloqueado?: boolean;
    fechaBloqueo?: string;
    observacion_bloqueo?: string;
    observacion_desbloqueo?: string;
  }): Promise<{
    total_recibidos: number;
    actualizados: number;
    ya_en_estado: number;
    no_encontrados: string[];
    errores: number;
    detalles: Array<{ documento: string; ok: boolean; cambios?: any; error?: string }>;
  }> {
    const url = `${this.apiUrl}/Datosbase/actualizar-estados/masivo/`;
    return firstValueFrom(
      this.http.post<any>(url, payload).pipe(
        catchError(this.handleError)
      )
    );
  }

  // Actualizar empleado (saldos)
  async actualizarEmpleado(cedulaEmpleado: string, saldos: string): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/actualizarSaldos/${encodeURIComponent(cedulaEmpleado)}`;
    const requestBody = { saldos };

    return firstValueFrom(
      this.http.post<any>(urlcompleta, requestBody).pipe(
        catchError(this.handleError)
      )
    );
  }

  // Masivo saldos
  async actualizarSaldosMasivo(rows: SaldosMasivoRow[]): Promise<SaldosMasivoResponse> {
    const url = `${this.apiUrl}/Datosbase/actualizar-saldos/`;
    const body = { rows };

    return firstValueFrom(
      this.http.post<SaldosMasivoResponse>(url, body).pipe(
        catchError(this.handleError)
      )
    );
  }

  // Actualizar saldo pendiente
  async actualizarSaldoPendienteEmpleado(cedulaEmpleado: string, saldoPendiente: string): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/actualizar-saldo-pendiente/${encodeURIComponent(cedulaEmpleado)}/`;
    const requestBody = { saldoPendiente };

    return firstValueFrom(
      this.http.post<any>(urlcompleta, requestBody).pipe(
        catchError(this.handleError)
      )
    );
  }

  // Reset valores
  async resetearValoresQuincena(): Promise<any> {
    const urlcompleta = `${this.apiUrl}/Datosbase/reiniciarValores`;
    return firstValueFrom(
      this.http.post<any>(urlcompleta, {}).pipe(
        catchError(this.handleError)
      )
    );
  }

  // Filtrar en memoria (si ya tienes la base cargada)
  async traerDatosBase(base: any[], ceduladelapersona: string): Promise<any[]> {
    return base.filter((item: any) => item.numero_de_documento === ceduladelapersona);
  }

  // Traer paginado
  async traerDatosbaseGeneral(limit = 500, offset = 0): Promise<DatosbasePage<DatosbaseItem>> {
    const params = new HttpParams()
      .set('limit', String(limit))
      .set('offset', String(offset));

    const response = await firstValueFrom(
      this.http.get<DatosbasePage<DatosbaseItem>>(`${this.apiUrl}/Datosbase/tesoreria`, { params }).pipe(
        catchError(this.handleError)
      )
    );

    return {
      total_general: response.total_general ?? 0,
      total_activos: response.total_activos ?? 0,
      limit: response.limit ?? limit,
      offset: response.offset ?? offset,
      datosbase: response.datosbase ?? []
    };
  }

  // Traer uno solo (por documento) - requiere ruta /tesoreria/<id>
  async traerDatosbasePorDocumento(doc: string): Promise<DatosbaseItem | null> {
    const url = `${this.apiUrl}/Datosbase/tesoreria/${encodeURIComponent(doc)}`;

    const response = await firstValueFrom(
      this.http.get<DatosbaseSingleResponse<DatosbaseItem>>(url).pipe(
        catchError(this.handleError)
      )
    );

    const row = response?.datosbase?.[0];
    return row ?? null;
  }

  // Si aún usas este endpoint alterno
  async traerdatosbaseGeneral2(): Promise<any[]> {
    const response = await firstValueFrom(
      this.http.get<any>(`${this.apiUrl}/Datosbase/tesoreria2`).pipe(
        catchError(this.handleError)
      )
    );
    return response.datosbase || [];
  }

  // Verificar si se puede eliminar
  verificaInfo(datos: any): boolean {
    const sumaTotal =
      parseInt(datos.mercados) +
      parseInt(datos.prestamoParaDescontar) +
      parseInt(datos.casino) +
      parseInt(datos.valoranchetas) +
      parseInt(datos.fondo) +
      parseInt(datos.carnet) +
      parseInt(datos.seguroFunerario) +
      parseInt(datos.anticipoLiquidacion) +
      parseInt(datos.cuentas);

    return !(sumaTotal > 0);
  }

  traerHistorialPorFecha(fechaInicio: string, fechaFin: string, nombre: string): Observable<any> {
    const params = new HttpParams()
      .set('nombre', nombre)
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    return this.http.get(`${this.apiUrl}/Historial/informeFecha`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  // Cambio estado quincena
  async actualizarEstadoQuincena(estado: boolean): Promise<any> {
    const url = `${this.apiUrl}/usuarios/tesoreria/cambioEstado`;
    return firstValueFrom(
      this.http.post<any>(url, { estado }).pipe(
        catchError(this.handleError)
      )
    );
  }
}
