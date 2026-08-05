/**
 * Modelo TypeScript del contrato de la API de Incapacidades v2.
 *
 * Espeja 1:1 lo que expone ms-hr:
 *   POST   /Incapacidades/v2/validar        -> ValidacionResponse   [STATELESS]
 *   POST   /Incapacidades/v2                -> IncapacidadV2 (201)
 *   GET    /Incapacidades/v2                -> Page<IncapacidadResumen>
 *   GET    /Incapacidades/v2/{id}           -> IncapacidadV2
 *   PUT    /Incapacidades/v2/{id}           -> IncapacidadV2
 *   POST   /Incapacidades/v2/{id}/validar   -> 200 | 409 { motivosBloqueo }
 *   DELETE /Incapacidades/v2/{id}           -> 204
 *   GET    /Incapacidades/v2/catalogos      -> CatalogosIncapacidad
 *
 * REGLA IMPORTANTE: los union types de abajo son SOLO para tipado. Las listas
 * que alimentan los desplegables NO se hardcodean aqui: se piden a
 * `GET /Incapacidades/v2/catalogos` (ver `IncapacidadV2Service.catalogos()`),
 * que devuelve `{ codigo, etiqueta, automatico? }` y es la unica fuente de
 * verdad de las etiquetas mostradas al usuario.
 *
 * Los codigos replican exactamente los enums Java de
 * `co.tsservicios.mshr.incapacidades.domain`.
 */

// ─────────────────────────────────────────────────────────────────────────
// Union types (tipado; las opciones visibles vienen del endpoint catalogos)
// ─────────────────────────────────────────────────────────────────────────

/** Espeja `domain/TipoIncapacidad.java`. */
export type TipoIncapacidad =
  | 'ENFERMEDAD_GENERAL'
  | 'ACCIDENTE_TRABAJO'
  | 'ENFERMEDAD_LABORAL'
  | 'ACCIDENTE_TRANSITO'
  | 'LICENCIA_MATERNIDAD'
  | 'LICENCIA_PATERNIDAD';

/** Espeja `domain/EstadoIncapacidad.java`. */
export type EstadoIncapacidad =
  | 'RECIBIDA'
  | 'VALIDADA'
  | 'PENDIENTE_RADICACION'
  | 'RADICADA'
  | 'EN_REVISION_EPS'
  | 'PAGADA'
  | 'NEGADA'
  | 'RECOBRO'
  | 'NUEVA_RESPUESTA'
  | 'PENDIENTE_CONCILIACION'
  | 'CONCILIADA'
  | 'FINALIZADA'
  | 'CANCELADA';

/**
 * Espeja `domain/EstadoDocumento.java`.
 * `PRESCRITA` y `NO_CUMPLE` son AUTOMATICOS (los pone el motor de reglas,
 * el usuario no deberia poder elegirlos: el catalogo los marca con
 * `automatico: true`).
 */
export type EstadoDocumento =
  | 'OK'
  | 'INCOMPLETA'
  | 'ILEGIBLE'
  | 'FALTA_HISTORIA_CLINICA'
  | 'FALTA_FURAT'
  | 'FALTA_FURIPS'
  | 'FALTA_REGISTRO_CIVIL'
  | 'FALTA_NACIDO_VIVO'
  | 'PRESCRITA'
  | 'NO_CUMPLE'
  | 'FALSA';

/** Espeja `domain/ResponsablePago.java`. */
export type ResponsablePago =
  | 'EMPLEADOR'
  | 'EPS'
  | 'ARL'
  | 'FONDO_PENSIONES'
  | 'EPS_Y_EMPLEADOR'
  | 'ARL_Y_EMPLEADOR'
  | 'PROPORCIONAL_COTIZADO'
  | 'NO_PAGAR';

/**
 * Espeja `domain/TipoSoporte.java`.
 * OJO: `SOAT` existe en `DocumentTypeCodes` (legacy Django) pero NO es un
 * `TipoSoporte` de la v2, por eso no aparece aqui.
 */
export type TipoSoporte =
  | 'INCAPACIDAD_MEDICA'
  | 'HISTORIAL_CLINICO'
  | 'REGISTRO_CIVIL'
  | 'REGISTRO_NACIDO_VIVO'
  | 'FURAT'
  | 'FURIPS'
  | 'FORMULARIO_SALUD_TOTAL';

/** Entidad que asume los dias que no paga el empleador. */
export type EntidadResponsable = 'EPS' | 'ARL';

/** Severidad de una alerta devuelta por el motor de reglas. */
export type NivelAlerta = 'INFO' | 'ADVERTENCIA' | 'CRITICA';

// ─────────────────────────────────────────────────────────────────────────
// Catalogos (GET /Incapacidades/v2/catalogos)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Opcion generica de un desplegable.
 * `automatico` solo viene poblado en `estadosDocumento`: cuando es `true`
 * el estado lo asigna el backend y la UI NO debe ofrecerlo para seleccion
 * manual.
 */
export interface OpcionCatalogo<C extends string = string> {
  codigo: C;
  etiqueta: string;
  automatico?: boolean;
}

/** Respuesta completa de `GET /Incapacidades/v2/catalogos`. */
export interface CatalogosIncapacidad {
  tiposIncapacidad: OpcionCatalogo<TipoIncapacidad>[];
  estados: OpcionCatalogo<EstadoIncapacidad>[];
  estadosDocumento: OpcionCatalogo<EstadoDocumento>[];
  responsablesPago: OpcionCatalogo<ResponsablePago>[];
  tiposSoporte: OpcionCatalogo<TipoSoporte>[];
}

// ─────────────────────────────────────────────────────────────────────────
// Validacion (POST /Incapacidades/v2/validar)  — STATELESS, no persiste
// ─────────────────────────────────────────────────────────────────────────

/**
 * Request del motor de reglas. Todas las fechas en `yyyy-MM-dd`
 * (usa `aIsoCorto` de `../utils/fechas`, NUNCA `toISOString()`).
 */
export interface ValidarIncapacidadRequest {
  cedula: string;
  /** Fecha de ingreso del trabajador, `yyyy-MM-dd`. */
  fechaIngreso: string;
  tipoIncapacidad: TipoIncapacidad;
  /** `yyyy-MM-dd`. */
  fechaInicio: string;
  /** `yyyy-MM-dd`. */
  fechaFin: string;
  codigoDiagnostico: string;
  /** Nombre de la EPS ya normalizado (con `trim()`: llega con espacios finales). */
  eps: string;
  estadoDocumento: EstadoDocumento;
  /** Soportes que el usuario ya adjunto. */
  soportesCargados: TipoSoporte[];
  /** Al editar: id de la incapacidad en curso, para que no se traslape consigo misma. */
  excluirId?: number;
}

/** Un soporte, con su visibilidad/obligatoriedad ya resueltas por las reglas. */
export interface SoporteRequerido {
  tipo: TipoSoporte;
  etiqueta: string;
  /** Si `false`, la UI no debe mostrar la casilla. */
  visible: boolean;
  /** Si `true`, sin el archivo no se puede promover a VALIDADA. */
  obligatorio: boolean;
  /** `true` si el request declaro este soporte como cargado. */
  cargado: boolean;
}

/** Alerta del motor de reglas para pintar en el panel lateral. */
export interface AlertaValidacion {
  nivel: NivelAlerta;
  /** Codigo estable de la regla (ej. `R7_SUPERADO_180`). */
  codigo: string;
  mensaje: string;
}

/** Respuesta de `POST /Incapacidades/v2/validar`. */
export interface ValidacionResponse {
  /** Dias calendario de la incapacidad (ambos extremos incluidos). */
  dias: number;
  /** Dias a cargo del empleador. */
  diasEmpresa: number;
  /** Dias a cargo de la EPS/ARL. */
  diasEntidad: number;
  entidadResponsable: EntidadResponsable;
  responsablePago: ResponsablePago;

  esProrroga: boolean;
  /** Id de la incapacidad de la que esta es prorroga, si aplica. */
  prorrogaDeId: number | null;

  tieneTraslape: boolean;
  /** Ids de incapacidades que se cruzan con el rango enviado. */
  idsTraslapados: number[];

  cumpleCotizacion: boolean;
  diasDesdeIngreso: number;

  estaPrescrita: boolean;
  diasHabilesTranscurridos: number;

  /** Dias acumulados del mismo diagnostico en la ventana legal. */
  diasAcumuladosDiagnostico: number;
  superado180: boolean;
  superado540: boolean;
  proximoA180: boolean;

  /** Estado documental que quedaria tras aplicar las reglas automaticas. */
  estadoDocumentoResultante: EstadoDocumento;
  /** Estado de gestion sugerido para la incapacidad. */
  estadoSugerido: EstadoIncapacidad;

  /** `false` => el boton "Validar" debe quedar deshabilitado. */
  puedeValidar: boolean;
  /** Razones legibles por las que no se puede validar. */
  motivosBloqueo: string[];

  soportes: SoporteRequerido[];
  alertas: AlertaValidacion[];
}

// ─────────────────────────────────────────────────────────────────────────
// Escritura (POST / PUT /Incapacidades/v2)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Payload de creacion/actualizacion.
 *
 * Contiene el mismo nucleo que `ValidarIncapacidadRequest` mas los datos
 * de contexto que el motor de reglas no necesita pero si se persisten
 * (trabajador, IPS, ARL, trazabilidad del usuario que recibe).
 *
 * `PUT /Incapacidades/v2/{id}` usa exactamente esta misma forma.
 */
export interface CrearIncapacidadV2Request {
  // ── Trabajador ──────────────────────────────────────────────────────
  cedula: string;
  tipoDocumento?: string;
  /* El backend guarda el nombre DESGLOSADO: no acepta `nombreCompleto`
     (CrearIncapacidadV2Request no lo declara y Jackson rechaza el cuerpo entero
     con 400 ante un campo desconocido). El nombre completo se arma al leer. */
  primerApellido?: string;
  segundoApellido?: string;
  primerNombre?: string;
  segundoNombre?: string;
  /** `yyyy-MM-dd`. */
  fechaIngreso: string;
  /** `yyyy-MM-dd`; puede ser null si la fecha guardada era basura. */
  fechaNacimiento?: string | null;
  /** Calculada desde `fechaNacimiento` con `calcularEdad`, nunca desde `edadTrabajador`. */
  edad?: number | null;
  /** El backend lo llama `sexo`, no `genero`. */
  sexo?: string;
  celular?: string;
  correo?: string;
  empresa?: string;
  centroCosto?: string;
  /** Etiqueta ya resuelta: "Apoyo Laboral" | "Tu Alianza" | el crudo si es desconocido. */
  temporal?: string;
  numeroContrato?: string;
  /** EPS normalizada con `trim()`. */
  eps: string;
  /** Fondo de pension obligatoria: viene de `afp.afp`, NUNCA de `afp.afc` (cesantias). */
  afp?: string;
  /** No existe como dato en ninguna tabla: se elige a mano, por defecto "ARL SURA". */
  arl?: string;

  // ── Incapacidad ─────────────────────────────────────────────────────
  tipoIncapacidad: TipoIncapacidad;
  /** `yyyy-MM-dd`. */
  fechaInicio: string;
  /** `yyyy-MM-dd`. */
  fechaFin: string;
  codigoDiagnostico: string;
  descripcionDiagnostico?: string;
  /** Numero impreso en el documento de la EPS/IPS. */
  numeroIncapacidad?: string;
  /* esProrroga, prorrogaDeId y responsablePago NO se envian: los decide el motor
     de reglas del servidor y el DTO de creacion ni siquiera los declara. */
  nitIps?: string;
  /** El backend lo llama `ipsNombre`, no `nombreIps`. */
  ipsNombre?: string;

  // ── Gestion documental ──────────────────────────────────────────────
  estadoDocumento: EstadoDocumento;
  soportesCargados?: TipoSoporte[];
  observaciones?: string;

  // ── Trazabilidad (autocompletado desde el usuario logueado) ─────────
  /** Sede/oficina. Obligatoria: nunca se guarda vacia. */
  oficina: string;
  /** Nombre de quien recibe: sale del usuario logueado. El backend lo llama `recibidoPor`. */
  recibidoPor: string;
  /** Id del usuario en sesion, para trazabilidad. */
  recibidoPorId?: string;
  /** Quien ejecuta la accion; hoy el gateway no inyecta los headers X-User-*. */
  actor?: string;
  actorRol?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Lectura (GET /Incapacidades/v2/{id} y GET /Incapacidades/v2)
// ─────────────────────────────────────────────────────────────────────────

/** Documento adjunto ya persistido. */
export interface SoporteAdjunto {
  tipo: TipoSoporte;
  /** Campo legacy de Django con el que se subio (`link_incapacidad`, ...). */
  legacyField?: string;
  /** Puede venir relativo (`/media/...`): resolverlo contra `environment.apiUrl`. */
  fileUrl?: string;
  nombreArchivo?: string;
  sha256?: string;
  /** ISO 8601 con hora. */
  subidoEn?: string;
}

/** Detalle completo: `IncapacidadV2Response` del backend. */
/**
 * Respuesta de GET/POST/PUT /Incapacidades/v2 (`IncapacidadV2Response` del backend).
 *
 * NO extiende `CrearIncapacidadV2Request`: son contratos DISTINTOS. La peticion
 * de creacion no lleva los campos que decide el motor de reglas (esProrroga,
 * responsablePago, diasEmpresa...) y la respuesta si los trae. Heredar uno del
 * otro fue lo que produjo el 400 "Unrecognized field": el formulario enviaba
 * campos de lectura que el DTO de escritura no declara.
 *
 * Los nombres de abajo estan copiados uno a uno de los @JsonProperty del backend.
 * Casi todo es opcional a proposito: el backend puede dejar nulos los calculados
 * mientras la incapacidad esta en RECIBIDA.
 */
export interface IncapacidadV2 {
  id: number;
  /** Clave de negocio: cedula + '_' + fechaInicio(yyyyMMdd). El backend NO devuelve `consecutivoSistema`. */
  codigoUnico?: string;

  // ── Trabajador ──────────────────────────────────────────────────────
  cedula?: string;
  tipoDocumento?: string;
  primerApellido?: string;
  segundoApellido?: string;
  primerNombre?: string;
  segundoNombre?: string;
  /** Lo arma el backend; en la peticion de creacion NO se envia. */
  nombreCompleto?: string;
  fechaNacimiento?: string;
  edad?: number;
  sexo?: string;
  empresa?: string;
  centroCosto?: string;
  temporal?: string;
  numeroContrato?: string;
  fechaIngreso?: string;
  eps?: string;
  afp?: string;
  arl?: string;
  celular?: string;
  correo?: string;

  // ── Recepcion ───────────────────────────────────────────────────────
  oficina?: string;
  recibidoPor?: string;
  recibidoPorId?: string;

  // ── Incapacidad ─────────────────────────────────────────────────────
  tipoIncapacidad?: TipoIncapacidad;
  tipoIncapacidadEtiqueta?: string;
  fechaInicio?: string;
  fechaFin?: string;
  dias?: number;
  codigoDiagnostico?: string;
  descripcionDiagnostico?: string;
  nitIps?: string;
  ipsNombre?: string;
  numeroIncapacidad?: string;

  // ── Calculado por el motor de reglas (solo lectura) ─────────────────
  esProrroga?: boolean;
  prorrogaDeId?: number | null;
  tieneTraslape?: boolean;
  cumpleCotizacion?: boolean;
  diasDesdeIngreso?: number;
  estaPrescrita?: boolean;
  diasHabilesTranscurridos?: number;
  diasEmpresa?: number;
  diasEntidad?: number;
  responsablePago?: ResponsablePago;
  responsablePagoEtiqueta?: string;
  entidadResponsable?: EntidadResponsable;
  diasAcumuladosDiagnostico?: number;

  // ── Workflow ────────────────────────────────────────────────────────
  estado?: EstadoIncapacidad;
  estadoEtiqueta?: string;
  estadoDocumento?: EstadoDocumento;
  estadoDocumentoEtiqueta?: string;
  observaciones?: string;
  soportesCargados?: string[];
  activo?: boolean;

  // ── Auditoria (ISO-8601) ────────────────────────────────────────────
  creadoPor?: string;
  creadoEn?: string;
  actualizadoPor?: string;
  actualizadoEn?: string;

  // ── Extras ──────────────────────────────────────────────────────────
  soportes?: SoporteAdjunto[];
  validacion?: ValidacionResponse;
}

/** Fila de la tabla: `IncapacidadResumenResponse` del backend. */
export interface IncapacidadResumen {
  id: number;
  consecutivoSistema: string;
  cedula: string;
  nombreCompleto: string;
  tipoIncapacidad: TipoIncapacidad;
  /** `yyyy-MM-dd`. */
  fechaInicio: string;
  /** `yyyy-MM-dd`. */
  fechaFin: string;
  dias: number;
  estado: EstadoIncapacidad;
  estadoDocumento: EstadoDocumento;
  responsablePago: ResponsablePago;
  eps: string;
  empresa?: string;
  centroCosto?: string;
  oficina?: string;
  codigoDiagnostico?: string;
  esProrroga?: boolean;
  /** Para pintar el punto rojo/amarillo en la fila. */
  nivelAlertaMaximo?: NivelAlerta | null;
  creadoEn?: string;
}

/** Filtros aceptados por `GET /Incapacidades/v2`. */
export interface FiltrosIncapacidadV2 {
  /** Texto libre: cedula, nombre o consecutivo. */
  q?: string;
  cedula?: string;
  estado?: EstadoIncapacidad;
  estadoDocumento?: EstadoDocumento;
  tipoIncapacidad?: TipoIncapacidad;
  responsablePago?: ResponsablePago;
  eps?: string;
  empresa?: string;
  centroCosto?: string;
  oficina?: string;
  /** Rango sobre `fechaInicio`, `yyyy-MM-dd`. */
  desde?: string;
  /** Rango sobre `fechaFin`, `yyyy-MM-dd`. */
  hasta?: string;
}

/**
 * Pagina estilo Spring Data (`Page<T>`).
 * Los campos opcionales se declaran asi para tolerar respuestas recortadas.
 */
export interface Page<T> {
  content: T[];
  /** Indice de pagina, base 0. */
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first?: boolean;
  last?: boolean;
  numberOfElements?: number;
  empty?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Promocion a VALIDADA (POST /Incapacidades/v2/{id}/validar)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resultado normalizado de promover una incapacidad a VALIDADA.
 * El 409 del backend NO se propaga como error: se traduce a
 * `{ ok: false, motivosBloqueo }` para que la UI lo pinte.
 */
export interface ResultadoPromocion {
  ok: boolean;
  /** Vacio cuando `ok === true`. */
  motivosBloqueo: string[];
  /** Detalle devuelto por el backend en el 200, si lo envia. */
  incapacidad?: IncapacidadV2;
}

// ─────────────────────────────────────────────────────────────────────────
// Endpoints de contratacion reutilizados
// ─────────────────────────────────────────────────────────────────────────

/** Fila de `GET /contratacion/empleados/buscar?q=&limit=`. */
export interface EmpleadoBusqueda {
  cedula: string;
  nombreCompleto: string;
  tipoDocumento: string;
  empresa: string;
  centroCosto: string;
  /** Codigo crudo: "AL" | "TA" (a veces nulo o con ruido). */
  temporal: string;
  numeroContrato: string;
  /** `yyyy-MM-dd`. */
  fechaIngreso: string;
  /** Puede llegar con espacios finales ("NUEVA EPS "). */
  eps: string;
  afp: string;
  oficina: string;
}

/**
 * `GET /contratacion/datosIncapacidadContratacion/{cedula}`.
 * Se conservan los nombres snake_case tal cual los devuelve el backend
 * legacy; el mapeo a camelCase lo hace la vista.
 */
export interface DatosContratacionResponse {
  datos_basicos?: DatosBasicosContratacion;
  contratacion?: BloqueContratacion;
  afp?: BloqueAfp;
}

export interface DatosBasicosContratacion {
  numerodeceduladepersona?: string;
  tipodedocumento?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  /** Contratacion lo devuelve como `genero` (el modelo de incapacidad lo llama `sexo`). */
  genero?: string;
  primercorreoelectronico?: string;
  celular?: string;
  whatsapp?: string;
  /** TEXTO en dos formatos mezclados (ISO y dd/MM/yyyy) + basura: usar `parsearFechaFlexible`. */
  fecha_nacimiento?: string;
  oficina?: string;
  /** Solo poblado en el 41% de los casos: NO usarlo, calcular desde `fecha_nacimiento`. */
  edadTrabajador?: string | number | null;
}

export interface BloqueContratacion {
  codigo_contrato?: string;
  fecha_contratacion?: string;
  /** Codigo crudo "AL" | "TA". */
  temporal?: string;
  cargo?: string;
  fechaIngreso?: string;
  centro_de_costos?: string;
  centro_costo_carnet?: string;
  /** Llega con espacios finales: normalizar con `trim()`. */
  nombre_eps_afiliada?: string;
  nombre_afp?: string;
  empresaUsuaraYCCentrodeCosto?: string;
}

export interface BloqueAfp {
  /** EPS. */
  eps?: string;
  /** Pension obligatoria: ESTE es el fondo de pensiones. */
  afp?: string;
  /** Cesantias. NO es el fondo de pension (bug del formulario viejo). */
  afc?: string;
}

/** Fila de `GET /Incapacidades/codigos-diagnostico/search`. */
export interface CodigoDiagnostico {
  codigo: string;
  descripcion: string;
}

/** Fila de `GET /Incapacidades/ips/search`. */
export interface IpsBusqueda {
  nit: string;
  nombre: string;
}

/** Respuesta de `GET /Incapacidades/traerTodaslistas`. */
export interface ListasIncapacidad {
  codigos: CodigoDiagnostico[];
  eps: unknown[];
  IPSNames: unknown[];
}

/** Respuesta de `POST /Incapacidades/{consecutivo}/documentos/upload`. */
export interface SubidaSoporteResponse {
  documentId?: string | number;
  versionId?: string | number;
  fileUrl?: string;
  sha256?: string;
  deduplicated?: boolean;
  error?: string;
  [clave: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────
// Mapeos auxiliares que la UI necesita y que NO vienen del backend
// ─────────────────────────────────────────────────────────────────────────

/**
 * `temporal` llega como codigo crudo. La rama por defecto devuelve el valor
 * original saneado para que nunca reviente ni muestre "undefined".
 */
export function etiquetaTemporal(codigo: string | null | undefined): string {
  const crudo = (codigo ?? '').toString().trim().toUpperCase();
  switch (crudo) {
    case 'AL':
      return 'Apoyo Laboral';
    case 'TA':
      return 'Tu Alianza';
    case '':
      return '';
    default:
      return (codigo ?? '').toString().trim();
  }
}

/**
 * ARL conocidas para el desplegable EDITABLE del formulario.
 * La ARL no existe como dato en ninguna tabla: el usuario la elige.
 */
export const ARL_CONOCIDAS: readonly string[] = [
  'ARL SURA',
  'POSITIVA',
  'COLMENA SEGUROS',
  'SEGUROS BOLIVAR',
  'LIBERTY SEGUROS',
  'AXA COLPATRIA',
  'MAPFRE',
  'EQUIDAD SEGUROS',
  'ALFA',
] as const;

/** Valor por defecto de la ARL segun la funcional. */
export const ARL_POR_DEFECTO = 'ARL SURA';
