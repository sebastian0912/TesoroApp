/**
 * Todo lo que se GUARDA desde el pipeline de contratación (y sus hijos) debe
 * ir sin tildes ni ñ: á→a, É→E, ñ→n, Ñ→N, ü→u. Se limpia en la frontera de
 * guardado (los servicios), no input por input, para que ningún flujo se escape.
 *
 * El backend ya es tolerante a esto donde hace matching por nombre
 * (`canonizar_oficina` normaliza tildes antes de comparar).
 */
export function sinTildes(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Aplica `sinTildes` a todos los strings de un payload, recursivamente.
 *
 * `skipKeys` (case-insensitive) protege valores que NO deben alterarse
 * (contraseñas, correos). Solo recorre objetos planos y arrays: File, Blob,
 * Date, FormData y demás instancias pasan intactas.
 */
export function sinTildesDeep<T>(data: T, skipKeys?: Set<string>): T {
  const skip = new Set(Array.from(skipKeys ?? []).map((k) => k.toLowerCase()));

  const esObjetoPlano = (v: object): boolean => {
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
  };

  const walk = (val: any, keyHint?: string): any => {
    if (val == null) return val;
    if (typeof val === 'string') {
      if (keyHint && skip.has(keyHint.toLowerCase())) return val;
      return sinTildes(val);
    }
    if (Array.isArray(val)) return val.map((v) => walk(v, keyHint));
    if (typeof val === 'object' && esObjetoPlano(val)) {
      const out: any = {};
      for (const [k, v] of Object.entries(val)) out[k] = walk(v, k);
      return out;
    }
    return val;
  };

  return walk(data) as T;
}
