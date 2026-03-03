import { Component, Input, ChangeDetectionStrategy, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { CandidatoSinCelular } from '../../../models/contratacion-metricas.models';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
    selector: 'app-sin-celular-table',
    standalone: true,
    imports: [CommonModule, MatTableModule, MatPaginatorModule, EmptyStateComponent],
    template: `
    <div class="table-container" *ngIf="hasData; else empty">
      <table mat-table [dataSource]="dataSource" class="mat-elevation-z0 neat-table">
        <!-- Nombres -->
        <ng-container matColumnDef="nombre">
          <th mat-header-cell *matHeaderCellDef> Candidato </th>
          <td mat-cell *matCellDef="let element"> 
            <div class="fw-bold">{{element.nombres}} {{element.apellidos}}</div>
            <div class="text-xs text-muted">{{element.numero_documento}}</div>
          </td>
        </ng-container>

        <!-- Oficina -->
        <ng-container matColumnDef="oficina">
          <th mat-header-cell *matHeaderCellDef> Oficina Origen </th>
          <td mat-cell *matCellDef="let element"> {{element.oficina}} </td>
        </ng-container>

        <!-- Status Pill (To show why it is here) -->
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef> Observación </th>
          <td mat-cell *matCellDef="let element"> 
            <span class="status-pill warn">Sin Celular Válido</span> 
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
      
      <mat-paginator [pageSizeOptions]="[5, 10, 25]" showFirstLastButtons aria-label="Select page of candidates"></mat-paginator>
    </div>

    <ng-template #empty>
      <app-empty-state 
        icon="check_circle" 
        title="Todo al día"
        description="Todos los candidatos en este rango tienen celular confirmado.">
      </app-empty-state>
    </ng-template>
  `,
    styles: [`
    .table-container {
      width: 100%;
      overflow-x: auto;
    }
    .neat-table {
      width: 100%;
      background: transparent;
    }
    th.mat-header-cell {
      color: #64748b;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #e2e8f0;
      padding: 1rem;
    }
    td.mat-cell {
      padding: 1rem;
      color: #334155;
      font-size: 0.875rem;
      border-bottom: 1px solid #f1f5f9;
    }
    .fw-bold { font-weight: 600; }
    .text-xs { font-size: 0.75rem; }
    .text-muted { color: #94a3b8; }
    
    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .status-pill.warn {
      background-color: #fee2e2;
      color: #ef4444;
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SinCelularTableComponent implements OnChanges {
    @Input() data: CandidatoSinCelular[] | null = null;
    @ViewChild(MatPaginator) paginator!: MatPaginator;

    displayedColumns: string[] = ['nombre', 'oficina', 'status'];
    dataSource = new MatTableDataSource<CandidatoSinCelular>([]);
    hasData = false;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['data'] && this.data) {
            if (this.data.length > 0) {
                this.hasData = true;
                this.dataSource.data = this.data;
                if (this.paginator) {
                    this.dataSource.paginator = this.paginator;
                }
            } else {
                this.hasData = false;
                this.dataSource.data = [];
            }
        }
    }

    ngAfterViewInit() {
        this.dataSource.paginator = this.paginator;
    }
}
