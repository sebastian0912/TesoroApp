import {
  USUARIO_ACTUAL_VACIO,
  haySesion,
  leerUsuarioCrudo,
  obtenerUsuarioActual,
  tieneSedeAsignada,
} from './usuario-actual';

/** Escribe el usuario en localStorage tal cual lo haria la app. */
function guardarUsuario(valor: unknown): void {
  localStorage.setItem('user', JSON.stringify(valor));
}

describe('core/utils/usuario-actual', () => {
  beforeEach(() => {
    localStorage.removeItem('user');
  });

  afterAll(() => {
    localStorage.removeItem('user');
  });

  describe('sin sesion', () => {
    it('devuelve el usuario vacio cuando no hay nada en localStorage', () => {
      expect(obtenerUsuarioActual()).toEqual({ ...USUARIO_ACTUAL_VACIO });
    });

    it('devuelve el usuario vacio cuando el JSON esta corrupto', () => {
      localStorage.setItem('user', '{esto no es json');
      expect(obtenerUsuarioActual()).toEqual({ ...USUARIO_ACTUAL_VACIO });
      expect(leerUsuarioCrudo()).toBeNull();
    });

    it('devuelve el usuario vacio cuando el valor no es un objeto', () => {
      localStorage.setItem('user', '"soy un string"');
      expect(obtenerUsuarioActual()).toEqual({ ...USUARIO_ACTUAL_VACIO });
    });

    it('devuelve el usuario vacio cuando el valor es un array', () => {
      localStorage.setItem('user', '[1,2,3]');
      expect(obtenerUsuarioActual()).toEqual({ ...USUARIO_ACTUAL_VACIO });
    });

    it('haySesion es false', () => {
      expect(haySesion()).toBe(false);
    });
  });

  describe('SHAPE A: justo despues del login (sin datos_basicos ni sede)', () => {
    beforeEach(() => {
      guardarUsuario({
        id: 'uuid-login',
        nombres: 'DANIEL ANDRES',
        apellidos: 'GOMEZ RUIZ',
        email: 'daniel@nova-col.com',
        rol: { id: 3, nombre: 'INCAPACIDADES' },
      });
    });

    it('arma el nombre completo desde el shape plano', () => {
      expect(obtenerUsuarioActual().nombreCompleto).toBe('DANIEL ANDRES GOMEZ RUIZ');
    });

    it('deja la sede vacia porque este shape no la trae', () => {
      expect(obtenerUsuarioActual().sedeNombre).toBe('');
      expect(tieneSedeAsignada()).toBe(false);
    });

    it('lee rol, id y email', () => {
      const u = obtenerUsuarioActual();
      expect(u.rol).toBe('INCAPACIDADES');
      expect(u.id).toBe('uuid-login');
      expect(u.email).toBe('daniel@nova-col.com');
    });

    it('haySesion es true', () => {
      expect(haySesion()).toBe(true);
    });
  });

  describe('SHAPE B: tras el refresh del navbar (datos_basicos + sede)', () => {
    beforeEach(() => {
      guardarUsuario({
        id: 'uuid-refresh',
        datos_basicos: {
          nombres: 'DANIEL ANDRES',
          apellidos: 'GOMEZ RUIZ',
          correo_electronico: 'daniel@nova-col.com',
        },
        sede: { id: 12, nombre: 'SOACHA' },
        rol: { id: 3, nombre: 'INCAPACIDADES' },
      });
    });

    it('arma el nombre completo desde datos_basicos', () => {
      expect(obtenerUsuarioActual().nombreCompleto).toBe('DANIEL ANDRES GOMEZ RUIZ');
    });

    it('lee la sede del objeto sede', () => {
      expect(obtenerUsuarioActual().sedeNombre).toBe('SOACHA');
      expect(tieneSedeAsignada()).toBe(true);
    });

    it('lee el correo desde datos_basicos', () => {
      expect(obtenerUsuarioActual().email).toBe('daniel@nova-col.com');
    });
  });

  it('los DOS shapes de la misma sesion producen el MISMO nombre', () => {
    guardarUsuario({ nombres: 'ANA', apellidos: 'PEREZ' });
    const desdeLogin = obtenerUsuarioActual().nombreCompleto;

    guardarUsuario({ datos_basicos: { nombres: 'ANA', apellidos: 'PEREZ' } });
    const desdeRefresh = obtenerUsuarioActual().nombreCompleto;

    expect(desdeLogin).toBe('ANA PEREZ');
    expect(desdeRefresh).toBe('ANA PEREZ');
  });

  describe('SHAPE C: historico (primer_nombre / primer_apellido)', () => {
    it('compone el nombre con los cuatro campos', () => {
      guardarUsuario({
        numero_de_documento: '1005851505',
        primer_nombre: 'PRUEBA',
        segundo_nombre: '5',
        primer_apellido: 'GOOGLE',
        segundo_apellido: 'CAMPOS',
        correo_electronico: 'prueba@test.com',
        rol: { nombre: 'ADMIN' },
        sede: { nombre: 'SOACHA' },
      });
      const u = obtenerUsuarioActual();
      expect(u.nombreCompleto).toBe('PRUEBA 5 GOOGLE CAMPOS');
      expect(u.sedeNombre).toBe('SOACHA');
      expect(u.rol).toBe('ADMIN');
      expect(u.email).toBe('prueba@test.com');
    });

    it('tolera que falten los segundos nombres', () => {
      guardarUsuario({ primer_nombre: 'ANA', primer_apellido: 'PEREZ' });
      expect(obtenerUsuarioActual().nombreCompleto).toBe('ANA PEREZ');
    });
  });

  describe('tolerancias', () => {
    it('acepta sede como string plano', () => {
      guardarUsuario({ nombres: 'ANA', apellidos: 'PEREZ', sede: 'FUSAGASUGA' });
      expect(obtenerUsuarioActual().sedeNombre).toBe('FUSAGASUGA');
    });

    it('acepta rol como string plano (shape del JWT)', () => {
      guardarUsuario({ nombres: 'ANA', rol: 'ADMIN' });
      expect(obtenerUsuarioActual().rol).toBe('ADMIN');
    });

    it('trata sede null como sin sede', () => {
      guardarUsuario({ nombres: 'ANA', apellidos: 'PEREZ', sede: null });
      expect(obtenerUsuarioActual().sedeNombre).toBe('');
      expect(tieneSedeAsignada()).toBe(false);
    });

    it('trata sede.nombre vacio como sin sede', () => {
      guardarUsuario({ nombres: 'ANA', sede: { id: 1, nombre: '   ' } });
      expect(obtenerUsuarioActual().sedeNombre).toBe('');
    });

    it('colapsa espacios sobrantes en el nombre', () => {
      guardarUsuario({ nombres: '  ANA   MARIA ', apellidos: '  PEREZ  ' });
      expect(obtenerUsuarioActual().nombreCompleto).toBe('ANA MARIA PEREZ');
    });

    it('no revienta si solo hay apellidos', () => {
      guardarUsuario({ apellidos: 'PEREZ' });
      expect(obtenerUsuarioActual().nombreCompleto).toBe('PEREZ');
    });

    it('acepta id numerico', () => {
      guardarUsuario({ id: 42, nombres: 'ANA' });
      expect(obtenerUsuarioActual().id).toBe('42');
    });

    it('nunca devuelve undefined en ningun campo', () => {
      guardarUsuario({});
      const u = obtenerUsuarioActual();
      expect(u.nombreCompleto).toBe('');
      expect(u.sedeNombre).toBe('');
      expect(u.rol).toBe('');
      expect(u.id).toBe('');
      expect(u.email).toBe('');
    });

    it('tieneSedeAsignada acepta un usuario ya resuelto', () => {
      expect(tieneSedeAsignada({ ...USUARIO_ACTUAL_VACIO, sedeNombre: 'CHIA' })).toBe(true);
      expect(tieneSedeAsignada({ ...USUARIO_ACTUAL_VACIO })).toBe(false);
    });
  });
});
