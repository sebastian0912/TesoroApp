import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';

export interface UploadResponse {
  id: number;
  uuid: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http  = inject(HttpClient);
  private base  = environment.apiUrl + '/api/matder/uploads';

  upload(file: File): Observable<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UploadResponse>(this.base, form);
  }

  delete(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${uuid}`);
  }

  fileUrl(uuid: string): string {
    return `${this.base}/${uuid}/file`;
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
}
