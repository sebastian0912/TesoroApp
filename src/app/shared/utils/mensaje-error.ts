/**
 * Traduce un error de HTTP o de JavaScript a una frase que entienda cualquiera.
 *
 * Antes se mostraba `err.message` tal cual, que produce cosas como:
 *
 *     Http failure response for http://127.0.0.1:8000/gestion_documental/...: 0 Unknown Error
 *     Cannot read properties of undefined (reading 'proceso')
 *     NG0100: ExpressionChangedAfterItHasBeenCheckedError
 *
 * Eso no le dice nada a quien está atendiendo gente en una oficina, y encima
 * expone URLs internas. Acá se traduce por CÓDIGO DE ESTADO, que es lo que de
 * verdad determina qué puede hacer la persona al respecto.
 *
 * El `detail` que manda el backend SÍ se muestra cuando viene escrito para
 * humanos (los nuestros están en español y explican el caso). Lo que nunca sale
 * es el texto crudo de la excepción.
 */

/** Frases por código de estado. La clave es qué puede HACER quien lo lee. */
const POR_ESTADO: Record<number, string> = {
  0: 'No hay conexión con el servidor. Revisa tu internet y vuelve a intentar.',
  400: 'Faltan datos o alguno quedó mal escrito. Revisa el formulario e intenta de nuevo.',
  401: 'Tu sesión se venció. Vuelve a entrar a la aplicación.',
  403: 'No tienes permiso para hacer esto. Pídeselo a quien administra el sistema.',
  404: 'No se encontró lo que buscabas. Puede que ya no exista o que lo hayan borrado.',
  408: 'El servidor se demoró demasiado en responder. Intenta otra vez.',
  409: 'Esta información ya cambió por otro lado. Recarga y vuelve a intentar.',
  413: 'El archivo pesa demasiado. Súbelo en menor tamaño o comprímelo.',
  415: 'Ese tipo de archivo no se acepta. Sube un PDF.',
  429: 'Se hicieron demasiadas peticiones seguidas. Espera un momento y reintenta.',
  500: 'El servidor tuvo un problema. Intenta de nuevo en unos minutos; si sigue igual, avisa a soporte.',
  502: 'El servidor no está respondiendo. Intenta de nuevo en unos minutos.',
  503: 'El servidor no está disponible en este momento. Intenta de nuevo en unos minutos.',
  504: 'El servidor se demoró demasiado. Intenta de nuevo en unos minutos.',
};

/**
 * ¿Este texto del backend se puede mostrar tal cual?
 *
 * Los `detail` que escribimos nosotros son frases en español. Lo que se filtra
 * y NO debe salir son trazas, nombres de clase, SQL y rutas de archivo.
 */
function esTextoParaHumanos(txt: string): boolean {
  const t = txt.trim();
  if (!t || t.length > 300) return false;
  const tecnico = [
    'Traceback', 'Exception', 'Error:', 'error at', 'null', 'undefined',
    'NoneType', 'QuerySet', 'IntegrityError', 'OperationalError',
    'DoesNotExist', 'KeyError', 'TypeError', 'ValueError',
    'SELECT ', 'INSERT ', 'UPDATE ', 'DELETE ',
    'http://', 'https://', '.py"', '.ts:', 'at line',
  ];
  return !tecnico.some(p => t.includes(p));
}

/** Saca el `detail`/mensaje del cuerpo de la respuesta, si es presentable. */
function detalleDelBackend(err: any): string | null {
  const cuerpo = err?.error;
  if (!cuerpo) return null;

  // Formato normal del proyecto: {"detail": "..."} o {"error": "..."}
  const directo = typeof cuerpo === 'string' ? cuerpo : (cuerpo.detail ?? cuerpo.message ?? cuerpo.error);
  if (typeof directo === 'string' && esTextoParaHumanos(directo)) return directo.trim();

  // DRF de validación: {"campo": ["falta esto"]}. Se arma una frase corta.
  if (directo == null && typeof cuerpo === 'object') {
    const partes: string[] = [];
    for (const [campo, valor] of Object.entries(cuerpo)) {
      const texto = Array.isArray(valor) ? valor.join(', ') : String(valor);
      if (esTextoParaHumanos(texto)) partes.push(`${campo}: ${texto}`);
    }
    if (partes.length) return partes.slice(0, 3).join(' · ');
  }
  return null;
}

/**
 * Devuelve la frase a mostrar. `respaldo` es lo que se dice cuando no se pudo
 * deducir nada: escríbelo pensando en la acción concreta que falló
 * ("No se pudo guardar la entrevista.").
 */
export function mensajeDeError(err: any, respaldo = 'No se pudo completar la acción.'): string {
  // Sin internet: el navegador lo sabe antes que el servidor.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'No hay conexión a internet. Revisa tu red y vuelve a intentar.';
  }

  const estado = Number(err?.status);

  // Un detail claro del backend gana: explica ESTE caso, no el genérico.
  const detalle = detalleDelBackend(err);
  if (detalle) return detalle;

  if (Number.isFinite(estado) && POR_ESTADO[estado]) return POR_ESTADO[estado];
  if (Number.isFinite(estado) && estado >= 500) return POR_ESTADO[500];
  if (Number.isFinite(estado) && estado >= 400) return POR_ESTADO[400];

  return respaldo;
}

/**
 * Igual que `mensajeDeError`, pero además deja el error técnico en la consola
 * para poder diagnosticarlo. Lo que ve el usuario nunca lleva ese detalle.
 */
export function mensajeDeErrorLog(contexto: string, err: any, respaldo?: string): string {
  console.error(`[${contexto}]`, err);
  return mensajeDeError(err, respaldo);
}
