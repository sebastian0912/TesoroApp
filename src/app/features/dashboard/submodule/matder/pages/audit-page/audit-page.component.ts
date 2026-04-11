import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatderDashboardService } from '../../services/dashboard.service';
import { AuditLogResponse } from '../../models/dashboard.models';

@Component({
  selector: 'app-audit-page', standalone: true,
  imports: [DatePipe, MatCardModule, MatIconModule, MatTableModule, MatChipsModule, MatProgressSpinnerModule],
  template: `
    <h2>Auditoría</h2>
    @if (loading()) { <div class="center"><mat-spinner diameter="40"></mat-spinner></div> }
    @else if (logs().length === 0) { <mat-card class="empty"><mat-icon>shield</mat-icon><p>Sin registros.</p></mat-card> }
    @else {
      <table mat-table [dataSource]="logs()" class="tbl">
        <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef>Fecha</th><td mat-cell *matCellDef="let l">{{ l.created_at | date:'short' }}</td></ng-container>
        <ng-container matColumnDef="user"><th mat-header-cell *matHeaderCellDef>Usuario</th><td mat-cell *matCellDef="let l">{{ l.user_name || '—' }}</td></ng-container>
        <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>Acción</th><td mat-cell *matCellDef="let l">{{ l.action }}</td></ng-container>
        <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>Entidad</th><td mat-cell *matCellDef="let l"><mat-chip-set><mat-chip>{{ l.entity_type }}</mat-chip></mat-chip-set></td></ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let row; columns: cols;"></tr>
      </table>
    }
  `,
  styles: [`h2{font-weight:500}.center{display:flex;justify-content:center;padding:48px}.empty{text-align:center;padding:48px}.empty mat-icon{font-size:48px;width:48px;height:48px;color:#9e9e9e}.tbl{width:100%}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPageComponent implements OnInit {
  logs = signal<AuditLogResponse[]>([]); loading = signal(true);
  cols = ['date', 'user', 'action', 'entity'];
  constructor(private ds: MatderDashboardService) {}
  async ngOnInit(): Promise<void> { try { this.logs.set(await this.ds.getAuditLogs()); } catch {} finally { this.loading.set(false); } }
}
