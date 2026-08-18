import {
  ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, computed, inject, signal,
} from '@angular/core';
import { CommonModule, formatCurrency, formatNumber } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

import { FormAnalyticsService } from '../../services/form-analytics.service';
import { DynamicFormService } from '../../services/dynamic-form.service';
import {
  ApiProblem, DailyPoint, FieldStats, FormAnalytics, FormDetail,
} from '../../models/dynamic-forms.models';

/** Color de marca (var(--navy)); echarts pinta en canvas y no resuelve variables CSS. */
const NAVY = '#21263C';
/** Gris para la barra agregada "Otros" (fuera de la identidad de marca a propósito). */
const GRIS_OTROS = '#94a3b8';
/** Máximo de barras individuales por campo; el resto se agrupa en "Otros". */
const TOP_BARRAS = 12;
/** Por encima de este span (días) no se rellenan los días sin respuestas. */
const MAX_DIAS_RELLENO = 400;

/** Presentación de cada estado de by_status (etiqueta ES + icono + clase de color). */
const META_ESTADOS: Record<string, { etiqueta: string; icono: string; clase: string; orden: number }> = {
  SUBMITTED: { etiqueta: 'Enviadas',   icono: 'send',         clase: 'kpi--enviadas',   orden: 1 },
  APPROVED:  { etiqueta: 'Aprobadas',  icono: 'check_circle', clase: 'kpi--aprobadas',  orden: 2 },
  REJECTED:  { etiqueta: 'Rechazadas', icono: 'cancel',       clase: 'kpi--rechazadas', orden: 3 },
  DRAFT:     { etiqueta: 'Borradores', icono: 'edit_note',    clase: 'kpi--borradores', orden: 4 },
};

interface KpiEstado {
  estado: string;
  etiqueta: string;
  icono: string;
  clase: string;
  total: number;
  orden: number;
}

interface FilaDistribucion {
  label: string;
  total: number;
}

/** Gráfica de barras de un campo con distribución + sus filas para la tabla accesible. */
interface CampoDistribucion {
  stat: FieldStats;
  option: EChartsOption;
  /** Alto del canvas en px (depende del número de barras). */
  alto: number;
  filas: FilaDistribucion[];
}

/**
 * Analítica de un formulario dinámico (ruta :formId/analitica).
 *
 * Solo lectura: KPIs por estado, serie diaria de respuestas y distribución por campo,
 * todo calculado por el backend (GET /forms/{id}/analytics). El filtro de fechas
 * re-consulta al servidor; no se tabula nada en el cliente salvo dar forma a las
 * opciones de echarts.
 */
@Component({
  selector: 'app-form-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts: () => import('echarts') })],
  templateUrl: './form-analytics.component.html',
  styleUrl: './form-analytics.component.css',
})
export class FormAnalyticsComponent {
  private analyticsSvc = inject(FormAnalyticsService);
  private formSvc = inject(DynamicFormService);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);
  private locale = inject(LOCALE_ID);

  readonly formId = Number(this.route.snapshot.paramMap.get('formId'));

  // ── Estado de la vista ─────────────────────────────────────────────
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly datos = signal<FormAnalytics | null>(null);
  readonly formulario = signal<FormDetail | null>(null);

  // Filtro de rango: lo escrito en los inputs vs. lo realmente aplicado a la consulta.
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly filtroAplicado = signal<{ from?: string; to?: string } | null>(null);

  constructor() {
    if (!Number.isFinite(this.formId) || this.formId <= 0) {
      this.cargando.set(false);
      this.error.set('El identificador del formulario en la URL no es válido.');
      return;
    }
    // El nombre del formulario es contexto, no bloquea la analítica si falla.
    this.formSvc.get(this.formId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: f => this.formulario.set(f),
        error: () => { /* el título cae al fallback "Formulario #id" */ },
      });
    this.cargar();
  }

  // ── Carga ──────────────────────────────────────────────────────────

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.analyticsSvc.analytics(this.formId, this.filtroAplicado() ?? {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.datos.set(data);
          this.cargando.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(this.mensajeError(err));
          this.cargando.set(false);
        },
      });
  }

  aplicarFiltro(): void {
    const from = this.desde() || undefined;
    const to = this.hasta() || undefined;
    if (from && to && from > to) {
      this.snack.open('Rango inválido: "Desde" no puede ser posterior a "Hasta".', 'Cerrar', { duration: 4000 });
      return;
    }
    this.filtroAplicado.set(from || to ? { from, to } : null);
    this.cargar();
  }

  limpiarFiltro(): void {
    this.desde.set('');
    this.hasta.set('');
    this.filtroAplicado.set(null);
    this.cargar();
  }

  private mensajeError(err: HttpErrorResponse): string {
    const problema = err.error as ApiProblem | null;
    if (problema && typeof problema.detail === 'string' && problema.detail.trim()) {
      return problema.detail;
    }
    return 'No se pudo cargar la analítica del formulario. Verifica tu conexión e intenta de nuevo.';
  }

  // ── KPIs ───────────────────────────────────────────────────────────

  readonly kpisEstado = computed<KpiEstado[]>(() => {
    const data = this.datos();
    if (!data) return [];
    return Object.entries(data.by_status ?? {})
      .map(([estado, total]) => {
        const meta = META_ESTADOS[estado];
        return {
          estado,
          etiqueta: meta?.etiqueta ?? estado,
          icono: meta?.icono ?? 'help',
          clase: meta?.clase ?? 'kpi--otro',
          total,
          orden: meta?.orden ?? 99,
        };
      })
      .sort((a, b) => a.orden - b.orden || a.estado.localeCompare(b.estado));
  });

  // ── Serie diaria ───────────────────────────────────────────────────

  /** Puntos crudos ordenados (para la tabla accesible bajo la gráfica). */
  readonly tablaDiaria = computed<DailyPoint[]>(() => {
    const diaria = this.datos()?.daily ?? [];
    return [...diaria].sort((a, b) => a.date.localeCompare(b.date));
  });

  readonly opcionDiaria = computed<EChartsOption | null>(() => {
    const crudos = this.tablaDiaria();
    if (crudos.length === 0) return null;
    const puntos = this.rellenarDias(crudos);
    const conAnio = puntos[0].date.slice(0, 4) !== puntos[puntos.length - 1].date.slice(0, 4);
    const unPunto = puntos.length <= 1;
    return {
      tooltip: { trigger: 'axis', confine: true },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: puntos.map(p => this.etiquetaDia(p.date, conAnio)),
        axisLabel: { color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: '#d8e0ea' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      series: [{
        name: 'Respuestas',
        type: 'line',
        smooth: true,
        showSymbol: unPunto,
        symbolSize: 7,
        data: puntos.map(p => p.total),
        lineStyle: { width: 2, color: NAVY },
        itemStyle: { color: NAVY },
        // Área suave bajo la línea (degradado del navy hacia transparente).
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(33, 38, 60, 0.16)' },
              { offset: 1, color: 'rgba(33, 38, 60, 0)' },
            ],
          },
        },
      }],
    };
  });

  /**
   * Rellena con 0 los días sin respuestas entre el primero y el último punto,
   * para que la línea no "una" fechas lejanas como si fueran contiguas.
   * En rangos enormes (> MAX_DIAS_RELLENO días) se deja la serie tal cual.
   */
  private rellenarDias(orden: DailyPoint[]): DailyPoint[] {
    if (orden.length <= 1) return orden;
    const validos = orden.filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.date));
    if (validos.length <= 1) return orden;
    const porDia = new Map(validos.map(p => [p.date, p.total]));
    const inicio = new Date(`${validos[0].date}T00:00:00`);
    const fin = new Date(`${validos[validos.length - 1].date}T00:00:00`);
    const span = Math.round((fin.getTime() - inicio.getTime()) / 86_400_000);
    if (span <= 0 || span > MAX_DIAS_RELLENO) return validos;
    const res: DailyPoint[] = [];
    for (const d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      res.push({ date: iso, total: porDia.get(iso) ?? 0 });
    }
    return res;
  }

  private etiquetaDia(iso: string, conAnio: boolean): string {
    const fecha = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString('es-CO', conAnio
      ? { day: '2-digit', month: 'short', year: '2-digit' }
      : { day: '2-digit', month: 'short' });
  }

  /** Fecha completa es-CO para la tabla de datos. */
  fechaLarga(iso: string): string {
    const fecha = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  // ── Distribución por campo ─────────────────────────────────────────

  readonly camposConDistribucion = computed<CampoDistribucion[]>(() => {
    const data = this.datos();
    if (!data) return [];
    return (data.fields ?? [])
      .filter(f => f.distribution && Object.keys(f.distribution).length > 0)
      .map(f => this.construirBarras(f));
  });

  private construirBarras(stat: FieldStats): CampoDistribucion {
    const entradas: FilaDistribucion[] = Object.entries(stat.distribution ?? {})
      .map(([label, total]) => ({ label: label.trim() || '—', total }))
      .sort((a, b) => b.total - a.total);

    const filas = entradas.slice(0, TOP_BARRAS);
    const resto = entradas.slice(TOP_BARRAS);
    if (resto.length > 0) {
      filas.push({
        label: `Otros (${resto.length})`,
        total: resto.reduce((suma, e) => suma + e.total, 0),
      });
    }

    const valores = filas.map((fila, i) => {
      const esOtros = resto.length > 0 && i === filas.length - 1;
      return {
        value: fila.total,
        itemStyle: {
          color: esOtros ? GRIS_OTROS : NAVY,
          borderRadius: [0, 4, 4, 0],
        },
      };
    });

    const option: EChartsOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true },
      grid: { left: 8, right: 44, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      yAxis: {
        type: 'category',
        inverse: true, // mayor conteo arriba
        data: filas.map(f => f.label),
        axisLabel: { color: '#334155', fontSize: 11, width: 140, overflow: 'truncate' },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [{
        name: stat.label,
        type: 'bar',
        data: valores,
        barMaxWidth: 18,
        label: { show: true, position: 'right', color: '#475569', fontSize: 11 },
      }],
    };

    return {
      stat,
      option,
      alto: Math.max(190, filas.length * 34 + 60),
      filas,
    };
  }

  // ── Campos numéricos sin distribución ──────────────────────────────

  readonly camposNumericos = computed<FieldStats[]>(() => {
    const data = this.datos();
    if (!data) return [];
    return (data.fields ?? []).filter(f =>
      (!f.distribution || Object.keys(f.distribution).length === 0)
      && (f.avg != null || f.min != null || f.max != null));
  });

  /** Formatea avg/min/max en es-CO; CURRENCY en pesos, el resto como número. */
  formatearValor(stat: FieldStats, valor: number | null | undefined): string {
    if (valor == null) return '—';
    return stat.type === 'CURRENCY'
      ? formatCurrency(valor, this.locale, '$', 'COP', '1.0-0')
      : formatNumber(valor, this.locale, '1.0-2');
  }
}
