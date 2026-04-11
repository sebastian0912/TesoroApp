import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatderDashboardService } from '../../services/dashboard.service';
import { NotificationResponse } from '../../models/dashboard.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-notifications-page', standalone: true,
  imports: [DatePipe, MatCardModule, MatButtonModule, MatIconModule, MatListModule, MatChipsModule, MatProgressSpinnerModule],
  template: `
    <div class="header"><h2>Notificaciones</h2>
      @if (unread() > 0) { <button mat-raised-button color="primary" (click)="readAll()"><mat-icon>done_all</mat-icon> Marcar todas</button> }
    </div>
    @if (loading()) { <div class="center"><mat-spinner diameter="40"></mat-spinner></div> }
    @else if (items().length === 0) { <mat-card class="empty"><mat-icon>notifications_off</mat-icon><p>Sin notificaciones.</p></mat-card> }
    @else { <mat-list>@for (n of items(); track n.id) {
      <mat-list-item [class.unread]="!n.read" (click)="markRead(n)">
        <mat-icon matListItemIcon>{{ typeIcon(n.type) }}</mat-icon>
        <div matListItemTitle>{{ n.title }}</div>
        <div matListItemLine>{{ n.message }}</div>
        <span matListItemMeta>{{ n.created_at | date:'short' }}</span>
      </mat-list-item>
    }</mat-list> }
  `,
  styles: [`.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}h2{margin:0;font-weight:500}.center{display:flex;justify-content:center;padding:48px}.empty{text-align:center;padding:48px}.empty mat-icon{font-size:48px;width:48px;height:48px;color:#9e9e9e}.unread{background:#e3f2fd}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent implements OnInit {
  items = signal<NotificationResponse[]>([]); loading = signal(true); unread = signal(0);
  constructor(private ds: MatderDashboardService) {}
  async ngOnInit(): Promise<void> { try { const [n, u] = await Promise.all([this.ds.getNotifications(), this.ds.getUnreadCount()]); this.items.set(n); this.unread.set(u.count); } catch {} finally { this.loading.set(false); } }
  async markRead(n: NotificationResponse): Promise<void> { if (n.read) return; try { await this.ds.markRead(n.id); n.read = true; this.items.set([...this.items()]); this.unread.update(v => Math.max(0, v - 1)); } catch {} }
  async readAll(): Promise<void> { try { await this.ds.markAllRead(); this.items.set(this.items().map(n => ({ ...n, read: true }))); this.unread.set(0); } catch {} }
  typeIcon(t: string): string { return ({ ASSIGNMENT: 'assignment_ind', COMMENT: 'comment', DUE_SOON: 'event_busy', MENTION: 'alternate_email', STATUS_CHANGE: 'swap_horiz' } as any)[t] ?? 'notifications'; }
}
