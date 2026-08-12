import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

// app.config.server hace mergeApplicationConfig(appConfig, ...), así que hereda
// LOCALE_ID: 'es-CO'. Proveer el locale SIN registrar sus datos revienta con
// "Missing locale data for the locale es-CO", así que aquí también se registra
// (main.ts ya lo hace para el navegador).
registerLocaleData(localeEsCo, 'es-CO');

const bootstrap = () => bootstrapApplication(AppComponent, config);

export default bootstrap;
