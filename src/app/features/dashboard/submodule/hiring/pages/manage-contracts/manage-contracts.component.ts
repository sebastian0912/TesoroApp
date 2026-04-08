import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../../../environments/environment';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';

interface ActivoRow {
  numero_documento: string;
  nombres: string;
  apellidos: string;
  oficina: string;
  codigo_contrato: string;
  centro_costos: string;
  fecha_ingreso: string;
}

@Component({
  selector: 'app-manage-contracts',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatButtonModule, 
    MatIconModule, 
    MatTableModule, 
    MatCheckboxModule, 
    MatProgressSpinnerModule,
    MatInputModule,
    FormsModule,
    DatePipe
  ],
  templateUrl: './manage-contracts.component.html',
  styleUrls: ['./manage-contracts.component.css']
})
export class ManageContractsComponent implements OnInit {
  private http = inject(HttpClient);
  private registroProceso = inject(RegistroProcesoContratacion);
  
  loading = signal<boolean>(true);
  dataSource = signal<ActivoRow[]>([]);
  displayedColumns: string[] = ['select', 'numero_documento', 'nombres', 'oficina', 'centro_costos', 'fecha_ingreso'];
  selection = new SelectionModel<ActivoRow>(true, []);
  
  filterText = signal<string>('');

  ngOnInit() {
    this.cargarContratosActivos();
  }

  async cargarContratosActivos() {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.http.get<{ok: boolean, data: ActivoRow[]}>(`${environment.apiUrl}/gestion_contratacion/contratacion/activos/`));
      this.dataSource.set(res.data);
    } catch(err) {
      console.error(err);
      Swal.fire('Error', 'No se pudieron cargar los contratos activos', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.filteredData().length;
    return numSelected === numRows && numRows > 0;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.filteredData());
  }

  filteredData() {
    const f = this.filterText().toLowerCase();
    return this.dataSource().filter(x => 
      x.numero_documento.includes(f) || 
      x.nombres.toLowerCase().includes(f) || 
      x.apellidos.toLowerCase().includes(f) ||
      x.oficina?.toLowerCase().includes(f) ||
      x.centro_costos?.toLowerCase().includes(f)
    );
  }

  async darBajaMasiva() {
    if (this.selection.selected.length === 0) {
      Swal.fire('Aviso', 'Seleccione al menos un contrato para dar de baja', 'info');
      return;
    }

    const { value: formValues } = await Swal.fire({
      title: 'Baja Masiva de Contratos',
      html: `
        <div style="text-align: left; margin-bottom: 8px;">
          <label>Candidatos seleccionados: <b>${this.selection.selected.length}</b></label>
        </div>
        <div style="text-align: left; margin-bottom: 8px;">
          <label>Fecha de Retiro General:</label>
          <input type="date" id="swal-fecha-baja-masiva" class="swal2-input" value="${new Date().toISOString().split('T')[0]}">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Confirmar Bajas',
      confirmButtonColor: '#d33',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const d = (document.getElementById('swal-fecha-baja-masiva') as HTMLInputElement).value;
        if (!d) Swal.showValidationMessage('La fecha es obligatoria');
        return d;
      }
    });

    if (formValues) {
      Swal.fire({ title: 'Procesando Bajas...', html: 'No cierre esta ventana.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      
      const errores: string[] = [];
      let exitosos = 0;

      // Executing in chunks/sequential or parallel (Promise.allSettled)
      const requests = this.selection.selected.map(cand => {
        const payload = {
          numero_documento: cand.numero_documento,
          contrato_detalle: {
            contrato_activo: false,
            fecha_retiro: formValues
          }
        };
        // Using Promise to capture individual errors
        return firstValueFrom(this.registroProceso.updateProcesoByDocumento(payload as any))
          .then(() => { exitosos++; })
          .catch(() => { errores.push(cand.numero_documento); });
      });

      await Promise.allSettled(requests);

      if (errores.length === 0) {
        Swal.fire('¡Proceso completado!', `Se dieron de baja ${exitosos} contratos exitosamente.`, 'success');
      } else {
        Swal.fire('Advertencia', `Se dieron de baja ${exitosos} contratos, pero hubo error en ${errores.length} registros (${errores.join(', ')}).`, 'warning');
      }
      
      this.selection.clear();
      this.cargarContratosActivos();
    }
  }
}
