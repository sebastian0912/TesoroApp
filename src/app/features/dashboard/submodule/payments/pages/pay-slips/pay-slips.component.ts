import { Component, OnInit } from '@angular/core';
import { PaymentsService } from '../../services/payments.service';
import { SharedModule } from '@/app/shared/shared.module';
import { MatTableDataSource } from '@angular/material/table';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { FormsModule } from '@angular/forms';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-pay-slips',
  imports: [
    SharedModule,
    InfoCardComponent,
    FormsModule
  ],
  templateUrl: './pay-slips.component.html',
  styleUrl: './pay-slips.component.css'
})

export class PaySlipsComponent implements OnInit {
  cedula: string = '';
  displayedColumns: string[] = [
    'no', 'cedula', 'nombre', 'ingreso', 'retiro', 'finca', 'telefono',
    'concepto', 'desprendibles', 'certificaciones', 'cartas_retiro',
    'carta_cesantias', 'entrevista_retiro', 'correo', 'confirmacion_envio'
  ];
  dataSource = new MatTableDataSource<any>();
  originalData: any[] = [];
  user: any
  correo: any;

  claves = ["No", "Cedula", "Nombre", "Ingreso",
    "Retiro", "Finca", "Telefono", "CONCEPTO",
    "Desprendibles", "Certificaciones", "Cartas_Retiro",
    "Carta_Cesantias", "Entrevista_Retiro", "Correo",
    "Confirmacion_Envio"];

  constructor(
    private paymentsService: PaymentsService,
    private utilityService: UtilityServiceService,
  ) { }

  async ngOnInit(): Promise<void> {
    this.user = await this.utilityService.getUser();
    if (this.user) {
      this.correo = this.user.correo_electronico;
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  isValidLink(url: string): boolean {
    return typeof url === 'string' && url.startsWith('https://');
  }


  public buscarDesprendibles(cedula: string): void {
    // Mantener la primera letra (si existe) y limpiar el resto
    let cleanedCedula: string;

    if (/^[A-Za-z]/.test(cedula)) {
      cleanedCedula = cedula[0].toUpperCase() + cedula.slice(1).replace(/[^\d]/g, '');
    } else {
      cleanedCedula = cedula.replace(/[^\d]/g, '');
    }

    // Convertir todo en mayúsculas
    cleanedCedula = cleanedCedula.toUpperCase();

    this.paymentsService.buscarDesprendibles(cleanedCedula).subscribe(
      (response: any) => {
        if (response.message == 'No se encontró el número de cédula') {
          Swal.fire({
            icon: 'info',
            title: 'Información',
            text: 'No se encontraron formas de pago para la cédula ingresada'
          });
          return;
        }

        const desprendibles = response.desprendibles
          .sort((a: any, b: any) => b.id - a.id);

        this.originalData = JSON.parse(JSON.stringify(desprendibles));
        this.dataSource.data = desprendibles;
      },
      (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ha ocurrido un error al buscar la información'
        });
      }
    );
  }


  triggerFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.click();
  }

  cargarExcel(event: any): void {
    const file = event.target.files[0];
    const reader = new FileReader();

    // Mostrar modal de carga
    Swal.fire({
      title: 'Procesando archivo...',
      text: 'Por favor espera mientras se carga la información.',
      icon: 'info',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "dd/mm/yyyy" });

        const modifiedRows = this.asignarClaves(rows);

        // Validar que tenga exactamente 15 columnas
        if (
          modifiedRows.length === 0 ||
          Object.keys(modifiedRows[0]).length !== 15
        ) {
          Swal.fire({
            icon: 'error',
            title: 'Error de formato',
            text: 'El archivo no tiene el formato correcto. Verifique que tenga exactamente 15 columnas válidas.'
          });
          return;
        }

        // Eliminar fila de encabezados
        modifiedRows.shift();

        this.resetFileInput();

        this.paymentsService.subirExcelDesprendibles(modifiedRows).then((response: any) => {
          if (response.message === 'success') {
            Swal.fire({
              icon: 'success',
              title: 'Éxito',
              text: 'Los datos han sido cargados correctamente.'
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ocurrió un problema al cargar los datos. Inténtalo nuevamente.'
            });
          }
        }).catch((error: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Error inesperado',
            text: 'Ha ocurrido un error durante la carga del archivo.'
          });
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error de lectura',
          text: 'No se pudo procesar el archivo. Asegúrese de que sea un archivo válido.'
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }


  asignarClaves(data: any[]): any[] {
    return data.map((row: any) => {
      let modifiedRow: any = {};
      this.claves.forEach((clave: string, index: number) => {
        modifiedRow[clave] = row[index] !== undefined && row[index] !== null ? row[index] : '-';
      });
      return modifiedRow;
    });
  }

  resetFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

}
