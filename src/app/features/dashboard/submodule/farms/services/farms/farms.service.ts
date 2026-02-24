import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { environment } from '@/environments/environment';

type AnyObj = Record<string, any>;

@Injectable({
  providedIn: 'root'
})
export class FarmsService {
  private readonly http = inject(HttpClient);

  /** Prefijo de tu API (ajusta según tu env) */
  private readonly base = `${environment.apiUrl}/gestion_centros_costos`;

  // ========== LISTAR (GET, SIN PAGINACIÓN) ==========
  /**
   * Lista todos los centros de costo (sin paginación).
   * @param search Texto a buscar (opcional)
   * Respuesta esperada: Array plano de objetos.
   * (Si el backend enviara wrapper {results: []}, lo adaptamos).
   */
  list(search?: string): Observable<AnyObj[]> {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }

    // GET /gestion_centros_costos/
    return this.http.get<AnyObj[] | { results: AnyObj[] }>(`${this.base}/`, { params }).pipe(
      map(resp => Array.isArray(resp) ? resp : (resp?.results ?? []))
    );
  }

  // ========== CREAR (POST) ==========
  /**
   * Crea un centro de costo. El payload debe tener las claves "tal cual el Excel":
   * FINCA, Ccostos, Subcentro, Grupo, Categoría, Operación, Sublabor, Salario,
   * AUXILIO DE TRANSPORTE, RUTA, Valor Transporte, Empresa , Centro de costo,
   * Dirección, LINEA CONTRATO, Indicaciones para Llegar, Ciudad,
   * Telefono de Contato Gestor, Temporal
   */
  create(payload: AnyObj): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.base}/create/`, payload);
  }

  // ========== DETALLE (GET) ==========
  getById(id: number): Observable<AnyObj> {
    return this.http.get<AnyObj>(`${this.base}/${id}/`);
  }

  // ========== ACTUALIZAR (PATCH / PUT) ==========
  updatePartial(id: number, partial: AnyObj): Observable<{ detail: string }> {
    return this.http.patch<{ detail: string }>(`${this.base}/${id}/`, partial);
  }

  updateReplace(id: number, payload: AnyObj): Observable<{ detail: string }> {
    return this.http.put<{ detail: string }>(`${this.base}/${id}/`, payload);
  }

  // ========== ELIMINAR (DELETE) ==========
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/`);
  }

  // ========== CARGA MASIVA POR EXCEL (POST multipart/form-data) ==========
  /**
   * Sube un Excel "tal cual" y hace truncate lógico (borra todo y recarga).
   * Devuelve { detail, insertados } desde el backend.
   */
  uploadExcel(file: File): Observable<{ detail: string; insertados: number }> {
    const form = new FormData();
    form.append('file', file); // el campo debe llamarse "file"
    return this.http.post<{ detail: string; insertados: number }>(`${this.base}/upload-excel/`, form);
  }

  // ========== DESCARGA EXCEL (GET blob) ==========
  /**
   * Descarga el Excel con los encabezados y datos EXACTOS.
   * Retorna un Blob; guárdalo en el componente con URL.createObjectURL o FileSaver.
   */
  downloadExcel(): Observable<Blob> {
    return this.http.get(`${this.base}/download-excel/`, {
      responseType: 'blob' as const
    });
  }

  /**
   * Descarga y guarda el archivo. Intenta usar el nombre sugerido por el servidor.
   */
  downloadExcelAndSave(fallbackName = 'centros_costos.xlsx'): Observable<void> {
    return this.http.get(`${this.base}/download-excel/`, {
      observe: 'response',
      responseType: 'blob'
    }).pipe(
      tap((res: HttpResponse<Blob>) => {
        const cd = res.headers.get('content-disposition') || '';
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
        const suggested = decodeURIComponent((match?.[1] || match?.[2] || '').trim());
        const filename = suggested || fallbackName;
        this.saveBlob(res.body as Blob, filename);
      }),
      map(() => void 0)
    );
  }

  // ========== Helpers ==========
  /** Guardar un Blob como archivo en el navegador (sin FileSaver). */
  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    try {
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
    } finally {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
}
