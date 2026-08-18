import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@/environments/environment';
import { DocumentRef } from '../models/dynamic-forms.models';

/** Respuesta snake_case de upload-by-owner en ms-documents. */
interface UploadByOwnerResponse {
  document_id: number;
  version_id?: number;
  size_bytes?: number;
  mime_type?: string;
  deduplicated?: boolean;
}

/**
 * Offload de media hacia ms-documents. Parte del CONTRATO de envío (no un flag):
 * el payload solo lleva referencias {source, document_id, ...}; un File nativo jamás
 * se serializa. En modo autenticado el envío es FAIL-CLOSED: si esta subida falla,
 * la página ABORTA el submit completo (no se pierde media en silencio).
 */
@Injectable({ providedIn: 'root' })
export class MediaOffloadService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/documents`;

  /** Sube UN archivo y devuelve la referencia que viaja en el payload. */
  upload(file: File, formId: number): Observable<DocumentRef> {
    const fd = new FormData();
    fd.append('ownerId', this.ownerId(formId));
    fd.append('ownerType', 'DYNAMIC_FORM');
    fd.append('sourceService', 'tesoro-dynamic-forms');
    fd.append('legacyField', `dfform:${formId}`);
    fd.append('file', file, file.name);
    return this.http.post<UploadByOwnerResponse>(`${this.base}/upload-by-owner`, fd).pipe(
      map((r) => {
        if (!r || r.document_id == null) {
          throw new Error('ms-documents no confirmó la subida');
        }
        return {
          source: 'ms-documents' as const,
          document_id: r.document_id,
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          size: file.size,
        };
      }),
    );
  }

  /** URL de descarga (el auth.interceptor agrega el JWT; usar DocViewerService para abrir). */
  downloadUrl(ref: DocumentRef): string {
    return `${this.base}/${ref.document_id}/download`;
  }

  /** Owner del documento = usuario autenticado (fallback al formulario). */
  private ownerId(formId: number): string {
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      const id = user?.id ?? user?.user_id ?? null;
      if (id) return String(id);
    } catch {
      /* usuario ilegible: cae al fallback */
    }
    return `dfform-${formId}`;
  }
}
