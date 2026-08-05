/**
 * Playwright — revisión visual de los PDF que genera la app.
 *
 * NO levanta la aplicación ni el backend: los constructores de PDF
 * (`buildRemisionPdf`, `buildCarnetApoyoPdf`, `buildCarnetsMasivoPdf`) son
 * funciones puras que reciben datos y devuelven un Blob. Se llaman directamente
 * y el navegador se usa solo para rasterizar el resultado a PNG con pdf.js.
 *
 * Por eso no hace falta login por huella ni datos de producción.
 *
 *     npx playwright test          # corre todo
 *     e2e/salida-pdf/*.png         # las imágenes para revisar a ojo
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Los PDF grandes (lotes de 12 carnets) tardan en rasterizar.
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
