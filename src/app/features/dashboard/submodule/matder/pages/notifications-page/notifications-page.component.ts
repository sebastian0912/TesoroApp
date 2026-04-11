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

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule, MatBadgeModule],
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
      COMMENT: 'comment',
      DUE_SOON: 'event_busy',
      MENTION: 'alternate_email',
      STATUS_CHANGE: 'swap_horiz',
    } as Record<string, string>)[t] ?? 'notifications';
  }

  typeColor(t: string): string {
    return ({
      ASSIGNMENT: '#2563eb',
      COMMENT: '#16a34a',
      DUE_SOON: '#dc2626',
      MENTION: '#7c3aed',
      STATUS_CHANGE: '#d97706',
    } as Record<string, string>)[t] ?? '#6b7280';
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }
}
