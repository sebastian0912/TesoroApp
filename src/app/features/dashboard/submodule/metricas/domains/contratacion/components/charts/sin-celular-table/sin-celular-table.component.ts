import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewChild, OnChanges, SimpleChanges } from '@angular/core';

import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CandidatoSinCelular } from '../../../models/contratacion-metricas.models';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
    selector: 'app-sin-celular-table',
    standalone: true,
    imports: [MatTableModule, MatPaginatorModule, MatIconModule, MatButtonModule, MatTooltipModule, EmptyStateComponent],
    template: `
    @if (hasData) {
      <div class="table-container">
        <div class="table-toolbar">
          <span class="counter">{{ dataSource.data.length }} candidato(s) sin celular</span>
          <button mat-stroked-button color="primary" type="button"
                  (click)="emitBulkDownload()"
                  [disabled]="!dataSource.data.length">
            <mat-icon>file_download</mat-icon>
            Descargar Excel (todos)
          </button>
        </div>
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
          <!-- Status Pill -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef> Observación </th>
            <td mat-cell *matCellDef="let element">
              <span class="status-pill warn">Sin Celular Válido</span>
            </td>
          </ng-container>
          <!-- Acciones -->
          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef class="col-actions"> Acciones </th>
            <td mat-cell *matCellDef="let element" class="col-actions">
              <button mat-icon-button type="button"
                      matTooltip="Descargar Excel de este candidato"
                      (click)="emitRowDownload(element)">
                <mat-icon>file_download</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
        <mat-paginator [pageSizeOptions]="[5, 10, 25]" showFirstLastButtons aria-label="Select page of candidates"></mat-paginator>
      </div>
    } @else {
      <app-empty-state
        icon="check_circle"
        title="Todo al día"
        description="Todos los candidatos en este rango tienen celular confirmado.">
      </app-empty-state>
    }
    `,
    styles: [`
    .table-container {
      width: 100%;
      overflow-x: auto;
    }
    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.25rem 1rem;
      gap: 1rem;
    }
    .counter {
      font-size: 0.8rem;
      color: #64748b;
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
    .col-actions { width: 80px; text-align: right; }
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
    @Output() bulkDownload = new EventEmitter<string[]>();
    @Output() rowDownload = new EventEmitter<string>();

    @ViewChild(MatPaginator) paginator!: MatPaginator;

    displayedColumns: string[] = ['nombre', 'oficina', 'status', 'acciones'];
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

    emitBulkDownload(): void {
        const docs = this.dataSource.data
            .map(c => String(c.numero_documento || '').trim())
            .filter(Boolean);
        this.bulkDownload.emit(docs);
    }

    emitRowDownload(element: CandidatoSinCelular): void {
        const doc = String(element?.numero_documento || '').trim();
        if (!doc) return;
        this.rowDownload.emit(doc);
    }
}
