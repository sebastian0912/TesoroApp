import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { KanbanService } from '../../services/kanban.service';
import { KanbanNotification } from '../../models/kanban.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-kanban-notifications',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatListModule, MatBadgeModule, MatChipsModule, MatProgressSpinnerModule,
  ],
  templateUrl: './kanban-notifications.component.html',
  styleUrls: ['./kanban-notifications.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanNotificationsComponent implements OnInit {
  notifications = signal<KanbanNotification[]>([]);
  loading = signal(true);
  unreadCount = signal(0);

  constructor(private kanbanService: KanbanService) {}

  async ngOnInit(): Promise<void> {
    await this.loadNotifications();
  }

  async loadNotifications(): Promise<void> {
    this.loading.set(true);
    try {
      const [data, unread] = await Promise.all([
        this.kanbanService.getNotifications(),
        this.kanbanService.getUnreadCount(),
      ]);
      this.notifications.set(data);
      this.unreadCount.set(unread.count);
    } catch {
      Swal.fire('Error', 'No se pudieron cargar las notificaciones.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  async markAsRead(notif: KanbanNotification): Promise<void> {
    if (notif.leida) return;
    try {
      await this.kanbanService.markNotificationRead(notif.id);
      notif.leida = true;
      this.notifications.set([...this.notifications()]);
      this.unreadCount.update(v => Math.max(0, v - 1));
    } catch {
      Swal.fire('Error', 'No se pudo marcar como leída.', 'error');
    }
  }

  async markAllRead(): Promise<void> {
    try {
      await this.kanbanService.markAllNotificationsRead();
      const updated = this.notifications().map(n => ({ ...n, leida: true }));
      this.notifications.set(updated);
      this.unreadCount.set(0);
      Swal.fire('Listo', 'Todas las notificaciones marcadas como leídas.', 'success');
    } catch {
      Swal.fire('Error', 'No se pudieron marcar como leídas.', 'error');
    }
  }

  getIcon(tipo: string): string {
    const icons: Record<string, string> = {
      asignacion: 'assignment_ind',
      comentario: 'comment',
      vencimiento: 'event_busy',
      mencion: 'alternate_email',
      estado: 'swap_horiz',
      general: 'notifications',
    };
    return icons[tipo] ?? 'notifications';
  }

  getColor(tipo: string): string {
    const colors: Record<string, string> = {
      asignacion: '#1976d2',
      comentario: '#388e3c',
      vencimiento: '#d32f2f',
      mencion: '#7b1fa2',
      estado: '#f57c00',
      general: '#616161',
    };
    return colors[tipo] ?? '#616161';
  }
}
