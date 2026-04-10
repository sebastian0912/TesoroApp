import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface Tarjeta {
    id: number;
    identification_number: string;
    card_number: string;
    created_at?: string;
    updated_at?: string;
}

@Injectable({
    providedIn: 'root'
})
export class TarjetasService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/tarjetas/`;
    // Si necesitas buscar por ID o cédula específicamente
}
