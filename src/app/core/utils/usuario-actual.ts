/**
 * Lectura tolerante del usuario logueado desde `localStorage`.
 *
 * POR QUE EXISTE ESTE HELPER
 * --------------------------
 * La funcional pidio que "el nombre de quien recibio" y la "oficina" se
 * traigan solos del usuario que esta operando. El problema es que ese dato
 * NO esta donde uno esperaria:
 *
 *  1. El JWT NO lleva ni sede ni nombre (solo `sub`, `email`, `doc`, `rol`,
 *     `perms`). No sirve para esto.
 *  2. `localStorage["user"]` tiene DOS SHAPES DISTINTOS en la MISMA sesion:
 *
 *     - Justo despues del login:
 *         { nombres, apellidos, ... }                      // SIN sede
 *     - Despues del refresh del navbar
 *       (GET /gestion_admin/usuarios/{id}/):
 *         { datos_basicos: { nombres, apellidos }, sede: { id, nombre } }
 *
 *     Por eso siempre se lee `user?.datos_basicos?.X ?? user?.X`.
 *
 *  3. Solo 123 de 7.582 usuarios tienen sede asignada. Cubre a 122 de los
 *     124 usuarios de roles administrativos (los que usan incapacidades),
 *     pero la UI DEBE contemplar que `sedeNombre` venga vacia y ofrecer un
 *     desplegable de oficinas. Nunca se guarda la oficina vacia.
 *
 * Ademas se tolera un tercer shape historico (la cuenta de prueba del login
 * y algunos fallbacks): `{ primer_nombre, primer_apellido, ... }`.
 *
 * Acceso a storage SIEMPRE via `safe-storage` (SSR-safe): en SSR no existe
 * `window` y un acceso directo tumba la hidratacion.
 */

import { getLocalStorageItem } from './safe-storage';

/** Datos del usuario logueado, ya normalizados y listos para la UI. */
export interface UsuarioActual {
  /** "NOMBRES APELLIDOS" con espacios colapsados. Cadena vacia si no hay dato. */
  nombreCompleto: string;
  /** Nombre de la sede/oficina. Cadena vacia si el usuario no tiene sede. */
  sedeNombre: string;
  /** Nombre del rol ("ADMIN", "INCAPACIDADES"...). Cadena vacia si no hay. */
  rol: string;
  /** Id (UUID) del usuario. Cadena vacia si no hay. */
  id: string;
  /** Correo electronico. Cadena vacia si no hay. */
  email: string;
}

/** Valor neutro: ninguna sesion valida en `localStorage`. */
export const USUARIO_ACTUAL_VACIO: Readonly<UsuarioActual> = Object.freeze({
  nombreCompleto: '',
  sedeNombre: '',
  rol: '',
  id: '',
  email: '',
});

/** Colapsa espacios y recorta. Devuelve '' para cualquier valor no util. */
function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  if (typeof valor !== 'string') return '';
  return valor.replace(/\s+/g, ' ').trim();
}

/** Primer valor no vacio de la lista. */
function primero(...valores: unknown[]): string {
  for (const valor of valores) {
    const limpio = texto(valor);
    if (limpio) return limpio;
  }
  return '';
}

/** Acceso seguro a una propiedad de un objeto desconocido. */
function prop(objeto: unknown, clave: string): unknown {
  if (!objeto || typeof objeto !== 'object') return undefined;
  return (objeto as Record<string, unknown>)[clave];
}

/**
 * Devuelve el objeto crudo guardado en `localStorage["user"]`.
 * `null` si no hay sesion, si el JSON esta corrupto o si no hay storage
 * (SSR). Nunca lanza.
 */
export function leerUsuarioCrudo(): Record<string, unknown> | null {
  const bruto = getLocalStorageItem('user');
  if (!bruto) return null;
  try {
    const parseado: unknown = JSON.parse(bruto);
    if (!parseado || typeof parseado !== 'object' || Array.isArray(parseado)) return null;
    return parseado as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Normaliza el usuario logueado tolerando TODOS los shapes conocidos.
 *
 * Nunca devuelve `null` ni lanza: si no hay sesion devuelve
 * {@link USUARIO_ACTUAL_VACIO} (todos los campos en cadena vacia), asi la
 * vista solo tiene que preguntar por `!!u.sedeNombre` en vez de encadenar
 * opcionales.
 *
 * @example
 * const u = obtenerUsuarioActual();
 * this.nombreQuienRecibe.set(u.nombreCompleto);
 * this.oficinaBloqueada.set(!!u.sedeNombre);
 */
export function obtenerUsuarioActual(): UsuarioActual {
  const user = leerUsuarioCrudo();
  if (!user) return { ...USUARIO_ACTUAL_VACIO };

  const basicos = prop(user, 'datos_basicos');

  // ── Nombre ────────────────────────────────────────────────────────────
  // Shape refrescado: datos_basicos.{nombres,apellidos}
  // Shape post-login: {nombres,apellidos}
  // Shape historico:  {primer_nombre, segundo_nombre, primer_apellido, ...}
  const nombres = primero(
    prop(basicos, 'nombres'),
    prop(user, 'nombres'),
    prop(user, 'nombre'),
    [
      primero(prop(basicos, 'primer_nombre'), prop(user, 'primer_nombre')),
      primero(prop(basicos, 'segundo_nombre'), prop(user, 'segundo_nombre')),
    ]
      .filter(Boolean)
      .join(' '),
  );

  const apellidos = primero(
    prop(basicos, 'apellidos'),
    prop(user, 'apellidos'),
    prop(user, 'apellido'),
    [
      primero(prop(basicos, 'primer_apellido'), prop(user, 'primer_apellido')),
      primero(prop(basicos, 'segundo_apellido'), prop(user, 'segundo_apellido')),
    ]
      .filter(Boolean)
      .join(' '),
  );

  const nombreCompleto = texto(
    [nombres, apellidos].filter(Boolean).join(' ') ||
      primero(prop(basicos, 'nombre_completo'), prop(user, 'nombre_completo')),
  );

  // ── Sede ──────────────────────────────────────────────────────────────
  // Puede venir como objeto {id, nombre} o, en fallbacks, como string plano.
  const sedeCruda = prop(user, 'sede') ?? prop(basicos, 'sede');
  const sedeNombre =
    typeof sedeCruda === 'string'
      ? texto(sedeCruda)
      : primero(prop(sedeCruda, 'nombre'), prop(user, 'sede_nombre'), prop(user, 'oficina'));

  // ── Rol ───────────────────────────────────────────────────────────────
  // El backend lo devuelve como {id, nombre}; el JWT como string plano.
  const rolCrudo = prop(user, 'rol');
  const rol =
    typeof rolCrudo === 'string'
      ? texto(rolCrudo)
      : primero(prop(rolCrudo, 'nombre'), prop(user, 'rol_nombre'));

  // ── Identificadores ───────────────────────────────────────────────────
  const id = primero(
    prop(user, 'id'),
    prop(user, 'usuario_id'),
    prop(basicos, 'id'),
    prop(user, 'sub'),
  );

  const email = primero(
    prop(user, 'email'),
    prop(user, 'correo_electronico'),
    prop(basicos, 'correo_electronico'),
    prop(basicos, 'email'),
    prop(basicos, 'primercorreoelectronico'),
    prop(user, 'primercorreoelectronico'),
  );

  return { nombreCompleto, sedeNombre, rol, id, email };
}

/**
 * `true` si el usuario trae sede utilizable.
 * Cuando es `false` la vista DEBE pedir la oficina con un desplegable:
 * la oficina nunca puede guardarse vacia.
 */
export function tieneSedeAsignada(usuario: UsuarioActual = obtenerUsuarioActual()): boolean {
  return usuario.sedeNombre.length > 0;
}

/** `true` si hay una sesion legible en `localStorage`. */
export function haySesion(): boolean {
  return leerUsuarioCrudo() !== null;
}
