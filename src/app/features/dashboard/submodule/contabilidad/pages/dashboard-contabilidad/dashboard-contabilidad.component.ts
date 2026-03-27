import { Component, OnInit, signal, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

import {
  ContabilidadService,
  DashboardStats,
  AnalisisNominaData,
} from '../../service/contabilidad.service';

@Component({
  selector: 'app-dashboard-contabilidad',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './dashboard-contabilidad.component.html',
  styleUrls: ['./dashboard-contabilidad.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardContabilidadComponent implements OnInit {
  private router = inject(Router);
  private service = inject(ContabilidadService);
  private cdr = inject(ChangeDetectorRef);

  loading = signal(true);
  stats = signal<DashboardStats | null>(null);
  analisis = signal<AnalisisNominaData | null>(null);
  hasData = signal(false);

  ngOnInit(): void {
    this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    this.loading.set(true);
    this.cdr.detectChanges();

    try {
      const [stats, analisis] = await Promise.all([
        this.service.getDashboardStats(),
        this.service.getAnalisisNomina(),
      ]);
      this.stats.set(stats);
      this.analisis.set(analisis);
      this.hasData.set(stats.total_registros > 0);
    } catch (err) {
      console.error('Error cargando dashboard:', err);
      this.hasData.set(false);
    } finally {
      this.loading.set(false);
      this.cdr.detectChanges();
    }
  }

  irACarga(): void {
    this.router.navigate(['/dashboard/contabilidad/carga']);
  }

  irAAnalisis(): void {
    this.router.navigate(['/dashboard/contabilidad/analisis-nomina']);
  }

  /* ─── Helpers para las gráficas CSS ─── */

  /** Barra como % del máximo */
  barWidth(value: number, items: any[]): number {
    const maxVal = Math.max(...items.map((i: any) =>
      i.debito || i.total || i.cantidad || i.salario_total || i.monto || 0
    ));
    return maxVal > 0 ? (value / maxVal) * 100 : 0;
  }

  formatCurrency(value: number): string {
    if (!value) return '$0';
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }

  formatNumber(value: number): string {
    return value?.toLocaleString('es-CO') || '0';
  }

  // Color por índice para gráficas
  chartColor(i: number): string {
    const colors = [
      '#1565c0', '#2e7d32', '#c62828', '#ef6c00', '#6a1b9a',
      '#00838f', '#ad1457', '#4527a0', '#2e7d32', '#ff6f00',
      '#1b5e20', '#880e4f',
    ];
    return colors[i % colors.length];
  }

  // Donut: calcular stroke-dasharray para SVG
  donutSegment(value: number, total: number, circumference: number): string {
    const pct = total > 0 ? (value / total) * circumference : 0;
    return `${pct} ${circumference - pct}`;
  }

  donutOffset(items: { cantidad: number }[], index: number, circumference: number): number {
    const total = items.reduce((s, i) => s + i.cantidad, 0);
    let offset = circumference * 0.25; // Start at top
    for (let i = 0; i < index; i++) {
      offset -= (items[i].cantidad / total) * circumference;
    }
    return offset;
  }

  totalDistribucion(): number {
    return this.analisis()?.distribucion_salarial?.reduce((s, d) => s + d.cantidad, 0) || 1;
  }

  // Colores para distribución salarial
  salaryColor(i: number): string {
    const c = ['#e3f2fd', '#90caf9', '#42a5f5', '#1e88e5', '#1565c0', '#0d47a1'];
    return c[i % c.length];
  }
}
