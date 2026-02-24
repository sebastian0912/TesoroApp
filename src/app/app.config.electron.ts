import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { interceptor } from './core/interceptors/auth.interceptor';

/**
 * Electron-specific config: always uses HashLocationStrategy.
 * Hash routing (/#/dashboard) is required for file:// protocol;
 * without it, Ctrl+R reloads a non-existent filesystem path.
 */
export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes, withHashLocation()),
        provideAnimationsAsync(),
        provideHttpClient(
            withFetch(),
            withInterceptors([interceptor])
        )
    ]
};
