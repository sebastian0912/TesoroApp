import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';

export interface Tarjeta {
    id: number;
    identification_number: string;
    card_number: string;
    created_at?: string;
    updated_at?: string;
}

export interface ImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: any[];
}

@Injectable({
    providedIn: 'root'
})
export class TarjetasService {
    private apiUrl = `${environment.apiUrl}/tarjetas`;

    private http = inject(HttpClient);
  constructor() {}

    list(params: any = {}): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/`, { params });
    }

    create(data: Partial<Tarjeta>): Observable<Tarjeta> {
        return this.http.post<Tarjeta>(`${this.apiUrl}/`, data);
    }

    update(id: number, data: Partial<Tarjeta>): Observable<Tarjeta> {
        return this.http.patch<Tarjeta>(`${this.apiUrl}/${id}/`, data);
    }

    delete(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/${id}/`);
    }

    importExcel(file: File): Observable<ImportResult> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<ImportResult>(`${this.apiUrl}/import-excel/`, formData);
    }
}
