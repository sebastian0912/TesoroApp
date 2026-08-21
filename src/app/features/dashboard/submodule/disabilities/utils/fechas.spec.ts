import {
  ANIO_MINIMO_PLAUSIBLE,
  aIsoCorto,
  aIsoCortoFlexible,
  calcularEdad,
  diasCalendarioInclusive,
  esFechaPlausible,
  parsearFechaFlexible,
} from './fechas';

describe('utils/fechas', () => {
  describe('parsearFechaFlexible', () => {
    it('parsea el formato ISO yyyy-MM-dd', () => {
      const fecha = parsearFechaFlexible('1990-05-12');
      expect(fecha).not.toBeNull();
      expect(fecha!.getFullYear()).toBe(1990);
      expect(fecha!.getMonth()).toBe(4); // mayo
      expect(fecha!.getDate()).toBe(12);
    });

    it('parsea el formato latino dd/MM/yyyy', () => {
      const fecha = parsearFechaFlexible('12/05/1990');
      expect(fecha).not.toBeNull();
      expect(fecha!.getFullYear()).toBe(1990);
      expect(fecha!.getMonth()).toBe(4);
      expect(fecha!.getDate()).toBe(12);
    });

    it('parsea el formato latino con guiones dd-MM-yyyy', () => {
      const fecha = parsearFechaFlexible('12-05-1990');
      expect(aIsoCorto(fecha)).toBe('1990-05-12');
    });

    it('los dos formatos mezclados de la base producen la MISMA fecha', () => {
      expect(aIsoCorto(parsearFechaFlexible('1990-05-12')))
        .toBe(aIsoCorto(parsearFechaFlexible('12/05/1990')));
    });

    it('acepta ISO con hora y con zona Z sin correr el dia', () => {
      expect(aIsoCorto(parsearFechaFlexible('1990-05-12T00:00:00Z'))).toBe('1990-05-12');
      expect(aIsoCorto(parsearFechaFlexible('1990-05-12T23:59:59.999Z'))).toBe('1990-05-12');
      expect(aIsoCorto(parsearFechaFlexible('1990-05-12 08:30:00'))).toBe('1990-05-12');
    });

    it('acepta dia y mes de un solo digito', () => {
      expect(aIsoCorto(parsearFechaFlexible('1990-5-2'))).toBe('1990-05-02');
      expect(aIsoCorto(parsearFechaFlexible('2/5/1990'))).toBe('1990-05-02');
    });

    it('normaliza un Date a medianoche local', () => {
      const fecha = parsearFechaFlexible(new Date(2020, 0, 15, 18, 45, 30));
      expect(aIsoCorto(fecha)).toBe('2020-01-15');
      expect(fecha!.getHours()).toBe(0);
      expect(fecha!.getMinutes()).toBe(0);
    });

    // ── Basura conocida en produccion ──────────────────────────────────
    it('descarta 0001-01-01 (basura real de la tabla)', () => {
      expect(parsearFechaFlexible('0001-01-01')).toBeNull();
    });

    it('descarta 9994-03-30 (basura real de la tabla)', () => {
      expect(parsearFechaFlexible('9994-03-30')).toBeNull();
    });

    it('descarta fechas por debajo del ano minimo plausible', () => {
      expect(parsearFechaFlexible(`${ANIO_MINIMO_PLAUSIBLE - 1}-06-15`)).toBeNull();
      expect(parsearFechaFlexible(`${ANIO_MINIMO_PLAUSIBLE}-06-15`)).not.toBeNull();
    });

    it('acepta el año siguiente (fecha fin de una incapacidad de diciembre) y descarta lo demas', () => {
      const anioSiguiente = new Date().getFullYear() + 1;
      expect(parsearFechaFlexible(`${anioSiguiente}-01-01`)).not.toBeNull();
      expect(parsearFechaFlexible(`${anioSiguiente + 1}-01-01`)).toBeNull();
    });

    it('descarta fechas de calendario inexistentes', () => {
      expect(parsearFechaFlexible('2023-02-30')).toBeNull();
      expect(parsearFechaFlexible('31/02/2024')).toBeNull();
      expect(parsearFechaFlexible('2023-13-01')).toBeNull();
      expect(parsearFechaFlexible('00/05/1990')).toBeNull();
    });

    it('acepta el 29 de febrero de un ano bisiesto', () => {
      expect(aIsoCorto(parsearFechaFlexible('29/02/2024'))).toBe('2024-02-29');
    });

    it('descarta texto libre, vacios y nulos', () => {
      expect(parsearFechaFlexible('SIN DATO')).toBeNull();
      expect(parsearFechaFlexible('')).toBeNull();
      expect(parsearFechaFlexible('   ')).toBeNull();
      expect(parsearFechaFlexible(null)).toBeNull();
      expect(parsearFechaFlexible(undefined)).toBeNull();
      expect(parsearFechaFlexible('12/1990')).toBeNull();
      expect(parsearFechaFlexible({} as unknown)).toBeNull();
      expect(parsearFechaFlexible(new Date('no es fecha'))).toBeNull();
    });

    it('ignora espacios sobrantes alrededor del texto', () => {
      expect(aIsoCorto(parsearFechaFlexible('  1990-05-12  '))).toBe('1990-05-12');
    });
  });

  describe('aIsoCorto', () => {
    it('NO desplaza el dia por zona horaria (el bug de toISOString)', () => {
      // En UTC-5 esta fecha a medianoche local es 1990-05-11T05:00Z:
      // toISOString() devolveria '1990-05-11'. aIsoCorto debe dar el 12.
      const fecha = new Date(1990, 4, 12, 0, 0, 0, 0);
      expect(aIsoCorto(fecha)).toBe('1990-05-12');
    });

    it('tampoco desplaza en el ultimo instante del dia', () => {
      const fecha = new Date(2024, 11, 31, 23, 59, 59, 999);
      expect(aIsoCorto(fecha)).toBe('2024-12-31');
    });

    it('rellena mes y dia con ceros', () => {
      expect(aIsoCorto(new Date(2024, 0, 5))).toBe('2024-01-05');
    });

    it('devuelve cadena vacia para nulo o fecha invalida', () => {
      expect(aIsoCorto(null)).toBe('');
      expect(aIsoCorto(undefined)).toBe('');
      expect(aIsoCorto(new Date('basura'))).toBe('');
    });

    it('ida y vuelta: parsear y serializar es estable', () => {
      const original = '2024-07-15';
      expect(aIsoCorto(parsearFechaFlexible(original))).toBe(original);
    });
  });

  describe('aIsoCortoFlexible', () => {
    it('convierte el formato latino al formato del backend', () => {
      expect(aIsoCortoFlexible('12/05/1990')).toBe('1990-05-12');
    });

    it('devuelve cadena vacia con basura', () => {
      expect(aIsoCortoFlexible('9994-03-30')).toBe('');
      expect(aIsoCortoFlexible(null)).toBe('');
    });
  });

  describe('calcularEdad', () => {
    const referencia = new Date(2026, 7, 4); // 4 de agosto de 2026

    it('calcula la edad con fecha ISO', () => {
      expect(calcularEdad('1990-05-12', referencia)).toBe(36);
    });

    it('calcula la edad con fecha latina', () => {
      expect(calcularEdad('12/05/1990', referencia)).toBe(36);
    });

    it('resta un ano si aun no ha cumplido en el ano de referencia', () => {
      expect(calcularEdad('1990-12-31', referencia)).toBe(35);
    });

    it('cuenta el ano el mismo dia del cumpleanos', () => {
      expect(calcularEdad('1990-08-04', referencia)).toBe(36);
    });

    it('no cuenta el ano el dia previo al cumpleanos', () => {
      expect(calcularEdad('1990-08-05', referencia)).toBe(35);
    });

    it('devuelve null con la basura conocida de la tabla', () => {
      expect(calcularEdad('0001-01-01', referencia)).toBeNull();
      expect(calcularEdad('9994-03-30', referencia)).toBeNull();
      expect(calcularEdad('SIN DATO', referencia)).toBeNull();
      expect(calcularEdad(null, referencia)).toBeNull();
    });

    it('devuelve null si la edad queda fuera de 14..100', () => {
      // 13 anos: demasiado joven para ser trabajador.
      expect(calcularEdad('2013-08-04', referencia)).toBeNull();
      // 101 anos: implausible.
      expect(calcularEdad('1925-01-01', referencia)).toBeNull();
    });

    it('acepta los limites 14 y 100', () => {
      expect(calcularEdad('2012-08-04', referencia)).toBe(14);
      expect(calcularEdad('1926-08-04', referencia)).toBe(100);
    });
  });

  describe('esFechaPlausible', () => {
    it('acepta fechas dentro del rango', () => {
      expect(esFechaPlausible(new Date(2020, 0, 1))).toBe(true);
    });

    it('rechaza nulos e invalidos', () => {
      expect(esFechaPlausible(null)).toBe(false);
      expect(esFechaPlausible(new Date('basura'))).toBe(false);
    });
  });

  describe('diasCalendarioInclusive', () => {
    it('cuenta ambos extremos', () => {
      expect(diasCalendarioInclusive('2024-03-01', '2024-03-03')).toBe(3);
    });

    it('un solo dia cuenta 1', () => {
      expect(diasCalendarioInclusive('2024-03-01', '2024-03-01')).toBe(1);
    });

    it('acepta formatos mezclados', () => {
      expect(diasCalendarioInclusive('01/03/2024', '2024-03-31')).toBe(31);
    });

    it('devuelve null si el rango esta invertido o hay basura', () => {
      expect(diasCalendarioInclusive('2024-03-10', '2024-03-01')).toBeNull();
      expect(diasCalendarioInclusive('basura', '2024-03-01')).toBeNull();
    });
  });
});
