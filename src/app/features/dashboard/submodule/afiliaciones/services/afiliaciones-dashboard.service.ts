import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@/environments/environment';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, shareReplay, switchMap, catchError, startWith } from 'rxjs/operators';
import * as _moment from 'moment';
// @ts-ignore
const moment = _moment.default || _moment;

import {
  AfiliacionesDateRange,
  AfiliacionesKpiSummary,
  ContratacionRow,
  ResumenPorOficina,
  ResumenPorEmpresa
} from '../models/afiliaciones-dashboard.models';

@Injectable({
  providedIn: 'root'
})
export class AfiliacionesDashboardService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/gestion_contratacion`;

  // State: rango de fecha de ingreso (default: hoy)
  private dateRangeSubject = new BehaviorSubject<AfiliacionesDateRange>({
    start: moment().startOf('day').toDate(),
    end: moment().endOf('day').toDate()
  });

  public dateRange$ = this.dateRangeSubject.asObservable();

  // Filtro de texto para buscar por nombre, documento, etc.
  private searchSubject = new BehaviorSubject<string>('');
  public search$ = this.searchSubject.asObservable();

  // ──────────────────────────────────────────────
  // Datos crudos: Procesos con fecha de ingreso
  // ──────────────────────────────────────────────
  private procesosRaw$: Observable<any[]> = this.dateRange$.pipe(
    switchMap(range => {
      const start = moment(range.start).format('YYYY-MM-DD');
      const end = moment(range.end).format('YYYY-MM-DD');
      let params = new HttpParams()
        .set('ingreso_at__gte', start)
        .set('ingreso_at__lte', `${end} 23:59:59`)
        .set('limit', '5000');
      return this.http.get<any>(`${this.apiUrl}/procesos/`, { params }).pipe(
        map(res => res.results || []),
        catchError(() => of([]))
      );
    }),
    shareReplay(1)
  );

  // Candidatos para enriquecer con datos personales
  private candidatosRaw$: Observable<any[]> = this.dateRange$.pipe(
    switchMap(range => {
      const start = moment(range.start).format('YYYY-MM-DD');
      const end = moment(range.end).format('YYYY-MM-DD');
      let params = new HttpParams()
        .set('updated_at__gte', start)
        .set('updated_at__lte', `${end} 23:59:59`)
        .set('limit', '5000');
      return this.http.get<any>(`${this.apiUrl}/candidatos/`, { params }).pipe(
        map(res => res.results || []),
        catchError(() => of([]))
      );
    }),
    shareReplay(1)
  );

  // ──────────────────────────────────────────────
  // Tabla consolidada de contrataciones
  // ──────────────────────────────────────────────
  public contrataciones$: Observable<ContratacionRow[]> = combineLatest([
    this.procesosRaw$,
    this.candidatosRaw$
  ]).pipe(
    map(([procesos, candidatos]) => {
      // Mapa de candidatos por ID para enriquecer procesos
      const candidatoMap: Record<number, any> = {};
      candidatos.forEach((c: any) => candidatoMap[c.id] = c);

      return procesos.map((p: any) => {
        const cand = candidatoMap[p.candidato] || {};
        const primerNombre = cand.primer_nombre || p.primer_nombre || '';
        const segundoNombre = cand.segundo_nombre || p.segundo_nombre || '';
        const primerApellido = cand.primer_apellido || p.primer_apellido || '';
        const segundoApellido = cand.segundo_apellido || p.segundo_apellido || '';

        const estado = this.calcularEstado(p);

        return {
          id: p.id,
          numero_documento: cand.numero_documento || p.numero_documento || '',
          primer_nombre: primerNombre,
          segundo_nombre: segundoNombre,
          primer_apellido: primerApellido,
          segundo_apellido: segundoApellido,
          nombre_completo: `${primerNombre} ${segundoNombre} ${primerApellido} ${segundoApellido}`.replace(/\s+/g, ' ').trim(),
          empresa: p.empresa || p.empresa_contratante || 'Sin Empresa',
          oficina: p.oficina_creacion || p.oficina || 'Sin Oficina',
          finca: p.finca || p.centro_costo_nombre || '',
          cargo: p.cargo || p.cargo_nombre || '',
          fecha_ingreso: p.ingreso_at || '',
          estado,
          usuario_responsable: p.usuario_responsable || p.creado_por || '',
          contratado_at: p.contratado_at || '',
          ingreso_at: p.ingreso_at || '',
          examenes_medicos_at: p.examenes_medicos_at || '',
          autorizado_at: p.autorizado_at || '',
          centro_costo: p.centro_costo || p.centro_costo_nombre || ''
        } as ContratacionRow;
      });
    }),
    shareReplay(1)
  );

  // Contrataciones filtradas por texto de búsqueda
  public contratacionesFiltradas$: Observable<ContratacionRow[]> = combineLatest([
    this.contrataciones$,
    this.search$
  ]).pipe(
    map(([rows, search]) => {
      if (!search || search.trim().length === 0) return rows;
      const term = search.toLowerCase().trim();
      return rows.filter(r =>
        r.nombre_completo.toLowerCase().includes(term) ||
        r.numero_documento.toLowerCase().includes(term) ||
        r.empresa.toLowerCase().includes(term) ||
        r.oficina.toLowerCase().includes(term) ||
        r.cargo.toLowerCase().includes(term) ||
        r.usuario_responsable.toLowerCase().includes(term) ||
        r.finca.toLowerCase().includes(term)
      );
    })
  );

  // ──────────────────────────────────────────────
  // KPIs
  // ──────────────────────────────────────────────
  public kpiSummary$: Observable<AfiliacionesKpiSummary> = this.contrataciones$.pipe(
    map(rows => {
      const hoyStr = moment().format('YYYY-MM-DD');
      const empresas = new Set(rows.map(r => r.empresa));
      const oficinas = new Set(rows.map(r => r.oficina));

      const ingresosHoy = rows.filter(r => {
        if (!r.ingreso_at) return false;
        return moment(r.ingreso_at).format('YYYY-MM-DD') === hoyStr;
      }).length;

      const contratados = rows.filter(r => r.estado === 'Contratado' || r.estado === 'Ingreso').length;
      const pendientes = rows.filter(r => r.estado === 'Pendiente' || r.estado === 'En Proceso').length;

      return {
        totalIngresos: rows.length,
        ingresosHoy,
        totalEmpresas: empresas.size,
        totalOficinas: oficinas.size,
        totalContratados: contratados,
        totalPendientes: pendientes
      };
    }),
    startWith({
      totalIngresos: 0,
      ingresosHoy: 0,
      totalEmpresas: 0,
      totalOficinas: 0,
      totalContratados: 0,
      totalPendientes: 0
    })
  );

  // ──────────────────────────────────────────────
  // Resumen por oficina
  // ──────────────────────────────────────────────
  public resumenPorOficina$: Observable<ResumenPorOficina[]> = this.contrataciones$.pipe(
    map(rows => {
      const dict: Record<string, { total: number; contratados: number; pendientes: number }> = {};
      rows.forEach(r => {
        if (!dict[r.oficina]) dict[r.oficina] = { total: 0, contratados: 0, pendientes: 0 };
        dict[r.oficina].total++;
        if (r.estado === 'Contratado' || r.estado === 'Ingreso') dict[r.oficina].contratados++;
        if (r.estado === 'Pendiente' || r.estado === 'En Proceso') dict[r.oficina].pendientes++;
      });
      return Object.entries(dict)
        .map(([oficina, data]) => ({ oficina, ...data }))
        .sort((a, b) => b.total - a.total);
    })
  );

  // ──────────────────────────────────────────────
  // Resumen por empresa
  // ──────────────────────────────────────────────
  public resumenPorEmpresa$: Observable<ResumenPorEmpresa[]> = this.contrataciones$.pipe(
    map(rows => {
      const dict: Record<string, { total: number; contratados: number; pendientes: number }> = {};
      rows.forEach(r => {
        if (!dict[r.empresa]) dict[r.empresa] = { total: 0, contratados: 0, pendientes: 0 };
        dict[r.empresa].total++;
        if (r.estado === 'Contratado' || r.estado === 'Ingreso') dict[r.empresa].contratados++;
        if (r.estado === 'Pendiente' || r.estado === 'En Proceso') dict[r.empresa].pendientes++;
      });
      return Object.entries(dict)
        .map(([empresa, data]) => ({ empresa, ...data }))
        .sort((a, b) => b.total - a.total);
    })
  );

  // ──────────────────────────────────────────────
  // Acciones
  // ──────────────────────────────────────────────
  public updateDateRange(start: Date, end: Date): void {
    this.dateRangeSubject.next({
      start: moment(start).startOf('day').toDate(),
      end: moment(end).endOf('day').toDate()
    });
  }

  public updateSearch(term: string): void {
    this.searchSubject.next(term);
  }

  private calcularEstado(proceso: any): string {
    if (proceso.rechazado_at) return 'Rechazado';
    if (proceso.ingreso_at) return 'Ingreso';
    if (proceso.contratado_at) return 'Contratado';
    if (proceso.examenes_medicos_at) return 'Exámenes Médicos';
    if (proceso.autorizado_at || proceso.prueba_tecnica_at) return 'En Proceso';
    if (proceso.entrevistado_at) return 'Entrevistado';
    return 'Pendiente';
  }
}
