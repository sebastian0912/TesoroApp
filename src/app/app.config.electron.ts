import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection, LOCALE_ID, DEFAULT_CURRENCY_CODE } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { interceptor } from './core/interceptors/auth.interceptor';
import { offlineInterceptor } from './core/interceptors/offline.interceptor';
import { loadingProgressInterceptor } from './core/interceptors/loading-progress.interceptor';
import { OfflineSyncService } from './core/services/offline-sync.service';
import { PipelinePreloadService } from './core/services/pipeline-preload.service';
import { CatalogPreloadService } from './core/services/catalog-preload.service';
import { CHOICE_OPTIONS_RESOLVER } from './shared/components/forms/choice-options';
import { OptionSourceService } from './features/dashboard/submodule/dynamic-forms/services/option-source.service';

/**
 * Electron-specific config: always uses HashLocationStrategy.
 * Hash routing (/#/dashboard) is required for file:// protocol;
 * without it, Ctrl+R reloads a non-existent filesystem path.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    /**
     * Los campos de selección de shared/ pueden sacar sus opciones de una TABLA
     * PARAMETRIZADA; quien las resuelve es el submódulo de Formularios Dinámicos.
     * Se registra aquí para que shared/ no dependa de features/.
     */
    { provide: CHOICE_OPTIONS_RESOLVER, useExisting: OptionSourceService },
    // Este config NO hereda de app.config.ts (a diferencia del de servidor, que
    // sí hace mergeApplicationConfig). Sin repetirlo aquí, la app de escritorio
    // seguiría pintando los pesos en formato gringo.
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'COP' },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(
      withFetch(),
      withInterceptors([loadingProgressInterceptor, interceptor, offlineInterceptor])
    ),
    provideAnimations(),
    // Instancia temprana: el sync escucha isOnline$ y procesa la cola SQLite
    // al recuperar red; sin esto la cola crecería pero no se vaciaría.
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [OfflineSyncService, PipelinePreloadService, CatalogPreloadService],
      multi: true,
    },
  ],
};