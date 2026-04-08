import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@/environments/environment';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, shareReplay, switchMap, catchError, startWith } from 'rxjs/operators';
import { MetricasDateRange, KpiSummary, ChartDataPoint, ChartSeriesPoint, TopProductoChart } from '../models/tesoreria-metricas.models';
import * as _moment from 'moment';
// @ts-ignore
const moment = _moment.default || _moment;

@Injectable({
    providedIn: 'root'
})
export class TesoreriaMetricasApiService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/gestion_tesoreria`;

    // State
    private dateRangeSubject = new BehaviorSubject<MetricasDateRange>({
        start: moment().subtract(30, 'days').toDate(),
        end: moment().toDate()
    });

    // Expose state pattern
    public dateRange$ = this.dateRangeSubject.asObservable();

    // Core Data Streams (Aggregating frontend-side)
    // Bring transactions dynamically reacting to date limits
    public transacciones$ = this.dateRange$.pipe(
        switchMap(range => {
            // Formatear fechas a YYYY-MM-DD para el backend
            const start = moment(range.start).format('YYYY-MM-DD');
            const end = moment(range.end).format('YYYY-MM-DD');

            let params = new HttpParams()
                .set('created_at__gte', start)
                .set('created_at__lte', end)
                .set('limit', '1000'); // Tratar de traer suficentes para el métricas

            return this.http.get<any>(`${this.apiUrl}/transacciones/`, { params }).pipe(
                map(res => res.results || []),
                catchError(() => of([]))
            );
        }),
        shareReplay(1)
    );

    public personasSaldos$ = this.dateRange$.pipe(
        switchMap(() => {
            // Traer personas para saldos. Esto no es dependiente del rango normalmente
            // pero reaccionamos al mismo ciclo de refresco (o podríamos ignorar el rango real aquí).
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
                const val = Number(tx.valor) || 0;
                if (tx.estado === 'EJECUTADA') {
                    transaccionesEjecutadasCount++;
                    transaccionesEjecutadasMonto += val;
                } else if (tx.estado === 'SOLICITADA' || tx.estado === 'PENDIENTE') {
                    transaccionesPendientesMonto += val;
                } else if (tx.estado === 'AUTORIZADA') {
                    transaccionesAutorizadasMonto += val;
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
            const states: Record<string, number> = { 'AUTORIZADA': 0, 'EJECUTADA': 0, 'SOLICITADA': 0, 'RECHAZADA': 0 };
            txs.forEach((tx: any) => {
                if (states[tx.estado] !== undefined) states[tx.estado]++;
                else states[tx.estado] = 1;
            });
            return Object.keys(states).map(k => ({ name: k, value: states[k] }));
        })
    );

    // A) Transacciones: Serie temporal Ejecutadas vs Autorizadas
    // B) Personas: Top Saldo Pendiente 
    // etc...
}
