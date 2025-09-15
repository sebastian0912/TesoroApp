import { SharedModule } from '@/app/shared/shared.module';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { HiringService } from '../../service/hiring.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { Observable, firstValueFrom, forkJoin, map, of, startWith } from 'rxjs';
import { arregloDeCentroDeCostos as CENTROS_COSTO } from '@/app/shared/model/models';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';


@Component({
  selector: 'app-hiring-questions',
  imports: [
    SharedModule,
    MatTabsModule
  ],
  templateUrl: './hiring-questions.component.html',
  styleUrl: './hiring-questions.component.css'
})

export class HiringQuestionsComponent implements OnInit, OnChanges  {
  @Input() cedula: string = '';
  @Input() codigoContrato: string = '';
  @Output() idVacante = new EventEmitter<number>();

  @Input() vacanteSeleccionadaId: any;   // id de vacante elegida desde fuera
  @Input() idInfoEntrevistaAndrea: any;  // id info entrevista
  @Input() idVacantes: any;              // id de la vacante (para actualizar estado)

  // Lista de centros de costo (tomada del modelo compartido)
  arregloDeCentroDeCostos: string[] = CENTROS_COSTO as unknown as string[];

  message: string = '';
  message2: string = '';
  fingerprintImagePD: string | null = null;
  fingerprintImageID: string | null = null;
  nombreEmpresa: string = '';
  descripcionVacante: string = '';

  pagoTransporteForm!: FormGroup;
  referenciasForm!: FormGroup;
  huellaForm!: FormGroup;
  trasladosForm!: FormGroup;

  filteredCentros$!: Observable<string[]>;

  // Permitimos File | string por si en el futuro guardas URLs
  uploadedFiles: { [key: string]: { file: File | string; fileName: string } } = {};

  // Mapeo de tipos documentales
  typeMap: { [key: string]: number } = {
    personal1: 16,
    personal2: 16,
    familiar1: 17,
    familiar2: 17,
    traslado: 18,
    laboral1: 2,
    laboral2: 2,
  };

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private contratacionService: HiringService,
    private gestionDocumentalService: GestionDocumentalService,
    private vacantesService: VacantesService,
    private infoVacantesService: InfoVacantesService
  ) {
    // ─── Form Pago/Transporte ────────────────────────────────────────────────
    this.pagoTransporteForm = this.fb.group(
      {
        semanasCotizadas: [''],
        formaPago: [''],
        otraFormaPago: [''],
        // Si realmente deben ser 10 dígitos, deja el pattern. Si no, ajusta aquí:
        numeroPagos: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
        validacionNumeroCuenta: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
        seguroFunerario: [''],
        Ccostos: [''],
        salario: [''],
        auxilioTransporte: [''],
        porcentajeARL: [''],
      },
      { validators: this.matchNumbersValidator } // validador a nivel form-group
    );

    // Revalidar cuando cambien los campos a comparar
    this.pagoTransporteForm.get('numeroPagos')?.valueChanges.subscribe(() => {
      this.pagoTransporteForm.updateValueAndValidity({ onlySelf: false, emitEvent: false });
    });
    this.pagoTransporteForm.get('validacionNumeroCuenta')?.valueChanges.subscribe(() => {
      this.pagoTransporteForm.updateValueAndValidity({ onlySelf: false, emitEvent: false });
    });

    // ─── Form Referencias ────────────────────────────────────────────────────
    this.referenciasForm = this.fb.group({
      familiar1: [''],
      familiar2: [''],
      personal1: [''],
      personal2: [''],
      laboral1: [''],
      laboral2: [''],
    });

    // ─── Form Traslados ─────────────────────────────────────────────────────
    this.trasladosForm = this.fb.group({
      opcion_traslado_eps: [''],
      eps_a_trasladar: [''],
      traslado: [''], // aquí se guarda el nombre del archivo
    });

    // ─── Form Huella ────────────────────────────────────────────────────────
    this.huellaForm = this.fb.group({
      cedula: [''],
      centroCosto: [''],
    });
  }

  ngOnInit(): void {
    // Autocomplete centros de costo
    this.filteredCentros$ = (this.pagoTransporteForm.get('Ccostos')!.valueChanges as Observable<string>)
      .pipe(
        startWith(''),
        map(value => this.filtrarCentros(value || ''))
      );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cedula'] || changes['codigoContrato']) {
      const nuevaCedula = (this.cedula || '').trim();
      const nuevoCodigo = (this.codigoContrato || '').trim();
      if (nuevaCedula && nuevoCodigo) this.loadData();
    }
  }

  // ─────────────────────────── Helpers ───────────────────────────

  filtrarCentros(valor: string): string[] {
    const filtro = (valor || '').toLowerCase();
    return (this.arregloDeCentroDeCostos || []).filter((centro: string) =>
      String(centro || '').toLowerCase().includes(filtro)
    );
  }

  // Validador a nivel grupo: compara número de cuenta vs validación
  matchNumbersValidator(group: AbstractControl) {
    const numeroPagos = group.get('numeroPagos')?.value;
    const validacionNumeroCuenta = group.get('validacionNumeroCuenta')?.value;
    if (numeroPagos && validacionNumeroCuenta && numeroPagos !== validacionNumeroCuenta) {
      return { numbersNotMatch: true };
    }
    return null;
  }

  // ─────────────────────────── Acciones principales ───────────────────────────

  async cargarPagoTransporte() {
    if (this.pagoTransporteForm.invalid) {
      this.pagoTransporteForm.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Revisa los campos obligatorios antes de continuar.',
      });
      return;
    }

    const data = {
      numero_de_cedula: this.cedula,
      codigo_contrato: this.codigoContrato,
      semanas_cotizadas: this.pagoTransporteForm.get('semanasCotizadas')?.value,
      forma_pago: this.pagoTransporteForm.get('formaPago')?.value,
      numero_pagos: this.pagoTransporteForm.get('numeroPagos')?.value,
      validacion_numero_cuenta: this.pagoTransporteForm.get('validacionNumeroCuenta')?.value,
      seguro_funerario: this.pagoTransporteForm.get('seguroFunerario')?.value,
      centro_de_costos: this.pagoTransporteForm.get('Ccostos')?.value,
      salario_contratacion: this.pagoTransporteForm.get('salario')?.value,
      valor_transporte: this.pagoTransporteForm.get('auxilioTransporte')?.value,
      porcentaje_arl: this.pagoTransporteForm.get('porcentajeARL')?.value
    };

    try {
      await this.contratacionService.guardarOActualizarContratacion(data);

      const results = await Promise.allSettled([
        firstValueFrom(
          this.infoVacantesService.setEstadoVacanteAplicante(this.idInfoEntrevistaAndrea, 'contratado', true)
        ),
        firstValueFrom(
          this.vacantesService.setEstadoVacanteAplicante(this.idVacantes, 'contratado', this.cedula)
        )
      ]);

      const fallas = results.filter(r => r.status === 'rejected');
      if (fallas.length) {
        console.error('Fallas al actualizar estados:', fallas);
        Swal.fire({
          icon: 'warning',
          title: 'Guardado con advertencias',
          text: 'Se guardó, pero algunos estados no se actualizaron. Intenta nuevamente desde Vacantes.',
          confirmButtonText: 'Entendido'
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Datos guardados y estados actualizados correctamente.',
          confirmButtonText: 'Ok'
        });
      }
    } catch (error) {
      console.error('Error al guardar o actualizar:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un error al guardar o actualizar los datos. Intenta nuevamente.',
      });
    }
  }

  cargarReferencias() {
    Swal.fire({
      title: 'Cargando...',
      text: 'Procesando referencias y subiendo archivos.',
      icon: 'info',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.subirReferenciasArchivos()
      .then(() => {
        Swal.close();
        Swal.fire({ title: '¡Éxito!', text: 'Referencias y archivos guardados.', icon: 'success' });
      })
      .catch((error) => {
        Swal.close();
        Swal.fire({ title: 'Error', text: `Error al subir archivos: ${error}`, icon: 'error' });
      });
  }

  onTrasladoChange(event: any) {
    const trasladoSeleccionado = event?.value;
    if (trasladoSeleccionado === 'no') {
      this.trasladosForm.get('eps_a_trasladar')?.reset();
    }
  }

  cargarTraslados() {
    // Añadimos cedula y contrato al payload
    const payload = {
      ...this.trasladosForm.value,
      numerodeceduladepersona: this.cedula,
      codigo_contrato: this.codigoContrato
    };

    Swal.fire({
      title: 'Cargando...',
      icon: 'info',
      text: 'Procesando la solicitud.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const archivoTraslado = this.uploadedFiles['traslado'];

    const continuar = () => this.procesarSolicitudTraslado(payload);

    if (archivoTraslado) {
      this.subirArchivoTraslados()
        .then(() => continuar())
        .catch((error) => {
          Swal.close();
          Swal.fire({ title: 'Error', text: `Error al subir archivos: ${error}`, icon: 'error' });
        });
    } else {
      continuar();
    }
  }

  private procesarSolicitudTraslado(payload: any) {
    (async () => {
      try {
        await this.contratacionService.actualizarProcesoContratacion(payload);
        Swal.close();
        Swal.fire({ title: '¡Éxito!', text: 'Solicitud de traslado guardada.', icon: 'success' });
      } catch (error) {
        Swal.close();
        Swal.fire({ title: 'Error', text: 'No se pudo guardar la solicitud.', icon: 'error' });
      }
    })();
  }

  // ─────────────────────────── Archivos / Descargas ───────────────────────────

  urlToFile(url: string, fileName: string): Promise<File> {
    return fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`No se pudo descargar: ${response.statusText}`);
        return response.blob();
      })
      .then(blob => new File([blob], fileName, { type: blob.type || 'application/octet-stream' }))
      .catch(error => {
        Swal.fire('Error', 'No se pudo descargar el archivo', 'error');
        throw error;
      });
  }

  verArchivo(campo: string) {
    const registro = this.uploadedFiles[campo];
    if (!registro) {
      Swal.fire('Error', 'No se encontró el archivo', 'error');
      return;
    }

    const f = registro.file;
    if (typeof f === 'string') {
      window.open(encodeURI(f), '_blank');
      return;
    }
    const url = URL.createObjectURL(f);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  subirArchivo(event: any, campo: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.name.length > 100) {
      Swal.fire('Error', 'El nombre del archivo no debe exceder los 100 caracteres', 'error');
      this.resetInput(input);
      return;
    }

    this.uploadedFiles[campo] = { file, fileName: file.name };

    // si el control existe en el form de traslados, guarda el nombre para que el campo quede “llenado”
    this.trasladosForm.get(campo)?.setValue(file.name);
    this.trasladosForm.get(campo)?.markAsTouched();
    this.trasladosForm.get(campo)?.markAsDirty();

    this.resetInput(input);
  }

  private resetInput(input: HTMLInputElement): void {
    const nuevo = input.cloneNode(true) as HTMLInputElement;
    input.parentNode?.replaceChild(nuevo, input);
  }

  descargarArchivo() {
    let archivo = '';
    if (this.nombreEmpresa === 'APOYO LABORAL TS SAS') {
      archivo = 'APOYOLABORALCARTAAUTORIZACIONTRASLADO2024.pdf';
    } else if (this.nombreEmpresa === 'TU ALIANZA SAS') {
      // quitamos espacio sobrante antes de ".pdf"
      archivo = 'TUALIANZACARTAAUTORIZACIONTRASLADO_2024.pdf';
    } else {
      Swal.fire({ title: '¡Error!', text: 'Sucedió un problema.', icon: 'error' });
      return;
    }
    const url = `Docs/${archivo}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = archivo;
    link.click();
  }

  // Sube solo archivos de referencias (personales y familiares)
  subirReferenciasArchivos(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const refs = ['personal1', 'personal2', 'familiar1', 'familiar2'];
      const keys = Object.keys(this.uploadedFiles).filter(k => refs.includes(k));
      const total = keys.length;
      if (total === 0) return resolve(true);

      let ok = 0;
      keys.forEach((campo) => {
        const { file, fileName } = this.uploadedFiles[campo];
        const type = this.typeMap[campo] || 3;

        if (typeof file === 'string') {
          // si algún día guardas una URL, descárgala a File antes
          reject(`El archivo de ${campo} es una URL, no un File.`);
          return;
        }

        this.gestionDocumentalService.guardarDocumento(fileName, this.cedula, type, file)
          .subscribe({
            next: () => {
              ok++;
              if (ok === total) resolve(true);
            },
            error: () => {
              Swal.fire('Error', `Error al subir el archivo para ${campo}`, 'error');
              reject(`Error al subir archivo ${campo}`);
            }
          });
      });
    });
  }

  subirArchivoTraslados(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const keys = Object.keys(this.uploadedFiles).filter(k => k === 'traslado');
      const total = keys.length;
      if (total === 0) return resolve(true);

      let ok = 0;
      keys.forEach((campo) => {
        const { file, fileName } = this.uploadedFiles[campo];
        const type = this.typeMap[campo] || 3;

        if (typeof file === 'string') {
          reject('Traslado es URL, no File.');
          return;
        }

        this.gestionDocumentalService
          .guardarDocumento(fileName, this.cedula, type, file, this.codigoContrato)
          .subscribe({
            next: () => {
              ok++;
              if (ok === total) resolve(true);
            },
            error: () => {
              Swal.fire('Error', `Error al subir el archivo de traslado`, 'error');
              reject('Error al subir traslado');
            }
          });
      });
    });
  }

  // ─────────────────────────── Estado / Datos backend ───────────────────────────

  actualizarEmpresaYDescripcionEnLocalStorage() {
    const stored = localStorage.getItem('formularios');
    const base = stored ? JSON.parse(stored) : {};

    const merged = {
      ...base,
      empresa: this.nombreEmpresa,
      descripcionVacante: this.descripcionVacante,
      cedulaPersonalAdministrativo: this.huellaForm.value,
      huellaIndice: this.fingerprintImageID,
      huellaPulgarDerecho: this.fingerprintImagePD,
      pagoTransporte: this.pagoTransporteForm.value,
    };

    localStorage.setItem('formularios', JSON.stringify(merged));
  }

  loadData() {
    if (!this.cedula || !this.codigoContrato) return;

    this.contratacionService.traerDatosSeleccion(this.cedula).subscribe((response: any) => {
      const lista = Array.isArray(response?.procesoSeleccion) ? response.procesoSeleccion : [];
      if (!lista.length) return;

      // proceso con mayor id
      const seleccion = lista.reduce((acc: any, cur: any) => (cur?.id ?? 0) > (acc?.id ?? 0) ? cur : acc, null);

      const idVacante = seleccion?.vacante;
      if (typeof idVacante === 'number') this.idVacante.emit(idVacante);

      this.vacantesService.obtenerVacante(idVacante).subscribe((vacanteResponse: any) => {
        this.nombreEmpresa = vacanteResponse?.temporal || '';
        this.descripcionVacante = vacanteResponse?.descripcion || '';
        this.actualizarEmpresaYDescripcionEnLocalStorage();
        this.llenarDocumentos();

        this.contratacionService.traerDatosContratacion(this.cedula, this.codigoContrato).subscribe((datos: any) => {
          if (datos) {
            this.pagoTransporteForm.patchValue({
              semanasCotizadas: datos.semanas_cotizadas,
              formaPago: datos.forma_pago,
              numeroPagos: datos.numero_pagos,
              validacionNumeroCuenta: datos.validacion_numero_cuenta,
              seguroFunerario: datos.seguro_funerario,
              porcentajeARL: datos.porcentaje_arl,
              auxilioTransporte: datos.auxilio_transporte,
              salario: '1423500',
              Ccostos: datos.centro_de_costos || '',
            });

            this.trasladosForm.patchValue({
              opcion_traslado_eps: datos.opcion_traslado_eps,
              eps_a_trasladar: datos.eps_a_trasladar,
              traslado: datos.traslado,
            });

            this.contratacionService
              .detalleLaboralContratacion(seleccion.centro_costo_entrevista, seleccion.cargo)
              .subscribe((detalle: any) => {
                if (Array.isArray(detalle) && detalle.length) {
                  this.pagoTransporteForm.patchValue({
                    porcentajeARL: detalle[0].porcentaje_arl,
                    auxilioTransporte: detalle[0].valor_transporte,
                    salario: detalle[0].salario,
                    Ccostos: seleccion.centro_costo_entrevista || '',
                  });
                } else {
                  Swal.fire('Error', 'No se encontraron datos de detalle laboral', 'error');
                }
              });
          }
        });
      });
    });
  }

  llenarDocumentos() {
    forkJoin({
      tipo2: this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, 2, this.codigoContrato),
      tipo16: this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, 16, this.codigoContrato),
      tipo17: this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, 17, this.codigoContrato),
      tipo18: this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, 18, this.codigoContrato),
    }).subscribe({
      next: async (res) => {
        // tipo 2
        if (res.tipo2) {
          for (const doc of res.tipo2) {
            const typeKey = Object.keys(this.typeMap).find(k => this.typeMap[k] === doc.type);
            if (typeKey) {
              const file = await this.urlToFile(doc.file_url, doc.title || 'Documento');
              this.uploadedFiles[typeKey] = { fileName: doc.title || 'Documento', file };
            }
          }
        }

        // tipo 16 (personales)
        if (res.tipo16) {
          let idx = 1;
          for (const doc of res.tipo16) {
            if (idx > 2) break;
            const key = `personal${idx}`;
            const file = await this.urlToFile(doc.file_url, doc.title || 'Documento');
            this.uploadedFiles[key] = { fileName: doc.title || 'Documento', file };
            this.referenciasForm.patchValue({ [key]: doc.title || 'Documento' });
            idx++;
          }
        }

        // tipo 17 (familiares)
        if (res.tipo17) {
          let idx = 1;
          for (const doc of res.tipo17) {
            if (idx > 2) break;
            const key = `familiar${idx}`;
            const file = await this.urlToFile(doc.file_url, doc.title || 'Documento');
            this.uploadedFiles[key] = { fileName: doc.title || 'Documento', file };
            this.referenciasForm.patchValue({ [key]: doc.title || 'Documento' });
            idx++;
          }
        }

        // tipo 18 (traslados)
        if (res.tipo18 && res.tipo18.length) {
          for (const doc of res.tipo18) {
            const file = await this.urlToFile(doc.file_url, doc.title || 'Documento');
            this.uploadedFiles['traslado'] = { fileName: doc.title || 'Documento', file };
            this.trasladosForm.patchValue({ traslado: doc.title || 'Documento' });
          }
        }
      },
      error: () => {
        // silencioso; si quieres, muestra un toast
      }
    });
  }

  // ─────────────────────────── Huellas ───────────────────────────

  captureFingerprintID() {
    if (window.electron?.fingerprint?.get) {
      window.electron.fingerprint.get()
        .then((result: { success: boolean; data?: string; error?: string }) => {
          if (result.success) {
            this.message = 'Huella capturada exitosamente.';
            this.fingerprintImageID = `data:image/png;base64,${result.data}`;
          } else {
            this.message = `Error al capturar huella: ${result.error || 'Error desconocido.'}`;
          }
        })
        .catch((error: any) => {
          this.message = `Error al capturar huella: ${error?.error || 'Error de comunicación con Electron.'}`;
        });
    } else {
      this.message = 'Electron o fingerprint no están disponibles en window.';
    }
  }

  captureFingerprintPD() {
    if (window.electron?.fingerprint?.get) {
      window.electron.fingerprint.get()
        .then((result: { success: boolean; data?: string; error?: string }) => {
          if (result.success) {
            this.message2 = 'Huella capturada exitosamente.';
            this.fingerprintImagePD = `data:image/png;base64,${result.data}`;
          } else {
            this.message2 = `Error al capturar huella: ${result.error || 'Error desconocido.'}`;
          }
        })
        .catch((error: any) => {
          this.message2 = `Error al capturar huella: ${error?.error || 'Error de comunicación con Electron.'}`;
        });
    } else {
      this.message2 = 'Electron o fingerprint no están disponibles en window.';
    }
  }

}
