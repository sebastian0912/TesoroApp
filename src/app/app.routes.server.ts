// src/app/app.routes.server.ts
import { RenderMode, type ServerRoute } from '@angular/ssr';

// Toda la app se renderiza en el cliente (CSR).
// Prerender causaba NG0401 porque el servidor no dispone
// de contexto de plataforma browser al inspeccionar rutas lazy.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
