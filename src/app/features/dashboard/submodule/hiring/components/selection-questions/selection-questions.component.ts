import { Component, effect, input, OnInit } from '@angular/core';
import { SharedModule } from '@/app/shared/shared.module';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import Swal from 'sweetalert2';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { PDFDocument } from 'pdf-lib';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { HiringService } from '../../service/hiring.service';
import { catchError, debounceTime, firstValueFrom, merge, of, Subscription, take, throwError } from 'rxjs';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

type UploadedFileInfo = {
  file?: File | string;
  fileName?: string;
  updatedAt?: number | string;
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
  // Inputs como signals
  cedula = input<string>('');
  vacanteSeleccionada = input<any>(null);
  idProcesoSeleccion = input<number | null>(null);
  idInfoEntrevistaAndrea = input<number | null>(null);

  private _ready = false;
  private _prev = {
    cedula: undefined as string | undefined,
    vacante: undefined as any,
    idProceso: undefined as number | null | undefined,
    idInfoEntrevistaAndrea: undefined as number | null | undefined
  };

  // Arreglos
  antecedentesEstados: string[] = ['Cumple', 'No Cumple', 'Sin Buscar'];
  epsList: string[] = [
    'ALIANSALUD', 'ASMET SALUD', 'CAJACOPI', 'CAPITAL SALUD', 'CAPRESOCA', 'COMFAMILIARHUILA',
    'COMFAORIENTE', 'COMPENSAR', 'COOSALUD', 'DUSAKAWI', 'ECOOPSOS', 'FAMISANAR',
    'FAMILIAR DE COLOMBIA', 'MUTUAL SER', 'NUEVA EPS', 'PIJAOS SALUD', 'SALUD TOTAL',
    'SANITAS', 'SAVIA SALUD', 'SOS', 'SURA', 'No Tiene', 'Sin Buscar',
  ];
  afpList: string[] = ['PORVENIR', 'COLFONDOS', 'PROTECCION', 'COLPENSIONES'];
  medidasCorrectivas = [
    ...Array.from({ length: 11 }, (_, i) => i),
    'CUMPLE'
  ];
  categoriasSisben: string[] = [
    'A1', 'A2', 'A3', 'A4', 'A5',
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7',
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18',
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21',
    'No Aplica', 'Sin Buscar'
  ];


  // formulario
  antecedentes: FormGroup;

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

  constructor(
    private fb: FormBuilder,
    private gestionDocumentalService: GestionDocumentalService,
    private seleccionService: SeleccionService,
    private utilityService: UtilityServiceService
  ) {

    this.antecedentes = this.fb.group({
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

    // Un solo efecto que reacciona a los 3 inputs y loguea cambios individuales
    effect(() => {
      const c = this.cedula();
      const v = this.vacanteSeleccionada();
      const id = this.idProcesoSeleccion();
      const idInfo = this.idInfoEntrevistaAndrea();

      if (this._ready) {
        if (c !== this._prev.cedula) {
          console.log('[SelectionQuestions] cedula cambió:', this._prev.cedula, '→', c);
        }
        if (v !== this._prev.vacante) {
          console.log('[SelectionQuestions] vacanteSeleccionada cambió:', this._prev.vacante, '→', v);
        }
        if (id !== this._prev.idProceso) {
          console.log('[SelectionQuestions] idProcesoSeleccion cambió:', this._prev.idProceso, '→', id);
        }
        if (idInfo !== this._prev.idInfoEntrevistaAndrea) {
          console.log('[SelectionQuestions] idInfoEntrevistaAndrea cambió:', this._prev.idInfoEntrevistaAndrea, '→', idInfo);
        }
      }

      // Actualiza prev y ejecuta tu handler
      this._prev = { cedula: c, vacante: v, idProceso: id, idInfoEntrevistaAndrea: idInfo };
      this.onInputsChanged(c, v, id, idInfo);
    });
  }

  ngOnInit(): void {
    // A partir de aquí, cualquier cambio va a loguear
    this._ready = true;
  }

  private onInputsChanged(cedula: string, vacante: any, idProceso: number | null, idInfoEntrevistaAndrea: number | null) {
    // Aquí puedes hacer tus acciones según el cambio
    // console.log('onInputsChanged →', { cedula, vacante, idProceso });
  }

  private toTimestampMs(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const p = Date.parse(v);
      return isNaN(p) ? undefined : p;
    }
    return undefined;
  }

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

  onlyInteger(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
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
      const payload: any = { ...this.antecedentes.value, numerodeceduladepersona: this.cedula };

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

}
