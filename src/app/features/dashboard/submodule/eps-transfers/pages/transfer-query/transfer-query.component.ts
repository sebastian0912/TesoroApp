import {  Component , ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { TrasladosService } from '../../service/traslados.service';
import { SharedModule } from '@/app/shared/shared.module';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ElectronWindowService } from '@/app/core/services/electron-window.service';

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
    private electronWindow: ElectronWindowService,
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
    this.electronWindow.openDocument(solicitud, { title: 'Solicitud de traslado' });
  }

  /**
   * Resuelve la URL del PDF a abrir desde el response del backend.
   * Prioridad: solicitud_doc.file_url (gestion_documental) > external_url (Drive).
   * Fallback al campo legacy solicitud_traslado solo si todavía existe.
   */
  resolveSolicitudUrl(element: any): string | null {
    return (
      element?.solicitud_doc?.file_url ||
      element?.external_url ||
      element?.solicitud_traslado ||
      null
    );
  }

}
