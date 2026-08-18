import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';
import { FormAnalytics } from '../models/dynamic-forms.models';

/** Analítica de un formulario (totales, serie diaria, distribución por campo). */
@Injectable({ providedIn: 'root' })
export class FormAnalyticsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dynamic-forms`;

  analytics(formId: number, opts: { from?: string; to?: string } = {}): Observable<FormAnalytics> {
    let params = new HttpParams();
    if (opts.from) params = params.set('from', opts.from);
    if (opts.to) params = params.set('to', opts.to);
    return this.http.get<FormAnalytics>(`${this.base}/forms/${formId}/analytics`, { params });
  }
}
