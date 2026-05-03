# Plan de migración a Angular Material M3 (Material Design 3)

**Estado actual:** Material 21.2.9 instalado, pero el proyecto NO usa el sistema
de temas de Angular Material. Los estilos globales viven en `src/styles.css` con
CSS variables propias (`--primary`, `--surface`, etc.) y no se invoca ningún
mixin de Material (`mat.core()`, `mat.define-light-theme()`, `mat.theme()`).

## Por qué no se ejecuta hoy

1. **El archivo es CSS plano** (`styles.css`), no SCSS. Material M3 con
   `mat.theme()` mixin **requiere SCSS** (no se puede importar desde CSS).
2. **Material 21 ya viene con tokens CSS por defecto** — los componentes
   funcionan visualmente sin el mixin. Lo que pierde el proyecto:
   - Personalización de paleta primaria/terciaria
   - Tokens de tipografía consistentes con Material
   - Density tokens
   - Sistema de tema dark/light unificado

## Lo que tiene actualmente

```css
:root {
  --primary: #3b82f6;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --surface: #ffffff;
  --bg: #f6f7fb;
  /* ... etc, 956 líneas en total */
}
```

Las CSS variables se aplican manualmente en cada componente con `var(--primary)`.

## Lo que sería el M3 estándar (después de migrar a SCSS)

```scss
// styles.scss
@use '@angular/material' as mat;

html {
  @include mat.theme((
    color: (
      theme-type: light,
      primary: mat.$azure-palette,
      tertiary: mat.$blue-palette,
    ),
    typography: Roboto,
    density: 0,
  ));
}

// Después del mixin, todo componente Material consume tokens:
//   color: var(--mat-sys-primary);
//   background: var(--mat-sys-surface);
//   ...etc
```

## Plan de migración (3 fases)

### Fase 1 — Migración CSS → SCSS (mecánica)

1. Renombrar `src/styles.css` → `src/styles.scss`.
2. Actualizar `angular.json`:
   ```json
   "styles": ["src/styles.scss"]
   ```
3. **Verificar build pasa** (CSS es válido SCSS, no debería romper).
4. **Commit aislado**: `chore(styles): migrate styles.css to styles.scss`.

### Fase 2 — Aplicar M3 theme mixin

1. En `styles.scss`, agregar al inicio:
   ```scss
   @use '@angular/material' as mat;

   html {
     @include mat.theme((
       color: (
         theme-type: light,
         primary: mat.$azure-palette,
         tertiary: mat.$blue-palette,
       ),
       typography: Roboto,
       density: 0,
     ));
   }
   ```
2. **Mantener** las CSS variables custom existentes (`--primary`, etc.) por
   ahora — los componentes que las usan no se rompen.
3. **Verificar visual**: los componentes Material (mat-button, mat-card, mat-tab,
   etc.) ahora usan tokens M3. Debería verse idéntico o mejor.
4. **Commit**: `feat(material): apply M3 theme mixin`.

### Fase 3 — Migración gradual a tokens M3

A lo largo de varias sesiones, ir reemplazando CSS variables custom por
los tokens del sistema M3:

| Antes (custom)        | Después (M3 system token)            |
|-----------------------|--------------------------------------|
| `var(--primary)`      | `var(--mat-sys-primary)`             |
| `var(--surface)`      | `var(--mat-sys-surface)`             |
| `var(--bg)`           | `var(--mat-sys-background)`          |
| `var(--text)`         | `var(--mat-sys-on-surface)`          |
| `var(--border)`       | `var(--mat-sys-outline-variant)`     |
| `var(--danger)`       | `var(--mat-sys-error)`               |

**No** hacer este cambio en bulk con `replace_all`: cada uno requiere
inspección visual del componente afectado para confirmar que el contraste
y el color casan con la intención original.

### Fase 4 — Dark mode (opcional)

Material M3 trae dark mode "gratis" si el theme-type es dynamic:

```scss
html {
  color-scheme: light dark;
  @include mat.theme((
    color: (
      primary: mat.$azure-palette,
      tertiary: mat.$blue-palette,
    ),
    ...
  ));
}
```

Después: todos los `var(--mat-sys-*)` se adaptan automáticamente vía
`light-dark()` CSS function. Las CSS variables custom NO — habría que
hacerles dark variants manualmente.

## Cuándo retomar

Cuando el equipo decida invertir en consistencia visual con M3. **No es
urgente** — la app es funcional con su CSS actual. La ganancia es:

- Coherencia tipográfica con Material (Roboto + escala oficial)
- Density tokens (interfaces más compactas o espaciosas con un solo cambio)
- Dark mode automático si se quiere
- Mejor performance: M3 usa tokens nativos en lugar de duplicar reglas

**Estimación**:
- Fase 1: 30 min (rename + build).
- Fase 2: 1 sesión (probar visualmente cada componente Material).
- Fase 3: 2–4 sesiones (gradual, una sección de UI por sesión).
- Fase 4: 1 sesión (si se decide dark mode).
