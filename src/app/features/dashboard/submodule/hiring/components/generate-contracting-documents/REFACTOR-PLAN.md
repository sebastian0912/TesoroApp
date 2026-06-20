# Plan de refactor — `generate-contracting-documents.component.ts`

**Estado actual**: 12 278 líneas, 31 generadores PDF embebidos, 187 llamadas a `this.safe()`,
acoplado a estado del componente (`this.vacante`, `this.candidato`, `this.firma`).

**Por qué no se ejecuta en esta tanda de hardening:**
los PDFs son legalmente vinculantes (contratos laborales, autorizaciones, fichas
sociales de trabajadores). Mover lógica sin tests automatizados que comparen
output pre/post pone en riesgo la operación. La extracción debe hacerse con
suite de regresión visual de PDFs primero.

---

## Fase 1 — Tests de regresión (prerequisito)

Antes de cualquier extracción crítica, necesitamos:

1. **Casos de prueba congelados** (5–10 cédulas reales por empresa cubierta):
   Elite, Elite Blu, Sagaro, Ipanema, Flores del Rio, Agrícola Cardenal,
   Administrativos, Apoyo default, Tu Alianza default.

2. **Snapshot de PDFs base**:
   - Ejecutar la app actual
   - Generar cada PDF (Inducción, Contrato, Ficha Técnica, Ficha Ta, Manejo
     Imagen, Sagaro Lockers/Imagen/Celular, Entrega Carnets, Inducción
     Capacitación, Formato Solicitud) con cada cédula muestra
   - Guardar en `tests/golden-pdfs/<empresa>/<cedula>/<doc>.pdf`

3. **Test de comparación binaria**:
   - Helper que toma cédula+empresa+doc → genera PDF → compara byte-a-byte
     con el golden
   - Las firmas/timestamps que cambien por ejecución se enmascaran (regex
     en el texto del PDF, o se ignora la sección).

4. **CI hook**: cualquier PR que toque archivos de `pdf-generators/` o el
   componente principal debe pasar la suite de regresión.

---

## Fase 2 — Extracciones seguras (sin lógica PDF)

Estas se pueden hacer SIN tests de regresión (cambios mecánicos triviales):

| Archivo destino | Símbolos a extraer | Líneas aprox. |
|---|---|---:|
| `pdf-shared/string.utils.ts` | `safe`, `norm`, `escapeHtml` | 13 |
| `pdf-shared/date.utils.ts` | `parseDateToDDMMYYYY`, `formatLongDateES`, `formatMoneyCOP` | 88 |
| `pdf-shared/buffer.utils.ts` | `toSafeArrayBuffer` | 5 |
| `pdf-shared/empresa.utils.ts` | `getEmpresaInfo`, `hijosTop5` (con candidato/vacante como parámetros) | 30 |

**Importante**: aunque la extracción es trivial, hay 187 llamadas a `this.safe()`
que reemplazar por `safe()` (función libre). Eso requiere `replace_all` cuidadoso
y typecheck verde después.

---

## Fase 3 — Extracción de generadores por familia (con tests de Fase 1)

En este orden, validando con golden PDFs después de cada extracción:

1. `pdf-generators/manejo-imagen.generator.ts` *(2 páginas, autocontenido)*
2. `pdf-generators/sagaro-extras.generator.ts` *(Lockers + Imagen + Celular)*
3. `pdf-generators/operativos-flores-rio.generator.ts` *(Entrega Carnets + Inducción Capacitación + Formato Solicitud)*
4. `pdf-generators/inducciones-apoyo.generator.ts` *(Apoyo + Agrícola + Jardines)*
5. `pdf-generators/inducciones-tu-alianza.generator.ts` *(Sagaro + Flores Andes + Ipanema + Ipanema Foráneos + Rebaño + Melody + Sin Casino + Administrativos)*
6. `pdf-generators/contratos.generator.ts` *(Contrato + Contrato TA + Variants)*
7. `pdf-generators/fichas-tecnicas.generator.ts` *(Ficha Técnica + Ficha Ta Completa + Foráneos)*
8. `pdf-generators/auxiliares.generator.ts` *(Autorización Datos + Manejo Imagen extras + Otros)*

Cada uno: extraer → typecheck → build → generar PDF de prueba → comparar
byte-a-byte con golden → commit. Si cualquier paso falla, rollback inmediato.

---

## Fase 4 — Servicios de orquestación

Una vez los generadores son archivos separados, el componente queda como UI
+ dispatcher. El dispatcher puede pasar a un servicio:

```ts
@Injectable({ providedIn: 'root' })
export class DocumentGenerationDispatcher {
  async generate(
    type: PdfDocumentType,
    context: PdfGeneratorContext,
  ): Promise<Blob> {
    switch (type) {
      case 'manejo-imagen':       return generateManejoImagenPdf(context);
      case 'sagaro-lockers':      return generateSagaroLockersPdf(context);
      // ... etc
    }
  }
}
```

Tamaño estimado del componente al final: ~3 000 líneas (UI + selección + dispatcher).
El componente baja de 12 278 → 3 000 (-75%).

---

## Cuándo retomar

Cuando exista la suite de Fase 1. **No antes**.

**Estimación realista**:
- Fase 1 (tests golden): 1–2 sesiones (depende de cuántas cédulas muestra haya).
- Fase 2 (extracciones seguras): 1 sesión.
- Fase 3 (8 generadores): 4–6 sesiones, una por familia.
- Fase 4 (dispatcher service): 1 sesión.

**Total**: ~10 sesiones de trabajo dedicado, cada una con validación PDF.

---

## Lo que SÍ se hizo en este Sprint

- Filtrado por empresa (`PerfilEmpresa[]`) — `documentos-por-empresa.config.ts`
- Memoización de filtros (`documentosVisibles` cacheado)
- Caché de fonts/templates PDF estáticos en runtime
- Eliminación de moment (~230KB del bundle)
- Helpers de imagen (`Manejo Imagen` mantenido como 1 PDF de 2 páginas)
- 4 generadores ya extraídos antes: `minerva-fill.ts`, `ficha-social-fill.ts`,
  `ficha-tecnica-fill.ts`, `contrato-administrativo-fill.ts`.

Esto bajó la presión sobre el componente sin tocar lógica de PDF crítica.
