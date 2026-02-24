import { ChangeDetectionStrategy, Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from './../../../../../../shared/models/advanced-table-interface';
import { DynamicFormDialogComponent } from '@/app/shared/components/dynamic-form-dialog/dynamic-form-dialog.component';
import { DocumentacionService } from '../../service/documentacion/documentacion.service';

type RetencionRow = {
  id?: number;
  name: string;
  retention_days: number;
  estado?: boolean;
};

type DynamicField = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'boolean' | 'password' | 'color' | 'file';
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: Array<string | { value: any; label: string }>;
  disabled?: boolean;
};

@Component({
  selector: 'app-retencion',
  standalone: true,
  imports: [StandardFilterTable, MatCardModule, MatIconModule, MatDialogModule, MatButtonModule],
  templateUrl: './retencion.component.html',
  styleUrl: './retencion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetencionComponent implements OnInit {
  tableTitle = 'Retención documental';

  columnDefinitions: ColumnDefinition[] = [
    { name: 'actions', header: 'Acciones', type: 'custom', stickyStart: true, width: '110px', filterable: false, sortable: false },
    { name: 'name', header: 'Tipo', type: 'text', width: '420px' },
    { name: 'retention_days', header: 'Días de retención', type: 'number', width: '170px' },
  ];

  data: RetencionRow[] = [];

  constructor(
    private dialog: MatDialog,
    private documentacionService: DocumentacionService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.documentacionService.mostrar_jerarquia_gestion_documental().subscribe({
      next: (response) => {
        // La respuesta es jerárquica, debemos aplanarla para la tabla
        this.data = this.flattenHierarchy(response);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error cargando tipos documentales:', err);
        Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
      }
    });
  }

  flattenHierarchy(nodes: any[]): RetencionRow[] {
    let result: RetencionRow[] = [];
    for (const node of nodes) {
      if (!node.subtypes || node.subtypes.length === 0) {
        result.push({
          id: node.id,
          name: node.name,
          retention_days: node.retention_days || 0,
          estado: node.estado
        });
      }

      if (node.subtypes && node.subtypes.length > 0) {
        result = result.concat(this.flattenHierarchy(node.subtypes));
      }
    }
    return result;
  }

  // =========================
  // EDIT
  // =========================
  async editar(row: RetencionRow): Promise<void> {
    if (!row.id) return;

    const fields: DynamicField[] = [
      { name: 'name', label: 'Tipo', type: 'text', required: true, disabled: true },
      { name: 'retention_days', label: 'Días de retención', type: 'number', required: true, min: 0 },
    ];

    const ref = this.dialog.open(DynamicFormDialogComponent, {
      width: 'min(760px, 96vw)',
      maxWidth: '96vw',
      autoFocus: false,
      restoreFocus: false,
      data: {
        title: 'Editar retención',
        subtitle: 'Actualiza los días de retención',
        icon: 'edit',
        fields,
        value: { ...row },
        mode: 'edit',
      },
    });

    const payload = await firstValueFrom(ref.afterClosed());
    if (!payload) return;

    const retention_days = Number(payload?.retention_days);
    if (!Number.isFinite(retention_days) || retention_days < 0) {
      Swal.fire('Días inválidos', 'retention_days debe ser un número >= 0.', 'warning');
      return;
    }

    // Payload para editar
    const apiPayload = {
      data: {
        retention_days: retention_days,
      }
    };

    this.documentacionService.editar_tipo_documento(row.id, apiPayload).subscribe({
      next: () => {
        Swal.fire('Actualizado', 'Cambios guardados.', 'success');
        this.loadData();
      },
      error: (err) => {
        console.error('Error actualizando:', err);
        Swal.fire('Error', 'No se pudo actualizar el registro.', 'error');
      }
    });
  }

  // =========================
  // DELETE
  // =========================
  async eliminar(row: RetencionRow): Promise<void> {
    const r = await Swal.fire({
      title: 'Deshabilitar',
      text: `¿Deseas deshabilitar el tipo documentale "${row.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, deshabilitar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });

    if (!r.isConfirmed || !row.id) return;

    const apiPayload = {
      data: {
        estado: false
      }
    };

    this.documentacionService.editar_tipo_documento(row.id, apiPayload).subscribe({
      next: () => {
        Swal.fire('Deshabilitado', 'El tipo documental ha sido deshabilitado.', 'success');
        this.loadData();
      },
      error: (err) => {
        console.error('Error eliminando:', err);
        Swal.fire('Error', 'No se pudo realizar la acción.', 'error');
      }
    });
  }
}
