import { ColumnConfig } from './../../models/advanced-table-interface';
import { Component, Inject, Input, ViewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Output, EventEmitter } from '@angular/core';
import { SharedModule } from '../../shared.module';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-tabla',
  imports: [
    SharedModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    FormsModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './tabla.component.html',
  styleUrl: './tabla.component.css'
})
export class TablaComponent {
    /* -------- INPUTS -------- */
  @Input() dataSource!: MatTableDataSource<any>;
  @Input() columns!: ColumnConfig[];
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();

  /* -------- COLUMNAS PARA LA PLANTILLA -------- */
  displayedColumns: string[] = [];
  displayedFilterColumns: string[] = [];

  filters: Record<string, any> = {};

  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort!: MatSort;

  constructor(@Inject(MAT_DIALOG_DATA) public dialogData: any) {}

  onEdit(row: any) { this.edit.emit(row); }
  onDelete(row: any) { this.delete.emit(row); }

  ngOnInit(): void {
    // Soporta uso como dialog o como componente con @Input
    if (this.dialogData) {
      this.columns = this.dialogData.columns;
      this.dataSource = new MatTableDataSource(this.dialogData.dataSource);
    }

    // Validación defensiva para evitar undefined
    if (!this.columns || !Array.isArray(this.columns)) {
      throw new Error('TablaComponent: Falta columns (configuración de columnas).');
    }
    if (!this.dataSource) {
      throw new Error('TablaComponent: Falta dataSource.');
    }

    this.displayedColumns = this.columns.map(c => c.columnDef).concat('actions');
    this.displayedFilterColumns = this.columns.map(c => c.columnDef + '_filter').concat('actions_filter');
    this.dataSource.filterPredicate = this.buildFilterPredicate();
  }

  ngAfterViewInit(): void {
    // Solo setea si existen los elementos
    if (this.dataSource) {
      if (this.paginator) this.dataSource.paginator = this.paginator;
      if (this.sort) this.dataSource.sort = this.sort;
    }
  }

  /** Filtrado custom para cada columna */
  private buildFilterPredicate() {
    return (row: any, rawFilter: string): boolean => {
      if (!rawFilter) return true;
      const activeFilters: Record<string, any> = JSON.parse(rawFilter);
      return this.columns.every(col => {
        const filterValue = activeFilters[col.columnDef];
        if (filterValue === undefined || filterValue === '' || filterValue === null) return true;
        const cellRaw = col.cellFn ? col.cellFn(row) : row[col.columnDef];
        if (cellRaw === undefined || cellRaw === null) return false;
        switch (col.type) {
          case 'select':
            return cellRaw.toString() === filterValue.toString();
          case 'date': {
            const cellDate = new Date(cellRaw);
            const filterDate = new Date(filterValue);
            return cellDate.toDateString() === filterDate.toDateString();
          }
          default:
            return cellRaw.toString().toLowerCase()
              .includes(filterValue.toString().toLowerCase());
        }
      });
    };
  }

  /** Se lanza cada vez que cambia un filtro individual. */
  applyFilter(): void {
    this.dataSource.filter = JSON.stringify(this.filters);
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /** Limpia todos los filtros y refresca la tabla. */
  resetFilters(): void {
    this.filters = {};
    this.applyFilter();
  }

  /** Exporta la tabla filtrada a Excel */
  exportFilteredToExcel(): void {
    const filteredData = this.dataSource.filteredData;
    if (!filteredData || filteredData.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }
    const headers = this.columns.map(col => col.header);
    const exportData = filteredData.map(row => {
      const obj: any = {};
      this.columns.forEach(col => {
        obj[col.header] = col.cellFn ? col.cellFn(row) : row[col.columnDef];
      });
      return obj;
    });
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData, { header: headers });
    const workbook: XLSX.WorkBook = { Sheets: { 'Datos Filtrados': worksheet }, SheetNames: ['Datos Filtrados'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    FileSaver.saveAs(blob, `exportacion-filtrada-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
}
