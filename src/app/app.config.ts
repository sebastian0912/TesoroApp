import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { interceptor } from './core/interceptors/auth.interceptor';

const isElectron = shouldEnableHash();

function shouldEnableHash(): boolean {
  if (typeof window === 'undefined') return false;
  // Check for User Agent or other signals if process isn't reliable in all contexts
  const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
  return userAgent.includes('electron');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      // Apply withHashLocation() ONLY if in Electron
      ...(isElectron ? [withHashLocation()] : [])
    ),
    provideClientHydration(),
    provideAnimationsAsync(),
    provideHttpClient(
      withFetch(),
      withInterceptors([interceptor])
    )
  ]
};
