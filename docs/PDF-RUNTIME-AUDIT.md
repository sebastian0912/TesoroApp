# Audit de runtimes PDF

## Estado actual

TesoroApp tiene **3 librerías PDF coexistiendo** con propósitos parcialmente solapados:

| Librería | Versión | Tamaño aprox. | Uso |
|---|---|---:|---|
| `pdf-lib` | 1.17.1 | ~400 KB | Mayoritario: edita PDFs base con `AcroForm` (templates) |
| `jsPDF` | 2.5.2 | ~150 KB | Generación desde cero (tablas/recibos sencillos) |
| `jspdf-autotable` | 5.0.7 | ~30 KB | Plugin de tablas para jsPDF |
| `fontkit` | 2.0.4 | ~80 KB | Embebido de fuentes para pdf-lib |

**Total bundle PDF**: ~660 KB minified.

## Matriz de uso

### `pdf-lib` (8 archivos)

Es el motor principal. Carga plantillas estáticas (`Docs/*.pdf` con campos
AcroForm) y las llena.

- `generate-contracting-documents.component.ts` → manejo-imagen, autorización-datos
- `minerva-fill.ts` → Hoja de Vida Minerva (4 páginas)
- `ficha-social-fill.ts` → Ficha Social
- `ficha-tecnica-fill.ts` → Ficha Técnica con foráneos
- `contrato-administrativo-fill.ts` → Contrato administrativo
- `home.component.ts` → exportaciones del home
- `pdf.service.ts` (shared) → utilidades comunes
- `incapacidad.service.ts` → PDFs de incapacidades

### `jsPDF` (9 archivos)

Generación programática sin plantilla. Se usa para PDFs construidos íntegramente
desde código.

- `generate-contracting-documents.component.ts` → la mayoría de inducciones
  (Sagaro Lockers/Imagen/Celular, BONIFICACION IPANEMA, todas las "Entrega
  documentos *", Contratos de trabajo, Fichas técnicas...)
- `autorizaciones.service.ts` → reportes de autorizaciones
- `document-scan-dialog.component.ts` → exportar escaneos
- `hiring-questions.component.ts` → preguntas de selección
- `recruitment-pipeline.component.ts` → reportes del pipeline
- `absences-new/pdf-generator.ts` → ausentismos
- `contracting-pdf.service.ts` → reportes de contratación

### `jspdf-autotable` (3 archivos)

Solo donde hay tablas grandes (recruitment-pipeline, contracting-pdf, hiring-questions).

## Diagnóstico

1. **No hay overlap accidental**: cada librería tiene un caso de uso claro.
   - `pdf-lib`: cuando hay PDF plantilla + campos AcroForm → llenar
   - `jsPDF`: cuando se construye PDF desde cero (texto, layout, logos)
   - `jspdf-autotable`: cuando hay tablas dinámicas

2. **Migrar todo a un solo motor sería costoso**:
   - pdf-lib **no** es bueno para PDFs construidos desde cero (no tiene API
     de auto-layout ni tablas).
   - jsPDF **no** puede leer/llenar formularios AcroForm de PDFs existentes.
   - Ambos motores son la elección correcta para sus casos.

3. **Donde sí hay redundancia**: el componente `generate-contracting-documents`
   importa AMBOS y los usa en distintos métodos. Esto es inevitable mientras
   el componente sea monolítico.

## Recomendaciones

### Inmediato (si se quiere bajar bundle)

1. **Lazy-load de pdf-lib y jsPDF**: hoy se importan eagerly en cada archivo.
   Si la primera carga del dashboard NO genera un PDF, esos 660 KB pesan al
   pintar la primera vista.
   ```ts
   // antes (eager)
   import { PDFDocument } from 'pdf-lib';

   // después (lazy)
   async generarManejoImagen() {
     const { PDFDocument } = await import('pdf-lib');
     // ...
   }
   ```
   - **Beneficio**: -660 KB del initial chunk, paint del dashboard ~20% más
     rápido.
   - **Costo**: la primera generación de PDF tarda un poco más (descarga el
     chunk). Como ya hay caché de fonts/templates, el tradeoff vale la pena.

2. **`fontkit` como dynamic import** dentro de los métodos que lo usan
   (`registerFontkit`).

### Mediano plazo

3. **Consolidar `pdf.service.ts` (shared)**: tener un único punto de entrada
   para todas las operaciones PDF. Hoy las llamadas a pdf-lib están dispersas.

4. **Considerar `pdfme` o `react-pdf` para nuevos PDFs**: pdf-lib es
   maduro pero su API es de bajo nivel. Para nuevas plantillas, evaluar
   librerías declarativas (no migrar las existentes; solo nuevas).

### NO hacer

- **NO migrar de pdf-lib a jsPDF (ni viceversa)**: cada uno está bien
  posicionado donde se usa. Migrar romperia PDFs en producción sin ganancia
  proporcional.
- **NO eliminar jspdf-autotable**: sus 30 KB se ahorrarían pero perderías
  layouts de tabla automáticos en 3 archivos críticos.

## Métricas de bundle (a verificar con `source-map-explorer`)

Para medir el impacto real, ejecutar después de un build:
```bash
npm run build
npx source-map-explorer dist/tesoreria/browser/main-*.js
```

Lo que se vería (esperado):
- Initial chunk: 4–6 MB total (Angular + Material + ECharts + ApexCharts + ngx-extended-pdf-viewer + ...)
- pdf-lib + jsPDF + jspdf-autotable + fontkit: ~660 KB del bundle compartido

Lazy-loading de los 4 PDF libs llevaría el initial chunk de ~5 MB a ~4.4 MB,
con la primera generación PDF tomando un extra de ~660 KB la primera vez.

---

## Resumen

**Estado: aceptable, no crítico**. Los 3 runtimes coexisten por razones legítimas.
La oportunidad real está en **lazy-loading**, no en consolidación.

**Acción para próximo sprint**: implementar dynamic imports de pdf-lib/jsPDF en
los 17 archivos identificados arriba. Es mecánico (cambio `import` por
`await import` dentro del método) y reversible.
