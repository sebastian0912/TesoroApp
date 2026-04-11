import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatderDashboardService } from '../../services/dashboard.service';
import { DashboardOverviewResponse } from '../../models/dashboard.models';

@Component({
  selector: 'app-analytics-page', standalone: true,
  imports: [MatCardModule, MatIconModule, MatTableModule, MatProgressSpinnerModule, MatProgressBarModule],
  template: `
    <h2>Analíticas</h2>
    @if (loading()) { <div class="center"><mat-spinner diameter="40"></mat-spinner></div> }
    @else if (data(); as d) {
      <div class="kpi-grid">
        <mat-card class="kpi"><div class="val">{{ d.completion_rate }}%</div><div class="lbl">Completado</div></mat-card>
        <mat-card class="kpi"><div class="val">{{ d.total_tasks }}</div><div class="lbl">Total tareas</div></mat-card>
        <mat-card class="kpi"><div class="val">{{ d.overdue_tasks }}</div><div class="lbl">Vencidas</div></mat-card>
        <mat-card class="kpi"><div class="val">{{ d.due_soon_tasks }}</div><div class="lbl">Próx. a vencer</div></mat-card>
        <mat-card class="kpi"><div class="val">{{ d.unassigned_tasks }}</div><div class="lbl">Sin asignar</div></mat-card>
        <mat-card class="kpi"><div class="val">{{ d.assignment_coverage_rate }}%</div><div class="lbl">Cobertura asignación</div></mat-card>
      </div>
      @if (d.board_indicators.length > 0) {
        <h3>Por tablero</h3>
        <table mat-table [dataSource]="d.board_indicators" class="tbl">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Tablero</th><td mat-cell *matCellDef="let b"><strong>{{ b.name }}</strong></td></ng-container>
          <ng-container matColumnDef="ws"><th mat-header-cell *matHeaderCellDef>Workspace</th><td mat-cell *matCellDef="let b">{{ b.workspace_name }}</td></ng-container>
          <ng-container matColumnDef="tasks"><th mat-header-cell *matHeaderCellDef>Tareas</th><td mat-cell *matCellDef="let b">{{ b.task_count }}</td></ng-container>
          <ng-container matColumnDef="progress"><th mat-header-cell *matHeaderCellDef>Progreso</th><td mat-cell *matCellDef="let b"><mat-progress-bar mode="determinate" [value]="b.progress_percent"></mat-progress-bar>{{ b.progress_percent }}%</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let row; columns: cols;"></tr>
        </table>
      }
    }
  `,
  styles: [`h2,h3{font-weight:500}.center{display:flex;justify-content:center;padding:48px}.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px}.kpi{text-align:center;padding:20px}.val{font-size:1.8rem;font-weight:700}.lbl{font-size:.8rem;color:rgba(0,0,0,.5)}.tbl{width:100%}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPageComponent implements OnInit {
  data = signal<DashboardOverviewResponse | null>(null);
  loading = signal(true);
  cols = ['name', 'ws', 'tasks', 'progress'];
  constructor(private ds: MatderDashboardService) {}
  async ngOnInit(): Promise<void> { try { this.data.set(await this.ds.getOverview()); } catch {} finally { this.loading.set(false); } }
}
