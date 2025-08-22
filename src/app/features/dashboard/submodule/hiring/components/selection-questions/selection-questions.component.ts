import { SharedModule } from '@/app/shared/shared.module';
import { Component, OnInit, SimpleChanges } from '@angular/core';
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
import { debounceTime, merge, Subscription } from 'rxjs';

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
  @Input() codigoContrato: string = '';
  @Input() vacanteSeleccionada: any;
  medidasCorrectivas = Array.from({ length: 10 }, (_, i) => i + 1);
  filteredExamOptions: string[] = [];

  formGroup1: FormGroup;
  // (opcional) por si tu valor llegara como string y quieres compararlo como número
  compareNumbers = (a: any, b: any) => Number(a) === Number(b);
  semanasOptions: number[] = Array.from({ length: 2001 }, (_, i) => i);
  // Evitar que se escriban caracteres no numéricos y solo enteros
  onlyInteger(e: KeyboardEvent) {
    const allowed = [
      'Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'
    ];
    if (allowed.includes(e.key)) return;

    // Permite números 0-9
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }

  private formSubs!: Subscription;

  examFiles: File[] = []; // Guardamos los archivos PDF por índice

  uploadedFiles: { [key: string]: { file?: File; fileName?: string } } = {
    eps: { fileName: 'Adjuntar documento' },
    afp: { fileName: 'Adjuntar documento' },
    policivos: { fileName: 'Adjuntar documento' },
    procuraduria: { fileName: 'Adjuntar documento' },
    contraloria: { fileName: 'Adjuntar documento' },
    ramaJudicial: { fileName: 'Adjuntar documento' },
    medidasCorrectivas: { fileName: 'Adjuntar documento' },
    sisben: { fileName: 'Adjuntar documento' },
    ofac: { fileName: 'Adjuntar documento' },
    examenesMedicos: { fileName: 'Adjuntar documento' },
    figuraHumana: { fileName: 'Adjuntar documento' },
    pensionSemanas: { fileName: 'Adjuntar documento' },
  };

  epsList: string[] = [
    'ALIANSALUD',
    'ASMET SALUD',
    'CAJACOPI',
    'CAPITAL SALUD',
    'CAPRESOCA',
    'COMFAMILIARHUILA',
    'COMFAORIENTE',
    'COMPENSAR',
    'COOSALUD',
    'DUSAKAWI',
    'ECOOPSOS',
    'FAMISANAR',
    'FAMILIAR DE COLOMBIA',
    'MUTUAL SER',
    'NUEVA EPS',
    'PIJAOS SALUD',
    'SALUD TOTAL',
    'SANITAS',
    'SAVIA SALUD',
    'SOS',
    'SURA',
    'No Tiene',
    'Sin Buscar',
  ];

  afpList: string[] = [
    'PORVENIR',
    'COLFONDOS',
    'PROTECCION',
    'COLPENSIONES'
  ];

  antecedentesEstados: string[] = [
    'Cumple',
    'No Cumple',
    'Sin Buscar'
  ];

  categoriasSisben: string[] = [
    // Grupo A: Pobreza extrema
    'A1', 'A2', 'A3', 'A4', 'A5',

    // Grupo B: Pobreza moderada
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7',

    // Grupo C: Vulnerabilidad
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18',

    // Grupo D: No pobre ni vulnerable
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21',

    // Opcionales de UI
    'No Aplica',
    'Sin Buscar'
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
    examenesMedicos: 32,
    pensionSemanas: 33
  };

  ngOnInit(): void {
    // … aquí creas/inyectas los formGroups …

    /* 🔔 Detectar cambios en los 4 juntos */
    this.formSubs = merge(
      this.formGroup1.valueChanges,

    )
      .pipe(debounceTime(300))        // evita escribir en cada tecla
      .subscribe(() => this.actualizarFormulariosLS());
  }

  ngOnDestroy(): void {
    this.formSubs?.unsubscribe();
  }

  private actualizarFormulariosLS(): void {
    const almacenado = localStorage.getItem('formularios');
    const formularios = almacenado ? JSON.parse(almacenado) : {};

    /* 👉 Agregar o sobre-escribir sólo estas partes */
    formularios.selecionparte1 = this.formGroup1.value;


    localStorage.setItem('formularios', JSON.stringify(formularios));
  }


  constructor(
    private seleccionService: SeleccionService,
    private gestionDocumentalService: GestionDocumentalService,
    private hiringService: HiringService,
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





    // Cargar lista completa de exámenes disponibles
    this.filteredExamOptions = [
      'Exámen Ingreso',
      'Colinesterasa',
      'Glicemia Basal',
      'Perfil lípidico',
      'Visiometria',
      'Optometría',
      'Audiometría',
      'Espirometría',
      'Sicometrico',
      'Frotis de uñas',
      'Frotis de garganta',
      'Cuadro hematico',
      'Creatinina',
      'TGO',
      'Coprológico',
      'Osteomuscular',
      'Quimico (Respiratorio - Dermatologico)',
      'Tegumentaria',
      'Cardiovascular',
      'Trabajo en alturas (Incluye test para detección de fobia a las alturas: El AQ (Acrophobia Questionnaire) de Cohen)',
      'Electrocardiograma (Sólo aplica para mayores de 45 años)',
      'Examen Médico',
      'HEPATITIS A Y B',
      'TETANO VACUNA T-D',
      'Exámen médico integral definido para conductores'
    ];
  }

  ngOnChanges(changes: SimpleChanges): void {
    const cedulaLlena = this.cedula && this.cedula.trim() !== '';
    const contratoLleno = this.codigoContrato && this.codigoContrato.trim() !== '';

    if (cedulaLlena && contratoLleno) {

      this.hiringService.traerDatosSeleccion(this.cedula).subscribe(
        (response) => {
          if (response) {
            const procesos = response?.procesoSeleccion;

            // 1️⃣  Si no hay procesos, salimos
            if (!Array.isArray(procesos) || procesos.length === 0) { return; }

            // 2️⃣  Obtenemos el proceso con id mayor
            const ultimoProceso = procesos.reduce(
              (max, curr) => (curr.id > max.id ? curr : max),
              procesos[0]
            );

            this.loadDataSeleccion(ultimoProceso);
            this.loadDataDocumentos();

          }
        },
        (error) => {
          Swal.fire({
            title: '¡Error!',
            text: 'No se pudieron obtener los datos de selección. Por favor, inténtelo de nuevo más tarde.',
            icon: 'error',
            confirmButtonText: 'Ok'
          });
        }
      );
    }
  }

  loadDataSeleccion(seleccion: any): void {
    // Llenar los campos del formulario de Datos Generales (formGroup1)
    this.formGroup1.patchValue({
      eps: seleccion.eps || '',
      afp: seleccion.afp || '',
      policivos: seleccion.policivos || '',
      procuraduria: seleccion.procuraduria || '',
      contraloria: seleccion.contraloria || '',
      ramaJudicial: seleccion.rama_judicial || '',
      medidasCorrectivas: seleccion.medidas_correctivas || '',
      area_aplica: seleccion.area_aplica || '',
      sisben: seleccion.sisben || '',
      ofac: seleccion.ofac || '',
      revisionAntecedentes: seleccion.revisionAntecedentes || ''
    });

  }

  loadDataDocumentos(): void {
    if (this.codigoContrato) {
      this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula, this.codigoContrato, 2)
        .subscribe({
          next: (infoGestionDocumentalAntecedentes: any[]) => {
            if (infoGestionDocumentalAntecedentes) {
              // Iterar sobre los documentos y mapearlos a los campos correctos
              infoGestionDocumentalAntecedentes.forEach(async (documento: any) => {
                const typeKey = Object.keys(this.typeMap).find(key => this.typeMap[key] === documento.type);
                if (typeKey) {
                  const file = await this.urlToFile(documento.file_url, documento.title || 'Documento sin título');
                  this.uploadedFiles[typeKey] = {
                    fileName: documento.title || 'Documento sin título',
                    file // Asigna el archivo descargado
                  };
                }
              });
            }
          },
          error: (err: any) => {
            // error que no sea que no se encontraron documentos
            if (err.error.error !== "No se encontraron documentos") {
              Swal.fire({
                title: '¡Error!',
                text: 'No se pudieron obtener los documentos de antecedentes',
                icon: 'error',
                confirmButtonText: 'Ok'
              });
            }
          }
        });
    }
  }

  // Método para calcular el porcentaje de llenado de un FormGroup
  getPercentage(formGroup: FormGroup): number {
    const totalFields = Object.keys(formGroup.controls).length;
    const filledFields = Object.values(formGroup.controls).filter(control => {
      const value = control.value;

      // Ignorar campos vacíos y arreglos vacíos
      if (Array.isArray(value)) {
        return value.length > 0; // Solo contar como lleno si el arreglo tiene elementos
      }

      return value !== null && value !== undefined && value !== ''; // Considerar los valores no vacíos
    }).length;

    return Math.round((filledFields / totalFields) * 100);
  }

  // Método para determinar el color de fondo del encabezado según el porcentaje
  getPanelColor(percentage: number): string {
    if (percentage <= 20) {
      return '#ff6666'; // Fondo rojo intenso
    } else if (percentage > 20 && percentage <= 40) {
      return '#ffcc99'; // Fondo naranja claro
    } else if (percentage > 40 && percentage <= 60) {
      return '#fff5cc'; // Fondo amarillo claro
    } else if (percentage > 60 && percentage <= 80) {
      return '#d9f2d9'; // Fondo verde claro
    } else if (percentage > 80 && percentage < 100) {
      return '#a3e4a3'; // Fondo verde medio
    } else {
      return '#66ff66'; // Fondo verde intenso (100% completo)
    }
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

  // Método que se ejecuta cuando se selecciona un archivo o se genera un PDF en memoria
  subirArchivo(event: any | Blob, campo: string, fileName?: string) {
    let file: File;

    if (event instanceof Blob) {
      // Si es un archivo generado en memoria (como el PDF fusionado)
      file = new File([event], fileName || 'archivo.pdf', { type: 'application/pdf' });
    } else {
      // Si es un evento de input file (archivo seleccionado por el usuario)
      file = event.target.files[0];
    }

    if (file) {
      // Verificar si el nombre del archivo tiene más de 100 caracteres
      if (file.name.length > 100) {
        Swal.fire('Error', 'El nombre del archivo no debe exceder los 100 caracteres', 'error');
        return; // Salir de la función si la validación falla
      }

      // Si la validación es exitosa, almacenar el archivo en uploadedFiles
      this.uploadedFiles[campo] = { file: file, fileName: file.name };

      // Mensaje opcional de éxito
      // Swal.fire('Archivo subido', `Archivo ${file.name} subido para ${campo}`, 'success');
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


  // Método para imprimir los datos del formulario y subir todos los archivos
  imprimirVerificacionesAplicacion(): void {
    // Mostrar Swal de cargando
    Swal.fire({
      title: 'Cargando...',
      text: 'Estamos guardando los datos y subiendo los archivos.',
      icon: 'info',
      allowOutsideClick: false,
      showConfirmButton: false, // No mostrar botón hasta que termine el proceso
      willOpen: () => {
        Swal.showLoading(); // Mostrar el indicador de carga
      }
    });

    // Llamar al servicio para guardar los datos del formulario (Parte 1)
    this.seleccionService
      .crearSeleccionParteUnoCandidato(this.formGroup1.value, this.cedula, this.codigoContrato)
      .subscribe(
        (response) => {
          if (response.message === 'success') {
            // si this.uploadedFiles esta vacio
            if (Object.keys(this.uploadedFiles).length === 0) {
              Swal.close(); // Cerrar el Swal de carga
              Swal.fire({
                title: '¡Éxito!',
                text: 'Datos guardados exitosamente',
                icon: 'success',
                confirmButtonText: 'Ok'
              });
            }
            else {
              const nombres = ["eps", "afp", "policivos", "procuraduria", "contraloria", "ramaJudicial", "medidasCorrectivas", "sisben", "ofac", "pensionSemanas"];
              // Si la respuesta es exitosa, proceder a subir los archivos
              this.subirTodosLosArchivos(nombres).then((allFilesUploaded) => {
                if (allFilesUploaded) {
                  Swal.close();
                  // Cerrar el Swal de carga y mostrar el mensaje de éxito
                  Swal.fire({
                    title: '¡Éxito!',
                    text: 'Datos y archivos guardados exitosamente',
                    icon: 'success',
                    confirmButtonText: 'Ok'
                  });
                }
              }).catch((error) => {
                // Cerrar el Swal de carga y mostrar el mensaje de error en caso de fallo al subir archivos
                Swal.fire({
                  title: 'Error',
                  text: `Hubo un error al subir los archivos: ${error}`,
                  icon: 'error',
                  confirmButtonText: 'Ok'
                });
              });
            }
          }
        },
        (error) => {
          // Cerrar el Swal de carga y mostrar el mensaje de error en caso de fallo al guardar los datos
          Swal.fire({
            title: 'Error',
            text: 'Hubo un error al guardar los datos del formulario',
            icon: 'error',
            confirmButtonText: 'Ok'
          });
        }
      );
  }




  // Método para fusionar PDFs y almacenarlo en uploadedFiles["examenesMedicos"]
  async imprimirSaludOcupacional(): Promise<void> {
    if (this.examFiles.length === 0 || this.examFiles.every(file => !file)) {
      Swal.fire({
        title: '¡Advertencia!',
        text: 'Debe subir al menos un archivo PDF.',
        icon: 'warning',
        confirmButtonText: 'Ok'
      });
      return;
    }

    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Generando documento PDF...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      // Crear un nuevo documento PDF
      const mergedPdf = await PDFDocument.create();

      for (const file of this.examFiles) {
        if (file) {
          const fileBuffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(fileBuffer);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
      }

      // Generar el PDF fusionado en Blob
      const mergedPdfBytes = await mergedPdf.save();
      const pdfBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

      // Guardar el archivo fusionado en uploadedFiles["examenesMedicos"]
      this.subirArchivo(pdfBlob, "examenesMedicos", "SaludOcupacional_Combinado.pdf");

      Swal.close(); // Cerrar la alerta de carga

      this.imprimirDocumentos();

    } catch (error) {
      Swal.close();
      Swal.fire({
        title: '¡Error!',
        text: 'Ocurrió un problema al fusionar los archivos PDF.',
        icon: 'error',
        confirmButtonText: 'Ok'
      });
    }
  }




  // Método para subir todos los archivos almacenados en uploadedFiles
  subirTodosLosArchivos(keysEspecificos: string[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Filtrar los archivos válidos basados en las keys específicas proporcionadas
      let archivosAEnviar = Object.keys(this.uploadedFiles)
        .filter(key => {
          const fileData = this.uploadedFiles[key];
          // Incluir solo las keys específicas y con un objeto `file` válido
          return keysEspecificos.includes(key) && fileData && fileData.file;
        })
        .map(key => ({
          key,
          ...this.uploadedFiles[key],
          typeId: this.typeMap[key] // Asignar el tipo documental (typeId)
        }));


      // Si no hay archivos para subir
      if (archivosAEnviar.length === 0) {
        resolve(true); // Resolver inmediatamente si no hay archivos
        return;
      }

      // Crear promesas para cada archivo
      const promesasDeSubida = archivosAEnviar.map(({ key, file, fileName, typeId }) => {
        return new Promise<void>((resolveSubida, rejectSubida) => {
          if (file && typeId) {
            // Verificar si la clave está entre ["examenesMedicos", "figuraHumana", "pensionSemanas"]
            if (["examenesMedicos", "figuraHumana", "pensionSemanas"].includes(key)) {
              // Si la clave coincide, incluir this.codigoContrato en guardarDocumento
              this.gestionDocumentalService
                .guardarDocumento(fileName, this.cedula, typeId, file, this.codigoContrato)
                .subscribe({
                  next: () => {
                    resolveSubida(); // Resolver la promesa de este archivo
                  },
                  error: (error) => {
                    rejectSubida(`Error al subir archivo ${key}: ${error.message}`);
                  }
                });
            } else {
              // Si no coincide, usar el método normal
              this.gestionDocumentalService
                .guardarDocumento(fileName, this.cedula, typeId, file) // Sin this.codigoContrato
                .subscribe({
                  next: () => {
                    resolveSubida(); // Resolver la promesa de este archivo
                  },
                  error: (error) => {
                    rejectSubida(`Error al subir archivo ${key}: ${error.message}`);
                  }
                });
            }
          } else {
            rejectSubida(`Archivo ${key} no tiene datos válidos`);
          }
        });
      });

      // Esperar a que todas las subidas terminen
      Promise.all(promesasDeSubida)
        .then(() => {
          resolve(true); // Resolver cuando todos los archivos hayan sido procesados
        })
        .catch((error) => {
          reject(error); // Rechazar si hay errores en alguna subida
        });
    });
  }

  imprimirDocumentos() {
    // Mostrar Swal de carga con ícono animado
    Swal.fire({
      title: 'Subiendo archivos...',
      icon: 'info',
      html: 'Por favor, espere mientras se suben los archivos.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading(); // Mostrar icono de carga animado
      }
    });
    const nombres = ["examenesMedicos", "figuraHumana", "pensionSemanas"];
    // Subir solo los primeros 9 archivos
    this.subirTodosLosArchivos(nombres)
      .then((allFilesUploaded) => {
        if (allFilesUploaded) {
          Swal.close(); // Cerrar el Swal de carga
          // Mostrar mensaje de éxito
          Swal.fire({
            title: '¡Éxito!',
            text: 'Datos y archivos guardados exitosamente',
            icon: 'success',
            confirmButtonText: 'Ok'
          });
        }
      })
      .catch((error) => {
        // Cerrar el Swal de carga y mostrar un mensaje de error
        Swal.close();
        Swal.fire({
          title: 'Error',
          text: `Hubo un error al subir los archivos: ${error}`,
          icon: 'error',
          confirmButtonText: 'Ok'
        });
      });
  }

  // Guardar el archivo PDF seleccionado para cada examen
  onFileSelected(event: any, index: number): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.examFiles[index] = file;
    } else {
      alert('Por favor, seleccione un archivo PDF válido.');
    }
  }

}
