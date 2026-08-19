import { APP_INITIALIZER, ApplicationConfig, provideZonelessChangeDetection, LOCALE_ID, DEFAULT_CURRENCY_CODE } from '@angular/core';
import { provideRouter, withHashLocation, withComponentInputBinding, withPreloading } from '@angular/router';
import { routes } from './app.routes';
import { IdlePreloadStrategy } from './core/strategies/idle-preload.strategy';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { interceptor } from './core/interceptors/auth.interceptor';
import { offlineInterceptor } from './core/interceptors/offline.interceptor';
import { loadingProgressInterceptor } from './core/interceptors/loading-progress.interceptor';
import { OfflineSyncService } from './core/services/offline-sync.service';
import { PipelinePreloadService } from './core/services/pipeline-preload.service';
import { CatalogPreloadService } from './core/services/catalog-preload.service';
import { CHOICE_OPTIONS_RESOLVER } from './shared/components/forms/choice-options';
import { OptionSourceService } from './features/dashboard/submodule/dynamic-forms/services/option-source.service';

/**
 * Web/SSR config: uses PathLocationStrategy (default).
 * Hash routing is NOT needed for web deployments.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    /**
     * Los campos de selección de shared/ pueden sacar sus opciones de una TABLA
     * PARAMETRIZADA; quien las resuelve es el submódulo de Formularios Dinámicos.
     * Se registra aquí para que shared/ no dependa de features/.
     */
    { provide: CHOICE_OPTIONS_RESOLVER, useExisting: OptionSourceService },
    /**
     * main.ts hacía `registerLocaleData(localeEsCo, 'es-CO')` pero nadie proveía
     * LOCALE_ID: registrar el locale NO basta. Sin esto, todos los pipes (number,
     * currency, date, percent) caían en en-US y pintaban $1,300,000 en una app
     * colombiana, en vez de $1.300.000.
     */
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'COP' },
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation(), withComponentInputBinding(), withPreloading(IdlePreloadStrategy)),
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withFetch(),
      withInterceptors([loadingProgressInterceptor, interceptor, offlineInterceptor])
    ),
    provideAnimations(),
    // Instanciar servicios offline temprano para que escuchen isOnline$
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [OfflineSyncService, PipelinePreloadService, CatalogPreloadService],
      multi: true,
    },
  ],
};