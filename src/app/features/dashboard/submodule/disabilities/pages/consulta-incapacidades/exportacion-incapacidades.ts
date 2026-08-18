/**
 * Motor de exportacion de la consulta de incapacidades.
 *
 * Aqui vive TODA la logica pura (que columnas existen, como se saca el valor de
 * cada una, como se arma el CSV). El dialogo solo orquesta: pide las paginas al
 * backend, muestra el progreso y dispara la descarga.
 *
 * Separarlo asi permite probar "la exportacion respeta la seleccion de columnas"
 * sin montar ningun componente ni ningun navegador.
 *
 * REGLA HEREDADA DEL MODULO VIEJO (y que aqui NO se repite): el export anterior
 * decia "exportar todo" pero mandaba unicamente la pagina que estaba cargada en
 * memoria. Por eso el alcance es una decision explicita del usuario y el modo
 * "todos los resultados" recorre de verdad todas las paginas del backend.
 */

import { EstadoDocumento, EstadoIncapacidad, ResponsablePago, TipoIncapacidad } from '../../models/incapacidad-v2.model';
import { parsearFechaFlexible } from '../../utils/fechas';
import { IncapacidadResumenExtendido, humanizarCodigo } from './consulta-incapacidades.model';

/** Resolutores de etiqueta (vienen del catalogo del backend). */
export interface EtiquetasExportacion {
  tipoIncapacidad: (codigo: TipoIncapacidad | string | null | undefined) => string;
  estado: (codigo: EstadoIncapacidad | string | null | undefined) => string;
  estadoDocumento: (codigo: EstadoDocumento | string | null | undefined) => string;
  responsablePago: (codigo: ResponsablePago | string | null | undefined) => string;
}

/** Respaldo: humaniza el codigo. Se usa en pruebas y si el catalogo no cargo. */
export const ETIQUETAS_HUMANIZADAS: EtiquetasExportacion = {
  tipoIncapacidad: humanizarCodigo,
  estado: humanizarCodigo,
  estadoDocumento: humanizarCodigo,
  responsablePago: humanizarCodigo,
};

/** Una columna que el usuario puede marcar/desmarcar en el dialogo. */
export interface ColumnaExportable {
  /** Clave estable (coincide con el `name` de la columna de la tabla cuando existe). */
  clave: string;
  /** Cabecera que aparecera en el Excel/CSV. */
  etiqueta: string;
  /** `true` si por defecto se muestra en la tabla (opcion "las visibles"). */
  enTabla: boolean;
  /** Extrae el valor ya formateado para el archivo. */
  obtener: (fila: IncapacidadResumenExtendido, etiquetas: EtiquetasExportacion) => string | number;
}

/** Formatea `yyyy-MM-dd` (o los formatos sucios reales) a `dd/MM/yyyy`. */
export function fechaLegible(valor: unknown): string {
  const fecha = parsearFechaFlexible(valor);
  if (!fecha) return '';
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${fecha.getFullYear()}`;
}

/**
 * Fecha CON hora para los campos de auditoria (`creadoEn` llega ISO 8601).
 * No usa `toISOString()` (en UTC-5 restaria un dia).
 */
export function fechaHoraLegible(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const texto = String(valor);
  const fecha = new Date(texto);
  if (isNaN(fecha.getTime())) return fechaLegible(valor);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const hora = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${fecha.getFullYear()} ${hora}:${min}`;
}

/** Texto o cadena vacia (nunca "null" ni "undefined" en el archivo). */
function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

/** Numero o cadena vacia (para que Excel no meta ceros inventados). */
function numero(valor: unknown): string | number {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = typeof valor === 'number' ? valor : Number(valor);
  return isNaN(n) ? '' : n;
}

/** Indicador "n/m" de soportes; vacio si el backend aun no lo envia. */
export function indicadorSoportes(fila: IncapacidadResumenExtendido): string {
  const cargados = fila.soportesAdjuntos;
  const exigidos = fila.soportesExigidos;
  if (cargados === null || cargados === undefined) return '';
  if (exigidos === null || exigidos === undefined) return String(cargados);
  return `${cargados}/${exigidos}`;
}

/** `true` si la fila tiene todos sus soportes; `null` si no se puede saber. */
export function soportesCompletos(fila: IncapacidadResumenExtendido): boolean | null {
  if (fila.soportesCompletos === true || fila.soportesCompletos === false) {
    return fila.soportesCompletos;
  }
  const cargados = fila.soportesAdjuntos;
  const exigidos = fila.soportesExigidos;
  if (typeof cargados !== 'number' || typeof exigidos !== 'number') return null;
  return cargados >= exigidos;
}

/**
 * Catalogo completo de columnas exportables.
 * El orden de este array es el orden de las columnas del archivo.
 */
export const COLUMNAS_EXPORTABLES: readonly ColumnaExportable[] = [
  {
    clave: 'consecutivoSistema',
    etiqueta: 'Codigo unico',
    enTabla: true,
    obtener: (f) => texto(f.consecutivoSistema),
  },
  { clave: 'cedula', etiqueta: 'Cedula', enTabla: true, obtener: (f) => texto(f.cedula) },
  {
    clave: 'nombreCompleto',
    etiqueta: 'Nombre del trabajador',
    enTabla: true,
    obtener: (f) => texto(f.nombreCompleto),
  },
  { clave: 'empresa', etiqueta: 'Empresa', enTabla: true, obtener: (f) => texto(f.empresa) },
  {
    clave: 'centroCosto',
    etiqueta: 'Centro de costo',
    enTabla: true,
    obtener: (f) => texto(f.centroCosto),
  },
  { clave: 'temporal', etiqueta: 'Temporal', enTabla: false, obtener: (f) => texto(f.temporal) },
  { clave: 'oficina', etiqueta: 'Oficina', enTabla: false, obtener: (f) => texto(f.oficina) },
  {
    clave: 'tipoIncapacidad',
    etiqueta: 'Tipo de incapacidad',
    enTabla: true,
    obtener: (f, e) => e.tipoIncapacidad(f.tipoIncapacidad),
  },
  {
    clave: 'codigoDiagnostico',
    etiqueta: 'Diagnostico (CIE-10)',
    enTabla: false,
    obtener: (f) => texto(f.codigoDiagnostico),
  },
  {
    clave: 'fechaInicio',
    etiqueta: 'Fecha de inicio',
    enTabla: true,
    obtener: (f) => fechaLegible(f.fechaInicio),
  },
  {
    clave: 'fechaFin',
    etiqueta: 'Fecha de fin',
    enTabla: true,
    obtener: (f) => fechaLegible(f.fechaFin),
  },
  { clave: 'dias', etiqueta: 'Dias', enTabla: true, obtener: (f) => numero(f.dias) },
  {
    clave: 'diasEmpresa',
    etiqueta: 'Dias empresa',
    enTabla: true,
    obtener: (f) => numero(f.diasEmpresa),
  },
  {
    clave: 'diasEntidad',
    etiqueta: 'Dias entidad',
    enTabla: true,
    obtener: (f) => numero(f.diasEntidad),
  },
  { clave: 'eps', etiqueta: 'EPS', enTabla: true, obtener: (f) => texto(f.eps) },
  { clave: 'afp', etiqueta: 'Fondo de pension (AFP)', enTabla: false, obtener: (f) => texto(f.afp) },
  {
    clave: 'responsablePago',
    etiqueta: 'Responsable de pago',
    enTabla: true,
    obtener: (f, e) => e.responsablePago(f.responsablePago),
  },
  {
    clave: 'estado',
    etiqueta: 'Estado',
    enTabla: true,
    obtener: (f, e) => e.estado(f.estado),
  },
  {
    clave: 'estadoDocumento',
    etiqueta: 'Estado del documento',
    enTabla: true,
    obtener: (f, e) => e.estadoDocumento(f.estadoDocumento),
  },
  {
    clave: 'soportes',
    etiqueta: 'Soportes',
    enTabla: true,
    obtener: (f) => indicadorSoportes(f),
  },
  {
    clave: 'esProrroga',
    etiqueta: 'Es prorroga',
    enTabla: false,
    obtener: (f) => (f.esProrroga === true ? 'Si' : f.esProrroga === false ? 'No' : ''),
  },
  {
    clave: 'numeroContrato',
    etiqueta: 'Numero de contrato',
    enTabla: false,
    obtener: (f) => texto(f.numeroContrato),
  },
  {
    clave: 'creadoPor',
    etiqueta: 'Registrado por',
    enTabla: true,
    obtener: (f) => texto(f.creadoPor),
  },
  {
    clave: 'creadoEn',
    etiqueta: 'Fecha de registro',
    enTabla: true,
    obtener: (f) => fechaHoraLegible(f.creadoEn),
  },
  {
    clave: 'actualizadoEn',
    etiqueta: 'Ultima modificacion',
    enTabla: false,
    obtener: (f) => fechaHoraLegible(f.actualizadoEn),
  },
  // ── Radicacion (V44) ────────────────────────────────────────────────
  {
    clave: 'numeroRadicado',
    etiqueta: 'Numero de radicado',
    enTabla: true,
    obtener: (f) => texto(f.numeroRadicado),
  },
  {
    clave: 'fechaRadicado',
    etiqueta: 'Fecha de radicado',
    enTabla: true,
    obtener: (f) => fechaLegible(f.fechaRadicado),
  },
  {
    clave: 'semanaRadicacion',
    etiqueta: 'Semana de radicacion',
    enTabla: true,
    obtener: (f) => numero(f.semanaRadicacion),
  },
  {
    clave: 'entidadGrupo',
    etiqueta: 'Entidad (carpeta)',
    enTabla: true,
    obtener: (f) => texto(f.entidadGrupoEtiqueta ?? f.entidadGrupo),
  },
  {
    clave: 'dondeRadicado',
    etiqueta: 'Donde se radico',
    enTabla: true,
    obtener: (f) => texto(f.dondeRadicadoEtiqueta ?? f.dondeRadicado),
  },
  {
    clave: 'radicadoPor',
    etiqueta: 'Radicado por',
    enTabla: true,
    obtener: (f) => texto(f.radicadoPor),
  },
  { clave: 'id', etiqueta: 'Id interno', enTabla: false, obtener: (f) => numero(f.id) },
];

/** Claves marcadas por defecto al abrir el dialogo (las que se ven en la tabla). */
export const CLAVES_EXPORTACION_POR_DEFECTO: readonly string[] = COLUMNAS_EXPORTABLES.filter(
  (c) => c.enTabla,
).map((c) => c.clave);

/** Busca una columna por su clave. */
export function columnaExportable(clave: string): ColumnaExportable | undefined {
  return COLUMNAS_EXPORTABLES.find((c) => c.clave === clave);
}

/**
 * Convierte las filas del backend en filas de archivo, **respetando el orden y
 * la seleccion de columnas** que hizo el usuario.
 *
 * Las claves de cada objeto resultante son las ETIQUETAS (cabeceras), porque es
 * lo que `XLSX.utils.json_to_sheet` usa como fila de encabezado.
 *
 * @param filas datos crudos del backend.
 * @param claves claves seleccionadas; las desconocidas se ignoran en silencio.
 * @param etiquetas resolutores de etiqueta de los enums.
 */
export function construirFilasExportacion(
  filas: readonly IncapacidadResumenExtendido[],
  claves: readonly string[],
  etiquetas: EtiquetasExportacion = ETIQUETAS_HUMANIZADAS,
): Record<string, string | number>[] {
  const columnas = clavesAColumnas(claves);

  return (filas ?? []).map((fila) => {
    const salida: Record<string, string | number> = {};
    for (const columna of columnas) {
      salida[columna.etiqueta] = columna.obtener(fila, etiquetas);
    }
    return salida;
  });
}

/**
 * Traduce claves a columnas conservando el ORDEN CANONICO de
 * {@link COLUMNAS_EXPORTABLES} (no el orden en que el usuario las marco).
 */
export function clavesAColumnas(claves: readonly string[]): ColumnaExportable[] {
  const seleccionadas = new Set(claves ?? []);
  return COLUMNAS_EXPORTABLES.filter((c) => seleccionadas.has(c.clave));
}

/** Cabeceras (en orden) de una seleccion de claves. */
export function cabecerasExportacion(claves: readonly string[]): string[] {
  return clavesAColumnas(claves).map((c) => c.etiqueta);
}

/** Escapa un campo para CSV (comillas dobles, separador o salto de linea). */
function escaparCsv(valor: string | number, separador: string): string {
  const texto0 = valor === null || valor === undefined ? '' : String(valor);
  const necesitaComillas =
    texto0.includes(separador) ||
    texto0.includes('"') ||
    texto0.includes('\n') ||
    texto0.includes('\r');
  if (!necesitaComillas) return texto0;
  return `"${texto0.replace(/"/g, '""')}"`;
}

/**
 * Arma el CSV completo (cabecera + filas).
 *
 * Separador `;` por defecto: es lo que espera Excel en configuracion regional
 * es-CO; con `,` abriria todo en una sola columna.
 */
export function construirCsv(
  filas: readonly Record<string, string | number>[],
  cabeceras: readonly string[],
  separador = ';',
): string {
  const lineas: string[] = [];
  lineas.push(cabeceras.map((c) => escaparCsv(c, separador)).join(separador));

  for (const fila of filas) {
    lineas.push(
      cabeceras
        .map((cabecera) => escaparCsv(fila[cabecera] ?? '', separador))
        .join(separador),
    );
  }

  return lineas.join('\r\n');
}

/** Nombre de archivo con marca de tiempo local (nunca `toISOString`). */
export function nombreArchivoExportacion(extension: 'xlsx' | 'csv', ahora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const marca =
    `${ahora.getFullYear()}${p(ahora.getMonth() + 1)}${p(ahora.getDate())}` +
    `_${p(ahora.getHours())}${p(ahora.getMinutes())}`;
  return `incapacidades_${marca}.${extension}`;
}

/** Anchos de columna razonables para el Excel (en caracteres). */
export function anchosColumnas(claves: readonly string[]): { wch: number }[] {
  return clavesAColumnas(claves).map((c) => ({
    wch: Math.min(38, Math.max(12, c.etiqueta.length + 4)),
  }));
}
