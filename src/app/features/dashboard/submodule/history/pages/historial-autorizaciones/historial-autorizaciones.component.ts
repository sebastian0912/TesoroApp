import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { HistorialService } from '../../service/historial/historial.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';

@Component({
  selector: 'app-historial-autorizaciones',
  imports: [
    SharedModule,
    StandardFilterTable
  ],
  templateUrl: './historial-autorizaciones.component.html',
  styleUrls: ['./historial-autorizaciones.component.css']
})
export class HistorialAutorizacionesComponent implements OnInit {

  myForm!: FormGroup;

  columns: ColumnDefinition[] = [
    { name: 'concepto', header: 'Concepto', type: 'text', filterable: true },
    { name: 'generadopor', header: 'Persona que autorizo', type: 'text', filterable: true },
    { name: 'fechaEfectuado', header: 'Fecha Efectuado', type: 'text', filterable: true },
    { name: 'valor', header: 'Valor Autorizado', type: 'text', filterable: true },
    { name: 'cuotas', header: 'Cuotas', type: 'text', filterable: true },
    { name: 'conceptoEjecutado', header: 'Concepto ejecutado', type: 'text', filterable: true },
    { name: 'valorEjecutado', header: 'Valor ejecutado', type: 'text', filterable: true },
    { name: 'nombreQuienEntrego', header: 'Persona que ejecuto', type: 'text', filterable: true },
    { name: 'fechaEjecutado', header: 'Fecha ejecutado', type: 'text', filterable: true }
  ];

  dataList: any[] = [];

  constructor(
    private historialService: HistorialService,
    private autorizacionesService: AutorizacionesService,
    private fb: FormBuilder
  ) { }

  ngOnInit(): void {
    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
    });
  }

  private trimField(fieldName: string) {
    const control = this.myForm.get(fieldName);
    if (control && control.value && typeof control.value === 'string') {
      control.setValue(control.value.trim());
    }
  }

  onSubmit(): void {
    if (this.myForm.valid) {
      this.trimField('cedula');
      this.historialService.getHistorialOperario(this.myForm.value.cedula).subscribe(
        (data: any) => {
          if (data.historial.length === 0) {
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: 'No se encontraron registros para este empleado',
            });
            return;
          }

          // ordenar de mayor a menor por id
          data.historial.sort((a: any, b: any) => {
            return b.id - a.id;
          });

          // Map and format currency values
          this.dataList = data.historial.map((item: any) => ({
            ...item,
            // Format numbers using Intl.NumberFormat or simple toLocaleString if sufficient
            valor: this.formatCurrency(item.valor),
            valorEjecutado: this.formatCurrency(item.valorEjecutado)
          }));

          this.buscarOperario();
        },
        (error: any) => {
        }
      );
    }
  }

  formatCurrency(value: any): string {
    if (value === null || value === undefined) return '';
    // Format similar to '1.0-0' pipe: integer with thousands separators
    return Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  buscarOperario(): void {
    // si cedula no es válida
    Swal.fire({
      title: 'Buscando trabajador...',
      icon: 'info',
      text: 'Por favor, espera mientras se procesa la información.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    if (this.myForm.valid) {
      this.autorizacionesService.traerOperarios(this.myForm.value.cedula).subscribe(
        (data: any) => {
          if (data.datosbase === "No se encontró el registro para el ID proporcionado") {
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: 'Este empleado no existe, esta retirado o no pertenece a la empresa',
            });
          }
          if (data.activo == false) {
            Swal.fire({
              icon: 'error',
              title: 'Empleado retirado',
              text: 'El empleado con la cédula proporcionada se encuentra retirado.',
            });
            return;
          }
          Swal.close();
        },
        (error: any) => {
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'Hubo un problema al buscar el operario. Intente nuevamente.',
          });
        }
      );
    }
  }
}
