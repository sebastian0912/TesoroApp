/**
 * Saneador de texto para los form fields de los PDF.
 *
 * Los campos de formulario se codifican en WinAnsi y pdf-lib aborta la
 * generación COMPLETA con `WinAnsi cannot encode "́" (0x0301)` en cuanto le
 * llega un diacrítico COMBINANTE: la tilde suelta que se pega a la letra
 * anterior ('E' + U+0301) en lugar de la 'É' precompuesta.
 *
 * Los dos se ven idénticos en pantalla, así que el dato entra sin que nadie
 * lo note —copiar y pegar, ciertos teclados, algunas importaciones— y basta
 * un carácter en un solo campo para tumbar el documento entero.
 *
 * Estrategia:
 *   1. `NFC` compone lo que tenga forma precompuesta: 'E' + U+0301 -> 'É',
 *      que sí existe en WinAnsi. Así se conserva el acento.
 *   2. Lo que quede suelto (una marca sin letra base, o sobre una letra sin
 *      precompuesto) se descarta. Es preferible perder un acento a no poder
 *      generar el PDF.
 */
export function sanitizeWinAnsi(v: string): string {
  return v.normalize('NFC').replace(/[̀-ͯ]/g, '');
}

/** `String(v).trim()` saneado. Punto único por el que pasan los valores. */
export function sanitizedString(v: unknown): string {
  return v === null || v === undefined ? '' : sanitizeWinAnsi(String(v).trim());
}
