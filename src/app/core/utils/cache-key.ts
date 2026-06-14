import { environment } from '@/environments/environment';

const PLACEHOLDER_BASE = 'http://placeholder.local';

/**
 * Convierte una URL en una clave de cache estable e independiente del host
 * del backend. Antes guardabamos `http://10.10.10.60:4545/foo`, ahora `/foo`.
 * Razon: si el binario cambia de apuntar a localhost a apuntar al server LAN
 * (o viceversa al hacer dist desde un dev contaminado), las entradas viejas
 * con host obsoleto nunca volvian a hacer match y refreshCache las re-emitia
 * literalmente, generando 19 GETs a un 127.0.0.1:8000 que ya no aplica.
 */
export function toCacheKey(url: string): string {
  if (!url) return '/';
  if (url.startsWith('/')) return url;
  try {
    const u = new URL(url, PLACEHOLDER_BASE);
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

/**
 * Reconstruye una URL absoluta para refrescar el cache. Para entradas nuevas
 * (path-only) prefija con el apiUrl actual; para entradas legacy (absolutas
 * cuyo host coincide con el actual) las devuelve tal cual.
 */
export function fromCacheKey(entry: string): string {
  if (!entry) return entry;
  if (entry.startsWith('http://') || entry.startsWith('https://')) return entry;
  const base = environment.apiUrl.replace(/\/$/, '');
  const path = entry.startsWith('/') ? entry : `/${entry}`;
  return `${base}${path}`;
}

/**
 * Detecta entradas legacy en cache cuyo host ya no es el del environment
 * actual (p. ej. 127.0.0.1:8000 sobreviviendo en una build de produccion).
 * Esas entradas se invalidan en refreshCache para que no sigan disparando
 * GETs a hosts inexistentes.
 */
export function entryHostMatchesCurrent(entry: string): boolean {
  if (!entry) return false;
  if (!(entry.startsWith('http://') || entry.startsWith('https://'))) return true;
  try {
    const u = new URL(entry);
    const cur = new URL(environment.apiUrl);
    return u.host === cur.host && u.protocol === cur.protocol;
  } catch {
    return false;
  }
}
