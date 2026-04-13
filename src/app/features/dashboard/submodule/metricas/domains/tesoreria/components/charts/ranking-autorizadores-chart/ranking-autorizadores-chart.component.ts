import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { RankingAutorizador } from '../../../models/tesoreria-metricas.models';

@Component({
    selector: 'app-ranking-autorizadores-chart',
    standalone: true,
    imports: [CommonModule, MatIconModule, EmptyStateComponent],
    template: `
    @if (hasData) {
      <div class="ranking-container">
        <div class="ranking-header">
          <span class="rk-col rk-pos">#</span>
          <span class="rk-col rk-name">Autorizador</span>
          <span class="rk-col rk-count">Total</span>
          <span class="rk-col rk-monto">Monto</span>
          <span class="rk-col rk-bar"></span>
        </div>
        @for (item of sortedData; track item.autorizado_por; let i = $index) {
          <div class="ranking-row" [class.top1]="i === 0" [class.top2]="i === 1" [class.top3]="i === 2" [class.last]="i === sortedData.length - 1">
            <span class="rk-col rk-pos">
              @if (i === 0) { <mat-icon class="medal gold">emoji_events</mat-icon> }
              @else if (i === 1) { <mat-icon class="medal silver">emoji_events</mat-icon> }
              @else if (i === 2) { <mat-icon class="medal bronze">emoji_events</mat-icon> }
              @else { <span class="pos-num">{{ i + 1 }}</span> }
            </span>
            <span class="rk-col rk-name">{{ item.autorizado_por }}</span>
            <span class="rk-col rk-count"><strong>{{ item.total_autorizaciones }}</strong></span>
            <span class="rk-col rk-monto mono">{{ formatCurrency(item.monto_total) }}</span>
            <span class="rk-col rk-bar">
              <div class="bar-bg"><div class="bar-fill" [style.width.%]="getBarPercent(item)"></div></div>
            </span>
          </div>
        }
        @if (leastAuthorizer) {
          <div class="least-section">
            <mat-icon class="least-icon">arrow_downward</mat-icon>
            <span class="least-label">Menos autoriza:</span>
            <strong>{{ leastAuthorizer.autorizado_por }}</strong>
            <span class="least-count">({{ leastAuthorizer.total_autorizaciones }} autorizaciones)</span>
          </div>
        }
      </div>
    } @else {
      <app-empty-state icon="admin_panel_settings" title="Sin Autorizadores" description="No hay datos de autorizaciones en este periodo."></app-empty-state>
    }
    `,
    styles: [`
    :host { display: block; width: 100%; height: 100%; overflow-y: auto; }
    .ranking-container { padding: 0.25rem 0; }
    .ranking-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; }
    .ranking-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
    .ranking-row:hover { background: #f8fafc; }
    .rk-col { flex-shrink: 0; }
    .rk-pos { width: 32px; text-align: center; }
    .rk-name { flex: 1; font-size: 0.85rem; color: #1e293b; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rk-count { width: 48px; text-align: center; font-size: 0.85rem; }
    .rk-monto { width: 100px; text-align: right; font-size: 0.78rem; color: #475569; }
    .rk-bar { width: 100px; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .pos-num { font-size: 0.8rem; font-weight: 600; color: #94a3b8; }
    .medal { font-size: 20px; width: 20px; height: 20px; }
    .gold { color: #f59e0b; }
    .silver { color: #94a3b8; }
    .bronze { color: #b45309; }
    .bar-bg { height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #60a5fa); border-radius: 3px; transition: width 0.4s ease; }
    .top1 { background: #fffbeb; }
    .last { border-bottom: none; }
    .least-section { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; padding: 0.75rem; background: #fef2f2; border-radius: 8px; font-size: 0.8rem; color: #991b1b; }
    .least-icon { font-size: 18px; width: 18px; height: 18px; color: #ef4444; }
    .least-label { color: #b91c1c; font-weight: 500; }
    .least-count { color: #dc2626; font-size: 0.75rem; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RankingAutorizadoresChartComponent implements OnChanges {
    @Input() data: RankingAutorizador[] | null = null;
    hasData = false;
    sortedData: RankingAutorizador[] = [];
    leastAuthorizer: RankingAutorizador | null = null;
    private maxCount = 1;
    private currencyPipe = new CurrencyPipe('es-CO');

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['data'] && this.data) {
            this.sortedData = [...this.data].sort((a, b) => b.total_autorizaciones - a.total_autorizaciones);
            this.hasData = this.sortedData.length > 0;
            if (this.hasData) {
                this.maxCount = this.sortedData[0].total_autorizaciones || 1;
                this.leastAuthorizer = this.sortedData[this.sortedData.length - 1];
                if (this.sortedData.length <= 1) this.leastAuthorizer = null;
            }
        }
    }

    getBarPercent(item: RankingAutorizador): number {
        return (item.total_autorizaciones / this.maxCount) * 100;
    }

    formatCurrency(val: number): string {
        return this.currencyPipe.transform(val, 'COP', 'symbol-narrow', '1.0-0') || '$0';
    }
}
