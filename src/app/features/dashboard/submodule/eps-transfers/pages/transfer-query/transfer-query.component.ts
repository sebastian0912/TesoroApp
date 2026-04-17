import {  Component , ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { TrasladosService } from '../../service/traslados.service';
import { SharedModule } from '@/app/shared/shared.module';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-transfer-query',
  imports: [
    SharedModule,
    MatTableModule
  ],
  templateUrl: './transfer-query.component.html',
  styleUrl: './transfer-query.component.css'
} )
export class TransferQueryComponent {
  myForm!: FormGroup;
  dataSource = new MatTableDataSource<any>([]);

  displayedColumns: string[] = [
    'codigo_traslado',
    'solicitud_traslado',
    'eps_a_trasladar',
    'responsable',
    'estado_del_traslado'
  ];

  constructor(
    private trasladosService: TrasladosService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {
    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  onSubmit(): void {
    if (this.myForm.valid) {
      this.trimField('cedula');

      // Mostrar Swal de carga
      Swal.fire({
        title: 'Buscando información...',
        html: 'Por favor, espere.',
        icon: 'info',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      this.trasladosService.buscarAfiliacionPorId(this.myForm.value.cedula).subscribe(
        (data: any) => {
          Swal.close(); // Cierra el swal al recibir respuesta
          this.dataSource.data = data;
          this.cdr.markForCheck();
        },
        (error: any) => {
          Swal.close(); // Cierra el swal si hay error
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo realizar la consulta. Por favor, inténtelo de nuevo más tarde.',
          });
          this.cdr.markForCheck();
        }
      );
    }
  }


  private trimField(fieldName: string) {
    const control = this.myForm.get(fieldName);
    if (control && control.value && typeof control.value === 'string') {
      control.setValue(control.value.trim());
    }
  }

  verDocumento(solicitud: string): void {
    if (solicitud.startsWith('data:application/pdf;base64,')) {
      const base64 = solicitud.split(',')[1];
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } else {
      window.open(solicitud, '_blank');
    }
  }

}
