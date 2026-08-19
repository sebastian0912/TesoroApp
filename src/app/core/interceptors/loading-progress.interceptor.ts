import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';

import { LoadingProgressService } from '../services/loading-progress.service';
import { environment } from '../../../environments/environment';

/**
 * Alimenta el indicador de carga con la actividad HTTP REAL de la plataforma.
 *
 * Sólo se registran las LECTURAS (GET) contra nuestra API: son las que hacen esperar al
 * usuario mirando una pantalla vacía. Las escrituras ya tienen su propio feedback (botón
 * deshabilitado, snackbar) y meterlas aquí haría aparecer el overlay al pulsar "Guardar".
 */

const API_HOST = (() => {
  try { return new URL(environment.apiUrl).host; } catch { return ''; }
})();

/**
 * Peticiones que NO deben mover la barra.
 *
 * El sondeo de notificaciones corre en un `timer(0, 45000)` de la barra lateral: si contara,
 * la vista de carga reaparecería sola cada 45 segundos sin que el usuario haya pedido nada.
 * Lo mismo con el refresh de token y los health checks: son fontanería, no carga de datos.
 */
const SILENCIOSAS = [
  '/api/v1/admin/notificaciones/no-leidas',
  // La ruta vieja de ms-tools sigue listada mientras dure la doble escritura de
  // la Fase 1: si hubiera que devolver la campana al endpoint anterior, el
  // sondeo no debe empezar a mover la barra de carga.
  '/matder/notifications/unread-count',
  '/gestion_admin/auth/refresh',
  '/actuator/',
  '/health',
];

/**
 * Etiquetas legibles por prefijo de ruta. La clave es el segmento que usa el gateway;
 * el valor es lo que lee el usuario. Sin esto la lista mostraría URLs crudas.
 */
const ETIQUETAS: ReadonlyArray<readonly [string, string]> = [
  ['/gestion_afiliaciones/contratos/resumen', 'Indicadores de afiliaciones'],
  ['/gestion_afiliaciones/contratos/timeline', 'Evolución de contrataciones'],
  ['/gestion_afiliaciones/contratos', 'Contrataciones'],
  ['/gestion_afiliaciones', 'Afiliaciones'],
  ['/gestion_documental/documentos', 'Documentos'],
  ['/gestion_documental', 'Gestión documental'],
  ['/gestion_contratacion/contratacion/candidatos-tabla', 'Tablero de candidatos'],
  ['/gestion_contratacion/candidatos', 'Datos del candidato'],
  ['/gestion_contratacion/procesos', 'Historial de procesos'],
  ['/gestion_contratacion/biometria', 'Biometría'],
  ['/gestion_contratacion', 'Contratación'],
  ['/gestion_tesoreria', 'Tesorería'],
  ['/gestion_ausentismios', 'Ausentismos'],
  ['/gestion_contabilidad', 'Contabilidad'],
  ['/gestion_centros_costos', 'Centros de costo'],
  ['/gestion_catalogos', 'Catálogos'],
  ['/gestion_cargos', 'Cargos'],
  ['/gestion_payroll', 'Nómina'],
  ['/gestion_entrevista', 'Entrevistas'],
  ['/gestion_forms', 'Formularios'],
  ['/gestion_admin/modulos', 'Módulos y permisos'],
  ['/gestion_admin/usuarios', 'Usuarios'],
  ['/gestion_admin', 'Administración'],
  ['/EstadosRobots', 'Estados de robots'],
  ['/Robots', 'Robots'],
  ['/api/v1/admin/notificaciones', 'Novedades'],
  ['/matder/notifications', 'Notificaciones'],
];

/**
 * Pesos. Los endpoints que agregan sobre la vista de contratos tardan segundos; un catálogo
 * responde en milisegundos. Sin esta diferencia, cargar 6 catálogos rápidos empujaría la
 * barra al 85% mientras la consulta que de verdad falta ni ha empezado a volver.
 */
const PESOS: ReadonlyArray<readonly [string, number]> = [
  ['/gestion_afiliaciones/contratos/resumen', 6],
  ['/gestion_afiliaciones/contratos/timeline', 4],
  ['/gestion_afiliaciones/contratos', 3],
  ['/gestion_contratacion/contratacion/candidatos-tabla', 4],
  ['/gestion_documental/documentos', 2],
];

function esNuestraApi(url: string): boolean {
  if (url.startsWith('/')) return true;
  try { return new URL(url).host === API_HOST; } catch { return false; }
}

function ruta(url: string): string {
  try { return new URL(url, 'http://x').pathname; } catch { return url; }
}

function etiquetaDe(path: string): string {
  const hit = ETIQUETAS.find(([pre]) => path.includes(pre));
  if (hit) return hit[1];
  // Último recurso: el segmento más informativo de la ruta, presentable.
  const seg = path.split('/').filter(s => s && !/^\d+$/.test(s)).pop() || 'datos';
  return seg.replace(/[-_]/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

function pesoDe(path: string): number {
  const hit = PESOS.find(([pre]) => path.includes(pre));
  return hit ? hit[1] : 1;
}

export const loadingProgressInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const url = req.urlWithParams;

  if (req.method !== 'GET' || !esNuestraApi(url) || SILENCIOSAS.some(s => url.includes(s))) {
    return next(req);
  }

  const progreso = inject(LoadingProgressService);
  const path = ruta(url);

  // La clave es la URL completa con params: dos páginas distintas del mismo listado son
  // dos esperas distintas, pero la MISMA petición repetida (p.ej. re-suscripción) no
  // debe contar dos veces.
  const clave = `${req.method} ${url}`;
  let fallo = false;

  progreso.iniciar(clave, etiquetaDe(path), pesoDe(path));

  return next(req).pipe(
    tap({ error: () => { fallo = true; } }),
    finalize(() => progreso.terminar(clave, !fallo)),
  );
};
