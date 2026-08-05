import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '@/environments/environment';
import { IncapacidadV2Service, LEGACY_FIELD_POR_SOPORTE } from './incapacidad-v2.service';
import {
  CatalogosIncapacidad,
  CrearIncapacidadV2Request,
  IncapacidadResumen,
  Page,
  ResultadoPromocion,
  ValidacionResponse,
  ValidarIncapacidadRequest,
} from '../../models/incapacidad-v2.model';

const API = environment.apiUrl;
const BASE = `${API}/Incapacidades/v2`;

const REQ_VALIDAR: ValidarIncapacidadRequest = {
  cedula: '1005851505',
  fechaIngreso: '2024-01-15',
  tipoIncapacidad: 'ENFERMEDAD_GENERAL',
  fechaInicio: '2026-07-01',
  fechaFin: '2026-07-05',
  codigoDiagnostico: 'J00',
  eps: 'NUEVA EPS',
  estadoDocumento: 'OK',
  soportesCargados: ['INCAPACIDAD_MEDICA'],
};

const REQ_CREAR: CrearIncapacidadV2Request = {
  cedula: '1005851505',
  fechaIngreso: '2024-01-15',
  eps: 'SURA',
  tipoIncapacidad: 'ENFERMEDAD_GENERAL',
  fechaInicio: '2026-01-01',
  fechaFin: '2026-01-03',
  codigoDiagnostico: 'J00',
  estadoDocumento: 'OK',
  oficina: 'SOACHA',
  nombreQuienRecibe: 'ANA PEREZ',
};

const CATALOGOS: CatalogosIncapacidad = {
  tiposIncapacidad: [{ codigo: 'ENFERMEDAD_GENERAL', etiqueta: 'Enfermedad general' }],
  estados: [{ codigo: 'RECIBIDA', etiqueta: 'Recibida' }],
  estadosDocumento: [
    { codigo: 'OK', etiqueta: 'Documentacion OK', automatico: false },
    { codigo: 'PRESCRITA', etiqueta: 'Prescrita', automatico: true },
  ],
  responsablesPago: [{ codigo: 'EPS', etiqueta: 'EPS' }],
  tiposSoporte: [{ codigo: 'INCAPACIDAD_MEDICA', etiqueta: 'Incapacidad medica' }],
};

const PAGINA_VACIA: Page<IncapacidadResumen> = {
  content: [],
  number: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

describe('IncapacidadV2Service', () => {
  let servicio: IncapacidadV2Service;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('token', 'Bearer token-de-prueba');

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        IncapacidadV2Service,
      ],
    });

    servicio = TestBed.inject(IncapacidadV2Service);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('token');
  });

  it('se crea', () => {
    expect(servicio).toBeTruthy();
  });

  describe('validar', () => {
    it('hace POST a /Incapacidades/v2/validar con el cuerpo tal cual', () => {
      const recibidas: ValidacionResponse[] = [];
      servicio.validar(REQ_VALIDAR).subscribe((r) => recibidas.push(r));

      const req = http.expectOne(`${BASE}/validar`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(REQ_VALIDAR);
      expect(req.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');

      req.flush({ dias: 5, puedeValidar: true, motivosBloqueo: [] });
      expect(recibidas.length).toBe(1);
      expect(recibidas[0].dias).toBe(5);
    });

    it('propaga el error sin transformarlo', () => {
      const errores: HttpErrorResponse[] = [];
      servicio.validar(REQ_VALIDAR).subscribe({
        next: () => fail('no deberia emitir'),
        error: (e: HttpErrorResponse) => errores.push(e),
      });

      http.expectOne(`${BASE}/validar`).flush('boom', { status: 500, statusText: 'Error' });
      expect(errores.length).toBe(1);
      expect(errores[0].status).toBe(500);
    });
  });

  describe('CRUD', () => {
    it('crear hace POST a la base', () => {
      servicio.crear(REQ_CREAR).subscribe();
      const req = http.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(REQ_CREAR);
      req.flush({ id: 1 });
    });

    it('actualizar hace PUT a /{id}', () => {
      servicio.actualizar(7, REQ_CREAR).subscribe();
      const req = http.expectOne(`${BASE}/7`);
      expect(req.request.method).toBe('PUT');
      req.flush({ id: 7 });
    });

    it('obtener hace GET a /{id}', () => {
      servicio.obtener(7).subscribe();
      const req = http.expectOne(`${BASE}/7`);
      expect(req.request.method).toBe('GET');
      req.flush({ id: 7 });
    });

    it('eliminar hace DELETE a /{id}', () => {
      servicio.eliminar(7).subscribe();
      const req = http.expectOne(`${BASE}/7`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('promoverAValidada', () => {
    it('devuelve ok:true con el 200', () => {
      const resultados: ResultadoPromocion[] = [];
      servicio.promoverAValidada(7).subscribe((r) => resultados.push(r));

      const req = http.expectOne(`${BASE}/7/validar`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 7, estado: 'VALIDADA' });

      expect(resultados.length).toBe(1);
      expect(resultados[0].ok).toBe(true);
      expect(resultados[0].motivosBloqueo).toEqual([]);
    });

    it('traduce el 409 a ok:false con los motivosBloqueo', () => {
      const resultados: ResultadoPromocion[] = [];
      const errores: unknown[] = [];
      servicio.promoverAValidada(7).subscribe({
        next: (r) => resultados.push(r),
        error: (e: unknown) => errores.push(e),
      });

      http.expectOne(`${BASE}/7/validar`).flush(
        { motivosBloqueo: ['Falta historia clinica', 'No cumple cotizacion'] },
        { status: 409, statusText: 'Conflict' },
      );

      expect(errores.length).toBe(0);
      expect(resultados.length).toBe(1);
      expect(resultados[0].ok).toBe(false);
      expect(resultados[0].motivosBloqueo).toEqual([
        'Falta historia clinica',
        'No cumple cotizacion',
      ]);
    });

    it('da un motivo por defecto si el 409 viene sin cuerpo util', () => {
      const resultados: ResultadoPromocion[] = [];
      servicio.promoverAValidada(7).subscribe((r) => resultados.push(r));

      http.expectOne(`${BASE}/7/validar`).flush(null, {
        status: 409,
        statusText: 'Conflict',
      });

      expect(resultados[0].ok).toBe(false);
      expect(resultados[0].motivosBloqueo.length).toBe(1);
    });

    it('NO se traga los errores distintos de 409', () => {
      const errores: HttpErrorResponse[] = [];
      servicio.promoverAValidada(7).subscribe({
        next: () => fail('no deberia emitir'),
        error: (e: HttpErrorResponse) => errores.push(e),
      });

      http.expectOne(`${BASE}/7/validar`).flush('nope', { status: 500, statusText: 'Error' });
      expect(errores.length).toBe(1);
      expect(errores[0].status).toBe(500);
    });
  });

  describe('listar', () => {
    it('manda page, size y sort', () => {
      const paginas: Page<IncapacidadResumen>[] = [];
      servicio
        .listar({}, 2, 50, { campo: 'fechaInicio', direccion: 'desc' })
        .subscribe((p) => paginas.push(p));

      const req = http.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('50');
      expect(req.request.params.get('sort')).toBe('fechaInicio,desc');

      req.flush({ ...PAGINA_VACIA, number: 2, size: 50 });
      expect(paginas.length).toBe(1);
      expect(paginas[0].content).toEqual([]);
    });

    it('acepta el sort como cadena', () => {
      servicio.listar({}, 0, 20, 'cedula,asc').subscribe();
      const req = http.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('sort')).toBe('cedula,asc');
      req.flush(PAGINA_VACIA);
    });

    it('omite los filtros vacios, nulos o de solo espacios', () => {
      servicio
        .listar({ cedula: '  1005  ', eps: '   ', estado: undefined, q: '' }, 0, 20)
        .subscribe();

      const req = http.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('cedula')).toBe('1005');
      expect(req.request.params.has('eps')).toBe(false);
      expect(req.request.params.has('estado')).toBe(false);
      expect(req.request.params.has('q')).toBe(false);
      expect(req.request.params.has('sort')).toBe(false);

      req.flush(PAGINA_VACIA);
    });
  });

  describe('catalogos', () => {
    it('pide los catalogos UNA sola vez y cachea en el signal', () => {
      expect(servicio.catalogosListos()).toBe(false);

      servicio.catalogos().subscribe();
      http.expectOne(`${BASE}/catalogos`).flush(CATALOGOS);

      expect(servicio.catalogosListos()).toBe(true);
      expect(servicio.catalogosCache()).toEqual(CATALOGOS);

      const segundas: CatalogosIncapacidad[] = [];
      servicio.catalogos().subscribe((c) => segundas.push(c));
      http.expectNone(`${BASE}/catalogos`);
      expect(segundas).toEqual([CATALOGOS]);
    });

    it('comparte la peticion en vuelo entre suscriptores concurrentes', () => {
      const recibidos: CatalogosIncapacidad[] = [];
      servicio.catalogos().subscribe((c) => recibidos.push(c));
      servicio.catalogos().subscribe((c) => recibidos.push(c));

      // Un solo GET pese a los dos suscriptores.
      http.expectOne(`${BASE}/catalogos`).flush(CATALOGOS);

      expect(recibidos).toEqual([CATALOGOS, CATALOGOS]);
    });

    it('propaga el error y permite reintentar', () => {
      const errores: HttpErrorResponse[] = [];
      servicio.catalogos().subscribe({
        next: () => fail('no deberia emitir'),
        error: (e: HttpErrorResponse) => errores.push(e),
      });
      http.expectOne(`${BASE}/catalogos`).flush('boom', { status: 503, statusText: 'X' });

      expect(errores.length).toBe(1);
      expect(errores[0].status).toBe(503);
      expect(servicio.catalogosListos()).toBe(false);

      // El reintento vuelve a pegarle al backend.
      servicio.catalogos().subscribe();
      http.expectOne(`${BASE}/catalogos`).flush(CATALOGOS);
      expect(servicio.catalogosListos()).toBe(true);
    });

    it('invalidarCatalogos fuerza una nueva peticion', () => {
      servicio.catalogos().subscribe();
      http.expectOne(`${BASE}/catalogos`).flush(CATALOGOS);

      servicio.invalidarCatalogos();
      expect(servicio.catalogosListos()).toBe(false);

      servicio.catalogos().subscribe();
      http.expectOne(`${BASE}/catalogos`).flush(CATALOGOS);
    });
  });

  describe('endpoints de contratacion reutilizados', () => {
    it('buscarEmpleados manda q y limit', () => {
      servicio.buscarEmpleados('juan', 15).subscribe();
      const req = http.expectOne((r) => r.url === `${API}/contratacion/empleados/buscar`);
      expect(req.request.params.get('q')).toBe('juan');
      expect(req.request.params.get('limit')).toBe('15');
      req.flush([]);
    });

    it('datosContratacion codifica la cedula en la ruta', () => {
      servicio.datosContratacion('1005 851').subscribe();
      const req = http.expectOne(
        `${API}/contratacion/datosIncapacidadContratacion/1005%20851`,
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('buscarCodigosDiagnostico usa el endpoint CIE-10 con limit por defecto', () => {
      servicio.buscarCodigosDiagnostico('gripa').subscribe();
      const req = http.expectOne(
        (r) => r.url === `${API}/Incapacidades/codigos-diagnostico/search`,
      );
      expect(req.request.params.get('q')).toBe('gripa');
      expect(req.request.params.get('limit')).toBe('20');
      req.flush([]);
    });

    it('buscarIps usa el endpoint de IPS', () => {
      servicio.buscarIps('clinica', 5).subscribe();
      const req = http.expectOne((r) => r.url === `${API}/Incapacidades/ips/search`);
      expect(req.request.params.get('limit')).toBe('5');
      req.flush([]);
    });
  });

  describe('subirSoporte', () => {
    it('el mapeo TipoSoporte -> legacy_field es el que entiende el backend', () => {
      // Verificado contra commons DocumentTypeCodes.INCAPACIDAD_LEGACY_FIELD_TO_CODE.
      expect(LEGACY_FIELD_POR_SOPORTE).toEqual({
        INCAPACIDAD_MEDICA: 'link_incapacidad',
        HISTORIAL_CLINICO: 'historial_clinico',
        REGISTRO_CIVIL: 'registro_civil',
        REGISTRO_NACIDO_VIVO: 'registro_de_nacido_vivo',
        FURAT: 'furat',
        FURIPS: 'furips',
        FORMULARIO_SALUD_TOTAL: 'formulario_salud_total',
      });
    });

    it('envia multipart con legacy_field y file al endpoint legacy', () => {
      const archivo = new File(['contenido'], 'incapacidad.pdf', { type: 'application/pdf' });
      servicio.subirSoporte('INC-2026-001', 'HISTORIAL_CLINICO', archivo).subscribe();

      const req = http.expectOne(`${API}/Incapacidades/INC-2026-001/documentos/upload`);
      expect(req.request.method).toBe('POST');

      const cuerpo = req.request.body as FormData;
      expect(cuerpo instanceof FormData).toBe(true);
      expect(cuerpo.get('legacy_field')).toBe('historial_clinico');
      expect((cuerpo.get('file') as File).name).toBe('incapacidad.pdf');

      // El navegador debe poner el boundary: no se fuerza Content-Type.
      expect(req.request.headers.has('Content-Type')).toBe(false);

      req.flush({ documentId: 99 });
    });

    it('acepta tambien un id numerico', () => {
      const archivo = new File([''], 'a.pdf');
      servicio.subirSoporte(42, 'INCAPACIDAD_MEDICA', archivo).subscribe();
      const req = http.expectOne(`${API}/Incapacidades/42/documentos/upload`);
      expect((req.request.body as FormData).get('legacy_field')).toBe('link_incapacidad');
      req.flush({});
    });
  });

  describe('urlAbsolutaDocumento', () => {
    it('deja pasar las URL absolutas', () => {
      expect(servicio.urlAbsolutaDocumento('https://x.co/a.pdf')).toBe('https://x.co/a.pdf');
    });

    it('resuelve las rutas relativas contra apiUrl', () => {
      expect(servicio.urlAbsolutaDocumento('/media/a.pdf')).toBe(`${API}/media/a.pdf`);
      expect(servicio.urlAbsolutaDocumento('media/a.pdf')).toBe(`${API}/media/a.pdf`);
    });

    it('devuelve cadena vacia con valores vacios', () => {
      expect(servicio.urlAbsolutaDocumento(null)).toBe('');
      expect(servicio.urlAbsolutaDocumento(undefined)).toBe('');
      expect(servicio.urlAbsolutaDocumento('')).toBe('');
    });
  });
});
