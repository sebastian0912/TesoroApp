import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatderDashboardService } from '../../services/dashboard.service';
import { AuditLogResponse } from '../../models/dashboard.models';

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [
    DatePipe, FormsModule, MatCardModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './audit-page.component.html',
  styleUrls: ['./audit-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPageComponent implements OnInit {
  logs = signal<AuditLogResponse[]>([]);
  loading = signal(true);
  search = '';
  entityFilter = '';

  constructor(private ds: MatderDashboardService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    try { this.logs.set(await this.ds.getAuditLogs()); }
    catch { /* empty */ }
    finally { this.loading.set(false); }
  }

  get filtered(): AuditLogResponse[] {
    let result = this.logs();
    if (this.search) {
      const q = this.search.toLowerCase();
      result = result.filter(l =>
        l.action.toLowerCase().includes(q) ||
        (l.user_name ?? '').toLowerCase().includes(q) ||
        l.entity_type.toLowerCase().includes(q)
      );
    }
    if (this.entityFilter) {
      result = result.filter(l => l.entity_type === this.entityFilter);
    }
    return result;
  }

  get entityTypes(): string[] {
    return [...new Set(this.logs().map(l => l.entity_type))].sort();
  }

  actionIcon(action: string): string {
    const a = action.toLowerCase();
    if (a.includes('create') || a.includes('add')) return 'add_circle';
    if (a.includes('delete') || a.includes('remove')) return 'remove_circle';
    if (a.includes('update') || a.includes('edit') || a.includes('move')) return 'edit';
    if (a.includes('login') || a.includes('auth')) return 'login';
    return 'info';
  }

  actionColor(action: string): string {
    const a = action.toLowerCase();
    if (a.includes('create') || a.includes('add')) return '#16a34a';
    if (a.includes('delete') || a.includes('remove')) return '#dc2626';
    if (a.includes('update') || a.includes('edit') || a.includes('move')) return '#2563eb';
    return '#6b7280';
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }
}
