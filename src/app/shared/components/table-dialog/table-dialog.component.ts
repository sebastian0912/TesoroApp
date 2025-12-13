import { Component, Inject, Input, Optional, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

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
}

@Component({
  selector: 'app-table-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    StandardFilterTable,
  ],
  templateUrl: './table-dialog.component.html',
  styleUrl: './table-dialog.component.css',
})
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

  get isDialog(): boolean {
    return !!this.dialogRef;
  }

  constructor(
    @Optional() private dialogRef: MatDialogRef<TableDialogComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) data?: TableDialogData
  ) {
    if (data) {
      if (data.title != null) this.title = data.title;
      if (data.rows) this.rows = data.rows;
      if (data.columns) this.columns = data.columns;
      if (data.pageSize != null) this.pageSize = data.pageSize;
      if (data.pageSizeOptions) this.pageSizeOptions = data.pageSizeOptions;
      if (data.tableTitle) this.tableTitle = data.tableTitle;
    }
  }

  close(): void {
    this.dialogRef?.close();
  }
}
