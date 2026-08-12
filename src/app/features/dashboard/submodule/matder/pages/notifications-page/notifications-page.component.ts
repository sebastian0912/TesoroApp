import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatderDashboardService } from '../../services/dashboard.service';
import { NotificationResponse } from '../../models/dashboard.models';
import { MatderMobileNavComponent } from '../../components/matder-mobile-nav/matder-mobile-nav.component';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule, MatBadgeModule,
    MatderMobileNavComponent
  
  ],
  templateUrl: './notifications-page.component.html',
  styleUrls: ['./notifications-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent implements OnInit {
  items = signal<NotificationResponse[]>([]);
  loading = signal(true);
  unread = signal(0);

  constructor(private ds: MatderDashboardService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    try {
      const [n, u] = await Promise.all([this.ds.getNotifications(), this.ds.getUnreadCount()]);
      this.items.set(n);
      this.unread.set(u.count);
    } catch { /* empty */ }
    finally { this.loading.set(false); }
  }

  async markRead(n: NotificationResponse): Promise<void> {
    if (n.read) return;
    try {
      await this.ds.markRead(n.id);
      this.items.set(this.items().map(item => item.id === n.id ? { ...item, read: true } : item));
      this.unread.update(v => Math.max(0, v - 1));
    } catch { /* ignore */ }
  }

  /** Clic en una notificación: la marca leída y navega a la tarea/espacio vinculado. */
  open(n: NotificationResponse): void {
    this.markRead(n);
    if (n.link) this.nav(n.link);
  }

  /** Etiqueta en español del tipo de notificación (evita mostrar el código crudo). */
  typeLabel(t: string): string {
    return ({
      ASSIGNMENT: 'Asignación',
      ASSIGNMENT_CONFIRM: 'Asignación enviada',
      COMMENT: 'Comentario',
      WORKSPACE: 'Espacio de trabajo',
      DUE_SOON: 'Por vencer',
      MENTION: 'Mención',
      STATUS_CHANGE: 'Cambio de estado',
    } as Record<string, string>)[t] ?? t;
  }

  async readAll(): Promise<void> {
    try {
      await this.ds.markAllRead();
      this.items.set(this.items().map(n => ({ ...n, read: true })));
      this.unread.set(0);
    } catch { /* ignore */ }
  }

  typeIcon(t: string): string {
    return ({
      ASSIGNMENT: 'assignment_ind',
      ASSIGNMENT_CONFIRM: 'assignment_turned_in',
      COMMENT: 'comment',
      WORKSPACE: 'group_add',
      DUE_SOON: 'event_busy',
      MENTION: 'alternate_email',
      STATUS_CHANGE: 'swap_horiz',
    } as Record<string, string>)[t] ?? 'notifications';
  }

  typeColor(t: string): string {
    return ({
      ASSIGNMENT: '#2563eb',
      ASSIGNMENT_CONFIRM: '#0d9488',
      COMMENT: '#16a34a',
      WORKSPACE: '#0ea5e9',
      DUE_SOON: '#dc2626',
      MENTION: '#7c3aed',
      STATUS_CHANGE: '#d97706',
    } as Record<string, string>)[t] ?? '#6b7280';
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }
}
