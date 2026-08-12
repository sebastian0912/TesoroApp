import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

/**
 * Estrategia de precarga de rutas lazy EN SEGUNDO PLANO.
 *
 * Problema que resuelve: sin precarga, cada sección del sidebar es un chunk
 * JS aparte (algunos de 1–1.8 MB) que solo se descarga al navegar a ella →
 * la primera pantalla abre bien pero "cambiar de página se demora demasiado"
 * mientras baja el chunk. Con esta estrategia, unos segundos después de que
 * la primera pantalla ya pidió sus datos, se descargan los chunks de las
 * demás rutas en background y quedan en cache (nginx los sirve immutable), así
 * la navegación posterior es instantánea.
 *
 * Salvaguardas:
 *  - Solo en navegador (CSR); en SSR/prerender no tiene sentido.
 *  - Se salta conexiones lentas o con ahorro de datos (Network Information API)
 *    para no gastar el plan de datos del usuario en móvil.
 *  - Respeta `data.preload === false` en cualquier ruta que quiera excluirse.
 *  - Espera ~2.5 s para no competir con la carga inicial ni con las llamadas
 *    de datos de la primera vista.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (typeof window === 'undefined') return of(null);
    if (route.data && route.data['preload'] === false) return of(null);

    const conn = (navigator as any)?.connection;
    if (conn && (conn.saveData === true || /(?:^|\b)(?:slow-2g|2g)$/.test(conn.effectiveType || ''))) {
      return of(null);
    }

    return timer(2500).pipe(mergeMap(() => load()));
  }
}
