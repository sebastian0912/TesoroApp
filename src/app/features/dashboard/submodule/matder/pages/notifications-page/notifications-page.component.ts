import { Component, OnInit, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatderMobileNavComponent } from '../../components/matder-mobile-nav/matder-mobile-nav.component';
import { NotificationCenterService, NotificationItem } from '../../../../services/notification-center.service';
import { firstValueFrom } from 'rxjs';

type FilterMode = 'all' | 'unread' | 'ASSIGNMENT' | 'ASSIGNMENT_CONFIRM' | 'COMMENT' | 'WORKSPACE' | 'DUE_SOON' | 'MENTION' | 'STATUS_CHANGE';

const TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: 'Asignación',
  ASSIGNMENT_CONFIRM: 'Asignaste',
  COMMENT: 'Comentario',
  WORKSPACE: 'Workspace',
  DUE_SOON: 'Por vencer',
  MENTION: 'Mención',
  STATUS_CHANGE: 'Estado',
};

const TYPE_ICONS: Record<string, string> = {
  ASSIGNMENT: 'assignment_ind',
  ASSIGNMENT_CONFIRM: 'assignment_turned_in',
  COMMENT: 'comment',
  WORKSPACE: 'group_add',
  DUE_SOON: 'event_busy',
  MENTION: 'alternate_email',
  STATUS_CHANGE: 'swap_horiz',
};

const TYPE_COLORS: Record<string, string> = {
  ASSIGNMENT: '#2563eb',
  ASSIGNMENT_CONFIRM: '#0d9488',
  COMMENT: '#16a34a',
  WORKSPACE: '#0ea5e9',
  DUE_SOON: '#dc2626',
  MENTION: '#7c3aed',
  STATUS_CHANGE: '#d97706',
};

const FILTER_CHIPS: { label: string; mode: FilterMode; icon: string }[] = [
  { label: 'Todas',        mode: 'all',               icon: 'notifications' },
  { label: 'No leídas',   mode: 'unread',            icon: 'mark_email_unread' },
  { label: 'Asignaciones',mode: 'ASSIGNMENT',         icon: 'assignment_ind' },
  { label: 'Comentarios', mode: 'COMMENT',            icon: 'comment' },
  { label: 'Estado',      mode: 'STATUS_CHANGE',      icon: 'swap_horiz' },
  { label: 'Por vencer',  mode: 'DUE_SOON',           icon: 'event_busy' },
  { label: 'Workspace',   mode: 'WORKSPACE',          icon: 'group_add' },
];

const PAGE_SIZE = 30;

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [
    DatePipe, MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressSpinnerModule, MatBadgeModule,
    MatTooltipModule, MatderMobileNavComponent,
  ],
  templateUrl: './notifications-page.component.html',
  styleUrls: ['./notifications-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent implements OnInit {
  readonly chips = FILTER_CHIPS;

  items = signal<NotificationItem[]>([]);
  loading = signal(true);
  unread = signal(0);
  filter = signal<FilterMode>('all');
  page = signal(0);
  hasMore = signal(false);
  loadingMore = signal(false);
  deleting = signal<Set<number>>(new Set());

  constructor(
    private notifSvc: NotificationCenterService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadPage(true);
  }

  private async loadPage(reset: boolean): Promise<void> {
    if (reset) { this.loading.set(true); this.page.set(0); }
    else this.loadingMore.set(true);

    const cur = this.filter();
    const p = this.page();
    try {
      const [list, uc] = await Promise.all([
        firstValueFrom(this.notifSvc.list({
          tipo: cur !== 'all' && cur !== 'unread' ? cur : undefined,
          soloNoLeidas: cur === 'unread',
          page: p,
          size: PAGE_SIZE,
        })),
        reset ? firstValueFrom(this.notifSvc.unreadCount()) : Promise.resolve(null),
      ]);
      const fetched = list || [];
      if (reset) {
        this.items.set(fetched);
      } else {
        this.items.update(prev => [...prev, ...fetched]);
      }
      this.hasMore.set(fetched.length === PAGE_SIZE);
      if (uc) this.unread.set(uc.count);
    } catch { /**/ }
    finally { this.loading.set(false); this.loadingMore.set(false); }
  }

  async setFilter(mode: FilterMode): Promise<void> {
    if (this.filter() === mode) return;
    this.filter.set(mode);
    await this.loadPage(true);
  }

  async loadMore(): Promise<void> {
    this.page.update(p => p + 1);
    await this.loadPage(false);
  }

  async markRead(n: NotificationItem): Promise<void> {
    if (n.read) return;
    try {
      await firstValueFrom(this.notifSvc.markRead(n.id));
      this.items.update(list => list.map(i => i.id === n.id ? { ...i, read: true } : i));
      this.unread.update(v => Math.max(0, v - 1));
    } catch { /**/ }
  }

  open(n: NotificationItem): void {
    this.markRead(n);
    if (n.link) this.nav(n.link);
  }

  async readAll(): Promise<void> {
    try {
      await firstValueFrom(this.notifSvc.markAllRead());
      this.items.update(list => list.map(n => ({ ...n, read: true })));
      this.unread.set(0);
    } catch { /**/ }
  }

  async deleteOne(ev: Event, n: NotificationItem): Promise<void> {
    ev.stopPropagation();
    const cur = new Set(this.deleting());
    cur.add(n.id);
    this.deleting.set(cur);
    try {
      await firstValueFrom(this.notifSvc.delete(n.id));
      this.items.update(list => list.filter(i => i.id !== n.id));
      if (!n.read) this.unread.update(v => Math.max(0, v - 1));
    } catch { /**/ }
    finally {
      const s = new Set(this.deleting());
      s.delete(n.id);
      this.deleting.set(s);
    }
  }

  async clearRead(): Promise<void> {
    try {
      await firstValueFrom(this.notifSvc.clearRead());
      this.items.update(list => list.filter(n => !n.read));
    } catch { /**/ }
  }

  typeLabel(t: string): string { return TYPE_LABELS[t] ?? t; }
  typeIcon(t: string): string  { return TYPE_ICONS[t]  ?? 'notifications'; }
  typeColor(t: string): string { return TYPE_COLORS[t] ?? '#6b7280'; }

  isDeleting(id: number): boolean { return this.deleting().has(id); }

  readCount(): number { return this.items().filter(n => n.read).length; }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }
}
