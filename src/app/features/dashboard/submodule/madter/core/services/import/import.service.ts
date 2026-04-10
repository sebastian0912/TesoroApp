import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';

export interface ImportResult {
  workspacesCreated: number;
  boardsCreated: number;
  cardsCreated: number;
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  private http = inject(HttpClient);
  private readonly base = environment.apiUrl + '/api/matder/import';

  downloadTemplate(): void {
    window.open(`${this.base}/template`, '_blank');
  }

  importFile(file: File): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportResult>(`${this.base}/workspaces`, form);
  }
}
