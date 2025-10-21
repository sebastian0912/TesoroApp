// src/app/app.routes.server.ts
import { RenderMode, type ServerRoute } from '@angular/ssr';

// Importante: reglas específicas arriba, comodín al final
export const serverRoutes: ServerRoute[] = [
  {
    path: 'dashboard/hiring/generate-contracting-documents/:numeroDocumento',
    // evita prerender en ruta con parámetro
    renderMode: RenderMode.Client, // (o RenderMode.Server si quieres SSR en runtime)
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender, // lo demás sí se prerenderiza
  },
];
