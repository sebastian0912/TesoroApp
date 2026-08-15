import {  Component, Inject, Input, Optional, Output, EventEmitter , ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';


import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  StandardFilterTable,
} from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '../../models/advanced-table-interface';

export interface TableDialogData {
  title?: string;
  rows?: any[];
  columns?: ColumnDefinition[];
  pageSize?: number;
  pageSizeOptions?: number[];
  tableTitle?: string; // título usado en exportaciones
  /**
   * Habilita el botón de borrar por fila. Lo pone quien abre el diálogo, con
   * TODA la lógica adentro (confirmación, llamado al backend); acá solo se
   * dibuja el botón y, si devuelve true, se saca la fila de la tabla.
   *
   * Sin este callback no se muestra ninguna acción: la tabla sigue de solo
   * lectura como en el resto de las pantallas que la usan.
   */
  onEliminar?: (row: any) => Promise<boolean>;
  /** Texto del tooltip del botón de borrar. */
  eliminarTooltip?: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-table-dialog',
  imports: [
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    StandardFilterTable
],
  templateUrl: './table-dialog.component.html',
  styleUrl: './table-dialog.component.css',
} )
export class TableDialogComponent {
  // Permite usar este componente tanto embebido (con @Input) como dentro de un MatDialog (vía MAT_DIALOG_DATA)
  @Input() title = 'Registros';
  @Input() rows: any[] = [];
  @Input() columns: ColumnDefinition[] = [];
  @Input() pageSize = 12;
  @Input() pageSizeOptions: number[] = [12, 24, 36];
  @Input() tableTitle?: string;

  // Reexpone el click de fila si alguna vez lo necesitas escuchar desde fuera
  @Output() rowClicked = new EventEmitter<any>();

  /** Callback de borrado por fila; si no viene, no se dibuja la columna. */
  onEliminar?: (row: any) => Promise<boolean>;
  eliminarTooltip = 'Eliminar este registro';
  /** Fila que está borrándose, para no dejar dar doble clic. */
  borrando: any = null;
  /** ¿Se borró algo? Se devuelve al cerrar para que el padre refresque. */
  private huboBorrados = false;

  get isDialog(): boolean {
    return !!this.dialogRef;
  }

  constructor(
    @Optional() private dialogRef: MatDialogRef<TableDialogComponent>,
    private cdr: ChangeDetectorRef,
    @Optional() @Inject(MAT_DIALOG_DATA) data?: TableDialogData
  ) {
    if (data) {
      if (data.title != null) this.title = data.title;
      if (data.rows) this.rows = data.rows;
      if (data.columns) this.columns = data.columns;
      if (data.pageSize != null) this.pageSize = data.pageSize;
      if (data.pageSizeOptions) this.pageSizeOptions = data.pageSizeOptions;
      if (data.tableTitle) this.tableTitle = data.tableTitle;
      if (data.eliminarTooltip) this.eliminarTooltip = data.eliminarTooltip;

      if (data.onEliminar) {
        this.onEliminar = data.onEliminar;
        // La columna 'actions' es la que la tabla conecta con #actionsTemplate.
        // Se agrega acá y no la pide el llamador para que no tenga que saber
        // ese detalle de `StandardFilterTable`.
        if (!this.columns.some(c => c.name === 'actions')) {
          // `type: 'custom'` porque `ColumnDefinition` no declara 'actions';
          // la tabla decide por el NOMBRE de la columna, no por el tipo
          // (`col.name === 'actions'` es lo que engancha #actionsTemplate).
          this.columns = [
            ...this.columns,
            { name: 'actions', header: '', type: 'custom', width: '64px', sortable: false, stickyEnd: true },
          ];
        }
      }
    }
  }

  async eliminar(row: any): Promise<void> {
    if (!this.onEliminar || this.borrando) return;
    this.borrando = row;
    try {
      if (await this.onEliminar(row)) {
        // Nueva referencia: el componente es OnPush y la tabla compara por
        // identidad para redibujar.
        this.rows = this.rows.filter(r => r !== row);
        this.huboBorrados = true;
      }
    } finally {
      this.borrando = null;
      this.cdr.markForCheck();
    }
  }

  close(): void {
    this.dialogRef?.close(this.huboBorrados);
  }
}
