import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';

export interface PersonaTesoreriaPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: PersonaTesoreriaItem[];
}

export interface PersonaTesoreriaItem {
  numero_documento: string;
  codigo?: string | null;
  nombre?: string | null;
  ingreso?: string | null;
  temporal?: string | null;
  finca?: string | null;

  salario?: number | string | null;
  saldos?: number | string | null;
  fondos?: number | string | null;
  mercados?: number | string | null;
  cuotas_mercados?: number | string | null;
  prestamo_para_descontar?: number | string | null;
  cuotas_prestamos_para_descontar?: number | string | null;
  casino?: number | string | null;
  valor_anchetas?: number | string | null;
  cuotas_anchetas?: number | string | null;
  fondo?: number | string | null;
  carnet?: number | string | null;
  seguro_funerario?: number | string | null;
  prestamo_para_hacer?: number | string | null;
  cuotas_prestamo_para_hacer?: number | string | null;
  anticipo_liquidacion?: number | string | null;
  cuentas?: number | string | null;

  bloqueado?: boolean;
  fecha_bloqueo?: string | null;
  observacion_bloqueo?: string | null;
  observacion_desbloqueo?: string | null;
  fecha_desbloqueo?: string | null;

  activo?: boolean;
  saldo_pendiente?: number | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExcelImportResponse {
  total_rows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors_count: number;
  errors_sample: { row: number, error: string }[];
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

  // --- Mass Excel Imports ---

  async importarPersonasExcel(file: File): Promise<ExcelImportResponse> {
    const url = `${this.apiUrl}/gestion_tesoreria/personas/import-excel/`;
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(this.http.post<ExcelImportResponse>(url, formData).pipe(catchError(this.handleError)));
  }

  async importarSaldosFondosExcel(file: File): Promise<ExcelImportResponse> {
    const url = `${this.apiUrl}/gestion_tesoreria/personas/saldos/import-excel/`;
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(this.http.post<ExcelImportResponse>(url, formData).pipe(catchError(this.handleError)));
  }

  async importarEstadosExcel(file: File): Promise<ExcelImportResponse> {
    const url = `${this.apiUrl}/gestion_tesoreria/personas/estados/import-excel/`;
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(this.http.post<ExcelImportResponse>(url, formData).pipe(catchError(this.handleError)));
  }

  // --- CRUD PersonaTesoreria ---

  async traerDatosbaseGeneral(limit = 500, offset = 0, search: string = ''): Promise<PersonaTesoreriaPage> {
    const page = Math.floor(offset / limit) + 1;
    let params = new HttpParams()
      .set('limit', String(limit))
      .set('page', String(page));

    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }

    const response = await firstValueFrom(
      this.http.get<PersonaTesoreriaPage>(`${this.apiUrl}/gestion_tesoreria/personas/`, { params }).pipe(
        catchError(this.handleError)
      )
    );

    return response;
  }

  async traerTodosLosDatos(): Promise<PersonaTesoreriaItem[]> {
    const pageSize = 1000;
    const first = await this.traerDatosbaseGeneral(pageSize, 0);
    const all: PersonaTesoreriaItem[] = [...first.results];
    const total = first.count;

    const remainingPages = Math.ceil(total / pageSize) - 1;
    for (let i = 1; i <= remainingPages; i++) {
      const page = await this.traerDatosbaseGeneral(pageSize, i * pageSize);
      all.push(...page.results);
    }

    return all;
  }

  async traerDatosbasePorDocumento(doc: string): Promise<PersonaTesoreriaItem | null> {
    const url = `${this.apiUrl}/gestion_tesoreria/personas/${encodeURIComponent(doc)}/`;
    try {
      const response = await firstValueFrom(
        this.http.get<PersonaTesoreriaItem>(url).pipe(
          catchError(this.handleError)
        )
      );
      return response;
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async actualizarDatosbaseCompleto(numero_documento: string, payload: PersonaTesoreriaItem): Promise<any> {
    const url = `${this.apiUrl}/gestion_tesoreria/personas/${encodeURIComponent(numero_documento)}/`;
    return firstValueFrom(
      this.http.put<any>(url, payload).pipe(
        catchError(this.handleError)
      )
    );
  }

  async actualizarParcial(numero_documento: string, cambios: Partial<PersonaTesoreriaItem>): Promise<any> {
    const url = `${this.apiUrl}/gestion_tesoreria/personas/${encodeURIComponent(numero_documento)}/`;
    return firstValueFrom(
      this.http.patch<any>(url, cambios).pipe(
        catchError(this.handleError)
      )
    );
  }

  async actualizarEstado(
    numero_documento: string,
    cambios: {
      bloqueado?: boolean;
      activo?: boolean;
      fecha_bloqueo?: string | null;
      fecha_desbloqueo?: string | null;
      observacion_bloqueo?: string;
      observacion_desbloqueo?: string;
    }
  ): Promise<any> {
    const url = `${this.apiUrl}/gestion_tesoreria/personas/${encodeURIComponent(numero_documento)}/`;
    return firstValueFrom(
      this.http.patch<any>(url, cambios).pipe(
        catchError(this.handleError)
      )
    );
  }

  // --- Old endpoints kept for compatibility or not yet refactored ---

  async resetearValoresQuincena(): Promise<any> {
    // Si tienes un endpoint para esto, sino dejar el original
    const urlcompleta = `${this.apiUrl}/gestion_tesoreria/personas/reset-quincena/`;
    return firstValueFrom(
      this.http.post<any>(urlcompleta, {}).pipe(
        catchError(this.handleError)
      )
    );
  }
}
