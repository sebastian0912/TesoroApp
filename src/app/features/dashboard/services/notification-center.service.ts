import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';

/** Notificación in-app tal como la expone ms-tools (/matder/notifications). */
export interface NotificationItem {
  id: number;
  user: string | null;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

/**
 * Centro de notificaciones del top bar global. Vive a nivel de dashboard (no del
 * submódulo Matder) para que la campana de la barra superior no dependa de código
 * de Matder; hoy la única fuente de notificaciones es ms-tools, de ahí la ruta.
 * El usuario se resuelve del JWT en el backend (no hace falta pasar usuarioId).
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private base = `${environment.apiUrl}/matder/notifications`;

  constructor(private http: HttpClient) {}

  list(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(`${this.base}/`);
  }

  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/unread-count/`);
  }

  markRead(id: number): Observable<unknown> {
    return this.http.patch(`${this.base}/${id}/read/`, {});
  }

  markAllRead(): Observable<unknown> {
    return this.http.patch(`${this.base}/read-all/`, {});
  }
}
