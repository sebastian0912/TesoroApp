import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@/environments/environment';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, shareReplay, switchMap, catchError, startWith } from 'rxjs/operators';
import * as _moment from 'moment';
// @ts-ignore
const moment = _moment.default || _moment;

import {
    MetricasContratacionDateRange,
    ContratacionKpiSummary,
    ChartDataPoint,
    CandidatoSinCelular,
    EmpresaFincaPivot,
    ChartSeriesPoint
} from '../models/contratacion-metricas.models';

@Injectable({
    providedIn: 'root'
})
export class ContratacionMetricasApiService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/gestion_contratacion`;

    // State
    private dateRangeSubject = new BehaviorSubject<MetricasContratacionDateRange>({
        start: moment().startOf('day').toDate(),
        end: moment().endOf('day').toDate()
    });

    public dateRange$ = this.dateRangeSubject.asObservable();

    // 1. Fetch raw lists
    // Candidatos (updated_at within range)
    private candidatosRaw$ = this.dateRange$.pipe(
        switchMap(range => {
            const start = moment(range.start).format('YYYY-MM-DD');
            const end = moment(range.end).format('YYYY-MM-DD');
            let params = new HttpParams()
                .set('updated_at__gte', start)
                .set('updated_at__lte', `${end} 23:59:59`)
                .set('limit', '1000');
            return this.http.get<any>(`${this.apiUrl}/candidatos/`, { params }).pipe(
                map(res => res.results || []),
                catchError(() => of([]))
            );
        }),
        shareReplay(1)
    );

    // Entrevistas
    // Usada para derivar "última oficina"
    // Lo traemos por fechas de creado y los cruzamos?
    // En este caso, trataremos de traer entrevistas limitadas o usar el endpoint si se escala N+1
    private entrevistasRaw$ = this.dateRange$.pipe(
        switchMap(range => {
            // Traemos las entrevistas en general o recientes para cruzar
            let params = new HttpParams().set('limit', '2000').set('ordering', '-created_at');
            return this.http.get<any>(`${this.apiUrl}/entrevistas/`, { params }).pipe(
                map(res => res.results || []),
                catchError(() => of([]))
            );
        }),
        shareReplay(1)
    );

    // Contactos (para correo y celular)
    private contactosRaw$ = this.dateRange$.pipe(
        switchMap(() => {
            let params = new HttpParams().set('limit', '2000').set('ordering', '-created_at');
            return this.http.get<any>(`${this.apiUrl}/contactos/`, { params }).pipe(
                map(res => res.results || []),
                catchError(() => of([]))
            );
        }),
        shareReplay(1)
    );

    // Procesos 
    private procesosRaw$ = this.dateRange$.pipe(
        switchMap(range => {
            const start = moment(range.start).format('YYYY-MM-DD');
            const end = moment(range.end).format('YYYY-MM-DD');
            // Idealmente esto debería filtrar por algun at del proceso para no traer toda la db
            // Pero como es un fallback de analiticas...
            let params = new HttpParams()
                .set('limit', '2000')
                .set('updated_at__gte', start)
                .set('updated_at__lte', `${end} 23:59:59`);
            return this.http.get<any>(`${this.apiUrl}/procesos/`, { params }).pipe(
                map(res => res.results || []),
                catchError(() => of([]))
            );
        }),
        shareReplay(1)
    );

    public updateDateRange(start: Date, end: Date): void {
        // Asegurar que el filtro from/to sea beginning of day y end of day timezone bugota
        this.dateRangeSubject.next({
            start: moment(start).startOf('day').toDate(),
            end: moment(end).endOf('day').toDate()
        });
    }

    // ----------------------------------------------------
    // AGREGACIONES COMPLEJAS FRONTEND (Fallback Analytics)
    // ----------------------------------------------------

    // Mapeo: Candidato ID -> Ultima Oficina de la Entrevista
    private oficinaPorCandidato$: Observable<Record<number, string>> = this.entrevistasRaw$.pipe(
        map(entrevistas => {
            const dict: Record<number, { date: Date, oficina: string }> = {};
            // Orden descendente en backend, pero doble verificacion
            entrevistas.forEach((ent: any) => {
                const candId = ent.candidato; // asumiendo int id
                if (!candId) return;
                const d = new Date(ent.created_at);
                if (!dict[candId] || dict[candId].date < d) {
                    dict[candId] = { date: d, oficina: ent.oficina || 'Sin Oficina' };
                }
            });

            const candToOficina: Record<number, string> = {};
            for (const [candId, data] of Object.entries(dict)) {
                candToOficina[Number(candId)] = data.oficina;
            }
            return candToOficina;
        }),
        shareReplay(1)
    );

    // KPIS base
    public kpiSummary$: Observable<ContratacionKpiSummary> = combineLatest([
        this.candidatosRaw$,
        this.contactosRaw$
    ]).pipe(
        map(([cands, contactos]) => {
            let totalLlenaron = cands.length;

            // map de contactos
            const candToContact: Record<number, any> = {};
            contactos.forEach((c: any) => candToContact[c.candidato] = c);

            let totalEmail = 0;
            let totalCelular = 0;

            cands.forEach((cand: any) => {
                const contact = candToContact[cand.id];
                if (contact) {
                    if (contact.email) totalEmail++;
                    if (contact.celular && /^\d+$/.test(contact.celular)) totalCelular++;
                }
            });

            return {
                totalCandidatos: totalLlenaron,
                totalLlenaronFormulario: totalLlenaron,
                totalConEmail: totalEmail,
                totalConCelular: totalCelular
            };
        }),
        startWith({ totalCandidatos: 0, totalLlenaronFormulario: 0, totalConEmail: 0, totalConCelular: 0 })
    );

    // Chart: Formularios por oficina
    public formulariosPorOficina$: Observable<ChartDataPoint[]> = combineLatest([
        this.candidatosRaw$,
        this.oficinaPorCandidato$
    ]).pipe(
        map(([cands, oficinaMap]) => {
            const counts: Record<string, number> = {};
            cands.forEach((c: any) => {
                const ofi = oficinaMap[c.id] || 'Sin Oficina (No Entrevistado)';
                counts[ofi] = (counts[ofi] || 0) + 1;
            });
            return Object.keys(counts).map(k => ({ name: k, value: counts[k] })).sort((a, b) => b.value - a.value);
        })
    );

    // Chart: Pipeline por oficina
    public pipelinePorOficina$: Observable<ChartSeriesPoint[]> = combineLatest([
        this.procesosRaw$,
        this.dateRange$
    ]).pipe(
        map(([procesos, range]) => {
            const startStr = moment(range.start).format('YYYY-MM-DD');
            const endStr = moment(range.end).format('YYYY-MM-DD');
            const endCompare = `${endStr} 23:59:59`;

            // Estructura: Oficina -> { Entrevistado: X, PruebaAuto: Y ... }
            const offices: Record<string, Record<string, number>> = {};
            const stages = ['Entrevistado', 'Prueba o Autorizado', 'Examenes Med', 'Contratado', 'Ingreso', 'Rechazado'];

            const inc = (ofi: string, stage: string) => {
                if (!offices[ofi]) {
                    offices[ofi] = {};
                    stages.forEach(s => offices[ofi][s] = 0);
                }
                offices[ofi][stage]++;
            };

            const inRange = (dateStr: string) => {
                if (!dateStr) return false;
                const m = moment(dateStr);
                return m.isSameOrAfter(startStr) && m.isSameOrBefore(endCompare);
            };

            procesos.forEach((p: any) => {
                const ofi = p.oficina_creacion || 'Desconocida';

                if (inRange(p.entrevistado_at)) inc(ofi, 'Entrevistado');

                if (inRange(p.prueba_tecnica_at) || inRange(p.autorizado_at)) {
                    inc(ofi, 'Prueba o Autorizado');
                }

                if (inRange(p.examenes_medicos_at)) inc(ofi, 'Examenes Med');
                if (inRange(p.contratado_at)) inc(ofi, 'Contratado');
                if (inRange(p.ingreso_at)) inc(ofi, 'Ingreso');
                if (inRange(p.rechazado_at)) inc(ofi, 'Rechazado');
            });

            // Convertir a ChartSeriesPoint (ECharts Stacked Bar)
            const xAxisData = Object.keys(offices);
            // Si queremos xAxis en el chart lo inyectamos desde el componente. Aqui pasamos series.
            // Para simplicar lo hacemos en el chart. Aquí retornaremos las series estructuradas

            const seriesList: ChartSeriesPoint[] = stages.map(stg => {
                return {
                    name: stg,
                    type: 'bar',
                    stack: 'total',
                    label: { show: true },
                    data: xAxisData.map(ofi => offices[ofi][stg] || 0)
                };
            });

            // Unimos el eje x como una propiedad "meta" temporal o lo recalculamos en el componente.
            // Para no romper la interfaz de series, lo agregare al final como un 'category' falso o emitire otro observable.
            // Asi que lo empaqueto como un objeto si es necesario, pero devolveré any para este spec visual 
            return seriesList as any; // Hack: en el componente extraeremos xAxisData comparando los keys.
        })
    );
    // Helper Observable for X xAxis since pipeline needs it
    public pipelineOffices$: Observable<string[]> = combineLatest([
        this.procesosRaw$,
        this.dateRange$
    ]).pipe(
        map(([procesos, range]) => {
            const offices = new Set<string>();
            procesos.forEach((p: any) => offices.add(p.oficina_creacion || 'Desconocida'));
            return Array.from(offices);
        })
    );


    // Listado de Sin Celular
    public sinCelularList$: Observable<CandidatoSinCelular[]> = combineLatest([
        this.candidatosRaw$,
        this.contactosRaw$,
        this.oficinaPorCandidato$
    ]).pipe(
        map(([cands, contactos, oficinaMap]) => {
            const setDocsConCelular = new Set<number>();
            contactos.forEach((c: any) => {
                if (c.celular && /^\d+$/.test(c.celular)) {
                    setDocsConCelular.add(c.candidato);
                }
            });

            return cands
                .filter((c: any) => !setDocsConCelular.has(c.id))
                .map((c: any) => ({
                    id: c.id,
                    nombres: `${c.primer_nombre || ''} ${c.segundo_nombre || ''}`.trim(),
                    apellidos: `${c.primer_apellido || ''} ${c.segundo_apellido || ''}`.trim(),
                    numero_documento: c.numero_documento,
                    oficina: oficinaMap[c.id] || 'N/A'
                }));
        })
    );

}
