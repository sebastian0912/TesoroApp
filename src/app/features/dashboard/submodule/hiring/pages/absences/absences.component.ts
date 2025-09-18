import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { SharedModule } from '@/app/shared/shared.module';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { HiringService } from '../../service/hiring.service';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-absences',
  imports: [
    SharedModule,
    InfoCardComponent,
    FormsModule,
    MatButtonModule
  ],
  templateUrl: './absences.component.html',
  styleUrl: './absences.component.css'
})
export class AbsencesComponent {
  cedula: string = '';
  displayedColumns: string[] = [
    'numerodeceduladepersona',
    'nombre_completo',
    'codigo_ultimo_contrato',
    'fecha_ultimo_ingreso',
    'primercorreoelectronico',
    'celular',
    'telefono_conyugue',
    'telefono_familiar_emergencia',
    'telefono_madre',
    'telefono_padre',
    'telefono_referencia_familiar1',
    'telefono_referencia_familiar2',
    'telefono_referencia_personal1',
    'telefono_referencia_personal2',
    'acciones'
  ];
  dataSource = new MatTableDataSource<any>();
  originalData: any[] = [];
  correo: string | null = null;

  // Refs a los inputs de archivo (deben existir en el HTML con #fileInput y #fileInput2)
  @ViewChild('fileInput', { static: false }) private fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInput2', { static: false }) private fileInput2Ref!: ElementRef<HTMLInputElement>;

  constructor(
    private hiringService: HiringService,
    private utilityService: UtilityServiceService
  ) { }

  async ngOnInit(): Promise<void> {
    const user = await this.utilityService.getUser();
    if (user) {
      this.correo = user.correo_electronico;
    }
  }

  public buscarFormasPago(cedula: string): void {
    // Eliminar todo lo que no sea dígito
    const cleanedCedula = cedula.replace(/[^\d]/g, '');

    this.hiringService.buscarEncontratacion(cleanedCedula).subscribe(
      (response: any) => {
        if (response.message === 'success') {
          const data = response.data.map((item: any) => ({
            ...item,
            nombre_completo: `${item.primer_nombre} ${item.segundo_nombre} ${item.primer_apellido} ${item.segundo_apellido}`,
            editing: false
          }));
          this.originalData = JSON.parse(JSON.stringify(data));
          this.dataSource.data = data;
        }
      },
      (error: any) => {
        if (error?.error?.message?.startsWith?.('No se encontraron datos ')) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontraron datos para la cédula ingresada'
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ha ocurrido un error al buscar la información'
          });
        }
      }
    );
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value || '';
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  toggleEdit(element: any): void {
    element.editing = !element.editing;

    if (!element.editing) {
      this.hiringService
        .editarContratacion_Cedula_Correo(
          element.numerodeceduladepersona,
          element.primercorreoelectronico,
          element.celular
        )
        .then((response: any) => {
          if (response.message === 'success') {
            Swal.fire({
              icon: 'success',
              title: 'Éxito',
              text: 'La información ha sido actualizada correctamente'
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ha ocurrido un error al actualizar la información'
            });
          }
        })
        .catch(() => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ha ocurrido un error al actualizar la información'
          });
        });
    }
  }

  /** Abre el selector del input #fileInput (Cargar Ausentismos) */
  triggerFileInput(): void {
    this.fileInputRef?.nativeElement?.click();
  }

  /** Abre el selector del input #fileInput2 (Eliminar caracteres especiales) */
  triggerFileInput2(): void {
    const el = this.fileInput2Ref?.nativeElement;
    if (!el) return;
    el.value = '';          // permite re-seleccionar el mismo archivo
    el.click();             // abre el selector
  }

  /** Helper para limpiar caracteres especiales (incluye emojis) */
  removeSpecialCharacters = (text: string): string => {
    const emojiPattern =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F7E0}-\u{1F7EF}]/gu;

    return text.replace(emojiPattern, '');
  };

  // -------- Cargar Excel (contratación) ----------
  cargarExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    Swal.fire({
      title: 'Procesando...',
      text: 'Por favor espera mientras se sube el archivo.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    const reader = new FileReader();

    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' }) as any[][];
      json.shift(); // quita encabezado si aplica

      const formatDate = (date: string): string => {
        const regex_ddmmyyyy = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
        const regex_mmddyy = /^\d{1,2}\/\d{1,2}\/\d{2}$/;
        if (regex_ddmmyyyy.test(date)) return date;
        if (regex_mmddyy.test(date)) {
          const [month, day, year] = date.split('/');
          const fullYear = (parseInt(year, 10) < 50) ? `20${year}` : `19${year}`;
          return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`;
        }
        return date;
      };

      const indicesFechas = [0, 8, 16, 24, 44, 134];

      const rows: string[][] = (json as any[][]).map((row: any[]) => {
        const completeRow = new Array(195).fill('-');
        row.forEach((cell, index) => {
          if (index < 195) {
            if (cell == null || cell === '' || cell === '#N/A' || cell === 'N/A' || cell === '#REF!' || cell === '#¡REF!') {
              completeRow[index] = '-';
            } else if (index === 11 || index === 1) {
              completeRow[index] = this.removeSpecialCharacters(
                cell.toString().replace(/[,.\s]/g, '').replace(/[^0-9xX]/g, '')
              );
            } else if (index === 3) {
              completeRow[index] = this.removeSpecialCharacters(
                cell.toString().replace(/[,.\s]/g, '')
              );
            } else if (indicesFechas.includes(index)) {
              completeRow[index] = formatDate(this.removeSpecialCharacters(cell.toString()));
            } else {
              completeRow[index] = this.removeSpecialCharacters(cell.toString());
            }
          }
        });
        return completeRow;
      });

      this.hiringService.subirContratacion(rows)
        .then((response: any) => {
          Swal.close();
          if (response.message === 'success') {
            const total = response.actualizados + response.creados;

            Swal.fire({
              icon: 'success',
              title: 'Éxito',
              html: `Los datos se procesaron correctamente.<br><br>
                     <strong>Actualizados:</strong> ${response.actualizados}<br>
                     <strong>Creados:</strong> ${response.creados}<br>
                     <strong>Total:</strong> ${total}`
            });

            if (response.errores) {
              this.generateErrorExcel(response.errores);
            }
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ocurrió un error al procesar los datos, inténtalo nuevamente.'
            });
          }
        })
        .catch((error: any) => {
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `Error al procesar los datos: ${error?.message || 'Error desconocido'}`
          });
        })
        .finally(() => {
          this.resetFile(this.fileInputRef);
        });
    };

    reader.readAsArrayBuffer(file);
  }

  generateErrorExcel(errores: any[]): void {
    const worksheetData = [['Registro', 'Campo', 'Error']];
    errores.forEach((error: any) => {
      worksheetData.push([error.registro, error.campo, error.error]);
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook: XLSX.WorkBook = { Sheets: { 'Errores': worksheet }, SheetNames: ['Errores'] };
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    this.saveAsExcelFile(excelBuffer, 'Errores_Contratacion');
  }

  saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url: string = window.URL.createObjectURL(data);
    const link: HTMLAnchorElement = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  isExcelDate(serial: number): boolean {
    return serial > 25569 && serial < 2958465;
  }

  excelSerialToJSDate2(serial: number): string {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  /** Reset genérico para cualquiera de los 2 inputs */
  private resetFile(ref: ElementRef<HTMLInputElement> | undefined): void {
    const el = ref?.nativeElement;
    if (el) el.value = '';
  }

  // -------- Eliminar caracteres especiales ----------
  eliminarCaracteresEspeciales(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    Swal.fire({
      title: 'Procesando...',
      text: 'Eliminando acentos y caracteres especiales...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    const reader = new FileReader();

    const limpiarTexto = (inputStr: string): string => {
      let output = inputStr.normalize('NFD');
      output = output.replace(/[\u0300-\u036f]/g, ''); // quita diacríticos
      return output;
    };

    const formatDate = (date: string): string => {
      const regex_ddmmyyyy = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
      const regex_mmddyy = /^\d{1,2}\/\d{1,2}\/\d{2}$/;
      if (regex_ddmmyyyy.test(date)) return date;
      if (regex_mmddyy.test(date)) {
        const [month, day, year] = date.split('/');
        const fullYear = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`;
      }
      return date;
    };

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false
        });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const jsonAOA = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          dateNF: 'dd/mm/yyyy'
        }) as any[][];

        const cleanedAOA = jsonAOA.map((row: any[]) =>
          row.map((cell: any) => (typeof cell === 'string' ? limpiarTexto(cell) : cell))
        );

        const newSheet = XLSX.utils.aoa_to_sheet(cleanedAOA);
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);

        const excelBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });

        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ArchivoSinEspeciales.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.fire({
          icon: 'success',
          title: 'Archivo procesado',
          text: 'Se eliminaron los caracteres especiales y se descargó el nuevo archivo.'
        });
      } catch (error: any) {
        Swal.fire({
          icon: 'error',
          title: 'Error al procesar el archivo',
          text: error?.message || 'Ocurrió un error inesperado.'
        });
      } finally {
        this.resetFile(this.fileInput2Ref);
      }
    };

    reader.readAsArrayBuffer(file);
  }
}
