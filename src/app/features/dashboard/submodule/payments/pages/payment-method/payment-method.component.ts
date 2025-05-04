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
  selector: 'app-payment-method',
  imports: [
    SharedModule,
    InfoCardComponent,
    FormsModule
  ],
  templateUrl: './payment-method.component.html',
  styleUrl: './payment-method.component.css'
})
export class PaymentMethodComponent implements OnInit {

  cedula: string = '';
  displayedColumns: string[] = ['contrato', 'cedula', 'nombre', 'centrodecosto', 'concepto', 'formadepago', 'valor', 'banco', 'fechadepago', 'acciones'];
  dataSource = new MatTableDataSource<any>();
  originalData: any[] = [];
  user: any;
  correo: any

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

  public buscarFormasPago(cedula: string): void {
    const cleanedCedula = cedula.replace(/[^\d]/g, '');

    this.paymentsService.buscarFormasPago(cleanedCedula).subscribe(
      (response: any) => {
        if (response.message == 'No se encontró el número de cédula') {
          Swal.fire({
            icon: 'info',
            title: 'Información',
            text: 'No se encontraron formas de pago para la cédula ingresada'
          });
          return;
        }

        const formasDePago = response.formasdepago
          .sort((a: any, b: any) => b.id - a.id)
          .slice(0, 4)
          .map((item: any) => ({ ...item, editing: false }));

        this.originalData = JSON.parse(JSON.stringify(formasDePago));
        this.dataSource.data = formasDePago;
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

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  toggleEdit(element: any): void {
    if (this.correo === "contaduria.rtc@gmail.com" ||
      this.correo === "ghumana.rtc@gmail.com" ||
      this.correo === "antcontable5.ts@gmail.com" ||
      this.correo === "programador.ts@gmail.com") {

      element.editing = !element.editing;

      if (!element.editing) {
        this.paymentsService.editarFormaPago(
          element.id,
          element.banco,
          element.nombre,
          element.centrodecosto,
          element.concepto,
          element.contrato,
          element.fechadepago,
          element.formadepago,
          element.valor
        ).then((response: any) => {
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
        }).catch((error: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ha ocurrido un error al actualizar la información'
          });
        });
      } else {
        const index = this.dataSource.data.indexOf(element);
        this.dataSource.data[index] = { ...this.originalData[index], editing: true };
      }
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No tienes permisos para editar esta información'
      });
    }
  }

  eliminarFormaPago(element: any): void {
    if (this.correo === "contaduria.rtc@gmail.com" ||
      this.correo === "ghumana.rtc@gmail.com" ||
      this.correo === "antcontable5.ts@gmail.com") {

      Swal.fire({
        title: '¿Estás seguro de eliminar esta información?',
        text: 'No podrás revertir esta acción',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.paymentsService.eliminarFormaPago(element.id).then((response: any) => {
            if (response.message == 'success') {
              Swal.fire({
                icon: 'success',
                title: 'Éxito',
                text: 'La información ha sido eliminada correctamente'
              });
              const index = this.dataSource.data.indexOf(element);
              this.dataSource.data.splice(index, 1);
              this.dataSource._updateChangeSubscription();
            } else {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ha ocurrido un error al eliminar la información'
              });
            }
          }).catch((error: any) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ha ocurrido un error al eliminar la información'
            });
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No tienes permisos para eliminar esta información'
          });
        }
      });
    }
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.click();
  }

  resetFileInput(event: any): void {
    event.target.value = '';
  }


  cargarExcel(event: any): void {
    const file = event.target.files[0];
    const reader = new FileReader();

    // Mostrar Swal de carga
    Swal.fire({
      title: 'Cargando archivo...',
      icon: 'info',
      text: 'Por favor espera mientras se procesa el archivo.',
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

        if (Object.keys(modifiedRows[0]).length !== 10) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'El archivo no tiene el formato correspondiente. Asegúrese de que tenga exactamente 10 columnas válidas.'
          });
          return;
        }

        this.paymentsService.subirExcelFormasPago(modifiedRows).then((response: any) => {
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
              text: 'Ha ocurrido un error al cargar los datos.'
            });
          }
        }).catch((error: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error inesperado al cargar los datos.'
          });
          console.error('Error en la carga del archivo:', error);
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo procesar el archivo.'
        });
        console.error('Error al procesar archivo Excel:', error);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  claves = ["NroDes", "Contrato", "Cedula", "Nombre", "CentrodeCosto", "Concepto", "FormadePago", "Valor", "Banco", "FECHADEPAGO"];

  asignarClaves(data: any[]): any[] {

    return data.map((row: any) => {
      let modifiedRow: any = {};
      row.forEach((cell: any, index: number) => {
        if (index < this.claves.length) {
          modifiedRow[this.claves[index]] = cell !== null ? cell : 'N/A';
        }
      });
      return modifiedRow;
    });
  }

}
