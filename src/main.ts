import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// 👇 Agrega estas 2 líneas antes del bootstrap
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
registerLocaleData(localeEsCo, 'es-CO');

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
