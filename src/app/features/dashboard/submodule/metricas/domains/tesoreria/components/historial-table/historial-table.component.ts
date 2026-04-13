import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { HistorialItem } from '../../models/tesoreria-metricas.models';

@Component({
    selector: 'app-historial-table',
    standalone: true,
    imports: [CommonModule, MatIconModule, EmptyStateComponent],
    template: `
    @if (hasData) {
      <div class="table-wrapper">
        <table class="hist-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Nombre</th>
              <th>Finca</th>
              <th>Fecha Ejecucion</th>
              <th>Concepto</th>
              <th class="right">Monto</th>
              <th>Estado</th>
              <th>Autorizo</th>
              <th>Ejecuto</th>
              <th>Entrego</th>
              <th>Productos</th>
            </tr>
          </thead>
          <tbody>
            @for (row of displayRows; track row.numero_documento + row.fecha_ejecucion) {
              <tr>
                <td class="mono">{{ row.numero_documento }}</td>
                <td>{{ row.nombre }}</td>
                <td>{{ row.finca || '-' }}</td>
                <td class="mono">{{ row.fecha_ejecucion || row.fecha_autorizacion }}</td>
                <td><span class="badge" [class]="conceptoClass(row.concepto)">{{ row.concepto }}</span></td>
                <td class="right mono">{{ formatCurrency(row.monto) }}</td>
                <td><span class="estado-dot" [class]="estadoClass(row.estado)"></span>{{ row.estado }}</td>
                <td>{{ row.autorizado_por || '-' }}</td>
                <td>{{ row.ejecutado_por || '-' }}</td>
                <td>{{ row.quien_entrego || '-' }}</td>
                <td>
                  @if (row.productos && row.productos.length) {
                    @for (p of row.productos; track p.producto) {
                      <span class="prod-tag">{{ p.producto }} x{{ p.cantidad }}</span>
                    }
                  } @else { <span class="text-muted">-</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <app-empty-state icon="history" title="Sin Historial" description="No hay transacciones en el rango seleccionado."></app-empty-state>
    }
    `,
    styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .table-wrapper { overflow-x: auto; max-height: 420px; overflow-y: auto; }
    .hist-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8rem; }
    .hist-table thead { position: sticky; top: 0; z-index: 2; }
    .hist-table th { background: #f8fafc; color: #475569; font-weight: 600; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; padding: 0.75rem 0.625rem; border-bottom: 2px solid #e2e8f0; white-space: nowrap; text-align: left; }
    .hist-table td { padding: 0.625rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
    .hist-table tbody tr:hover { background: #f8fafc; }
    .right { text-align: right; }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    .badge-mercado { background: #dbeafe; color: #1d4ed8; }
    .badge-prestamo { background: #fef3c7; color: #92400e; }
    .badge-default { background: #f1f5f9; color: #475569; }
    .estado-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
    .estado-ejecutada { background: #10b981; }
    .estado-pendiente { background: #f59e0b; }
    .estado-anulada { background: #ef4444; }
    .prod-tag { display: inline-block; background: #ede9fe; color: #6d28d9; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.65rem; margin: 1px 2px; font-weight: 500; }
    .text-muted { color: #94a3b8; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistorialTableComponent implements OnChanges {
    @Input() data: HistorialItem[] | null = null;
    hasData = false;
    displayRows: HistorialItem[] = [];
    private currencyPipe = new CurrencyPipe('es-CO');

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['data']) {
            this.displayRows = this.data || [];
            this.hasData = this.displayRows.length > 0;
        }
    }

    formatCurrency(val: number): string {
        return this.currencyPipe.transform(val, 'COP', 'symbol-narrow', '1.0-0') || '$0';
    }

    conceptoClass(concepto: string): string {
        const c = (concepto || '').toLowerCase();
        if (c.includes('mercado')) return 'badge badge-mercado';
        if (c.includes('prestamo')) return 'badge badge-prestamo';
        return 'badge badge-default';
    }

    estadoClass(estado: string): string {
        switch (estado) {
            case 'EJECUTADA': return 'estado-dot estado-ejecutada';
            case 'PENDIENTE': return 'estado-dot estado-pendiente';
            case 'ANULADA': return 'estado-dot estado-anulada';
            default: return 'estado-dot';
        }
    }
}
