import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@/environments/environment';
import { Observable, ReplaySubject, Subject, combineLatest, of } from 'rxjs';
import { map, shareReplay, switchMap, catchError, startWith, take } from 'rxjs/operators';
import * as _moment from 'moment';
// @ts-ignore
const moment = _moment.default || _moment;

import {
    MetricasContratacionDateRange,
    ContratacionKpiSummary,
    ChartDataPoint,
    CandidatoSinCelular,
    PipelineVM,
    ChartSeriesPoint,
} from '../models/contratacion-metricas.models';

@Injectable({
    providedIn: 'root'
})
export class ContratacionMetricasApiService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/gestion_contratacion`;

    // ─── State ──────────────────────────────────────────────────────
    // Lazy: sólo emite cuando el filters-bar (o cualquier consumidor) invoca
    // updateDateRange. Así la sola inyección del servicio — `providedIn: 'root'` —
    // no dispara 4 GETs al arrancar la app.
    private dateRangeSubject = new ReplaySubject<MetricasContratacionDateRange>(1);
    public dateRange$ = this.dateRangeSubject.asObservable();

    // Canal de errores de red. Los dashboards se suscriben y muestran snackbar/banner
    // en vez de tragarse silenciosamente los fallos.
    private errorSubject = new Subject<string>();
    public errors$ = this.errorSubject.asObservable();

    public updateDateRange(start: Date, end: Date): void {
        this.dateRangeSubject.next({
            start: moment(start).startOf('day').toDate(),
            end: moment(end).endOf('day').toDate()
        });
    }

    // ─── Fetch raw lists ────────────────────────────────────────────
    public candidatosRaw$ = this.dateRange$.pipe(
        switchMap(range => {
            const start = moment(range.start).format('YYYY-MM-DD');
            const end = moment(range.end).format('YYYY-MM-DD');
            const params = new HttpParams()
                .set('updated_at__gte', start)
                .set('updated_at__lte', `${end} 23:59:59`)
                .set('limit', '1000');
            return this.reportable(
                this.http.get<any>(`${this.apiUrl}/candidatos/`, { params }).pipe(
                    map(res => res.results || [])
                ),
                'candidatos'
            );
        }),
        shareReplay(1)
    );

    public entrevistasRaw$ = this.dateRange$.pipe(
        switchMap(() => {
            const params = new HttpParams().set('limit', '2000').set('ordering', '-created_at');
            return this.reportable(
                this.http.get<any>(`${this.apiUrl}/entrevistas/`, { params }).pipe(
                    map(res => res.results || [])
                ),
                'entrevistas'
            );
        }),
        shareReplay(1)
    );

    public contactosRaw$ = this.dateRange$.pipe(
        switchMap(() => {
            const params = new HttpParams().set('limit', '2000').set('ordering', '-created_at');
            return this.reportable(
                this.http.get<any>(`${this.apiUrl}/contactos/`, { params }).pipe(
                    map(res => res.results || [])
                ),
                'contactos'
            );
        }),
        shareReplay(1)
    );

    public procesosRaw$ = this.dateRange$.pipe(
        switchMap(range => {
            const start = moment(range.start).format('YYYY-MM-DD');
            const end = moment(range.end).format('YYYY-MM-DD');
            const params = new HttpParams()
                .set('limit', '2000')
                .set('updated_at__gte', start)
                .set('updated_at__lte', `${end} 23:59:59`);
            return this.reportable(
                this.http.get<any>(`${this.apiUrl}/procesos/`, { params }).pipe(
                    map(res => res.results || [])
                ),
                'procesos'
            );
        }),
        shareReplay(1)
    );

    // ─── Agregaciones frontend ──────────────────────────────────────

    /** Mapa: candidatoId → última oficina entrevistada. */
    private oficinaPorCandidato$: Observable<Record<number, string>> = this.entrevistasRaw$.pipe(
        map(entrevistas => {
            const latest: Record<number, { date: Date, oficina: string }> = {};
            entrevistas.forEach((ent: any) => {
                const candId = ent.candidato;
                if (!candId) return;
                const d = new Date(ent.created_at);
                if (!latest[candId] || latest[candId].date < d) {
                    latest[candId] = { date: d, oficina: ent.oficina || 'Sin Oficina' };
                }
            });
            const out: Record<number, string> = {};
            for (const [candId, data] of Object.entries(latest)) out[Number(candId)] = data.oficina;
            return out;
        }),
        shareReplay(1)
    );

    public kpiSummary$: Observable<ContratacionKpiSummary> = combineLatest([
        this.candidatosRaw$,
        this.contactosRaw$
    ]).pipe(
        map(([cands, contactos]) => {
            const totalLlenaron = cands.length;

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
            return Object.keys(counts)
                .map(k => ({ name: k, value: counts[k] }))
                .sort((a, b) => b.value - a.value);
        })
    );

    /**
     * Pipeline por oficina — series stacked bar + eje X en un único VM.
     * Antes: dos observables separados y un `as any` porque el tipo no coincidía.
     */
    public pipelineVM$: Observable<PipelineVM> = combineLatest([
        this.procesosRaw$,
        this.dateRange$
    ]).pipe(
        map(([procesos, range]) => {
            const startStr = moment(range.start).format('YYYY-MM-DD');
            const endStr = moment(range.end).format('YYYY-MM-DD');
            const endCompare = `${endStr} 23:59:59`;
            const inRange = (dateStr: string) =>
                !!dateStr && moment(dateStr).isSameOrAfter(startStr) && moment(dateStr).isSameOrBefore(endCompare);

            const stages = ['Entrevistado', 'Prueba o Autorizado', 'Examenes Med', 'Contratado', 'Ingreso', 'Rechazado'];
            const offices: Record<string, Record<string, number>> = {};

            const inc = (ofi: string, stage: string) => {
                if (!offices[ofi]) {
                    offices[ofi] = {};
                    stages.forEach(s => offices[ofi][s] = 0);
                }
                offices[ofi][stage]++;
            };

            procesos.forEach((p: any) => {
                const ofi = p.oficina_creacion || 'Desconocida';
                if (inRange(p.entrevistado_at)) inc(ofi, 'Entrevistado');
                if (inRange(p.prueba_tecnica_at) || inRange(p.autorizado_at)) inc(ofi, 'Prueba o Autorizado');
                if (inRange(p.examenes_medicos_at)) inc(ofi, 'Examenes Med');
                if (inRange(p.contratado_at)) inc(ofi, 'Contratado');
                if (inRange(p.ingreso_at)) inc(ofi, 'Ingreso');
                if (inRange(p.rechazado_at)) inc(ofi, 'Rechazado');
            });

            const xAxis = Object.keys(offices);
            const series: ChartSeriesPoint[] = stages.map(stg => ({
                name: stg,
                type: 'bar',
                stack: 'total',
                label: { show: true },
                data: xAxis.map(ofi => offices[ofi][stg] || 0),
            }));
            return { series, xAxis };
        })
    );

    public sinCelularList$: Observable<CandidatoSinCelular[]> = combineLatest([
        this.candidatosRaw$,
        this.contactosRaw$,
        this.oficinaPorCandidato$
    ]).pipe(
        map(([cands, contactos, oficinaMap]) => {
            const conCelular = new Set<number>();
            contactos.forEach((c: any) => {
                if (c.celular && /^\d+$/.test(c.celular)) conCelular.add(c.candidato);
            });
            return cands
                .filter((c: any) => !conCelular.has(c.id))
                .map((c: any) => ({
                    id: c.id,
                    nombres: `${c.primer_nombre || ''} ${c.segundo_nombre || ''}`.trim(),
                    apellidos: `${c.primer_apellido || ''} ${c.segundo_apellido || ''}`.trim(),
                    numero_documento: c.numero_documento,
                    oficina: oficinaMap[c.id] || 'N/A'
                }));
        })
    );

    // ─── Descargas / helpers de drill-down ──────────────────────────

    /** GET /gestion_contratacion/reporte/candidatos-excel/?cedulas=... */
    public downloadCandidatosExcel(cedulas: string[], filenameHint = 'candidatos'): Observable<void> {
        const unique = Array.from(new Set((cedulas || []).map(x => String(x).trim()).filter(Boolean)));
        if (unique.length === 0) return of(void 0);

        const params = new HttpParams().set('cedulas', unique.join(','));
        return this.http.get(`${this.apiUrl}/reporte/candidatos-excel/`, {
            params,
            responseType: 'blob',
            observe: 'response'
        }).pipe(
            map(resp => {
                const blob = resp.body as Blob | null;
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                const cd = resp.headers.get('Content-Disposition') || '';
                const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
                const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
                a.download = match?.[1] || `${filenameHint}_${stamp}.xlsx`;

                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            })
        );
    }

    public getDocsByOficina(oficina: string): Observable<string[]> {
        return combineLatest([this.candidatosRaw$, this.oficinaPorCandidato$]).pipe(
            take(1),
            map(([cands, ofiMap]) => cands
                .filter((c: any) => (ofiMap[c.id] || 'Sin Oficina (No Entrevistado)') === oficina)
                .map((c: any) => String(c.numero_documento || '').trim())
                .filter(Boolean)
            )
        );
    }

    public getDocsByCelularStatus(conCelular: boolean): Observable<string[]> {
        return combineLatest([this.candidatosRaw$, this.contactosRaw$]).pipe(
            take(1),
            map(([cands, contactos]) => {
                const withPhone = new Set<number>();
                contactos.forEach((c: any) => {
                    if (c.celular && /^\d+$/.test(String(c.celular))) withPhone.add(c.candidato);
                });
                return cands
                    .filter((c: any) => conCelular ? withPhone.has(c.id) : !withPhone.has(c.id))
                    .map((c: any) => String(c.numero_documento || '').trim())
                    .filter(Boolean);
            })
        );
    }

    public getDocsByPipelineSegment(oficina: string, stage: string): Observable<string[]> {
        return combineLatest([
            this.procesosRaw$,
            this.entrevistasRaw$,
            this.candidatosRaw$,
            this.dateRange$,
        ]).pipe(
            take(1),
            map(([procesos, entrevistas, cands, range]) => {
                const startStr = moment(range.start).format('YYYY-MM-DD');
                const endStr = moment(range.end).format('YYYY-MM-DD');
                const endCompare = `${endStr} 23:59:59`;
                const inRange = (d: string) =>
                    !!d && moment(d).isSameOrAfter(startStr) && moment(d).isSameOrBefore(endCompare);

                const stageMatches = (p: any) => {
                    switch (stage) {
                        case 'Entrevistado': return inRange(p.entrevistado_at);
                        case 'Prueba o Autorizado': return inRange(p.prueba_tecnica_at) || inRange(p.autorizado_at);
                        case 'Examenes Med': return inRange(p.examenes_medicos_at);
                        case 'Contratado': return inRange(p.contratado_at);
                        case 'Ingreso': return inRange(p.ingreso_at);
                        case 'Rechazado': return inRange(p.rechazado_at);
                        default: return false;
                    }
                };

                const entById: Record<number, any> = {};
                entrevistas.forEach((e: any) => { entById[e.id] = e; });

                const candById: Record<number, any> = {};
                cands.forEach((c: any) => { candById[c.id] = c; });

                const docs = new Set<string>();
                procesos.forEach((p: any) => {
                    if ((p.oficina_creacion || 'Desconocida') !== oficina) return;
                    if (!stageMatches(p)) return;
                    const ent = entById[p.entrevista];
                    if (!ent) return;
                    const cand = candById[ent.candidato];
                    const doc = String(cand?.numero_documento || '').trim();
                    if (doc) docs.add(doc);
                });
                return Array.from(docs);
            })
        );
    }

    // ─── Métricas por Temporal (agregación en backend) ──────────────

    fetchMetricasTemporal(temporal: string, start: string, end: string): Observable<any> {
        let params = new HttpParams();
        if (temporal) params = params.set('temporal', temporal);
        if (start) params = params.set('start', start);
        if (end) params = params.set('end', end);
        return this.http.get<any>(`${this.apiUrl}/procesos/metricas-temporal/`, { params });
    }

    fetchSegmentDocs(
        filters: { temporal?: string; start?: string; end?: string },
        segment: { kind: 'oficina' | 'finca' | 'fecha' | 'pipeline' | 'motivo'; value: string; stage?: string }
    ): Observable<string[]> {
        let params = new HttpParams()
            .set('kind', segment.kind)
            .set('value', segment.value);
        if (filters.temporal) params = params.set('temporal', filters.temporal);
        if (filters.start) params = params.set('start', filters.start);
        if (filters.end) params = params.set('end', filters.end);
        if (segment.stage) params = params.set('stage', segment.stage);

        return this.http.get<{ docs: string[] }>(
            `${this.apiUrl}/procesos/metricas-temporal-docs/`, { params }
        ).pipe(
            map(r => Array.isArray(r?.docs) ? r.docs : []),
            catchError(err => {
                this.reportError('candidatos del segmento', err);
                return of<string[]>([]);
            })
        );
    }

    // ─── helpers internos ───────────────────────────────────────────

    /** Envuelve un fetch para que, si falla, emita por `errors$` y mantenga el stream vivo. */
    private reportable<T>(src$: Observable<T>, label: string): Observable<T | any[]> {
        return src$.pipe(
            catchError(err => {
                this.reportError(label, err);
                return of([] as any);
            })
        );
    }

    private reportError(label: string, err: any): void {
        console.error(`[ContratacionMetricas] fallo cargando ${label}`, err);
        const status = err?.status ? ` (${err.status})` : '';
        this.errorSubject.next(`No se pudieron cargar ${label}${status}.`);
    }
}
