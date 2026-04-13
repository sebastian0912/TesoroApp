import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@/environments/environment';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, shareReplay, switchMap, catchError, startWith } from 'rxjs/operators';
import {
    MetricasDateRange, KpiSummary, ChartDataPoint, ChartSeriesPoint, TopProductoChart,
    MetricasResumen, HistorialItem, TopComprador, RankingAutorizador, ProductoFecha
} from '../models/tesoreria-metricas.models';
import * as _moment from 'moment';
// @ts-ignore
const moment = _moment.default || _moment;

@Injectable({
    providedIn: 'root'
})
export class TesoreriaMetricasApiService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/gestion_tesoreria`;

    // State - default: semana actual (lunes a hoy)
    private dateRangeSubject = new BehaviorSubject<MetricasDateRange>({
        start: moment().startOf('isoWeek').toDate(),
        end: moment().toDate()
    });

    // Expose state pattern
    public dateRange$ = this.dateRangeSubject.asObservable();

    // Core Data Streams (Aggregating frontend-side)
    // Bring transactions dynamically reacting to date limits
    public transacciones$ = this.dateRange$.pipe(
        switchMap(range => {
            const start = moment(range.start).format('YYYY-MM-DD');
            const end = moment(range.end).format('YYYY-MM-DD');

            let params = new HttpParams()
                .set('created_at__gte', start)
                .set('created_at__lte', end)
                .set('limit', '1000');

            return this.http.get<any>(`${this.apiUrl}/transacciones/`, { params }).pipe(
                map(res => res.results || []),
                catchError(() => of([]))
            );
        }),
        shareReplay(1)
    );

    public personasSaldos$ = this.dateRange$.pipe(
        switchMap(() => {
            let params = new HttpParams()
                .set('limit', '1000')
                .set('ordering', '-saldo_pendiente');

            return this.http.get<any>(`${this.apiUrl}/personas/`, { params }).pipe(
                map(res => res.results || []),
                catchError(() => of([]))
            );
        }),
        shareReplay(1)
    );

    // ============================================================
    // NUEVO: Métricas agregadas server-side (una sola llamada)
    // ============================================================
    public metricasResumen$: Observable<MetricasResumen> = this.dateRange$.pipe(
        switchMap(range => {
            const start = moment(range.start).format('YYYY-MM-DD');
            const end = moment(range.end).format('YYYY-MM-DD');

            let params = new HttpParams()
                .set('fecha_inicio', start)
                .set('fecha_fin', end);

            return this.http.get<MetricasResumen>(`${this.apiUrl}/metricas-resumen/`, { params }).pipe(
                catchError(() => of({
                    historial: [],
                    top_compradores: [],
                    ranking_autorizadores: [],
                    productos_por_fecha: [],
                } as MetricasResumen))
            );
        }),
        shareReplay(1)
    );

    // Selectores derivados del resumen
    public historial$: Observable<HistorialItem[]> = this.metricasResumen$.pipe(
        map(r => r.historial)
    );

    public topCompradores$: Observable<TopComprador[]> = this.metricasResumen$.pipe(
        map(r => r.top_compradores)
    );

    public rankingAutorizadores$: Observable<RankingAutorizador[]> = this.metricasResumen$.pipe(
        map(r => r.ranking_autorizadores)
    );

    public productosPorFecha$: Observable<ProductoFecha[]> = this.metricasResumen$.pipe(
        map(r => r.productos_por_fecha)
    );

    // Derived Selectors (View Models para la UI)

    public kpiSummary$: Observable<KpiSummary> = combineLatest([
        this.transacciones$,
        this.personasSaldos$
    ]).pipe(
        map(([txs, personas]) => {
            const saldosPendientes = personas.reduce((acc: number, p: any) => acc + (Number(p.saldo_pendiente) || 0), 0);

            let transaccionesEjecutadasCount = 0;
            let transaccionesEjecutadasMonto = 0;
            let transaccionesPendientesMonto = 0;
            let transaccionesAutorizadasMonto = 0;

            txs.forEach((tx: any) => {
                if (tx.estado === 'EJECUTADA') {
                    // Dinero real que salio
                    transaccionesEjecutadasCount++;
                    transaccionesEjecutadasMonto += Number(tx.ejecucion_monto) || 0;
                } else if (tx.estado === 'PENDIENTE') {
                    // Autorizado pero NO ejecutado - aun no es valor real
                    transaccionesPendientesMonto += Number(tx.autorizacion_monto) || 0;
                } else if (tx.estado === 'ANULADA') {
                    // Monto de transacciones canceladas
                    transaccionesAutorizadasMonto += Number(tx.autorizacion_monto) || 0;
                }
            });

            return {
                saldosPendientes,
                transaccionesEjecutadasCount,
                transaccionesEjecutadasMonto,
                transaccionesPendientesMonto,
                transaccionesAutorizadasMonto
            };
        }),
        startWith({
            saldosPendientes: 0, transaccionesEjecutadasMonto: 0, transaccionesEjecutadasCount: 0, transaccionesPendientesMonto: 0, transaccionesAutorizadasMonto: 0
        })
    );

    public updateDateRange(start: Date, end: Date): void {
        this.dateRangeSubject.next({ start, end });
    }

    // A) Transacciones: Funnel Status
    public funnelChartData$: Observable<ChartDataPoint[]> = this.transacciones$.pipe(
        map(txs => {
            const states: Record<string, number> = { 'PENDIENTE': 0, 'EJECUTADA': 0, 'ANULADA': 0 };
            txs.forEach((tx: any) => {
                if (states[tx.estado] !== undefined) states[tx.estado]++;
                else states[tx.estado] = (states[tx.estado] || 0) + 1;
            });
            return Object.keys(states).map(k => ({ name: k, value: states[k] }));
        })
    );
}
