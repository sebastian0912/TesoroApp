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

  list(opts: { tipo?: string; soloNoLeidas?: boolean; page?: number; size?: number } = {}): Observable<NotificationItem[]> {
    let params: Record<string, string | number | boolean> = {};
    if (opts.tipo) params['tipo'] = opts.tipo;
    if (opts.soloNoLeidas) params['soloNoLeidas'] = true;
    if (opts.page != null) params['page'] = opts.page;
    if (opts.size != null) params['size'] = opts.size;
    return this.http.get<NotificationItem[]>(`${this.base}/`, { params: params as any });
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

  delete(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }

  clearRead(): Observable<{ deleted: number }> {
    return this.http.delete<{ deleted: number }>(`${this.base}/clear-read/`);
  }
}
