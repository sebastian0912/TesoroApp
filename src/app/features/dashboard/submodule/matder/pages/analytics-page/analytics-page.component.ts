import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatderDashboardService } from '../../services/dashboard.service';
import { DashboardOverviewResponse } from '../../models/dashboard.models';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, MatTableModule, MatProgressSpinnerModule, MatProgressBarModule],
  templateUrl: './analytics-page.component.html',
  styleUrls: ['./analytics-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPageComponent implements OnInit {
  data = signal<DashboardOverviewResponse | null>(null);
  loading = signal(true);
  boardCols = ['name', 'ws', 'tasks', 'overdue', 'unassigned', 'progress'];
  wsCols = ['name', 'boards', 'tasks', 'overdue', 'progress'];

  constructor(private ds: MatderDashboardService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    try {
      this.data.set(await this.ds.getOverview());
    } catch { /* empty */ }
    finally { this.loading.set(false); }
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }
}
