/**
 * Salario en letras (español de Colombia) para la carátula de los contratos.
 *
 * Antes el campo "Salario Mensual Ordinario" iba con el SMMLV escrito a mano
 * dentro del código, así que TODO contrato salía con el mínimo aunque la vacante
 * pagara otra cosa. Aquí se toma `vacante.salario` y se arma la misma frase que
 * usaban las plantillas: `S.M.M.L.V $ 1.750.905 UN MILLÓN ... PESOS M/C`.
 *
 * El salario SIEMPRE es un número entero de pesos: no se imprimen centavos.
 *
 * Ojo con el origen del dato: `publicacion.Vacante.salario` es un `DecimalField`,
 * así que DRF lo serializa como string CON cola decimal ("1750905.00"). Por eso
 * `parseMontoCOP` no puede tratar todo punto como separador de miles: si lo
 * hiciera, ese valor se leería como 175.090.500. Distingue la cola por el número
 * de dígitos y después redondea a pesos enteros. También aguanta "1.750.905" y
 * "$ 1.750.905", que es como puede llegar desde un formulario o desde
 * `proceso.vacante_salario` (CharField).
 */

/**
 * SMMLV vigente. Sólo se usa para decidir si la frase lleva el prefijo
 * "S.M.M.L.V"; el valor impreso siempre sale de la vacante.
 * Al cambiar de año hay que actualizarlo también en el default de
 * `crear-editar-vacante.component.ts`.
 */
export const SMMLV_VIGENTE = 1750905;

/** 0..29 en una sola pieza (incluye los irregulares 16-19 y 21-29). */
const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO',
  'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];

const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];

const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
  'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

/**
 * 0..99. `apocope` aplica la forma corta que exige un sustantivo masculino
 * detrás ("un peso", "veintiún mil", "treinta y un pesos").
 */
function menorDeCien(n: number, apocope: boolean): string {
  if (n < 30) {
    if (apocope && n === 1) return 'UN';
    if (apocope && n === 21) return 'VEINTIÚN';
    return UNIDADES[n];
  }
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return DECENAS[d];
  return `${DECENAS[d]} Y ${apocope && u === 1 ? 'UN' : UNIDADES[u]}`;
}

/** 0..999. "CIEN" exacto vs "CIENTO ..." cuando hay resto. */
function menorDeMil(n: number, apocope: boolean): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (r > 0) partes.push(menorDeCien(r, apocope));
  return partes.join(' ');
}

/**
 * 0..999.999. El grupo de los miles siempre va apocopado ("veintiún mil") y
 * el 1 se calla ("mil", nunca "un mil").
 */
function menorDeUnMillon(n: number, apocope: boolean): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (miles === 1) partes.push('MIL');
  else if (miles > 1) partes.push(`${menorDeMil(miles, true)} MIL`);
  if (resto > 0) partes.push(menorDeMil(resto, apocope));
  return partes.join(' ');
}

/**
 * Entero a letras en escala larga (la del español: 10^9 = "mil millones",
 * 10^12 = "un billón"). `apocope` = true cuando detrás va un sustantivo
 * masculino, p. ej. "PESOS" → "novecientos un pesos".
 */
export function numeroALetrasCO(valor: number, apocope: boolean = false): string {
  let n = Math.floor(Math.abs(Number(valor) || 0));
  if (n === 0) return 'CERO';

  const partes: string[] = [];

  const billones = Math.floor(n / 1e12);
  n = n % 1e12;
  if (billones === 1) partes.push('UN BILLÓN');
  else if (billones > 1) partes.push(`${menorDeUnMillon(billones, true)} BILLONES`);

  const millones = Math.floor(n / 1e6);
  n = n % 1e6;
  if (millones === 1) partes.push('UN MILLÓN');
  else if (millones > 1) partes.push(`${menorDeUnMillon(millones, true)} MILLONES`);

  if (n > 0) partes.push(menorDeUnMillon(n, apocope));

  return partes.join(' ');
}

/**
 * Normaliza a número lo que llegue del backend o de un formulario.
 * Devuelve `null` si no hay un monto usable.
 *
 * El separador decimal se detecta por la cola: sólo cuenta como decimales si
 * detrás del último `.` o `,` hay 1-2 dígitos. Así "1.750.905" son un millón
 * setecientos mil y "1750905.00" es ese mismo monto con la cola de DRF. Quien
 * imprime redondea a pesos enteros (`formatoPesosCO` / `montoEnLetrasCOP`).
 */
export function parseMontoCOP(valor: any): number | null {
  if (valor == null) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;

  const bruto = String(valor).trim();
  if (!bruto) return null;

  const negativo = /^-/.test(bruto);
  const limpio = bruto.replace(/[^\d.,]/g, '');
  if (!limpio) return null;

  const ultimoSep = Math.max(limpio.lastIndexOf('.'), limpio.lastIndexOf(','));
  let entera = limpio;
  let decimales = '';
  if (ultimoSep > -1) {
    const cola = limpio.slice(ultimoSep + 1);
    if (/^\d{1,2}$/.test(cola)) {
      entera = limpio.slice(0, ultimoSep);
      decimales = cola;
    }
  }

  const digitos = entera.replace(/\D/g, '');
  if (!digitos && !decimales) return null;

  const n = Number(`${digitos || '0'}.${decimales || '0'}`);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/**
 * "1750905" → "$ 1.750.905". Agrupación manual: no depende del ICU del runtime.
 *
 * Siempre en pesos enteros: los salarios no manejan centavos, así que un
 * decimal residual se redondea en vez de imprimirse.
 */
export function formatoPesosCO(valor: number): string {
  const entero = Math.abs(Math.round(valor));
  const conPuntos = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${valor < 0 ? '-' : ''}${conPuntos}`;
}

/**
 * Monto a letras con la moneda pegada: "UN MILLÓN ... PESOS M/C".
 *
 * Sin centavos: en nómina el salario siempre es un número entero de pesos, así
 * que se redondea igual que `formatoPesosCO` y las dos representaciones (cifra
 * y letras) nunca pueden discrepar.
 */
export function montoEnLetrasCOP(valor: number, sufijoMoneda: string = 'M/C'): string {
  const entero = Math.abs(Math.round(valor));
  const letras = numeroALetrasCO(entero, true);

  // "TRES MILLONES DE PESOS", pero "TRES MILLONES QUINIENTOS MIL PESOS": el
  // "de" sólo va cuando la cifra termina justo en millón/billón, sin resto.
  const terminaEnMillon = /\b(MILL[ÓO]N|MILLONES|BILL[ÓO]N|BILLONES)$/.test(letras);

  const partes = [letras];
  if (terminaEnMillon) partes.push('DE');
  partes.push(entero === 1 ? 'PESO' : 'PESOS');
  if (sufijoMoneda) partes.push(sufijoMoneda);
  return partes.join(' ');
}

/**
 * Frase completa del campo "Salario Mensual Ordinario" de la carátula:
 * `S.M.M.L.V $ 1.750.905 UN MILLÓN SETECIENTOS CINCUENTA MIL NOVECIENTOS CINCO PESOS M/C`
 *
 * El prefijo "S.M.M.L.V" sólo aparece si el salario de la vacante es
 * exactamente el mínimo legal; con cualquier otro monto sería falso.
 * Devuelve '' si la vacante no trae salario, para que el llamador decida el
 * fallback en vez de imprimir "$ 0".
 */
export function salarioContratoCO(valor: any, sufijoMoneda: string = 'M/C'): string {
  const n = parseMontoCOP(valor);
  if (n == null || n <= 0) return '';
  const prefijo = Math.round(n) === SMMLV_VIGENTE ? 'S.M.M.L.V ' : '';
  return `${prefijo}${formatoPesosCO(n)} ${montoEnLetrasCOP(n, sufijoMoneda)}`;
}
