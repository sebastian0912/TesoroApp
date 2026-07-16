# Documentación técnica — Vistas de Contratación y Vacantes (TesoroApp)

> Objetivo: describir de forma exhaustiva **qué componentes hay, cómo están
> configurados, qué información muestran, qué reglas de lógica rigen los datos,
> qué bloqueos existen y qué endpoints consumen** — para replicar/validar la
> misma funcionalidad en otro proyecto.
>
> Todas las rutas son relativas a `TesoroApp/src/app/features/dashboard/submodule/`.
> Las referencias `archivo:línea` corresponden al estado del repo al momento de
> escribir este documento (pueden desplazarse con futuras ediciones).

Índice:
- [Parte A — Recruitment Pipeline (vista de contratación)](#parte-a)
- [Parte B — Vacantes](#parte-b)
- [Parte C — Endpoints consolidados](#parte-c)
- [Parte D — Tipos de documento y catálogos](#parte-d)
- [Parte E — Notas de riesgo / puntos a validar 1:1](#parte-e)

---

<a name="parte-a"></a>
# PARTE A — Recruitment Pipeline (vista de contratación)

Carpeta: `hiring/pages/recruitment-pipeline/`
- `recruitment-pipeline.component.ts` (~2263 líneas), `.html` (~480), `.css` (~1146)
- `pago-transporte.rules.ts`, `prueba-tecnica.rules.ts` (reglas puras, testeables)
- Servicio central: `hiring/service/registro-proceso-contratacion/registro-proceso-contratacion.ts`
  (base `${environment.apiUrl}/gestion_contratacion`)

Notas transversales: `standalone: true`, locale `es-CO`, formato de fecha
`DD/MM/YYYY`. Imports de hijos en el decorador: `SearchForCandidateComponent`,
`SelectionQuestionsComponent`, `HelpInformationComponent`, `HiringQuestionsComponent`.
`CameraDialogComponent` se abre por `MatDialog`, no en plantilla.

## A1. Estructura de tabs (mat-tab-group externo)

Control del tab activo (html:212-213): `[selectedIndex]="tabIndex()"` +
`(selectedIndexChange)="tabIndex.set($event)"`, con `tabIndex = signal(0)` (ts:305).
Un `effect` fuerza el regreso a Turnos si hay contrato activo (ts:542-544).

| Índice | Label | Ícono | `[disabled]` | Hijo renderizado |
|---|---|---|---|---|
| 0 | Turnos | `search` | — (siempre) | `<app-search-for-candidate>` |
| 1 | ANTECEDENTES | `thumb_up` | `contratoActivo()` | `<app-selection-questions>` |
| 2 | Selección | `rate_review` | `contratoActivo()` | `<app-help-information>` |
| 3 | Exámenes de ingreso | `medical_information` / `check_circle` si `examenesYaCargados()` | `contratoActivo()` | **sin hijo**: form inline `formGroup3` (html:278-457) |
| 4 | Contratación | `how_to_reg` | `contratoActivo()` | `<app-hiring-questions>` |

Puntos clave:
- La tab 3 (Exámenes de ingreso / salud ocupacional) **no usa componente hijo**;
  el formulario vive inline en el padre.
- La tab 4 (Contratación) se bloquea **solo** por `contratoActivo()`. En html:460
  hay un `[disabled]="deshabilitarContratacion()"` **comentado/desactivado**: el
  gate de requisitos existe pero **no** deshabilita la tab (ver A3.3).
- Tooltip de tabs bloqueadas: `contratoActivo() ? 'Dé de baja el contrato activo para continuar' : null`.

## A2. Estado compartido y carga del candidato

Signal central: `candidatoSeleccionado = signal<any|null>(null)` (ts:103).

Cableado:
- Tab 0 emite: `(candidatoSeleccionado)="onCandidatoSeleccionado($event)"` → `candidatoSeleccionado.set(candidato)` (ts:548-551).
- Tabs 1, 2, 4 reciben `[candidatoSeleccionado]="candidatoSeleccionado()"` como input.

Carga del objeto candidato: la hace el hijo `search-for-candidate` (endpoint
`GET candidatos/by-document/<doc>?full=1&include_queue=1`, servicio:742-753) y lo
emite al padre. El padre, ante cada cambio del signal, dispara un `effect`
(ts:420-445) que:
- Llena `nombreCandidato` / `numeroDocumento` (`getFullName`, `getNumeroDocumento`).
- `setBiometriaFromCandidate` (biometría embebida); si falta o es "stale" (>3 min,
  `isBioStale`) → `refreshBiometriaForCandidate`.
- `refreshExamenMedicoForCandidate` (doc 32), `refreshArlForCandidate` (doc 30),
  `refreshFotoForCandidate` (doc 89).
- **`mostrarTabla()`** (ts:444): abre el diálogo de Historial laboral **automáticamente**
  al seleccionar candidato (además del botón del header).

## A3. BLOQUEOS / gates

### A3.1 `contratoActivo` (computed, ts:247-249)
```ts
readonly contratoActivo = computed<boolean>(() =>
  !!this.candidatoSeleccionado()?.entrevistas?.[0]?.proceso?.contrato?.contrato_activo);
```
Efectos: deshabilita tabs 1-4; `effect` fuerza `tabIndex=0`; banner rojo de bloqueo
con botón "Dar de baja" (`darDeBajaManual()`); el pill verde "Contrato activo" del
header también dispara `darDeBajaManual()`.

`darDeBajaManual()` (ts:661-744): Swal con fecha (default hoy, `max=hoy`) y motivo,
ambos obligatorios. Payload `{numero_documento, contrato_detalle:{contrato_activo:false, fecha_retiro, motivo_retiro}}`
→ `updateProcesoByDocumento(payload)` (POST). Actualiza estado local y re-set del signal.

### A3.2 Gate de "generar documentación"
- `faltantesPagoTransporte` (computed, ts:252-254) → `faltantesDePagoTransporte(contrato)` (ver A5).
- `puedeGenerarDocumentacion` (ts:285-287): `!!numero_documento && faltantesPagoTransporte().length === 0`.
- `tooltipGenerarDocumentacion` (ts:290-299): sin candidato → "Selecciona un candidato";
  sin faltantes → "Generar o subir documentación"; con faltantes →
  `Completa y guarda "Pago y Transporte" (tab Contratación). Falta: ...`.
- Botón (html:148-155): `[routerLink]="['/dashboard/hiring/generate-contracting-documents', numero_documento]"`,
  `[disabled]="!puedeGenerarDocumentacion()"`, `[matTooltip]="tooltipGenerarDocumentacion()"`.
- **Se valida contra lo GUARDADO en backend** (`proceso.contrato`), no contra el form,
  porque `generate-contracting-documents` recarga el candidato por cédula y arma los
  documentos desde el backend.

### A3.3 `_missingForContratacion` / `deshabilitarContratacion` / `_etapasOk`
`deshabilitarContratacion()` (ts:943-945) = `_missingForContratacion().length > 0`.

`_missingForContratacion()` (ts:883-939) exige (leyendo `proc.antecedentes[].observacion`
vía `_antecedenteValor`):
- Existe `entrevistas[0]` y `proceso`.
- Antecedente **EPS**: solo que NO esté vacío.
- Antecedente **PROCURADURIA** = `'CUMPLE'`.
- Antecedente **POLICIVOS** = `'CUMPLE'`.
- `proceso.entrevistado === true`.
- Al menos uno: `prueba_tecnica === true` **o** `autorizado === true`.
- `proceso.examenes_medicos === true`.
- NO haya "NO APTO" en el form local de exámenes (`selectedExamsArray`).
- **`remision` YA NO es requisito** (comentado explícitamente, ts:917-918).

**IMPORTANTE**: `deshabilitarContratacion()`/`_missingForContratacion()` **solo**
alimentan un toast overlay que lista lo que falta (effect ts:513-537). **No** están
cableados al `[disabled]` de la tab (html:460 comentado). En producción la tab de
Contratación **no se bloquea** por estos faltantes; solo se muestra el aviso.

**Código muerto / roto** (a tener en cuenta al validar):
- `_etapasOk(proc)` (ts:874-880) exige `proc?.remision === true`, requisito que el
  gate real eliminó → daría `false` casi siempre. Nunca se invoca.
- `_antecedentesCumplen` (ts:866-872) también está definido pero nunca se llama.

### A3.4 Gate NO APTO (exámenes)
`effect` (ts:495-510): cuando `hayNoApto()` pasa a true, Swal "Examen no apto" y
`this.util.nextStep.emit()`. `hayNoApto` se recalcula en `recalcHayNoApto()` escuchando
`selectedExamsArray`.

## A4. Prueba técnica (pill del header)

Base: `_proceso` computed (ts:258-260) = `candidato…entrevistas[0].proceso`.

Computeds: `esPruebaTecnica`, `resultadoPrueba` (`'sin_resultado'|'paso'|'no_paso'`),
`pasoPrueba`, `noPasoPrueba`, `etiquetaPrueba`, `tooltipPrueba` (ts:263-283).

Render (html:49-65): solo si `esPruebaTecnica()`. Clases `pill-danger` (no_paso),
`pill-success` (paso), `pill-info` (sin resultado); íconos `thumb_down`/`thumb_up`/`assignment_ind`.
Click/Enter/Space → `registrarResultadoPrueba()`.

`registrarResultadoPrueba()` (ts:753-841):
1. Sale si no hay `numero_documento` o no `esPruebaTecnica()`.
2. Swal: "Pasó" (verde) / "No pasó" (rojo) / "Cancelar".
3. Si "No pasó": segundo Swal textarea "Motivo" (obligatorio, mín. 5 caracteres).
4. Payload: `{numero_documento, paso_prueba_tecnica: !noPaso, no_paso_prueba_tecnica: noPaso, motivo_no_paso_prueba_tecnica: noPaso ? motivo : null}`.
5. `updateProcesoByDocumento(payload, 'PATCH')` → `PATCH procesos/update-by-document/`.
6. Actualización local con `aplicarResultadoPruebaLocal` (referencias nuevas, ver abajo).
7. Toast de éxito; en error muestra `err.error.detail`.

**Semántica**: es solo un marcador; NO toca `prueba_tecnica`, así que "no pasó" **no
bloquea** el pipeline (pero sí es estado terminal a nivel backend — ver Parte C /
regla de "proceso terminal").

### Reglas `prueba-tecnica.rules.ts`
- `esVacanteDePruebaTecnica(proceso)`: requiere `proceso.publicacion`; normaliza
  `vacante_tipo` (quita tildes/minúsculas) y acepta `prueba | prueba tecnica | prueba_tecnica`.
- `resultadoDePruebaTecnica(proceso)`: `no_paso_prueba_tecnica===true` → `'no_paso'`
  (prioridad); `paso_prueba_tecnica===true` → `'paso'`; si no `'sin_resultado'`.
- `etiquetaPruebaTecnica`: `'paso'`→"Pasó la prueba"; `'no_paso'`→"No pasó la prueba";
  default "Enviado a prueba".
- `aplicarResultadoPruebaLocal(candidato, {noPaso, motivo, procResp, ahora})`: devuelve
  **COPIA** con referencias nuevas en toda la cadena (candidato→entrevistas[0]→proceso).
  Es obligatorio crear referencias nuevas porque `_proceso()` es un computed memoizado
  por referencia; mutar en el sitio dejaría el pill sin actualizar hasta re-buscar.

## A5. Gate de Pago y Transporte (`pago-transporte.rules.ts`)

`CAMPOS_PAGO_TRANSPORTE` (11 campos, nombre backend → etiqueta): `forma_de_pago`
(Forma de pago), `numero_para_pagos` (Número para pagos), `Ccentro_de_costos`
(Centro de costos), `subcentro_de_costos` (Subcentro de costos), `porcentaje_arl`
(Porcentaje ARL), `cesantias` (Cesantías), `grupo` (Grupo), `categoria` (Categoría),
`operacion` (Operación), `fecha_ingreso` (Fecha de ingreso), `fecha_contrato`
(Fecha de contrato).

`faltantesDePagoTransporte(contrato)`:
- Si `!contrato` → `['Guardar el sub-tab "Pago y Transporte" de Contratación.']`.
- Filtra los campos vacíos (`vacio` = `null | undefined | trim === ''`; **no** usa
  `!valor` porque `porcentaje_arl` puede ser `0`).
- Regla extra: si `forma_de_pago` existe y **no** es `'Daviplata'` y falta
  `identification_number_tarjeta` → agrega "Número de tarjeta".

Exclusiones a propósito: `seguro_funerario`/`horas_extras` (booleanos, `false` válido);
`salario`/`auxilio_transporte` (deshabilitados en el form, no se envían);
**`contrasenia_asignada`** (el form la exige, pero es `write_only` en el serializer y
la API nunca la devuelve → exigirla bloquearía para siempre a todo candidato no-Daviplata).

## A6. Diálogo de Historial laboral (`mostrarTabla`, ts:1234-1371)

Origen: cédula = `numero_documento`. Endpoint: `listProcesosMiniByDocumento(ced)` →
`GET procesos/by-document-min/?numero_documento=<ced>` (siempre normaliza a array).

Regla de negocio: solo puede haber **UN CONTRATADO vigente** (el más reciente). Los
datos llegan del más reciente al más antiguo; el primer contratado activo es el
vigente; cualquier otro contratado posterior en la lista se marca RETIRADO (`contratadoAsignado`).

Mapeo de cada fila → `_estado` (en orden de prioridad del if/else, ts:1258-1292),
con `apl = String(row.aplica_o_no_aplica).toUpperCase()`:
1. `contrato_activo === false` → **RETIRADO**, `_motivo = motivo_retiro`.
2. `contratado === true` → **CONTRATADO** (primero) / **RETIRADO** (siguientes) + `motivo_retiro`.
3. `rechazado === true || apl ∈ {NO_APLICA, NO APLICA}` → **911**, `_motivo = motivo_no_aplica || detalle`.
4. `no_paso_prueba_tecnica === true` → **NO PASÓ PRUEBA**, `_motivo = motivo_no_paso_prueba_tecnica`.
5. `paso_prueba_tecnica === true` → **PASÓ PRUEBA**.
6. `prueba_tecnica === true` → **PRUEBA TÉCNICA**.
7. `apl === 'EN_ESPERA'` → **ESPERA VACANTE**, `_motivo = motivo_espera`.
8. `apl === 'APLICA'` → **EN PROGRESO**.
9. else → `''`.

Campos derivados por fila:
- `_ingreso_date = contrato_fecha_ingreso || ingreso_at || null`.
- `_prueba`: `no_paso_prueba_tecnica` → `'NO PASÓ'`; `paso_prueba_tecnica` → `'PASÓ'`;
  si no `''`. **Independiente del estado** (se ve el resultado aunque el estado sea RETIRADO/CONTRATADO).
- `_fecha_resultado_prueba = no_paso_prueba_tecnica_at || paso_prueba_tecnica_at || null`.
- `_motivo` se sobreescribe con `motivo_no_paso_prueba_tecnica` **si existe, sea cual sea el estado**.

Columnas (`ColumnDefinition[]`, name / header / type / width):
- `oficina` / Oficina / text / 90px
- `entrevista_created_at` / Entrevista / date / 100px
- `_estado` / Estado / status / 120px — `statusConfig`:
  CONTRATADO `#fff/#2E7D32`, RETIRADO `#fff/#78909C`, 911 `#fff/#C62828`,
  PRUEBA TÉCNICA `#fff/#1565C0`, PASÓ PRUEBA `#fff/#2E7D32`, NO PASÓ PRUEBA `#fff/#C62828`,
  ESPERA VACANTE `#000/#FFD54F`, EN PROGRESO `#fff/#00897B`.
- `_prueba` / Prueba / status / 90px — PASÓ `#fff/#2E7D32`, NO PASÓ `#fff/#C62828`.
- `empresaUsuariaSolicita` / Empresa / text / 130px
- `finca` / Finca / text / 110px
- `_ingreso_date` / Ingreso / date / 95px
- `fecha_retiro` / Retiro / date / 95px
- `_fecha_resultado_prueba` / Fecha resultado prueba técnica / date `dd/MM/yyyy HH:mm` / 190px
- `_motivo` / Motivo / text / 160px

Config del diálogo: `maxWidth: '95vw'`, `height: '92vh'`, `maxHeight: '95vh'`,
`pageSize: 12`, `pageSizeOptions: [12,24,36]`, `panelClass: 'table-dialog'`.
En `styles.css` la clase `.table-dialog` recorta las celdas en una línea con "…" y
tooltip nativo (scopeado solo a este diálogo).

## A7. Otras acciones del header

Toolbar `.premium-toolbar` (casi todos `[disabled]="!numero_documento"`):
1. **Correo bienvenida** (`email`) → `confirmarCorreoBienvenida()`; badge ✓ si
   `contacto.correo_confirmado`; confirma vía `PATCH candidatos/<id>/confirmar-contacto/`.
2. **WhatsApp bienvenida** (`chat`) → `confirmarWhatsAppBienvenida()`; abre `wa.me`.
3. **Generar carnet** (`badge`) → `generarCarnetIndividual()` (PDF doble cara con
   jsPDF + QR, sube doc type 102, marca `contrato.carnet_generado`).
4. **Documentación** (`description`) → routerLink a `generate-contracting-documents`,
   `[disabled]="!puedeGenerarDocumentacion()"` (ver A3.2).
5. **Ver tabla** (`table_chart`) → `mostrarTabla()` (Historial laboral).
6. **Ver huella** (`fingerprint`), **Ver firma** (`edit`) → `ver('huella'|'firma')`.
7. **Ver examen médico** (`medical_services`) → `verExamenMedico()` (doc 32).
8. **Ver ARL** (`health_and_safety`) → `verArl()` (doc 30).

Pills del header (izquierda): prueba técnica (A4), contrato activo/inactivo,
estado del formulario web (`Formulario completo` / `Paso 1` / `Sin iniciar`).
Avatar/foto clicable → `openCamera()`.

Banners: contrato activo, y "EN ESPERA/NO APLICA" (`bloqueado()` / `motivoBloqueo()`,
delegados a `SeleccionEstadoService`).

## A8. Cámara / biometría / foto

`openCamera()`: abre `CameraDialogComponent` (`width:720px`, `disableClose:true`).
Con el resultado sube la foto con `uploadFotoWithRetry` (reintentos con backoff
exponencial para status `{0,408,425,429,500,502,503,504}`) → `POST biometria/upload/foto`
(FormData `numero_documento` + `file`). Luego refresca biometría (`GET biometria/<cedula>/`)
y foto (doc 89). Tipos: FOTO=89, HUELLA=88, FIRMA=87, examen=32, ARL=30, carnet=102.

## A9. Componentes hijos

### A9.1 `search-for-candidate` — Tab "Turnos"
Cola/tabla del día por orden de llegada. Columnas: #, Documento, Apellidos Nombres,
Hora de llegada, Oficina, Barrio, Municipio, Departamento, Edad, Experiencia,
Antecedentes, Formulario, botón Atender.

- **Antecedentes (6 fuentes bloqueantes)**: Contraloría, ADRES, Sisbén, Policivos,
  Procuraduría, OFAC. Estados: `SIN_CONSULTAR`/`EN_PROGRESO`/`FINALIZADO`/`BLOQUEADO`/`RECHAZADO_INCUMPLIMIENTO`.
- **Búsqueda** (`buscarCandidato`): (1) `asegurarEstadoRobot` (crea/resetea fila
  EstadosRobots, tolerante a fallos); (2) `getCandidatoPorDocumento(cedula, true)` →
  emite candidato o `null`; (3) si `encolarEnTabla` activo → `encolarCandidato` (idempotente).
- Tipos de documento: CC, CE, TI, PEP, PPT, PT, PA (default CC).
- Polling de la lista cada 3000 ms, límite 50, filtrado por sede; dedup por `numero_documento`.
- **Atender turno** (`seleccionarReciente`): marca optimista + `markAttended` + `buscarCandidato`.
- Excel por rango de turnos (`downloadTurnosExcel`). Reporte de vetado/observación (VetadosService).
- Endpoints: `candidatos/recientes/`, `candidatos/mark-attended/`, `candidatos/encolar/`,
  `candidatos/asegurar-estado-robot/`, `candidatos/by-document/<doc>?full=1&include_queue=1`,
  `reporte/turnos-excel/`.
- Bloqueos: ninguno por estado; "Consultar" `[disabled]="!cedula"`.

### A9.2 `selection-questions` — Tab "ANTECEDENTES"
Formulario data-driven de antecedentes judiciales y documentos.
- Campos tipo `estado` (CUMPLE / NO CUMPLE / SIN BUSCAR): Policivos, Procuraduría,
  Contraloría, OFAC, Rama Judicial.
- Campos tipo `list`: EPS (23 opciones), Sisbén (A1..D21/No Aplica/Sin Buscar),
  AFP (PORVENIR/COLFONDOS/PROTECCION/COLPENSIONES), Medidas Correctivas (0..10 + CUMPLE).
- Campo `number`: Semanas cotizadas.
- Carga: input `candidatoSeleccionado`; `effect` extrae cédula, `cola_antecedentes`, y
  hace patch desde `proceso.antecedentes` (mapeo nombre BD→key en `MAP_NOMBRE_TO_KEY`).
- Documentos por `typeMap`: eps=7, policivos=6, procuraduria=3, contraloria=4,
  medidasCorrectivas=10, afp=11, ramaJudicial=12, sisben=8, ofac=5, figuraHumana=31, pensionSemanas=33.
- Cola del robot (píldoras): `colaKeyMap` mapea cada doc a su clave en `cola_antecedentes`
  (eps→adress, policivos→policivo, procuraduria→procuraduria, contraloria→contraloria,
  ofac→ofac, sisben→sisben, medidasCorrectivas→medidas_correctivas, afp→fondo_pension).
- Polling de documentos: cada 2500 ms, máx 12 intentos (~30s), merge sin resetear.
- Subir archivo: **solo PDF**, nombre ≤ 100 caracteres.
- **Guardar** (botón "Cargar"): `POST procesos/seleccion-by-document` con `AntecedentesPayload`
  normalizado; luego sube los archivos cambiados con `guardarDocumento` (tipo `tipo_documento`
  no-CC prefija owner_id con "x").
- Bloqueos: no hay bloqueo por estado; los controls no tienen `required` (rara vez inválido).

### A9.3 `help-information` — Tab "Selección" (sub-tabs Entrevista y Remisión)
Dos sub-tabs: "Entrevista" (renderiza `<app-form-entrevista>`) y "Remisión" (form de vacantes).

**Remisión — selección de vacante**: `mat-select` único agrupado Empresa→Finca→Cargo
con buscador. `vacantesAgrupadas` filtra inactivas y las de 0 faltantes (excepto la
seleccionada), límite 60. Opción centinela "Sin vacante" (`SIN_VACANTE = -1`) que limpia
la remisión. KPIs por vacante (Req/Falt/Entr/Pru/Auto/Exm/Firm). Chip "Auto" con tooltip
**"Contratación inmediata"**.

**Campos del form**: `tipo`, `empresaUsuaria`, `cargo`, `area`, `fechaIngreso`, `salario`,
`fechaPruebaEntrevista`, `horaPruebaEntrevista`, `direccionEmpresa`. Ninguno con `required`
en el FormGroup; validación imperativa en `guardarVacantes()`.
- Condicionales: Autorización → Fecha ingreso + Salario; Prueba técnica → Área, Fecha/Hora
  de prueba, Dirección empresa.

**Mapeo de tipo (CRÍTICO)** — el select muestra:
- `value="Autorización de ingreso"` → label visible **"Contratación inmediata"**.
- `value="Prueba técnica"` → "Prueba técnica".
- `mapApiTipoToForm(apiVal)`: `prueba*` → `'Prueba técnica'`; empieza por `contrat...`
  o contiene `autorizacion`+`ingreso` → `'Autorización de ingreso'`.
- Payload (`guardarVacantes`): `v.pruebaOContratacion` → `'Prueba'`→`'Prueba técnica'`,
  `'Contratación'`→`'Autorización de ingreso'`. Ese es el `vacante_tipo` persistido.

**Bloque "No pasó la prueba técnica"** (solo si `isPrueba()`): banner rojo con fecha+motivo;
botón que abre Swal textarea (motivo obligatorio, ≥5 y ≤500 caracteres);
`marcarNoPasoPrueba()` → `PATCH update-by-document {no_paso_prueba_tecnica:true, motivo_no_paso_prueba_tecnica}`.
Botón "Quitar marca" → `quitarNoPasoPrueba()` → `PATCH {no_paso_prueba_tecnica:false}`.

**Bloqueo `bloqueado()`** (EN_ESPERA / NO_APLICA): viene del singleton
`SeleccionEstadoService` (`bloqueado = enEsperaVacante() || noAplica()`), escrito por
`form-entrevista` al evaluar la observación del evaluador. Deshabilita el select de vacante
y el botón Guardar; `guardarVacantes`/`marcarNoPasoPrueba`/`quitarNoPasoPrueba` salen
temprano con Swal si está bloqueado.

**Guardar Remisión** (`guardarVacantes`): valida vacante seleccionada, `tipo`, `numero_documento`.
Payload `{numero_documento, publicacion:v.id, vacante_tipo, vacante_fecha_prueba, vacante_salario,
prueba_tecnica:(tipo==='Prueba técnica'), autorizado:(tipo==='Autorización de ingreso')}` →
`PATCH procesos/update-by-document/`. "Sin vacante" → `PATCH {publicacion:null, ... prueba_tecnica:false, autorizado:false}`.

Carga de vacantes: `getVacantesPorOficina(sede)` → `GET publicacion/vacantes-por-nombre-oficina/<sede>/`.

### A9.4 `form-entrevista` — sub-tab Entrevista
Formulario grande (~1534 líneas) con **7 secciones** validadas por bloque (`step1..step7`):
1. Identificación y documento — `oficina` (disabled salvo GERENCIA, required), `tipo_doc`,
   `numero_documento` (pattern `/^X?\d+$/i`, 6-15), `fecha_expedicion`, `mpio_expedicion`.
2. Datos personales — apellidos/nombres (required los primeros), `fecha_nacimiento`, `edad`
   (calculada, disabled), `mpio_nacimiento`, `sexo`, `estado_civil`.
3. Contacto/domicilio — `correo_electronico` (email), `direccion_de_residencia`, `barrio`,
   `celular`/`whatsapp` (pattern `/^3\d{9}$/`), `personas_con_quien_convive` (≥1), `hace_cuanto_vive`.
4. Información familiar — `tieneHijos`; si sí: `cuidadorHijos`, `numeroHijos` (≥1) + FormArray
   `hijos` `{numero_de_documento, fecha_nac}`; referencias familiares/personales (opcionales).
5. Formación/experiencia flores — `nivel`, `estudiaActualmente`, `proyeccion1Ano`,
   `experienciaFlores` (Sí/No); si Sí: `tipoExperienciaFlores` (CULTIVO/POSCOSECHA/AMBAS/OTROS).
6. **Historial laboral** — FormArray `experiencias` (empresa, tiempo, labores, "Motivo retiro").
   Es una **sección del formulario**, NO el diálogo de Historial laboral.
7. Entrevista — `comoSeEntero`, `referenciado` (+`nombreReferenciado` si SI),
   **`aplicaObservacion`** (APLICA/NO_APLICA/EN_ESPERA; motivo obligatorio si no aplica/espera).
   **Este control publica el estado a `SeleccionEstadoService` y es el que produce el bloqueo**
   de Remisión/Exámenes/Contratación. Subgrupo "Evaluación" opcional.

Submit (`onSubmit`): si inválido, Swal listando secciones inválidas + scroll al primer error.
`PATCH candidatos/by-document-upsert` con `{...form, entrevistado:true}` (uppercase profundo
excepto email/correo/password; `numero_documento` prefija 'X' si tipo != CC).
`oficina` se hidrata desde query param y se bloquea (salvo GERENCIA).

---

<a name="parte-b"></a>
# PARTE B — Vacantes

Carpeta: `vacancies/`
- Página: `pages/vacantes/vacantes.component.{ts,html,css}`
- Diálogo: `components/cumplimiento-dialog/`
- Crear/editar: `components/crear-editar-vacante/`
- Servicios: `vacancies/service/vacantes/vacantes.service.ts` (base `/publicacion`),
  `vacancies/service/fincas/fincas.service.ts`

## B1. Página `vacantes.component`

Standalone, `OnPush`. Encabezado "Listado de Vacantes".

**Toggle de vista** (`mat-button-toggle-group`, `viewMode`): `table` (Todos),
`faltantes`, `completados`, `inactivas`. Persistido en localStorage (`vacantes:viewMode`).
`onToggleView` solo hace refetch al cruzar activas↔inactivas; el resto es filtro local.

**Menú global** (`more_vert`): Añadir Vacante (`openModal`), Subir Excel Vacantes
(**placeholder sin implementar**), Descargar Excel Vacantes (`descargarExcelVacantes`),
Formulario Pre Registro (abre URL externa).

**Tabla** (`app-standard-filter-table`, `[enableSelection]="true"`, páginas `[10,25,50]`).
Columnas: `actions` (sticky), `cumpl` (pill), `fechaPublicado` (date), `embudo`,
`finca` (Centro de costo), `cargo`, `empresaUsuariaSolicita`, `municipioLabel`,
`experiencia`, `perfil` (Obs./Descripción), `salario` (currency), `auxilioTransporte`,
`tipoContratacion`.

**Carga y mapeo**: `listarVacantes(activo)` (`GET /publicacion/publicaciones/?activo=`),
filtrado por sede del usuario. `enrichComputed` calcula del `conteo_estados`:
- `req = personasSolicitadas`, `entrev`, `prueba`, `auto`, `exm`, `firm = contratado`,
  `ing = ingreso`, `falt = max(0, req - firm)`, `cumpl = round(firm/req*100)` clamp 0..100.

**Embudo (8 chips)** — etiqueta / tooltip / origen:
| Chip | Tooltip | Origen |
|---|---|---|
| R | Requeridos | `personasSolicitadas` |
| Fa | Faltantes | `max(0, req - firm)` |
| En | Entrevistados | `conteo_estados.entrevistado` |
| Pr | Prueba técnica | `conteo_estados.prueba_tecnica` |
| **Au** | **Contratación inmediata** | `conteo_estados.autorizado` |
| Ex | Exámenes médicos | `conteo_estados.examenes_medicos` |
| Fi | **Firmados** = `contratado` | `conteo_estados.contratado` |
| In | Ingresados | `conteo_estados.ingreso` |

> Ojo: "Au" muestra la abreviatura de *autorizado* pero el tooltip dice "Contratación
> inmediata" (asimetría intencional). "Firmados" = `contratado`, no un contador de firmas.

**Pill de cumplimiento** por fila: `%` con semáforo (`>=100` verde, `>=70` naranja, resto rojo).
Click → abre `CumplimientoDialogComponent` (`panelClass: 'cumpl-dialog-panel'`) con
`{publicacionId, cargo, finca, empresa, req, firm, cumpl}`. Al cerrar, si devuelve `cambios`
truthy → `loadData()`.

**Filtros/búsqueda/paginación/selección**: los provee el componente compartido
`StandardFilterTable` (no la página). Selección múltiple vía su `SelectionModel` público.

**Acciones por fila**: Editar (`openModalEdit`), Eliminar (solo GERENCIA/ADMIN),
Activar/Inactivar (slide-toggle → `setActivo`, que si el cumplimiento < 100% exige motivo
≥10 caracteres). **Masivas** (barra si hay selección): Inactivar (forkJoin `cambiarEstadoActivo`),
Eliminar (solo permitidos).

**Descargas**: `descargarExcelVacantes` → `DateRangeDialogComponent` + `getVacantesExcel(start,end,sede)`
(`GET /publicacion/publicaciones-excel/`, blob) → `vacantes_<start>_<end>.xlsx`. El Excel lo genera el backend.

**Endpoints `VacantesService`**: `listarVacantes` (GET), `cambiarEstadoActivo` (PATCH),
`enviarVacante` (POST), `actualizarVacante` (PUT), `eliminarVacante` (DELETE),
`getVacantesExcel` (GET blob).

## B2. `cumplimiento-dialog` (el más importante)

Recibe `CumplimientoDialogData`: `publicacionId` (obligatorio), `cargo?`, `finca?`,
`empresa?`, `req?`, `firm?`, `cumpl?`.

Constantes fijas: `BMC_COMPANY = 'TU ALIANZA SAS'`, `BMC_PROVEEDOR = '900864596'`.

**Header/KPIs** (si `req != null`): Requeridos = `req`; Firmados = `firm` (verde);
Faltan = `max(0, req - firm)`; Cumplimiento = `cumpl %` con barra (semáforo `>=100`/`>=70`/resto).

**Carga de candidatos** (`cargar`): `getCandidatosPorVacante(publicacionId)` →
`GET procesos/candidatos-por-vacante/?publicacion=<id>` → `CandidatoPorVacanteItem[]`.
Tabla: checkbox, #, Candidato (avatar iniciales + nombre), Documento, Etapa (chip por
`etapaClass`, con tooltip de motivo si `no_paso_prueba_tecnica`).

**Campos disponibles del candidato** (`CandidatoPorVacanteItem`):
`proceso_id, tipo_doc, numero_documento, primer_nombre, segundo_nombre, primer_apellido,
segundo_apellido, apellidos_nombres, sexo, fecha_nacimiento, estado_civil, direccion,
barrio, celular, whatsapp, formacion, fecha_ingreso, vacante_tipo, etapa,
no_paso_prueba_tecnica?, no_paso_prueba_tecnica_at?, motivo_no_paso_prueba_tecnica?`.
**No** hay: lugar/fecha de expedición, lugar/ciudad de nacimiento, nacionalidad, RH/grupo
sanguíneo, EPS, AFP/pensión, ARL, cesantías, correo, tallas, n° hijos, supervisor/gerente,
código contrato → por eso esas columnas quedan en blanco en los formatos.

**Quitar vacante** (`quitarVacante`) — desasigna (no marca contratado):
1. Exige **selección explícita** (a diferencia de las descargas).
2. Por candidato: `PATCH update-by-document {publicacion:null, vacante_tipo:null, vacante_salario:null,
   vacante_fecha_prueba:null, prueba_tecnica:false, autorizado:false}`.
3. Concurrencia limitada: pool de **6 workers** con índice compartido y barra de progreso.
4. Optimista: `firmRemovidos` = removidos cuya etapa incluye `contrat`/`ingres`; baja `data.firm`
   y recalcula `data.cumpl`. Marca `cambios = true`.
5. Reconciliación silenciosa final (`cargar(true)`). Al cerrar devuelve `cambios` al padre.

**Descargas** (6 formatos; `objetivo()` = seleccionados o **todos** si no hay selección):
- **Base de candidatos** (`descargarBase`): `GET reporte/candidatos-excel/?cedulas=&persona=`
  (blob, generado por **backend**) → `base_vacante_<id>.xlsx`.
- **BMC** (`descargarBmc`): cliente con `xlsx`, 16 columnas fijas, `json_to_sheet`, hoja "BMC".
  Company/Proveedor fijos; fecha inicial = `fecha_ingreso`; teléfono = `celular||whatsapp`.
- **Flores del Río** (`descargarFlores`): hoja "base rio", 26 columnas, encabezado simple.
- **Sagaro** (`descargarSagaro`): hoja "formato de ingresos", 26 columnas, encabezado simple
  (NACIONALIDAD fija "COLOMBIANO").
- **HATO** (`descargarHato`): hoja "INGRESOS", 38 columnas, **doble encabezado con merges**
  (FECHA DE EXPEDICION cols 4-6, FECHA DE NACIMIENTO cols 8-10, SUBSIDIO cols 22-23);
  fecha de nacimiento partida en DIA/MES/AÑO; nombre completo en una columna.
- **San Carlos** (`descargarSanCarlos`): hoja "FORMATO INGRESOS", 40 columnas, doble encabezado
  (FECHA DE EXPEDICION cols 6-8, FECHA DE NACIMIENTO cols 10-12, SUBSIDIO cols 24-25);
  **fecha AÑO/MES/DIA**; nombre separado en APELLIDO 1/2 + NOMBRES.

Los 4 formatos por finca se **generan desde cero con `xlsx`** (no leen plantillas). Solo se
llenan las columnas con dato disponible; el resto queda en blanco.

Helper `construirDobleEncabezado(columnas, grupos, filas)`: crea la fila de sección con los
labels de grupo; genera merges **horizontales** por grupo (fila 0) y **verticales** (filas 0-1)
para las columnas sueltas; devuelve `{aoa:[seccion, columnas, ...filas], merges}`. `escribirLibro`
usa `aoa_to_sheet`, asigna `ws['!merges']` y `XLSX.writeFile`.

## B3. `crear-editar-vacante`

Diálogo con `MomentDateAdapter` (formato `D/M/YYYY`), locale `es-CO`. Modo edición si recibe `data`.

Campos (required marcados): `personasSolicitadas` (total, ≥1), `cargo` (autocomplete),
`finca`/Centro de costo (autocomplete; al elegir autollena empresa/dirección/temporal vía
`FincasService.getFincaByNombre`), `direccion`, `empresaUsuariaSolicita`,
`temporal` (select: **APOYO LABORAL SAS** / **TU ALIANZA SAS**), `area` (select de catálogo),
`salario` (default 1750905), `tieneFechaIngreso` (Si/No), `fechadeIngreso` (condicional si Si),
`auxilioTransporte` (Si/No), `municipio` (multiselect con buscador), `barrio` (aux),
`pruebaOContratacion` (**"Prueba"→Prueba técnica** / **"Contratación"→Contratación inmediata**),
`fechadePruebatecnica`/`horadePruebatecnica`/`ubicacionPruebaTecnica` (condicionales si Prueba),
`descripcion`, `observacionVacante` (opcional), `tipoContratacion` (Obra Labor/Fijo <1año/Fijo 1año/Indefinido),
`experiencia` (SI/NO/AMBAS), `codigoElite` (opcional),
`municipiosDistribucion` (FormArray {municipio, cantidad}), `oficinasSeleccionadas` (multiselect),
`oficinasQueContratan` (FormArray {nombre, ruta}). Ocultos: `fechaPublicado`, `quienpublicolavacante`, `estadovacante`.

Validadores de grupo: `sumNoExcedeTotalValidator` (suma de distribución ≤ total) y
`sumIgualTotalValidator` (si hay distribución, suma = total).

**No persiste directamente**: `guardar()` valida y hace `dialogRef.close(getRawValue())`.
El padre (`vacantes.component`) valida de nuevo, arma el payload y llama `enviarVacante` (POST)
o `actualizarVacante` (PUT).

---

<a name="parte-c"></a>
# PARTE C — Endpoints consolidados

Base contratación: `${apiUrl}/gestion_contratacion`. Base documental: `${apiUrl}/gestion_documental`.
Base vacantes: `${apiUrl}/publicacion`.

| Método | Ruta | Usado por |
|---|---|---|
| GET | `candidatos/by-document/<doc>?full=1&include_queue=1` | search-for-candidate (carga candidato) |
| GET | `candidatos/recientes/?limit=&oficina=` | search-for-candidate (cola) |
| POST | `candidatos/mark-attended/` | search-for-candidate (atender) |
| POST | `candidatos/encolar/` | search-for-candidate |
| POST | `candidatos/asegurar-estado-robot/` | search-for-candidate |
| PATCH | `candidatos/by-document-upsert` | form-entrevista (guardar entrevista) |
| PATCH | `candidatos/<id>/confirmar-contacto/` | header (correo/whatsapp) |
| POST | `procesos/seleccion-by-document` | selection-questions (antecedentes) |
| POST/PATCH | `procesos/update-by-document/` | pill prueba, help-information (remisión), quitar vacante, dar de baja |
| GET | `procesos/by-document-min/?numero_documento=` | Historial laboral (dialog) |
| GET | `procesos/candidatos-por-vacante/?publicacion=` | cumplimiento-dialog |
| GET | `biometria/<cedula>/` | refresco biometría |
| POST | `biometria/upload/foto` | openCamera |
| GET | `reporte/candidatos-excel/?cedulas=&persona=` (blob) | descargarBase |
| GET | `reporte/turnos-excel/?start=&end=&oficina=` (blob) | search-for-candidate |
| GET | `gestion_documental/documentos/?cedula=` | selection-questions, refrescos de docs |
| POST | `gestion_documental/documentos/` (FormData) | guardar documentos |
| GET | `publicacion/publicaciones/?activo=` | página vacantes |
| PATCH | `publicacion/publicaciones/<id>/` | activar/inactivar vacante |
| POST | `publicacion/publicaciones/` | crear vacante |
| PUT | `publicacion/publicaciones/<id>/` | editar vacante |
| DELETE | `publicacion/publicaciones/<id>/` | eliminar vacante |
| GET | `publicacion/publicaciones-excel/?start=&end=&oficina=` (blob) | descargarExcelVacantes |
| GET | `publicacion/vacantes-por-nombre-oficina/<sede>/` | help-information (remisión) |

---

<a name="parte-d"></a>
# PARTE D — Tipos de documento y catálogos

**Tipos de documento (gestión documental)** usados en estas vistas:
- 3 = PROCURADURIA, 4 = CONTRALORIA, 5 = OFAC, 6 = POLICIVOS, 7 = EPS/ADRES,
  8 = SISBEN, 10 = MEDIDAS CORRECTIVAS, 11 = AFP, 12 = RAMA JUDICIAL,
  30 = ARL, 31 = FIGURA HUMANA, 32 = EXAMEN MÉDICO, 33 = PENSIÓN/SEMANAS,
  87 = FIRMA, 88 = HUELLA, 89 = FOTO, 102 = CARNET.

**Fuentes de antecedentes del robot (6 bloqueantes)**: contraloria, adress, sisben,
policivo, procuraduria, ofac. (fondo_pension y medidas_correctivas son opcionales, no bloquean.)

**`conteo_estados`** (embudo de vacantes): `pre_registro, entrevistado, prueba_tecnica,
autorizado, examenes_medicos, contratado, ingreso, total_con_su_ultimo_registro`.

**Estados de proceso** (banderas booleanas en `ProcesoCandidato`): `pre_registro,
entrevistado, prueba_tecnica, no_paso_prueba_tecnica, paso_prueba_tecnica, autorizado,
examenes_medicos, contratado, ingreso, rechazado` (cada una con su `*_at`).

---

<a name="parte-e"></a>
# PARTE E — Notas de riesgo / puntos a validar 1:1

1. **La tab "Contratación" se bloquea SOLO por `contratoActivo()`**. El gate
   `deshabilitarContratacion()`/`_missingForContratacion()` **no** está cableado al
   `[disabled]` (html:460 comentado); solo alimenta un toast informativo.
2. **Código muerto**: `_etapasOk` (exige `remision===true`, requisito ya eliminado) y
   `_antecedentesCumplen` nunca se invocan. La lógica vigente está inline en `_missingForContratacion`.
3. **`remision` no es requisito** de Contratación (se eliminó).
4. **Terminología "Contratación inmediata"**: es el rótulo VISIBLE. El valor interno sigue
   siendo `vacante_tipo = "Autorización de ingreso"` (persistido) y la bandera `autorizado`.
   El chip "Au" del embudo y el select de remisión muestran "Contratación inmediata"; el
   dato viene de `autorizado`. No cambiar el valor interno.
5. **"No pasó la prueba técnica"** es marcador de resultado (no bloquea el pipeline actual),
   pero a nivel backend es **estado terminal**: la próxima vez que el candidato entra por
   turno se abre un ProcesoCandidato NUEVO (igual que rechazado/contratado/retirado).
6. **"Firmados" = `contratado`** en toda la vista de vacantes (no un contador de firmas).
   Cumplimiento = `contratado / personasSolicitadas`.
7. Los 4 formatos por finca (Flores/Sagaro/HATO/San Carlos) y el BMC se generan **100% en
   cliente con `xlsx`**; solo "Base de candidatos" usa endpoint backend. Muchas columnas
   quedan en blanco por falta de dato en `CandidatoPorVacanteItem`.
8. El diálogo de cumplimiento **muta `data.firm`/`data.cumpl` localmente** al quitar
   contratados; el refresco autoritativo ocurre al cerrar (padre → `loadData`).
9. **"Subir Excel Vacantes"** es un placeholder sin endpoint implementado.
10. **`mostrarTabla()` (Historial laboral) se abre también automáticamente** al seleccionar
    candidato, no solo por el botón.
11. **Dependencia de infraestructura**: la app apunta al backend interno
    `environment.ts → http://10.10.10.60:4545` (dev: `http://127.0.0.1:8000`);
    `formulario.tsservicios.co` se usa solo para media. Los campos `paso_prueba_tecnica`
    y `no_paso_prueba_tecnica` requieren las migraciones `0018` y `0019` de
    `gestion_contratacion` aplicadas en el backend.
12. Filtros/búsqueda/paginación/selección de la tabla de vacantes viven en el componente
    compartido `StandardFilterTable` (shared/components/standard-filter-table). Para portar
    la vista hay que llevar también ese componente (o replicar sus `@Input`: `data`,
    `columnDefinitions`, `enableSelection`, `pageSizeOptions`, `defaultPageSize`, y su API
    pública `selection: SelectionModel`).
