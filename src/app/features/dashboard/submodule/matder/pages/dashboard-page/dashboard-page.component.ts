import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatderDashboardService } from '../../services/dashboard.service';
import { WorkspaceService } from '../../services/workspace.service';
import { DashboardOverviewResponse } from '../../models/dashboard.models';
import { WorkspaceResponse } from '../../models/workspace.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-matder-dashboard',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatProgressBarModule],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatderDashboardPageComponent implements OnInit {
  loading = signal(true);
  overview = signal<DashboardOverviewResponse | null>(null);
  workspaces = signal<WorkspaceResponse[]>([]);

  constructor(
    private dashboardService: MatderDashboardService,
    private workspaceService: WorkspaceService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const [ov, ws] = await Promise.all([
        this.dashboardService.getOverview(),
        this.workspaceService.list(),
      ]);
      this.overview.set(ov);
      this.workspaces.set(ws);
    } catch {
      // empty state
    } finally {
      this.loading.set(false);
    }
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }
}
