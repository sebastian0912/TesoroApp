/**
 * Pipeline de contratación — pruebas de componente.
 *
 * Es la pantalla que orquesta todos los tabs. Se prueban las dos cosas que se
 * rompieron acá y que no se veían compilando:
 *
 *  1. La FOTO. `camera-dialog` devolvía una URL `blob:` y la revocaba en su
 *     propio `ngOnDestroy`, o sea justo al cerrarse. El pipeline guardaba esa
 *     URL muerta y el avatar mostraba el texto alternativo hasta que se volvía
 *     a consultar al candidato.
 *  2. El BORRADO de procesos desde el historial: tiene que mandar el id de ESA
 *     fila, no el del proceso más reciente.
 */
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { RecruitmentPipelineComponent } from './recruitment-pipeline.component';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { HiringService } from '../../service/hiring.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { ElectronWindowService } from '@/app/core/services/electron-window.service';

describe('RecruitmentPipelineComponent', () => {
  let fixture: ComponentFixture<RecruitmentPipelineComponent>;
  let comp: RecruitmentPipelineComponent;
  let registro: jasmine.SpyObj<RegistroProcesoContratacion>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    registro = jasmine.createSpyObj('RegistroProcesoContratacion', [
      'getCandidatoPorDocumento', 'eliminarProceso', 'listProcesosMiniByDocumento',
      'updateProcesoByDocumento', 'uploadFoto',
    ]);
    registro.getCandidatoPorDocumento.and.returnValue(of(null as any));
    registro.eliminarProceso.and.returnValue(of({
      message: 'deleted',
      eliminado: { entrevista_id: 10, proceso_id: 5, codigo_contrato: null, contrato_activo: false, antecedentes: 2 },
      candidato_conservado: { numero_documento: '1', formulario_paso: 5, formulario_completo: true },
    } as any));
    registro.listProcesosMiniByDocumento.and.returnValue(of([] as any));
    registro.updateProcesoByDocumento.and.returnValue(of({} as any));
    registro.uploadFoto.and.returnValue(of({} as any));

    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    dialog.open.and.returnValue({ afterClosed: () => of(true), componentInstance: {} } as any);

    await TestBed.configureTestingModule({
      imports: [RecruitmentPipelineComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RegistroProcesoContratacion, useValue: registro },
        { provide: MatDialog, useValue: dialog },
        {
          provide: GestionDocumentalService,
          useValue: { getDocuments: () => of([]), guardarDocumento: () => of({}) },
        },
        { provide: HiringService, useValue: {} },
        {
          provide: UtilityServiceService,
          useValue: {
            getUser: () => Promise.resolve({}),
            normalizeText: (v: any) => String(v ?? '').trim().toUpperCase(),
          },
        },
        {
          provide: ElectronWindowService,
          useValue: { openPdfFromBlob: () => Promise.resolve(), openExternal: () => { } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecruitmentPipelineComponent);
    comp = fixture.componentInstance;

    // El componente es standalone e importa `MatDialogModule`, cuyo provider
    // de `MatDialog` gana sobre el de TestBed. Se reemplaza en la instancia
    // para poder controlar las confirmaciones.
    (comp as any).dialog = dialog;
  });

  it('se construye con sus dependencias', () => {
    // No se llama `detectChanges()` a propósito: los effects de esta pantalla
    // arrancan media docena de cargas (exámenes, ARL, documentos, tabla) y
    // montarla entera exigiría simular casi toda la app. Lo que se prueba acá
    // son los métodos, que es donde estaban los bugs.
    expect(comp).toBeTruthy();
    expect(comp.candidatoSeleccionado).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────
  describe('vista previa de la foto', () => {

    it('crea una URL PROPIA a partir del archivo', () => {
      // No se reutiliza la del diálogo: esa la revoca él mismo al cerrarse.
      const file = new File([new Blob(['x'])], 'foto.jpg', { type: 'image/jpeg' });
      const spy = spyOn(URL, 'createObjectURL').and.returnValue('blob:propia');

      (comp as any).mostrarPreviewFoto(file);

      expect(spy).toHaveBeenCalledWith(file);
      expect(comp.fotoDataUrl()).toBe('blob:propia');
    });

    it('al tomar otra foto libera la anterior', () => {
      const revoke = spyOn(URL, 'revokeObjectURL');
      spyOn(URL, 'createObjectURL').and.returnValues('blob:1', 'blob:2');

      (comp as any).mostrarPreviewFoto(new File([''], 'a.jpg'));
      (comp as any).mostrarPreviewFoto(new File([''], 'b.jpg'));

      expect(revoke).toHaveBeenCalledWith('blob:1');
      expect(comp.fotoDataUrl()).toBe('blob:2');
    });

    it('liberar sin preview previa no revienta', () => {
      const revoke = spyOn(URL, 'revokeObjectURL');
      expect(() => (comp as any).liberarPreviewFoto()).not.toThrow();
      expect(revoke).not.toHaveBeenCalled();
    });

    it('la preview local manda sobre la URL del servidor', () => {
      spyOn(URL, 'createObjectURL').and.returnValue('blob:reciente');
      comp.fotoDoc.set({ file_url: 'https://servidor/vieja.jpg' } as any);

      (comp as any).mostrarPreviewFoto(new File([''], 'a.jpg'));

      expect(comp.avatarPhotoUrl()).toBe('blob:reciente');
    });

    it('sin preview local usa la URL del documento', () => {
      comp.fotoDoc.set({ file_url: 'https://servidor/foto.jpg' } as any);
      expect(comp.avatarPhotoUrl()).toBe('https://servidor/foto.jpg');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Un registro puede existir en la base y el archivo no estar en el servidor
  // (subida hecha contra otro disco, archivo movido, borrado a mano). Si la
  // imagen rota se queda en pantalla, se ve el texto alternativo sobre el
  // fondo azul y parece que la aplicación se dañó.
  describe('la foto existe en la base pero el archivo no carga', () => {

    const fallar = () => comp.onAvatarPhotoError(new Event('error'));

    it('deja de mostrar la imagen rota', () => {
      comp.fotoDoc.set({ file_url: 'https://servidor/no-existe.png' } as any);
      expect(comp.avatarPhotoUrl()).toBe('https://servidor/no-existe.png');

      fallar();

      expect(comp.avatarPhotoUrl())
        .withContext('con null el avatar cae en el ícono de persona')
        .toBeNull();
    });

    it('al subir una foto nueva vuelve a intentar', () => {
      comp.fotoDoc.set({ file_url: 'https://servidor/vieja.png' } as any);
      fallar();
      expect(comp.avatarPhotoUrl()).toBeNull();

      // Una subida nueva estrena URL: no puede quedar castigada por la anterior.
      comp.fotoDoc.set({ file_url: 'https://servidor/nueva.png' } as any);

      expect(comp.avatarPhotoUrl()).toBe('https://servidor/nueva.png');
    });

    it('la foto de otro candidato no queda marcada como rota', () => {
      comp.fotoDoc.set({ file_url: 'https://servidor/a.png' } as any);
      fallar();

      comp.fotoDoc.set({ file_url: 'https://servidor/b.png' } as any);

      expect(comp.avatarPhotoUrl()).toBe('https://servidor/b.png');
    });

    it('una preview local recién tomada manda sobre la URL rota', () => {
      comp.fotoDoc.set({ file_url: 'https://servidor/rota.png' } as any);
      fallar();
      spyOn(URL, 'createObjectURL').and.returnValue('blob:recien-tomada');

      (comp as any).mostrarPreviewFoto(new File([''], 'a.jpg'));

      expect(comp.avatarPhotoUrl()).toBe('blob:recien-tomada');
    });

    it('un error sin ninguna foto cargada no revienta', () => {
      comp.fotoDoc.set(null);
      comp.fotoDataUrl.set(null);
      expect(() => fallar()).not.toThrow();
      expect(comp.avatarPhotoUrl()).toBeNull();
    });

    it('fallar dos veces seguidas no deja el avatar en un estado raro', () => {
      comp.fotoDoc.set({ file_url: 'https://servidor/rota.png' } as any);
      fallar();
      fallar();
      expect(comp.avatarPhotoUrl()).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('borrado de un proceso del historial', () => {

    it('manda el id de ESA fila, no el del más reciente', fakeAsync(() => {
      comp.candidatoSeleccionado.set({ numero_documento: '1082490391' } as any);

      comp.eliminarProcesoDelHistorial({ id: 39389 });
      tick();

      expect(registro.eliminarProceso).toHaveBeenCalled();
      const [doc, opts] = registro.eliminarProceso.calls.mostRecent().args as any[];
      expect(doc).toBe('1082490391');
      expect(opts.procesoId).toBe(39389);
    }));

    it('devuelve true cuando borró, para que la tabla quite la fila', fakeAsync(() => {
      comp.candidatoSeleccionado.set({ numero_documento: '1' } as any);

      let resultado: boolean | undefined;
      comp.eliminarProcesoDelHistorial({ id: 1 }).then(r => resultado = r);
      tick();

      expect(resultado).toBeTrue();
    }));

    it('sin confirmar no llama al backend', fakeAsync(() => {
      dialog.open.and.returnValue({ afterClosed: () => of(false) } as any);
      comp.candidatoSeleccionado.set({ numero_documento: '1' } as any);

      comp.eliminarProcesoDelHistorial({ id: 1 });
      tick();

      expect(registro.eliminarProceso).not.toHaveBeenCalled();
    }));

    it('sin cédula no hace nada', fakeAsync(() => {
      comp.candidatoSeleccionado.set(null as any);
      comp.numeroDocumento = '';

      let resultado: boolean | undefined;
      comp.eliminarProcesoDelHistorial({ id: 1 }).then(r => resultado = r);
      tick();

      expect(resultado).toBeFalse();
      expect(registro.eliminarProceso).not.toHaveBeenCalled();
    }));

    it('un error del backend devuelve false y no rompe la pantalla', fakeAsync(() => {
      registro.eliminarProceso.and.returnValue(
        throwError(() => ({ status: 500, error: { detail: 'falló' } })));
      comp.candidatoSeleccionado.set({ numero_documento: '1' } as any);

      let resultado: boolean | undefined;
      comp.eliminarProcesoDelHistorial({ id: 1 }).then(r => resultado = r);
      tick();

      expect(resultado).toBeFalse();
    }));
  });
});
