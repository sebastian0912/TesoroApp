import { SharedModule } from '@/app/shared/shared.module';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import Swal from 'sweetalert2';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { PDFDocument } from 'pdf-lib';
import { Input } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { HiringService } from '../../service/hiring.service';
import { catchError, debounceTime, firstValueFrom, merge, of, Subscription, take, throwError } from 'rxjs';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

type UploadedFileInfo = {
  file?: File | string;
  fileName?: string;
  updatedAt?: number | string;   // ✅ ahora acepta número o ISO string
  updatedAtLabel?: string;
  changed?: boolean;
};

@Component({
  selector: 'app-selection-questions',
  imports: [
    SharedModule,
    MatTabsModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './selection-questions.component.html',
  styleUrl: './selection-questions.component.css'
})
export class SelectionQuestionsComponent implements OnInit {
  idvacante: string = '';
  @Input() cedula: string = '';
  @Input() vacanteSeleccionada: any;
  private _idProcesoSeleccion: number | null = null;

  @Input() set idProcesoSeleccion(v: any) {
    const n = v === null || v === undefined ? null : Number(v);
    this._idProcesoSeleccion = Number.isFinite(n as number) ? (n as number) : null;
    this.tryFetchOnce();
  }
  get idProcesoSeleccion() { return this._idProcesoSeleccion; }

  medidasCorrectivas = [
    ...Array.from({ length: 11 }, (_, i) => i),
    'CUMPLE'
  ];

  filteredExamOptions: string[] = [];

  formGroup1: FormGroup;
  compareNumbers = (a: any, b: any) => Number(a) === Number(b);
  semanasOptions: number[] = Array.from({ length: 2001 }, (_, i) => i);

  onlyInteger(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  private formSubs!: Subscription;

  examFiles: File[] = [];

  uploadedFiles: { [key: string]: UploadedFileInfo } = {
    eps: { fileName: 'Adjuntar documento' },
    afp: { fileName: 'Adjuntar documento' },
    policivos: { fileName: 'Adjuntar documento' },
    procuraduria: { fileName: 'Adjuntar documento' },
    contraloria: { fileName: 'Adjuntar documento' },
    ramaJudicial: { fileName: 'Adjuntar documento' },
    medidasCorrectivas: { fileName: 'Adjuntar documento' },
    sisben: { fileName: 'Adjuntar documento' },
    ofac: { fileName: 'Adjuntar documento' },
    figuraHumana: { fileName: 'Adjuntar documento' },
    pensionSemanas: { fileName: 'Sin consultar' },
  };

  epsList: string[] = [
    'ALIANSALUD', 'ASMET SALUD', 'CAJACOPI', 'CAPITAL SALUD', 'CAPRESOCA', 'COMFAMILIARHUILA',
    'COMFAORIENTE', 'COMPENSAR', 'COOSALUD', 'DUSAKAWI', 'ECOOPSOS', 'FAMISANAR',
    'FAMILIAR DE COLOMBIA', 'MUTUAL SER', 'NUEVA EPS', 'PIJAOS SALUD', 'SALUD TOTAL',
    'SANITAS', 'SAVIA SALUD', 'SOS', 'SURA', 'No Tiene', 'Sin Buscar',
  ];

  afpList: string[] = ['PORVENIR', 'COLFONDOS', 'PROTECCION', 'COLPENSIONES'];

  antecedentesEstados: string[] = ['Cumple', 'No Cumple', 'Sin Buscar'];

  getEstadoIcon(estado: string | null | undefined): string {
    switch (estado) {
      case 'Cumple': return 'check_circle';
      case 'No Cumple': return 'cancel';
      case 'Sin Buscar':
      default: return 'remove_circle';
    }
  }

  getEstadoColor(estado: string | null | undefined): string {
    switch (estado) {
      case 'Cumple': return 'green';
      case 'No Cumple': return 'red';
      case 'Sin Buscar':
      default: return 'gray';
    }
  }

  private _lastId: number | null = null;
  isLoading: boolean = false;

  private tryFetchOnce(): void {
    if (this._idProcesoSeleccion == null) return;
    if (this._lastId === this._idProcesoSeleccion) return;
    this._lastId = this._idProcesoSeleccion;

    this.isLoading = true;
    console.debug('[SelectionQuestions] Fetching selección', { idProcesoSeleccion: this._idProcesoSeleccion });

    this.seleccionService.getSeleccionPorId(this._idProcesoSeleccion!)
      .pipe(
        take(1),
        catchError(err => {
          this.isLoading = false;
          if (err?.status === 404) {
            console.warn('No hay proceso de selección para ese id.');
            return of(null);
          }
          Swal.fire({
            title: '¡Error!',
            text: 'No se pudieron obtener los datos de selección. Inténtalo de nuevo más tarde.',
            icon: 'error',
            confirmButtonText: 'Ok'
          });
          return throwError(() => err);
        })
      )
      .subscribe((response: any) => {
        this.isLoading = false;
        if (!response) return;

        const sel = response?.procesoSeleccion ?? response;
        this.loadDataSeleccion(sel);
        this.loadDataDocumentos();
      });
  }

  categoriasSisben: string[] = [
    'A1','A2','A3','A4','A5',
    'B1','B2','B3','B4','B5','B6','B7',
    'C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','C11','C12','C13','C14','C15','C16','C17','C18',
    'D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21',
    'No Aplica', 'Sin Buscar'
  ];

  typeMap: { [key: string]: number } = {
    eps: 7,
    policivos: 6,
    procuraduria: 3,
    contraloria: 4,
    medidasCorrectivas: 10,
    afp: 11,
    ramaJudicial: 12,
    sisben: 8,
    ofac: 5,
    figuraHumana: 31,
    pensionSemanas: 33
  };

  ngOnInit(): void {
    this.formSubs = merge(
      this.formGroup1.valueChanges,
    )
      .pipe(debounceTime(300))
      .subscribe(() => this.actualizarFormulariosLS());
  }

  ngOnDestroy(): void {
    this.formSubs?.unsubscribe();
  }

  private actualizarFormulariosLS(): void {
    const almacenado = localStorage.getItem('formularios');
    const formularios = almacenado ? JSON.parse(almacenado) : {};
    formularios.selecionparte1 = this.formGroup1.value;
    localStorage.setItem('formularios', JSON.stringify(formularios));
  }

  constructor(
    private seleccionService: SeleccionService,
    private gestionDocumentalService: GestionDocumentalService,
    private hiringService: HiringService,
    private utilityService: UtilityServiceService,
    private fb: FormBuilder,
  ) {
    this.formGroup1 = this.fb.group({
      eps: [''],
      afp: [''],
      policivos: [''],
      procuraduria: [''],
      contraloria: [''],
      ramaJudicial: [''],
      sisben: [''],
      ofac: [''],
      medidasCorrectivas: [''],
      semanasCotizadas: [0, [Validators.required, Validators.min(1)]],
    });

    this.filteredExamOptions = [
      'Exámen Ingreso', 'Colinesterasa', 'Glicemia Basal', 'Perfil lípidico', 'Visiometria',
      'Optometría', 'Audiometría', 'Espirometría', 'Sicometrico', 'Frotis de uñas',
      'Frotis de garganta', 'Cuadro hematico', 'Creatinina', 'TGO', 'Coprológico',
      'Osteomuscular', 'Quimico (Respiratorio - Dermatologico)', 'Tegumentaria',
      'Cardiovascular', 'Trabajo en alturas (Incluye test para detección de fobia a las alturas: El AQ (Acrophobia Questionnaire) de Cohen)',
      'Electrocardiograma (Sólo aplica para mayores de 45 años)', 'Examen Médico',
      'HEPATITIS A Y B', 'TETANO VACUNA T-D', 'Exámen médico integral definido para conductores'
    ];
  }

  loadDataSeleccion(seleccion: any): void {
    const toInt = (v: any, def = 0) => {
      const n = parseInt(String(v ?? '').trim(), 10);
      return Number.isFinite(n) ? n : def;
    };

    this.formGroup1.patchValue({
      eps: seleccion.eps || '',
      afp: seleccion.afp || '',
      policivos: seleccion.policivos || '',
      procuraduria: seleccion.procuraduria || '',
      contraloria: seleccion.contraloria || '',
      ramaJudicial: seleccion.rama_judicial || '',
      medidasCorrectivas: toInt(seleccion.medidas_correctivas, 0),
      area_aplica: seleccion.area_aplica || '',
      sisben: seleccion.sisben || '',
      ofac: seleccion.ofac || '',
      semanasCotizadas: seleccion.semanasCotizadas || 0
    });
  }

  private formatFechaActualizacion(iso: string | null | undefined): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return undefined;
    try {
      return d.toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Bogota'
      });
    } catch {
      return d.toLocaleString();
    }
  }

  async loadDataDocumentos(): Promise<void> {
    try {
      const docs: any[] = await firstValueFrom(
        this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, 2)
      );

      if (!Array.isArray(docs) || !docs.length) return;

      const tareas = docs.map(async (documento: any) => {
        const typeKey = Object.keys(this.typeMap).find(k => this.typeMap[k] === documento.type);
        if (!typeKey) return;

        const nombre = documento.title || 'Documento sin título';
        const file = await this.urlToFile(documento.file_url, nombre);

        const iso: string | undefined = documento.uploaded_at || undefined;
        const label = this.formatFechaActualizacion(iso);

        this.uploadedFiles[typeKey] = {
          fileName: nombre,
          file,
          updatedAt: iso ?? undefined,            // puede venir ISO
          updatedAtLabel: label ?? undefined
        };
      });

      await Promise.all(tareas);

    } catch (err: any) {
      if (err?.error?.error !== 'No se encontraron documentos') {
        Swal.fire({
          title: '¡Error!',
          text: 'No se pudieron obtener los documentos de antecedentes',
          icon: 'error',
          confirmButtonText: 'Ok'
        });
      }
    }
  }

  // ✅ Normaliza a timestamp numérico (ms) o undefined
  private toTimestampMs(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const p = Date.parse(v);
      return isNaN(p) ? undefined : p;
    }
    return undefined;
  }

  // Devuelve true si el archivo 'key' tiene más de 'days' días desde updatedAt/lastModified
  isOlderThan(key: string, days: number): boolean {
    const entry = this.uploadedFiles[key];
    if (!entry) return false;

    let ts: number | undefined = this.toTimestampMs(entry.updatedAt);
    if (ts == null && entry.file instanceof File) {
      ts = entry.file.lastModified;
    }
    if (ts == null) return false;

    const diffMs = Date.now() - ts;
    const limitMs = days * 24 * 60 * 60 * 1000;
    return diffMs > limitMs;
  }

  verArchivo(campo: string) {
    const archivo = this.uploadedFiles[campo];
    if (archivo && archivo.file) {
      if (typeof archivo.file === 'string') {
        const fileUrl = encodeURI(archivo.file);
        window.open(fileUrl, '_blank');
      } else if (archivo.file instanceof File) {
        const fileUrl = URL.createObjectURL(archivo.file);
        window.open(fileUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(fileUrl), 100);
      }
    } else {
      Swal.fire('Error', 'No se pudo encontrar el archivo para este campo', 'error');
    }
  }

  subirArchivo(event: any | Blob, campo: string, fileName?: string): void {
    let file: File | null = null;

    if (event instanceof Blob && !(event as any).target) {
      file = new File([event], fileName || 'archivo.pdf', { type: 'application/pdf' });
    } else if (event?.target?.files?.length) {
      file = event.target.files[0];
    }

    if (!file) return;

    if (file.name.length > 100) {
      Swal.fire('Error', 'El nombre del archivo no debe exceder los 100 caracteres', 'error');
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      Swal.fire('Error', 'Solo se permiten archivos PDF', 'error');
      return;
    }

    this.uploadedFiles[campo] = {
      file,
      fileName: file.name,
      changed: true,
      updatedAt: undefined,
      updatedAtLabel: undefined
    };
  }

  async urlToFile(url: string, fileName: string): Promise<File> {
    const busted = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();

    const res = await fetch(busted, {
      cache: 'no-store',
      mode: 'cors',
      referrerPolicy: 'strict-origin-when-cross-origin'
    });

    if (!res.ok) {
      throw new Error(`No se pudo descargar el archivo: ${res.status} ${res.statusText}`);
    }

    const blob = await res.blob();
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const fallback = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';
    const type = blob.type || fallback;

    return new File([blob], fileName, { type });
  }

  async imprimirVerificacionesAplicacion(): Promise<void> {
    Swal.fire({
      title: 'Cargando...',
      text: 'Estamos guardando los datos y subiendo los archivos.',
      icon: 'info',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const payload: any = { ...this.formGroup1.value, numerodeceduladepersona: this.cedula };

      const user = this.utilityService.getUser();
      const nombre = user.datos_basicos.nombres + ' ' + user.datos_basicos.apellidos;
      payload.nombre_evaluador = nombre;

      const resp: any = await firstValueFrom(
        this.seleccionService.crearSeleccionParteUnoCandidato(payload, this.cedula, this.idProcesoSeleccion)
      );

      const message = (resp?.message || '').toLowerCase();
      const ok = ['success', 'created', 'updated'].includes(message);
      if (!ok) throw new Error(resp?.message || 'Respuesta inesperada del servidor.');

      const hayArchivos = this.uploadedFiles && Object.keys(this.uploadedFiles).length > 0;
      if (!hayArchivos) {
        Swal.close();
        await Swal.fire({
          title: '¡Éxito!',
          text: message === 'updated' ? 'Datos actualizados exitosamente' : 'Datos guardados exitosamente',
          icon: 'success',
          confirmButtonText: 'Ok'
        });
        return;
      }

      const nombres = [
        'eps', 'afp', 'policivos', 'procuraduria', 'contraloria',
        'ramaJudicial', 'medidasCorrectivas', 'sisben', 'ofac', 'pensionSemanas'
      ];

      const docLabel: Record<string, string> = {
        eps: 'EPS',
        afp: 'AFP',
        policivos: 'Policivos',
        procuraduria: 'Procuraduría',
        contraloria: 'Contraloría',
        ramaJudicial: 'Rama Judicial',
        medidasCorrectivas: 'Medidas Correctivas',
        sisben: 'Sisbén',
        ofac: 'OFAC',
        pensionSemanas: 'Semanas cotizadas'
      };
      const label = (k: string) => (docLabel?.[k] ?? k);

      try {
        const { todosOk, exitosos, fallidos } = await this.subirTodosLosArchivos(nombres);

        Swal.close();

        if (todosOk) {
          await Swal.fire({
            title: '¡Éxito!',
            text: (message === 'updated' ? 'Datos actualizados' : 'Datos guardados') + ' y archivos subidos exitosamente.',
            icon: 'success',
            confirmButtonText: 'Ok'
          });
        } else {
          const htmlFallidos = fallidos.length
            ? `<ul>${fallidos.map(f => `<li>${label(f.key)}:</li>`).join('')}</ul>`
            : '<p>—</p>';

          const htmlExitosos = exitosos.length
            ? `<ul>${exitosos.map(k => `<li>${label(k)}</li>`).join('')}</ul>`
            : '<p>—</p>';

          await Swal.fire({
            icon: 'warning',
            title: 'Subida parcial',
            html: `
              <p>Los datos se guardaron, pero algunos archivos no se pudieron subir.</p>
              <p><b>Fallidos:</b></p>
              ${htmlFallidos}
              <p><b>Exitosos:</b></p>
              ${htmlExitosos}
            `,
            confirmButtonText: 'Ok'
          });
        }
      } catch (upErr: any) {
        Swal.close();
        await Swal.fire({
          title: 'Error',
          text: `Los datos se guardaron, pero hubo un error al subir los archivos: ${upErr?.message || upErr}`,
          icon: 'error',
          confirmButtonText: 'Ok'
        });
      }
    } catch (err: any) {
      Swal.close();
      await Swal.fire({
        title: 'Error',
        text: err?.error?.detail || err?.message || 'Hubo un error al guardar los datos del formulario.',
        icon: 'error',
        confirmButtonText: 'Ok'
      });
    }
  }

async subirTodosLosArchivos(
  keysEspecificos: string[]
): Promise<{ todosOk: boolean; exitosos: string[]; fallidos: { key: string; error: string }[] }> {
  // Prepara solo los que cambiaron y cuyo file es realmente File
  const archivosAEnviar = Object.keys(this.uploadedFiles)
    .filter(key => {
      const fd = this.uploadedFiles[key];
      return (
        keysEspecificos.includes(key) &&
        !!fd?.changed &&
        fd.file instanceof File
      );
    })
    .map(key => {
      const fd = this.uploadedFiles[key];
      const typeId = this.typeMap[key];
      return {
        key,
        file: fd.file as File,                                // ✅ ya es File
        fileName: fd.fileName ?? 'documento.pdf',
        typeId
      };
    })
    .filter(item => Number.isFinite(item.typeId));            // seguridad extra

  if (!archivosAEnviar.length) {
    return { todosOk: true, exitosos: [], fallidos: [] };
  }

  const promesas = archivosAEnviar.map(({ key, file, fileName, typeId }) => {
    return new Promise<void>((resolve, reject) => {
      this.gestionDocumentalService
        .guardarDocumento(fileName, this.cedula, typeId as number, file) // ✅ file: File
        .subscribe({
          next: () => {
            this.uploadedFiles[key].changed = false;
            this.uploadedFiles[key].updatedAt = new Date().toISOString();
            this.uploadedFiles[key].updatedAtLabel = this.formatFechaActualizacion(
              this.uploadedFiles[key].updatedAt as string
            );
            resolve();
          },
          error: (err) => reject(new Error(`Error al subir "${key}": ${err?.message || err}`))
        });
    });
  });

  const resultados = await Promise.allSettled(promesas);

  const exitosos: string[] = [];
  const fallidos: { key: string; error: string }[] = [];

  resultados.forEach((r, idx) => {
    const key = archivosAEnviar[idx].key;
    if (r.status === 'fulfilled') {
      exitosos.push(key);
    } else {
      fallidos.push({ key, error: r.reason?.message || String(r.reason) });
    }
  });

  return { todosOk: fallidos.length === 0, exitosos, fallidos };
}


  onFileSelected(event: any, index: number): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.examFiles[index] = file;
    } else {
      alert('Por favor, seleccione un archivo PDF válido.');
    }
  }
}
