import { SharedModule } from '@/app/shared/shared.module';
import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { HiringService } from '../../service/hiring.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { Observable } from 'rxjs/internal/Observable';
import { forkJoin, map, startWith } from 'rxjs';
import { arregloDeCentroDeCostos } from '@/app/shared/model/models';
import { VacantesService } from '../../service/vacantes/vacantes.service';

@Component({
  selector: 'app-hiring-questions',
  imports: [
    SharedModule,
    MatTabsModule
  ],
  templateUrl: './hiring-questions.component.html',
  styleUrl: './hiring-questions.component.css'
})

export class HiringQuestionsComponent implements OnInit {
  @Input() cedula: string = '';
  @Input() codigoContrato: string = '';
  @Output() idVacante = new EventEmitter<number>();
  //vacanteSeleccionadaId
  @Input() vacanteSeleccionadaId: any;


  arregloDeCentroDeCostos: any[] = arregloDeCentroDeCostos;
  message: string = '';
  message2: string = '';
  fingerprintImagePD: string | null = null;
  fingerprintImageID: string | null = null;
  nombreEmpresa: string = '';
  descripcionVacante: string = ''; // Variable to store the vacancy description


  pagoTransporteForm!: FormGroup;
  referenciasForm!: FormGroup;
  huellaForm!: FormGroup;
  trasladosForm: FormGroup;

  filteredCentros$: Observable<string[]> | undefined;

  uploadedFiles: { [key: string]: { file: File, fileName: string } } = {}; // Almacenar tanto el archivo como el nombre

  typeMap: { [key: string]: number } = {
    personal1: 16,
    personal2: 16,
    familiar1: 17,
    familiar2: 17,
    traslado: 18,
    laboral1: 2,
    laboral2: 2,
  };

  ngOnInit() {
    console.log(this.vacanteSeleccionadaId);
    // Inicializar el filtro de centros de costos
    this.filteredCentros$ = this.pagoTransporteForm.get('Ccostos')?.valueChanges.pipe(
      startWith(''),
      map(value => this.filtrarCentros(value))
    );

  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private contratacionService: HiringService,
    private gestionDocumentalService: GestionDocumentalService,
    private vacantesService: VacantesService

  ) {
    this.pagoTransporteForm = this.fb.group(
      {
        semanasCotizadas: [''],
        formaPago: [''],
        otraFormaPago: [''],
        numeroPagos: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
        validacionNumeroCuenta: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
        seguroFunerario: [''],
        Ccostos: [''],
        salario: [''],
        auxilioTransporte: [''],
        porcentajeARL: [''],
      },
      { validators: this.matchNumbersValidator } // Aquí se aplica el validador al grupo
    );

    // Escuchar cambios en ambos campos y revalidar
    this.pagoTransporteForm.get('numeroPagos')?.valueChanges.subscribe(() => {
      this.pagoTransporteForm.updateValueAndValidity(); // Actualiza el estado del grupo
    });
    this.pagoTransporteForm.get('validacionNumeroCuenta')?.valueChanges.subscribe(() => {
      this.pagoTransporteForm.updateValueAndValidity(); // Actualiza el estado del grupo
    });

    this.referenciasForm = this.fb.group({
      familiar1: [''],
      familiar2: [''],
      personal1: [''],
      personal2: [''],
      laboral1: [''],
      laboral2: [''],
    });

    // Inicializar el FormGroup de traslados
    this.trasladosForm = this.fb.group({
      opcion_traslado_eps: [''],
      eps_a_trasladar: [''],
      traslado: [''],
    });

    // Personal administrativo
    this.huellaForm = this.fb.group({
      cedula: [''],
      centroCosto: [''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cedula'] || changes['codigoContrato']) {
      const nuevaCedula = this.cedula?.trim();
      const nuevoCodigo = this.codigoContrato?.trim();

      if (nuevaCedula && nuevoCodigo) {
        this.loadData();
      }
    }
  }


  // Lógica de filtro
  filtrarCentros(valor: string): string[] {
    const filtro = valor.toLowerCase();
    return this.arregloDeCentroDeCostos.filter((centro) =>
      centro.toLowerCase().includes(filtro)
    );
  }



  cargarPagoTransporte() {
    // Verificar si el formulario es válido antes de enviar
    if (this.pagoTransporteForm.invalid) {
      return;
    }

    // Construir los datos que se enviarán al servicio
    const data = {
      numero_de_cedula: this.cedula, // Cédula del candidato
      codigo_contrato: this.codigoContrato, // Código de contrato
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

    // Llamar al servicio para guardar o actualizar los datos
    this.contratacionService.guardarOActualizarContratacion(data).then((response: any) => {
      // Aquí puedes manejar la respuesta si es necesario
      if (response) {
        // Mostrar mensaje de éxito
        Swal.fire({
          title: '¡Éxito!',
          text: 'Datos guardados exitosamente.',
          icon: 'success',
          confirmButtonText: 'Ok'
        });
      }
    }).catch((error: any) => {
      Swal.fire('Error', 'Hubo un error al guardar o actualizar los datos', 'error');
      // Aquí puedes manejar el error si es necesario
    });
  }


  cargarReferencias() {
    // Mostrar Swal de carga
    Swal.fire({
      title: 'Cargando...',
      text: 'Estamos procesando las referencias y subiendo los archivos. Por favor, espera.',
      icon: 'info',
      allowOutsideClick: false, // Evitar que el usuario cierre el Swal
      didOpen: () => {
        Swal.showLoading(); // Mostrar el indicador de carga
      }
    });

    // Llamar al método para subir solo los archivos relevantes
    this.subirReferenciasArchivos()
      .then((allFilesUploaded) => {
        if (allFilesUploaded) {
          Swal.close(); // Cerrar el Swal de carga
          // Mostrar mensaje de éxito
          Swal.fire({
            title: '¡Éxito!',
            text: 'Referencias y archivos guardados exitosamente.',
            icon: 'success',
            confirmButtonText: 'Ok'
          });
        }
      })
      .catch((error) => {
        Swal.close(); // Cerrar el Swal de carga
        // Mostrar mensaje de error si algo falla
        Swal.fire({
          title: 'Error',
          text: `Hubo un error al subir los archivos: ${error}`,
          icon: 'error',
          confirmButtonText: 'Ok'
        });
      });
  }



  onTrasladoChange(event: any) {
    const trasladoSeleccionado = event.value;
    if (trasladoSeleccionado === 'no') {
      // Si el usuario selecciona "No", reseteamos el campo de EPS
      this.trasladosForm.get('epsDestino')?.reset();
    }
  }

  cargarTraslados() {
    // Agregar información adicional al formulario
    const cedula = this.cedula;
    const codigoContrato = this.codigoContrato;
    this.trasladosForm.value.numerodeceduladepersona = cedula;
    this.trasladosForm.value.codigo_contrato = codigoContrato;

    // Mostrar Swal de carga
    Swal.fire({
      title: 'Cargando...',
      icon: 'info',
      text: 'Estamos procesando la solicitud. Por favor, espera.',
      allowOutsideClick: false, // Evitar que el usuario cierre el Swal
      didOpen: () => {
        Swal.showLoading(); // Mostrar el indicador de carga
      }
    });

    // Verificar si hay archivo para subir
    const archivoTraslado = this.uploadedFiles['traslado'];
    if (archivoTraslado) {
      // Subir archivo solo si existe
      this.subirArchivoTraslados()
        .then((allFilesUploaded) => {
          if (allFilesUploaded) {
            // Si el archivo se sube exitosamente, proceder con la solicitud
            this.procesarSolicitudTraslado();
          }
        })
        .catch((error) => {
          // Mostrar mensaje de error si algo falla al subir el archivo
          Swal.close(); // Cerrar el Swal de carga
          Swal.fire({
            title: 'Error',
            text: `Hubo un error al subir los archivos: ${error}`,
            icon: 'error',
            confirmButtonText: 'Ok',
          });
        });
    } else {
      // Si no hay archivo, procesar directamente la solicitud
      this.procesarSolicitudTraslado();
    }
  }


  urlToFile(url: string, fileName: string): Promise<File> {
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`No se pudo descargar el archivo: ${response.statusText}`);
        }
        return response.blob();
      })
      .then(blob => {
        const extension = fileName.split('.').pop() || 'txt';
        const mimeType = blob.type || `application/${extension}`;
        return new File([blob], fileName, { type: mimeType });
      })
      .catch(error => {
        Swal.fire('Error', 'No se pudo descargar el archivo', 'error');
        throw error;
      });
  }

  // Método para abrir un archivo en una nueva pestaña
  verArchivo(campo: string) {
    const archivo = this.uploadedFiles[campo];

    if (archivo && archivo.file) {
      if (typeof archivo.file === 'string') {
        // Asegurarse de que la URL esté correctamente codificada para evitar problemas
        const fileUrl = encodeURI(archivo.file);
        // Abrir el archivo en una nueva pestaña
        window.open(fileUrl, '_blank');
      } else if (archivo.file instanceof File) {
        // Crear una URL temporal para el archivo si es un objeto File
        const fileUrl = URL.createObjectURL(archivo.file);
        window.open(fileUrl, '_blank');

        // Revocar la URL después de que el archivo ha sido abierto para liberar memoria
        setTimeout(() => {
          URL.revokeObjectURL(fileUrl);
        }, 100);
      }
    } else {
      Swal.fire('Error', 'No se pudo encontrar el archivo para este campo', 'error');
    }
  }

  subirArchivo(event: any, campo: string) {
    const input = event.target as HTMLInputElement; // Referencia al input
    const file = input.files?.[0]; // Obtén el archivo seleccionado

    if (file) {
      // Verificar si el nombre del archivo tiene más de 100 caracteres
      if (file.name.length > 100) {
        Swal.fire('Error', 'El nombre del archivo no debe exceder los 100 caracteres', 'error');

        // Limpiar el input
        this.resetInput(input);
        return; // Salir de la función si la validación falla
      }

      // Si la validación es exitosa, almacenar el archivo
      this.uploadedFiles[campo] = { file: file, fileName: file.name }; // Guarda el archivo y el nombre
      // Actualizar el valor del FormControl en el FormGroup
      this.trasladosForm.get(campo)?.setValue(file.name); // Actualiza el control traslado con el nombre del archivo
      this.trasladosForm.get(campo)?.markAsTouched(); // Asegura que Angular lo considere como interactuado
      this.trasladosForm.get(campo)?.markAsDirty(); // Marca el control como modificado
    }

    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    this.resetInput(input);
  }

  // Método para reiniciar el input en el DOM
  private resetInput(input: HTMLInputElement): void {
    const newInput = input.cloneNode(true) as HTMLInputElement;
    input.parentNode?.replaceChild(newInput, input);
  }


  descargarArchivo() {
    let archivo: string;
    if (this.nombreEmpresa === 'APOYO LABORAL TS SAS') {
      archivo = 'APOYOLABORALCARTAAUTORIZACIONTRASLADO2024.pdf';
    } else if (this.nombreEmpresa === 'TU ALIANZA SAS') {
      archivo = 'TUALIANZACARTAAUTORIZACIONTRASLADO_2024 .pdf';
    } else {
      Swal.fire({
        title: '¡Error!',
        text: 'Sucedio un problema.',
        icon: 'error',
        confirmButtonText: 'Ok',
      });
      return;
    }
    const url = `Docs/${archivo}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = archivo;
    link.click();
  }


  // Método para subir solo los archivos de referencias personales y familiares
  subirReferenciasArchivos(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Filtrar los campos relevantes: personal1, personal2, familiar1, familiar2
      const referenciasKeys = ['personal1', 'personal2', 'familiar1', 'familiar2'];
      const archivosFiltrados = Object.keys(this.uploadedFiles).filter(key => referenciasKeys.includes(key));

      const totalFiles = archivosFiltrados.length; // Total de archivos relevantes a subir
      let filesUploaded = 0; // Contador de archivos subidos

      if (totalFiles === 0) {
        resolve(true); // No hay archivos relevantes que subir, resolver inmediatamente
        return;
      }

      archivosFiltrados.forEach((campo) => {
        const { file, fileName } = this.uploadedFiles[campo]; // Obtén el archivo y su nombre
        const title = fileName; // El título será el nombre del archivo PDF

        // Obtener el tipo correspondiente del mapa
        const type = this.typeMap[campo] || 3; // Si no hay tipo definido para el campo, se usa 3 como valor predeterminado

        // Llamar al servicio para subir cada archivo
        this.gestionDocumentalService
          .guardarDocumento(title, this.cedula, type, file)
          .subscribe(
            (response) => {
              filesUploaded += 1;

              // Si todos los archivos se han subido, resolvemos la promesa
              if (filesUploaded === totalFiles) {
                resolve(true); // Todos los archivos se subieron correctamente
              }
            },
            (error) => {
              Swal.fire('Error', `Error al subir el archivo para ${campo}`, 'error');
              reject(`Error al subir el archivo para ${campo}`);
            }
          );
      });
    });
  }

  subirArchivoTraslados(): Promise<boolean> {
    return new Promise((resolve, reject) => {

      // Filtrar los campos relevantes: personal1, personal2, familiar1, familiar2
      const referenciasKeys = ['traslado'];
      const archivosFiltrados = Object.keys(this.uploadedFiles).filter(key => referenciasKeys.includes(key));

      const totalFiles = archivosFiltrados.length; // Total de archivos relevantes a subir
      let filesUploaded = 0; // Contador de archivos subidos

      if (totalFiles === 0) {
        resolve(true); // No hay archivos relevantes que subir, resolver inmediatamente
        return;
      }

      archivosFiltrados.forEach((campo) => {
        const { file, fileName } = this.uploadedFiles[campo]; // Obtén el archivo y su nombre
        const title = fileName; // El título será el nombre del archivo PDF

        // Obtener el tipo correspondiente del mapa
        const type = this.typeMap[campo] || 3; // Si no hay tipo definido para el campo, se usa 3 como valor predeterminado

        // Llamar al servicio para subir cada archivo
        this.gestionDocumentalService
          .guardarDocumento(title, this.cedula, type, file, this.codigoContrato)
          .subscribe(
            (response) => {
              filesUploaded += 1;

              // Si todos los archivos se han subido, resolvemos la promesa
              if (filesUploaded === totalFiles) {
                resolve(true); // Todos los archivos se subieron correctamente
              }
            },
            (error) => {
              Swal.fire('Error', `Error al subir el archivo para ${campo}`, 'error');
              reject(`Error al subir el archivo para ${campo}`);
            }
          );
      });
    });
  }

  // Validador personalizado para verificar que los campos sean iguales
  matchNumbersValidator(group: AbstractControl): { [key: string]: boolean } | null {
    const numeroPagos = group.get('numeroPagos')?.value;
    const validacionNumeroCuenta = group.get('validacionNumeroCuenta')?.value;

    // Si ambos campos tienen valores y no coinciden, retorna un error
    if (numeroPagos && validacionNumeroCuenta && numeroPagos !== validacionNumeroCuenta) {
      return { numbersNotMatch: true };
    }

    return null; // Sin errores
  }

  //  Captura de huella
  captureFingerprintID() {
    // Verifica si window.myElectron y window.myElectron.fingerprint están disponibles
    if (window.electron.fingerprint) {
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
          this.message = `Error al capturar huella: ${error.error || 'Error de comunicación con el módulo Electron.'}`;
        });
    } else {
      const errorMessage = 'Electron o fingerprint no están disponibles en window.';
      this.message = errorMessage;
    }
  }

  captureFingerprintPD() {
    // Verifica si window.myElectron y window.myElectron.fingerprint están disponibles
    if (window.electron.fingerprint) {
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
          this.message2 = `Error al capturar huella: ${error.error || 'Error de comunicación con el módulo Electron.'}`;
        });
    } else {
      const errorMessage = 'Electron o fingerprint no están disponibles en window.';
      this.message2 = errorMessage;
    }
  }


  private procesarSolicitudTraslado() {
    // Realizar la solicitud para guardar la información del traslado
    (async () => {
      try {
        const response = await this.contratacionService.actualizarProcesoContratacion(this.trasladosForm.value);

        // Mostrar mensaje de éxito
        Swal.close(); // Cerrar el Swal de carga
        Swal.fire({
          title: '¡Éxito!',
          text: 'Solicitud de traslado guardada exitosamente.',
          icon: 'success',
          confirmButtonText: 'Ok',
        });
      } catch (error) {
        // Mostrar mensaje de error si algo falla en la solicitud
        Swal.close(); // Cerrar el Swal de carga
        Swal.fire({
          title: 'Error',
          text: 'Hubo un error al guardar la solicitud. Por favor, intenta de nuevo.',
          icon: 'error',
          confirmButtonText: 'Ok',
        });
      }
    })();
  }

  actualizarEmpresaYDescripcionEnLocalStorage() {
    const stored = localStorage.getItem('formularios');

    if (stored) {
      const formularios = JSON.parse(stored);

      formularios.empresa = this.nombreEmpresa;
      formularios.descripcionVacante = this.descripcionVacante;
      formularios.cedulaPersonalAdministrativo = this.huellaForm.value;
      formularios.huellaIndice = this.fingerprintImageID;
      formularios.huellaPulgarDerecho = this.fingerprintImagePD;
      formularios.pagoTransporte = this.pagoTransporteForm.value;

      localStorage.setItem('formularios', JSON.stringify(formularios));

    } else {
      // Si no existe el objeto, puedes crearlo con solo esos campos
      const formularios = {
        empresa: this.nombreEmpresa,
        descripcionVacante: this.descripcionVacante,
        cedulaPersonalAdministrativo: this.huellaForm.value,
        huellaIndice: this.fingerprintImageID,
        huellaPulgarDerecho: this.fingerprintImagePD,
        pagoTransporte: this.pagoTransporteForm.value,
      };
      localStorage.setItem('formularios', JSON.stringify(formularios));
    }
  }




  loadData() {
    if (!this.cedula || !this.codigoContrato) {
      return; // No hacer nada si la cédula o el código de contrato no están definidos
    }
    this.contratacionService.traerDatosSeleccion(this.cedula).subscribe((response: any) => {
      if (response && Array.isArray(response.procesoSeleccion) && response.procesoSeleccion.length > 0) {
        // Encontrar el proceso con el id más alto
        const seleccion = response.procesoSeleccion.reduce((max: { id: number; }, current: { id: number; }) =>
          current.id > max.id ? current : max
        );


        // Obtener la vacante desde ese proceso
        const idVacante = seleccion.vacante;
        if (typeof idVacante === 'number') {
          this.idVacante.emit(idVacante);
        }

        this.vacantesService.obtenerVacante(idVacante).subscribe((vacanteResponse: any) => {
          this.nombreEmpresa = vacanteResponse.temporal;
          this.descripcionVacante = vacanteResponse.descripcion;
          this.actualizarEmpresaYDescripcionEnLocalStorage();
          this.llenarDocumentos();
          // cedula

          this.contratacionService.traerDatosContratacion(this.cedula, this.codigoContrato).subscribe((datosContratacion: any) => {
            if (datosContratacion) {
              this.pagoTransporteForm.patchValue({
                semanasCotizadas: datosContratacion.semanas_cotizadas,
                formaPago: datosContratacion.forma_pago,
                numeroPagos: datosContratacion.numero_pagos,
                validacionNumeroCuenta: datosContratacion.validacion_numero_cuenta,
                seguroFunerario: datosContratacion.seguro_funerario,
                porcentajeARL: datosContratacion.porcentaje_arl,
                auxilioTransporte: datosContratacion.auxilio_transporte,
                salario: "1423500",
                Ccostos: datosContratacion.centro_de_costos || '',
              });
              this.trasladosForm.patchValue({
                opcion_traslado_eps: datosContratacion.opcion_traslado_eps,
                eps_a_trasladar: datosContratacion.eps_a_trasladar,
                traslado: datosContratacion.traslado,
              });

              this.contratacionService.detalleLaboralContratacion(seleccion.centro_costo_entrevista, seleccion.cargo).subscribe((detalleLaboral: any) => {
                if (detalleLaboral) {
                  this.pagoTransporteForm.patchValue({
                    porcentajeARL: detalleLaboral[0].porcentaje_arl,
                    auxilioTransporte: detalleLaboral[0].valor_transporte,
                    salario: detalleLaboral[0].salario,
                    Ccostos: seleccion.centro_costo_entrevista || '',
                  });
                } else {
                  Swal.fire('Error', 'No se encontraron datos de detalle laboral', 'error');
                }
              }
              );
            }
          });
        });
      }
    });
  }




  llenarDocumentos() {
    forkJoin({
      tipo2: this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, 2, this.codigoContrato),
      tipo16: this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, 16, this.codigoContrato),
      tipo17: this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, 17, this.codigoContrato),
      tipo18: this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, 18, this.codigoContrato),
    }).subscribe({
      next: async (resultados) => {
        // Manejo de documentos tipo 2
        if (resultados.tipo2) {
          for (const documento of resultados.tipo2) {
            const typeKey = Object.keys(this.typeMap).find(key => this.typeMap[key] === documento.type);
            if (typeKey) {
              const file = await this.urlToFile(documento.file_url, documento.title || 'Documento sin título');
              this.uploadedFiles[typeKey] = {
                fileName: documento.title || 'Documento sin título',
                file
              };
            }
          }
        }

        // Manejo de documentos tipo 16 (referencias personales)
        // Manejo de documentos tipo 16 (referencias personales)
        if (resultados.tipo16) {
          let personalIndex = 1; // Índice para personal1 y personal2
          for (const documento of resultados.tipo16) {
            const typeKey = `personal${personalIndex}`;
            if (personalIndex <= 2) { // Asegurarse de no exceder el número de controles (personal1 y personal2)
              const file = await this.urlToFile(documento.file_url, documento.title || 'Documento sin título');

              // Actualizar uploadedFiles
              this.uploadedFiles[typeKey] = {
                fileName: documento.title || 'Documento sin título',
                file
              };

              // Actualizar el FormGroup referenciasForm
              this.referenciasForm.patchValue({
                [typeKey]: documento.title || 'Documento sin título'
              });

              personalIndex++; // Incrementar para manejar personal2
            }
          }
        }

        // Manejo de documentos tipo 17 (referencias familiares)
        if (resultados.tipo17) {
          let familiarIndex = 1; // Índice para familiar1 y familiar2
          for (const documento of resultados.tipo17) {
            const typeKey = `familiar${familiarIndex}`;
            if (familiarIndex <= 2) { // Asegurarse de no exceder el número de controles (familiar1 y familiar2)
              const file = await this.urlToFile(documento.file_url, documento.title || 'Documento sin título');

              // Actualizar uploadedFiles
              this.uploadedFiles[typeKey] = {
                fileName: documento.title || 'Documento sin título',
                file
              };

              // Actualizar el FormGroup referenciasForm
              this.referenciasForm.patchValue({
                [typeKey]: documento.title || 'Documento sin título'
              });

              familiarIndex++; // Incrementar para manejar familiar2
            }
          }
        }

        // Manejo de documentos tipo 18 (traslados)
        if (resultados.tipo18) {
          for (const documento of resultados.tipo18) {
            const file = await this.urlToFile(documento.file_url, documento.title || 'Documento sin título');
            this.uploadedFiles['traslado'] = {
              fileName: documento.title || 'Documento sin título',
              file
            };

            // Actualizar el formulario trasladosForm
            this.trasladosForm.patchValue({
              traslado: documento.title || 'Documento sin título', // Asignar el nombre del archivo
            });
          }
        } else {
          Swal.fire({
            title: '¡Atención!',
            text: 'No se encontraron documentos de traslados',
            icon: 'warning',
            confirmButtonText: 'Ok'
          });
        }
      },
      error: (err) => {

      }
    });
  }



}
