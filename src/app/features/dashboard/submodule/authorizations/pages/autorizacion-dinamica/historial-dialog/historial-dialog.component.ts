import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SharedModule } from '../../../../../../../shared/shared.module';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { HistorialService } from '../../../../history/service/historial/historial.service';

@Component({
  selector: 'app-historial-dialog',
  imports: [SharedModule, StandardFilterTable],
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .dialog-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      border-radius: 4px;
    }
    .dialog-header {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      padding: 24px 28px;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }
    .dialog-header mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .dialog-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }
    .dialog-header p {
      margin: 4px 0 0 0;
      font-size: 13px;
      opacity: 0.85;
    }
    .dialog-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
    }
    .dialog-footer {
      padding: 12px 24px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      flex-shrink: 0;
      background: #fafafa;
    }
  `],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <mat-icon>history</mat-icon>
        <div>
          <h2>Historial de Autorizaciones</h2>
          <p>Documento: {{ data.numeroDocumento }}</p>
        </div>
      </div>

      <div class="dialog-body">
        <div *ngIf="loading" style="text-align: center; padding: 48px;">
          <mat-spinner diameter="40" style="margin: 0 auto;"></mat-spinner>
          <p style="margin-top: 12px; color: #64748b;">Cargando historial...</p>
        </div>
        <div *ngIf="!loading && dataList.length === 0" style="text-align: center; padding: 48px; color: #64748b;">
          <mat-icon style="font-size: 56px; width: 56px; height: 56px; color: #cbd5e1;">inbox</mat-icon>
          <p style="font-size: 16px; margin-top: 12px;">No se encontraron registros de transacciones.</p>
        </div>
        <app-standard-filter-table *ngIf="!loading && dataList.length > 0"
          [data]="dataList"
          [columnDefinitions]="columns"
          [tableTitle]="''"
          [enableRowClick]="false">
        </app-standard-filter-table>
      </div>

      <div class="dialog-footer">
        <button mat-flat-button mat-dialog-close color="primary" style="border-radius: 8px;">
          <mat-icon>close</mat-icon> CERRAR
        </button>
      </div>
    </div>
  `
})
export class HistorialDialogComponent implements OnInit {

  columns: ColumnDefinition[] = [
    { name: 'autorizacion_concepto', header: 'Concepto', type: 'text', filterable: true },
    { name: 'autorizacion_monto', header: 'Monto Aut.', type: 'text', filterable: true },
    { name: 'autorizacion_cuotas', header: 'Cuotas', type: 'number', filterable: true },
    { name: 'autorizado_por', header: 'Autorizado Por', type: 'text', filterable: true },
    { name: 'sede_autorizacion', header: 'Sede Aut.', type: 'text', filterable: true },
    { name: 'autorizado_en', header: 'Fecha Aut.', type: 'date', filterable: true },
    { name: 'estado', header: 'Estado', type: 'text', filterable: true },
    { name: 'ejecucion_concepto', header: 'Concepto Ejec.', type: 'text', filterable: true },
    { name: 'ejecucion_monto', header: 'Monto Ejec.', type: 'text', filterable: true },
    { name: 'ejecutado_por', header: 'Ejecutado Por', type: 'text', filterable: true },
    { name: 'sede_ejecucion', header: 'Sede Ejec.', type: 'text', filterable: true },
    { name: 'ejecutado_en', header: 'Fecha Ejec.', type: 'date', filterable: true },
    { name: 'codigo_ejecucion', header: 'Cód. Ejec.', type: 'text', filterable: true }
  ];

  dataList: any[] = [];
  loading = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { numeroDocumento: string },
    private dialogRef: MatDialogRef<HistorialDialogComponent>,
    private historialService: HistorialService
  ) { }

  ngOnInit(): void {
    this.historialService.getHistorialTransaccionesPorDocumento(this.data.numeroDocumento).subscribe(
      (res: any) => {
        const rawList = Array.isArray(res) ? res : (res.results || res.data || []);
        rawList.sort((a: any, b: any) => {
          const dateA = new Date(a.autorizado_en || a.created_at || 0).getTime();
          const dateB = new Date(b.autorizado_en || b.created_at || 0).getTime();
          return dateB - dateA;
        });
        this.dataList = rawList.map((item: any) => ({
          ...item,
          autorizacion_monto: this.fmt(item.autorizacion_monto),
          ejecucion_monto: item.ejecucion_monto ? this.fmt(item.ejecucion_monto) : ''
        }));
        this.loading = false;
      },
      () => {
        this.loading = false;
      }
    );
  }

  private fmt(value: any): string {
    if (value === null || value === undefined || value === '') return '';
    return Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }
}
