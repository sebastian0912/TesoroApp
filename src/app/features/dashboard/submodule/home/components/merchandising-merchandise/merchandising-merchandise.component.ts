import {  Component, OnInit, inject , ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ComercializadoraService } from '../../../merchandise/service/comercializadora/comercializadora.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-merchandising-merchandise',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './merchandising-merchandise.component.html',
  styleUrl: './merchandising-merchandise.component.css'
} )
export class MerchandisingMerchandiseComponent implements OnInit {
  private comercializadoraService = inject(ComercializadoraService);
  private utilityService = inject(UtilityServiceService);

  loading = false;

  // Tabla detallada (por lote)
  dataSourceDetallado = new MatTableDataSource<any>();
  displayedColumnsDetallado: string[] = [
    'producto_nombre', 'destino', 'codigo', 'cantidad_inicial',
    'cantidad_vendida', 'disponible', 'valor_unitario',
    'fecha_recepcion', 'realizado_por'
  ];

  // Tabla resumen (agrupada por producto)
  dataSourceResumen = new MatTableDataSource<any>();
  displayedColumnsResumen: string[] = [
    'producto_nombre', 'destino', 'total_recibido', 'total_vendido',
    'total_disponible', 'valor_unitario', 'valor_total'
  ];

  // Métricas
  totalLotes = 0;
  totalDisponible = 0;
  totalValorInventario = 0;

  ngOnInit(): void {
    this.cargarInventario();
  }

  async cargarInventario() {
    this.loading = true;
    try {
      // User's sede is no longer used for filtering to display global inventory on Home
      const data: any = await this.comercializadoraService.listarInventarioLotes('');
      const lotes = Array.isArray(data) ? data : (data?.results || []);

      // Tabla detallada
      this.dataSourceDetallado.data = lotes;

      // Tabla resumen (agrupada por producto_nombre)
      this.dataSourceResumen.data = this.agruparPorProducto(lotes);

      // Métricas
      this.totalLotes = lotes.length;
      this.totalDisponible = lotes.reduce((sum: number, l: any) => sum + (l.disponible || 0), 0);
      this.totalValorInventario = lotes.reduce(
        (sum: number, l: any) => sum + ((l.disponible || 0) * Number(l.valor_unitario || 0)), 0
      );
    } catch (error) {
      console.error('Error cargando inventario:', error);
      this.dataSourceDetallado.data = [];
      this.dataSourceResumen.data = [];
    } finally {
      this.loading = false;
    }
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSourceDetallado.filter = filterValue;
    this.dataSourceResumen.filter = filterValue;
  }

  private agruparPorProducto(lotes: any[]): any[] {
    const agrupado: Record<string, any> = {};

    for (const lote of lotes) {
      const key = `${lote.producto_nombre}-${lote.valor_unitario}-${lote.destino}`;
      if (!agrupado[key]) {
        agrupado[key] = {
          producto_nombre: lote.producto_nombre,
          destino: lote.destino,
          valor_unitario: Number(lote.valor_unitario || 0),
          total_recibido: 0,
          total_vendido: 0,
          total_disponible: 0,
          valor_total: 0,
        };
      }
      agrupado[key].total_recibido += (lote.cantidad_inicial || 0);
      agrupado[key].total_vendido += (lote.cantidad_vendida || 0);
      agrupado[key].total_disponible += (lote.disponible || 0);
    }

    const resultado = Object.values(agrupado);
    resultado.forEach((r: any) => {
      r.valor_total = r.total_disponible * r.valor_unitario;
    });

    resultado.sort((a: any, b: any) => a.producto_nombre.localeCompare(b.producto_nombre));
    return resultado;
  }

  formatCurrency(value: any): string {
    const n = Number(value || 0);
    return n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }
}
