import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@/environments/environment';
import { Observable, tap } from 'rxjs';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl + '/api/matder/notifications';

  notifications = signal<Notification[]>([]);
  unreadCount = signal<number>(0);

  loadNotifications() {
    this.http.get<Notification[]>(this.baseUrl).subscribe(data => {
      this.notifications.set(data);
      this.unreadCount.set(data.filter(n => !n.read).length);
    });
  }

  markAsRead(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/read`, {}).pipe(
      tap(() => {
        const current = this.notifications();
        const index = current.findIndex(n => n.id === id);
        if (index !== -1) {
          current[index].read = true;
          this.notifications.set([...current]);
          this.unreadCount.set(current.filter(n => !n.read).length);
        }
      })
    );
  }

  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/read-all`, {}).pipe(
      tap(() => {
        const current = this.notifications().map(n => ({ ...n, read: true }));
        this.notifications.set(current);
        this.unreadCount.set(0);
      })
    );
  }
}
