import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { environment } from '@/environments/environment';
import { getLocalStorageItem } from '../utils/safe-storage';

const MODULE_MAP: Record<string, string> = {
  'hiring':               'CONTRATACION',
  'afiliaciones':         'AFILIACIONES',
  'treasury':             'TESORERIA',
  'payments':             'TESORERIA',
  'document-management':  'DOCUMENTOS',
  'vacancies':            'SELECCION',
  'farms':                'SELECCION',
  'nomina':               'NOMINA',
  'robots':               'ROBOTS',
  'herramientas-ia':      'IA',
  'gestion-legal':        'LEGAL',
  'audit-logs':           'AUDITORIA',
  'users':                'ADMIN',
  'positions':            'ADMIN',
  'metricas':             'METRICAS',
  'matder':               'MATDER',
  'disabilities':         'HR',
  'eps-transfers':        'HR',
  'history':              'AUDITORIA',
  'money-loan':           'TESORERIA',
  'market':               'COMERCIALIZADORA',
  'merchandise':          'COMERCIALIZADORA',
  'contabilidad':         'CONTABILIDAD',
  'financiera':           'FINANCIERA',
  'bug-tickets':          'SOPORTE',
  'gestion-del-programa': 'ADMIN',
  'authorizations':       'TESORERIA',
  'home':                 'HOME',
};

const PAGE_MAP: Record<string, string> = {
  'recruitment-pipeline':    'Pipeline de selección',
  'hiring-report':           'Reporte de contratación',
  'manage-workers':          'Gestión de trabajadores',
  'company-docs-access':     'Documentos corporativos',
  'actividad':               'Actividad de usuarios',
  'cambios':                 'Historial de cambios',
  'seguridad':               'Eventos de seguridad',
  'process-transfers':       'Traslados EPS',
  'market-bonus':            'Bonificaciones',
  'bandeja':                 'Bandeja legal',
  'nuevo-proceso':           'Nuevo proceso legal',
  'asistente':               'Asistente IA',
  'conocimiento':            'Bases de conocimiento',
  'emergency-loan':          'Préstamo de emergencia',
  'change-password':         'Cambio de contraseña',
  'homologador-de-novedades':'Homologador de novedades',
  'calculo-nomina':          'Cálculo de nómina',
  'formulario':              'Formulario',
};

@Injectable({ providedIn: 'root' })
export class ActivityTrackingService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private endpoint = `${environment.apiUrl}/api/v1/admin/logs/cambio`;
  private lastUrl = '';

  startTracking(): void {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: NavigationEnd) => {
      const url = e.urlAfterRedirects || e.url;
      if (url === this.lastUrl) return;
      this.lastUrl = url;
      if (!url.startsWith('/dashboard/')) return;
      this.trackPage(url);
    });
  }

  private trackPage(url: string): void {
    const user = this.currentUser();
    if (!user) return;

    const parts = url.split('/').filter(Boolean);
    const dashIdx = parts.indexOf('dashboard');
    const submodule = parts[dashIdx + 1] ?? '';
    const page = parts[dashIdx + 2] ?? '';

    const modulo = MODULE_MAP[submodule] ?? submodule.toUpperCase().replace(/-/g, '_');
    const paginaNombre = PAGE_MAP[page] ?? this.humanize(page || submodule);

    this.http.post(this.endpoint, {
      modulo,
      entidad: 'Pagina',
      entidadId: null,
      accion: 'VIEW',
      campo: null,
      valorAnterior: null,
      valorNuevo: null,
      descripcion: `Visitó "${paginaNombre}" (${url})`
    }, { headers: { 'X-Skip-Log': '1' } }).subscribe({ error: () => {} });
  }

  private currentUser(): { id: string; email: string; nombre: string; rol: string } | null {
    try {
      const raw = getLocalStorageItem('user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      const nombres = [u?.datos_basicos?.nombres, u?.datos_basicos?.apellidos].filter(Boolean).join(' ');
      return {
        id: u?.id ?? '',
        email: u?.correo_electronico ?? '',
        nombre: nombres || u?.numero_de_documento || '',
        rol: u?.rol?.nombre ?? '',
      };
    } catch {
      return null;
    }
  }

  private humanize(s: string): string {
    return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Inicio';
  }
}
