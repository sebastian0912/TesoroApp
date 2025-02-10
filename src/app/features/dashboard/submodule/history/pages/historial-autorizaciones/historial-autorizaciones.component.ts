import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { MatTableDataSource } from '@angular/material/table';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { HistorialService } from '../../service/historial/historial.service';
import { SharedModule } from '../../../../../../shared/shared.module';

@Component({
  selector: 'app-historial-autorizaciones',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './historial-autorizaciones.component.html',
  styleUrls: ['./historial-autorizaciones.component.css']
})
export class HistorialAutorizacionesComponent implements OnInit {

  myForm!: FormGroup;
  displayedColumns: string[] = ['concepto', 'generadopor', 'fechaEfectuado', 'valor', 'cuotas', 'conceptoEjecutado', 'valorEjecutado', 'nombreQuienEntrego', 'fechaEjecutado'];
  dataSource = new MatTableDataSource<any>([]);

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
          this.dataSource.data = data.historial;

          this.buscarOperario();
        },
        (error: any) => {
        }
      );
    }
  }

  buscarOperario(): void {
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
        },
        (error: any) => {
        }
      );
    }
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

}
