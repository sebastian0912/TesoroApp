import { Component, Input, ViewChild, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContratacionRow } from '../../models/afiliaciones-dashboard.models';

@Component({
  selector: 'app-contrataciones-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="table-container">
      <table mat-table [dataSource]="dataSource" matSort class="contrataciones-mat-table">

        <!-- Documento -->
        <ng-container matColumnDef="numero_documento">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Documento</th>
          <td mat-cell *matCellDef="let row">{{ row.numero_documento }}</td>
        </ng-container>

        <!-- Nombre Completo -->
        <ng-container matColumnDef="nombre_completo">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Nombre Completo</th>
          <td mat-cell *matCellDef="let row">{{ row.nombre_completo }}</td>
        </ng-container>

        <!-- Empresa -->
        <ng-container matColumnDef="empresa">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Empresa</th>
          <td mat-cell *matCellDef="let row">
            <span class="chip-empresa">{{ row.empresa }}</span>
          </td>
        </ng-container>

        <!-- Oficina -->
        <ng-container matColumnDef="oficina">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Oficina</th>
          <td mat-cell *matCellDef="let row">{{ row.oficina }}</td>
        </ng-container>

        <!-- Finca / Centro de costo -->
        <ng-container matColumnDef="finca">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Finca / CC</th>
          <td mat-cell *matCellDef="let row">{{ row.finca || row.centro_costo || '-' }}</td>
        </ng-container>

        <!-- Cargo -->
        <ng-container matColumnDef="cargo">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Cargo</th>
          <td mat-cell *matCellDef="let row">{{ row.cargo || '-' }}</td>
        </ng-container>

        <!-- Fecha Ingreso -->
        <ng-container matColumnDef="fecha_ingreso">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Fecha Ingreso</th>
          <td mat-cell *matCellDef="let row">
            {{ row.fecha_ingreso ? (row.fecha_ingreso | date:'dd/MM/yyyy') : '-' }}
          </td>
        </ng-container>

        <!-- Estado -->
        <ng-container matColumnDef="estado">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Estado</th>
          <td mat-cell *matCellDef="let row">
            <span class="estado-chip" [ngClass]="getEstadoClass(row.estado)">
              {{ row.estado }}
            </span>
          </td>
        </ng-container>

        <!-- Usuario Responsable -->
        <ng-container matColumnDef="usuario_responsable">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Responsable</th>
          <td mat-cell *matCellDef="let row">{{ row.usuario_responsable || '-' }}</td>
        </ng-container>

        <!-- Contratado -->
        <ng-container matColumnDef="contratado_at">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Contratado</th>
          <td mat-cell *matCellDef="let row">
            {{ row.contratado_at ? (row.contratado_at | date:'dd/MM/yyyy') : '-' }}
          </td>
        </ng-container>

        <!-- Exámenes Médicos -->
        <ng-container matColumnDef="examenes_medicos_at">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Ex. M\u00e9dicos</th>
          <td mat-cell *matCellDef="let row">
            {{ row.examenes_medicos_at ? (row.examenes_medicos_at | date:'dd/MM/yyyy') : '-' }}
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>

        <tr class="mat-row" *matNoDataRow>
          <td class="mat-cell no-data-cell" [attr.colspan]="displayedColumns.length">
            <div class="no-data">
              <mat-icon>search_off</mat-icon>
              <span>No se encontraron registros de contrataci\u00f3n para el rango seleccionado</span>
            </div>
          </td>
        </tr>
      </table>

      <mat-paginator [pageSizeOptions]="[25, 50, 100, 250]"
                     [pageSize]="50"
                     showFirstLastButtons>
      </mat-paginator>
    </div>
  `,
  styles: [`
    .table-container {
      overflow: auto;
      max-height: 600px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }

    .contrataciones-mat-table {
      width: 100%;
      min-width: 1200px;
    }

    th.mat-mdc-header-cell {
      background-color: #f8fafc;
      color: #475569;
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border-bottom: 2px solid #e2e8f0;
      padding: 0.75rem 1rem !important;
      white-space: nowrap;
    }

    td.mat-mdc-cell {
      padding: 0.6rem 1rem !important;
      font-size: 0.875rem;
      color: #334155;
      border-bottom: 1px solid #f1f5f9;
    }

    .table-row:hover {
      background-color: #f8fafc;
    }

    .chip-empresa {
      background-color: #eff6ff;
      color: #1d4ed8;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
    }

    .estado-chip {
      padding: 0.2rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .estado-ingreso { background: #d1fae5; color: #065f46; }
    .estado-contratado { background: #dbeafe; color: #1e40af; }
    .estado-examenes { background: #fef3c7; color: #92400e; }
    .estado-proceso { background: #e0e7ff; color: #3730a3; }
    .estado-entrevistado { background: #f3e8ff; color: #6b21a8; }
    .estado-pendiente { background: #ffedd5; color: #9a3412; }
    .estado-rechazado { background: #ffe4e6; color: #9f1239; }

    .no-data-cell { text-align: center; padding: 3rem 1rem !important; }
    .no-data {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: #94a3b8;
    }
    .no-data mat-icon { font-size: 48px; width: 48px; height: 48px; }

    ::ng-deep .mat-mdc-paginator {
      border-top: 1px solid #e2e8f0;
      background-color: #f8fafc;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContratacionesTableComponent implements OnChanges {
  @Input() data: ContratacionRow[] | null = [];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = [
    'numero_documento',
    'nombre_completo',
    'empresa',
    'oficina',
    'finca',
    'cargo',
    'fecha_ingreso',
    'estado',
    'usuario_responsable',
    'contratado_at',
    'examenes_medicos_at'
  ];

  dataSource = new MatTableDataSource<ContratacionRow>([]);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
      this.dataSource.data = this.data || [];
      if (this.paginator) this.dataSource.paginator = this.paginator;
      if (this.sort) this.dataSource.sort = this.sort;
    }
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      'Ingreso': 'estado-ingreso',
      'Contratado': 'estado-contratado',
      'Ex\u00e1menes M\u00e9dicos': 'estado-examenes',
      'En Proceso': 'estado-proceso',
      'Entrevistado': 'estado-entrevistado',
      'Pendiente': 'estado-pendiente',
      'Rechazado': 'estado-rechazado'
    };
    return map[estado] || 'estado-pendiente';
  }
}
