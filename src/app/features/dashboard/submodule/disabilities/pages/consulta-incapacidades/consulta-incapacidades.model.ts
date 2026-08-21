/**
 * Tipos y utilidades EXCLUSIVOS de la vista de consulta/CRUD de incapacidades v2.
 *
 * Por que existe este archivo y no se toca `models/incapacidad-v2.model.ts`:
 *  - el contrato v2 del enunciado no detalla campo a campo el `IncapacidadResumenResponse`
 *    ni todos los filtros que pide la funcional (temporal, AFP, registrado por,
 *    rango de fecha de registro, soportes completos);
 *  - el backend se esta construyendo EN PARALELO, asi que todo lo que aqui se
 *    anade es OPCIONAL: si el backend no lo envia, la tabla pinta "—" y la vista
 *    sigue funcionando;
 *  - manteniendo la extension aqui, el modelo base sigue siendo el espejo limpio
 *    del contrato y no hay dos agentes escribiendo el mismo fichero.
 *
 * Cuando ms-hr publique el `IncapacidadResumenResponse` definitivo, lo unico que
 * hay que hacer es mover estos campos al modelo base y borrar la extension.
 */

import {
  CatalogosIncapacidad,
  EstadoDocumento,
  EstadoIncapacidad,
  FiltrosIncapacidadV2,
  IncapacidadResumen,
  IncapacidadV2,
  NivelAlerta,
  OpcionCatalogo,
  ResponsablePago,
  TipoIncapacidad,
  TipoSoporte,
} from '../../models/incapacidad-v2.model';

// ─────────────────────────────────────────────────────────────────────────
// Extensiones del contrato (todo opcional: el backend puede no enviarlo aun)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fila del listado con los campos extra que la funcional pidio ver/filtrar.
 * TODOS son opcionales a proposito: la vista degrada a "—" sin romperse.
 */
export interface IncapacidadResumenExtendido extends IncapacidadResumen {
  /** Dias a cargo del empleador. */
  diasEmpresa?: number | null;
  /** Dias a cargo de la EPS/ARL. */
  diasEntidad?: number | null;
  /** Cuantos soportes hay efectivamente adjuntos. */
  soportesAdjuntos?: number | null;
  /** Cuantos soportes exige el motor de reglas para este caso. */
  soportesExigidos?: number | null;
  /** Atajo del backend: `soportesAdjuntos >= soportesExigidos`. */
  soportesCompletos?: boolean | null;
  /** Etiqueta ya resuelta ("Apoyo Laboral" | "Tu Alianza"). */
  temporal?: string | null;
  /** Fondo de pension obligatoria (viene de `afp.afp`, nunca de `afc`). */
  afp?: string | null;
  numeroContrato?: string | null;
  /** Usuario que registro la incapacidad ("registrado por"). */
  creadoPor?: string | null;
  actualizadoEn?: string | null;
  actualizadoPor?: string | null;
}

/**
 * Filtros que la vista manda al SERVIDOR.
 * `IncapacidadV2Service.listar()` recorre las claves del objeto y descarta las
 * vacias, asi que estas claves extra viajan tal cual como query params.
 */
export interface FiltrosConsultaIncapacidad extends FiltrosIncapacidadV2 {
  /** "Apoyo Laboral" | "Tu Alianza" | valor crudo. */
  temporal?: string;
  /** Fondo de pension. */
  afp?: string;
  /** Usuario que registro. */
  registradoPor?: string;
  /** Rango sobre la fecha de registro (`creadoEn`), `yyyy-MM-dd`. */
  registradoDesde?: string;
  registradoHasta?: string;
  /** `'true'` = solo con todos los soportes; `'false'` = solo incompletas. */
  soportesCompletos?: 'true' | 'false';
}

/** Un paso de la linea de tiempo del detalle. */
export interface EventoHistorial {
  /** Codigo del estado alcanzado. */
  estado?: string;
  /** Etiqueta legible (si el backend ya la resuelve). */
  etiqueta?: string;
  /** ISO 8601. */
  fecha?: string;
  usuario?: string;
  comentario?: string;
}

/** Detalle completo + historico de estados (si el backend lo envia). */
export interface IncapacidadV2Detalle extends IncapacidadV2 {
  historial?: EventoHistorial[];
}

// ─────────────────────────────────────────────────────────────────────────
// Estilos de los chips (alimentan `statusConfig` de app-standard-filter-table)
// ─────────────────────────────────────────────────────────────────────────

/** Par de colores que entiende `ColumnDefinition.statusConfig`. */
export interface EstiloChip {
  color: string;
  background: string;
}

/** Chip por defecto cuando el codigo no esta en el mapa (nunca reventar). */
export const ESTILO_CHIP_NEUTRO: EstiloChip = {
  color: '#37474f',
  background: '#eceff1',
};

export const COLOR_ESTADO: Readonly<Record<EstadoIncapacidad, EstiloChip>> = {
  RECIBIDA: { color: '#1565c0', background: '#e3f2fd' },
  VALIDADA: { color: '#2e7d32', background: '#e8f5e9' },
  PENDIENTE_RADICACION: { color: '#b26a00', background: '#fff8e1' },
  RADICADA: { color: '#00838f', background: '#e0f7fa' },
  EN_REVISION_EPS: { color: '#3949ab', background: '#e8eaf6' },
  PAGADA: { color: '#00695c', background: '#e0f2f1' },
  NEGADA: { color: '#c62828', background: '#ffebee' },
  RECOBRO: { color: '#6a1b9a', background: '#f3e5f5' },
  NUEVA_RESPUESTA: { color: '#4527a0', background: '#ede7f6' },
  PENDIENTE_CONCILIACION: { color: '#ef6c00', background: '#fff3e0' },
  CONCILIADA: { color: '#33691e', background: '#f1f8e9' },
  FINALIZADA: { color: '#37474f', background: '#eceff1' },
  CANCELADA: { color: '#757575', background: '#f5f5f5' },
};

export const COLOR_ESTADO_DOCUMENTO: Readonly<Record<EstadoDocumento, EstiloChip>> = {
  OK: { color: '#2e7d32', background: '#e8f5e9' },
  INCOMPLETA: { color: '#b26a00', background: '#fff8e1' },
  ILEGIBLE: { color: '#ef6c00', background: '#fff3e0' },
  FALTA_HISTORIA_CLINICA: { color: '#b26a00', background: '#fff8e1' },
  FALTA_FURAT: { color: '#b26a00', background: '#fff8e1' },
  FALTA_FURIPS: { color: '#b26a00', background: '#fff8e1' },
  FALTA_REGISTRO_CIVIL: { color: '#b26a00', background: '#fff8e1' },
  FALTA_NACIDO_VIVO: { color: '#b26a00', background: '#fff8e1' },
  PRESCRITA: { color: '#c62828', background: '#ffebee' },
  NO_CUMPLE: { color: '#ad1457', background: '#fce4ec' },
  FALSA: { color: '#b71c1c', background: '#ffcdd2' },
};

export const COLOR_RESPONSABLE_PAGO: Readonly<Record<ResponsablePago, EstiloChip>> = {
  EMPLEADOR: { color: '#1565c0', background: '#e3f2fd' },
  EPS: { color: '#00838f', background: '#e0f7fa' },
  ARL: { color: '#ef6c00', background: '#fff3e0' },
  FONDO_PENSIONES: { color: '#6a1b9a', background: '#f3e5f5' },
  EPS_Y_EMPLEADOR: { color: '#00695c', background: '#e0f2f1' },
  ARL_Y_EMPLEADOR: { color: '#4e342e', background: '#efebe9' },
  PROPORCIONAL_COTIZADO: { color: '#3949ab', background: '#e8eaf6' },
  NO_PAGAR: { color: '#c62828', background: '#ffebee' },
};

export const COLOR_NIVEL_ALERTA: Readonly<Record<NivelAlerta, EstiloChip>> = {
  INFO: { color: '#1565c0', background: '#e3f2fd' },
  ADVERTENCIA: { color: '#b26a00', background: '#fff8e1' },
  CRITICA: { color: '#c62828', background: '#ffebee' },
};

/** Icono de Material por nivel de alerta. */
export const ICONO_NIVEL_ALERTA: Readonly<Record<NivelAlerta, string>> = {
  INFO: 'info',
  ADVERTENCIA: 'warning_amber',
  CRITICA: 'report',
};

/** Icono de Material por tipo de soporte (para la lista del detalle). */
export const ICONO_SOPORTE: Readonly<Record<TipoSoporte, string>> = {
  INCAPACIDAD_MEDICA: 'medical_information',
  HISTORIAL_CLINICO: 'clinical_notes',
  REGISTRO_CIVIL: 'contact_page',
  REGISTRO_NACIDO_VIVO: 'child_care',
  FURAT: 'engineering',
  FURIPS: 'directions_car',
  SOAT: 'car_crash',
  FORMULARIO_SALUD_TOTAL: 'assignment',
};

// ─────────────────────────────────────────────────────────────────────────
// Etiquetas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Convierte un codigo de enum en algo legible cuando NO hay catalogo.
 * `ENFERMEDAD_GENERAL` -> `Enfermedad general`.
 */
export function humanizarCodigo(codigo: string | null | undefined): string {
  const crudo = (codigo ?? '').toString().trim();
  if (!crudo) return '';
  const conEspacios = crudo.replace(/_/g, ' ').toLowerCase();
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

/** Busca la etiqueta de un codigo dentro de un catalogo; si no esta, la humaniza. */
export function etiquetaDeCatalogo<C extends string>(
  opciones: readonly OpcionCatalogo<C>[] | null | undefined,
  codigo: string | null | undefined,
): string {
  const crudo = (codigo ?? '').toString().trim();
  if (!crudo) return '';
  const encontrada = (opciones ?? []).find((o) => o.codigo === crudo);
  return encontrada?.etiqueta?.trim() || humanizarCodigo(crudo);
}

/**
 * Construye el `statusConfig` que pide `app-standard-filter-table`.
 *
 * OJO: ese componente pinta el VALOR de la celda y busca el color por ese mismo
 * valor, asi que las claves del mapa deben ser las ETIQUETAS visibles, no los
 * codigos. Por eso se necesita el catalogo para construirlo.
 */
export function construirStatusConfig<C extends string>(
  opciones: readonly OpcionCatalogo<C>[] | null | undefined,
  colores: Readonly<Record<C, EstiloChip>>,
): Record<string, EstiloChip> {
  const mapa: Record<string, EstiloChip> = {};

  // 1) Todo lo que conocemos por tipado (aunque el catalogo venga recortado).
  for (const codigo of Object.keys(colores) as C[]) {
    mapa[humanizarCodigo(codigo)] = colores[codigo];
  }

  // 2) Las etiquetas reales del catalogo pisan a las humanizadas.
  for (const opcion of opciones ?? []) {
    const etiqueta = (opcion.etiqueta ?? '').trim() || humanizarCodigo(opcion.codigo);
    mapa[etiqueta] = colores[opcion.codigo] ?? ESTILO_CHIP_NEUTRO;
  }

  return mapa;
}

// ─────────────────────────────────────────────────────────────────────────
// Catalogos de respaldo
// ─────────────────────────────────────────────────────────────────────────

const CODIGOS_TIPO_INCAPACIDAD: readonly TipoIncapacidad[] = [
  'ENFERMEDAD_GENERAL',
  'ACCIDENTE_TRABAJO',
  'ENFERMEDAD_LABORAL',
  'ACCIDENTE_TRANSITO',
  'LICENCIA_MATERNIDAD',
  'LICENCIA_PATERNIDAD',
];

const CODIGOS_ESTADO = Object.keys(COLOR_ESTADO) as EstadoIncapacidad[];
const CODIGOS_ESTADO_DOCUMENTO = Object.keys(COLOR_ESTADO_DOCUMENTO) as EstadoDocumento[];
const CODIGOS_RESPONSABLE_PAGO = Object.keys(COLOR_RESPONSABLE_PAGO) as ResponsablePago[];
const CODIGOS_TIPO_SOPORTE = Object.keys(ICONO_SOPORTE) as TipoSoporte[];

function aOpciones<C extends string>(codigos: readonly C[]): OpcionCatalogo<C>[] {
  return codigos.map((codigo) => ({ codigo, etiqueta: humanizarCodigo(codigo) }));
}

/**
 * Catalogos de RESPALDO: solo se usan si `GET /Incapacidades/v2/catalogos` falla
 * (el backend v2 todavia no existe). Se marcan en la UI con un aviso para que
 * nadie confunda estas etiquetas humanizadas con las oficiales.
 *
 * La fuente de verdad sigue siendo el endpoint.
 */
export const CATALOGOS_RESPALDO: CatalogosIncapacidad = {
  tiposIncapacidad: aOpciones(CODIGOS_TIPO_INCAPACIDAD),
  estados: aOpciones(CODIGOS_ESTADO),
  estadosDocumento: aOpciones(CODIGOS_ESTADO_DOCUMENTO).map((o) => ({
    ...o,
    automatico: o.codigo === 'PRESCRITA' || o.codigo === 'NO_CUMPLE',
  })),
  responsablesPago: aOpciones(CODIGOS_RESPONSABLE_PAGO),
  tiposSoporte: aOpciones(CODIGOS_TIPO_SOPORTE),
};

// ─────────────────────────────────────────────────────────────────────────
// KPI
// ─────────────────────────────────────────────────────────────────────────

/** Clave de cada tarjeta-KPI de la cabecera. */
export type ClaveKpi =
  | 'total'
  | 'recibidas'
  | 'validadas'
  | 'prescritas'
  | 'noCumplen'
  | 'soportesIncompletos';

/** Conteos del backend (NO de la pagina cargada). */
export type ConteosKpi = Record<ClaveKpi, number | null>;

export const CONTEOS_KPI_VACIOS: ConteosKpi = {
  total: null,
  recibidas: null,
  validadas: null,
  prescritas: null,
  noCumplen: null,
  soportesIncompletos: null,
};

/** Definicion visual de cada KPI + el filtro que aplica al pulsarlo. */
export interface DefinicionKpi {
  clave: ClaveKpi;
  etiqueta: string;
  icono: string;
  ayuda: string;
  /** Filtro extra que se aplica al hacer clic en la tarjeta. */
  filtro: Partial<FiltrosConsultaIncapacidad>;
}

export const KPIS: readonly DefinicionKpi[] = [
  {
    clave: 'total',
    etiqueta: 'Total',
    icono: 'inventory_2',
    ayuda: 'Todas las incapacidades que cumplen los filtros actuales',
    filtro: {},
  },
  {
    clave: 'recibidas',
    etiqueta: 'Recibidas',
    icono: 'inbox',
    ayuda: 'Registradas pero aun sin validar',
    filtro: { estado: 'RECIBIDA' },
  },
  {
    clave: 'validadas',
    etiqueta: 'Validadas',
    icono: 'verified',
    ayuda: 'Ya pasaron el motor de reglas',
    filtro: { estado: 'VALIDADA' },
  },
  {
    clave: 'prescritas',
    etiqueta: 'Prescritas',
    icono: 'hourglass_disabled',
    ayuda: 'Se paso el plazo legal de radicacion',
    filtro: { estadoDocumento: 'PRESCRITA' },
  },
  {
    clave: 'noCumplen',
    etiqueta: 'No cumplen',
    icono: 'gpp_bad',
    ayuda: 'No cumplen requisitos de cotizacion',
    filtro: { estadoDocumento: 'NO_CUMPLE' },
  },
  {
    clave: 'soportesIncompletos',
    etiqueta: 'Soportes incompletos',
    icono: 'attach_file_off',
    ayuda: 'Les falta al menos un soporte obligatorio',
    filtro: { soportesCompletos: 'false' },
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Chips de filtros activos
// ─────────────────────────────────────────────────────────────────────────

/** Un filtro activo pintado como chip, con su boton de quitar. */
export interface ChipFiltro {
  /** Nombre del control (o controles) que hay que limpiar al quitarlo. */
  claves: string[];
  etiqueta: string;
  valor: string;
  icono: string;
}
