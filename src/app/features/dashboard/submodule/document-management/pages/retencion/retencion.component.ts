import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from './../../../../../../shared/models/advanced-table-interface';
import { DynamicFormDialogComponent } from '@/app/shared/components/dynamic-form-dialog/dynamic-form-dialog.component';

type RetencionRow = {
  name: string;
  retention_days: number;
};

// ✅ Estructura genérica de field para tu DynamicFormDialog (lo importante: que sea un array)
type DynamicField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'boolean' | 'password' | 'color' | 'file';
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  options?: Array<string | { value: any; label: string }>;
  readonly?: boolean;
};

@Component({
  selector: 'app-retencion',
  standalone: true,
  imports: [StandardFilterTable, MatCardModule, MatIconModule, MatDialogModule, MatButtonModule],
  templateUrl: './retencion.component.html',
  styleUrl: './retencion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetencionComponent {
  tableTitle = 'Retención documental';

  columnDefinitions: ColumnDefinition[] = [
    { name: 'actions', header: 'Acciones', type: 'custom', stickyStart: true, width: '110px', filterable: false, sortable: false },
    { name: 'name', header: 'Tipo', type: 'text', width: '420px' },
    { name: 'retention_days', header: 'Días de retención', type: 'number', width: '170px' },
  ];

  // ✅ JSON quemado (ajusta retention_days cuando lo conectes al backend)
  data: RetencionRow[] = [
    { name: 'DOC_USUARIA', retention_days: 365 },
    { name: 'ANTECEDENTES', retention_days: 365 },
    { name: 'PROCURADURIA', retention_days: 15 },
    { name: 'CONTRALORIA', retention_days: 15 },
    { name: 'OFAC', retention_days: 15 },
    { name: 'POLICIVOS', retention_days: 15 },
    { name: 'ADRES', retention_days: 15 },
    { name: 'SISBEN', retention_days: 15 },
    { name: 'FONDO_PENSION', retention_days: 15 },
    { name: 'MEDIDAS_CORRECTIVAS', retention_days: 15 },
    { name: 'AFP', retention_days: 15 },
    { name: 'RAMA_JUDICIAL', retention_days: 15 },
    { name: 'HOJA_DE_VIDA', retention_days: 365 },
    { name: 'REFERENCIA_PERSONAL', retention_days: 365 },
    { name: 'REFERENCIA_FAMILIAR', retention_days: 365 },
    { name: 'TRASLADOS', retention_days: 365 },
    { name: 'PRUEBAS_PSICOLOGICAS', retention_days: 365 },
    { name: 'PRUEBA_LECTRO_ESCRITURA', retention_days: 365 },
    { name: 'AUTHZ_CANDIDATO', retention_days: 365 },
    { name: 'PRUEBA_SST', retention_days: 365 },
    { name: 'CONTRATO', retention_days: 365 },
    { name: 'AUTORIZACION_TRATAMIENTOS_DE_DATOS', retention_days: 365 },
    { name: 'ENTREGA_DE_DOCUMENTOS', retention_days: 365 },
    { name: 'HOJA_DE_VIDA_M', retention_days: 365 },
    { name: 'CEDULA', retention_days: 365 },
    { name: 'ARL', retention_days: 365 },
    { name: 'FIGURA_HUMANA', retention_days: 365 },
    { name: 'EXAMENES_MEDICOS', retention_days: 365 },
    { name: 'SEMANAS_COTIZADAS', retention_days: 365 },
    { name: 'FICHA_TECNICA', retention_days: 365 },
    { name: 'UNION', retention_days: 365 },
    { name: 'EPS', retention_days: 365 },
    { name: 'CAJA', retention_days: 365 },
    { name: 'PAGO_SEGURIDAD_SOCIAL', retention_days: 365 },
    { name: 'PROCESOS_DISCIPLINARIOS', retention_days: 365 },
    { name: 'PRUEBAS_PSICOLOGICAS_ADMINTRATIVOS', retention_days: 365 },
    { name: 'VISITA_DOMICILIARIA', retention_days: 365 },
    { name: 'DOTACION', retention_days: 365 },
    { name: 'CARTA_AUMENTO_SALARIO', retention_days: 365 },
    { name: 'DISMINUCION_HORARIO', retention_days: 365 },
    { name: 'CARTA_ENTREGA_HERRAMIENTAS', retention_days: 365 },
    { name: 'MANEJO_IMAGEN', retention_days: 365 },
    { name: 'DOCUMENTOS_DE_INTERES_TU_ALIANZA', retention_days: 365 },
    { name: 'REGLAMENTO_INTERNO', retention_days: 365 },
    { name: 'CAJA_DE_COMPENSACIÓN_FAMILIAR', retention_days: 365 },
    { name: 'POLÍTICA_DE_TRATAMIENTO_DE_DATOS', retention_days: 365 },
    { name: 'POLÍTICA_DE_SAGRILAFT', retention_days: 365 },
    { name: 'SEGURIDAD_Y_SALUD_EN_EL_TRABAJO', retention_days: 365 },
    { name: 'SEGURIDAD_VIAL', retention_days: 365 },
    { name: 'PREVENCIÓN_COVID-19', retention_days: 365 },
    { name: 'INDUCCIÓN', retention_days: 365 },
    { name: 'POLITICAS_TU_ALIANZA', retention_days: 365 },
    { name: 'POLITICA_TRABAJO_FORZOSO', retention_days: 365 },
    { name: 'POLITICA_TRABAJO_INFANTIL', retention_days: 365 },
    { name: 'POLITICA_LIBRE_ELECCION', retention_days: 365 },
    { name: 'DECLARACION_DERECHOS_HUMANOS', retention_days: 365 },
    { name: 'LIBERTAD_DE_ASOCIACION', retention_days: 365 },
    { name: 'IGUALDAD_Y_NO_DISCRIMINACION', retention_days: 365 },
    { name: 'POLITICA_GESTION_HUMANA', retention_days: 365 },
    { name: 'DESCONEXION_LABORAL', retention_days: 365 },
    { name: 'CONTRATO_AUX', retention_days: 365 },
  ];

  constructor(private dialog: MatDialog) {}

  // =========================
  // CREATE
  // =========================
  async crear(): Promise<void> {
    const fields: DynamicField[] = [
      { key: 'name', label: 'Tipo', type: 'text', required: true, placeholder: 'Ej: DOC_USUARIA' },
      { key: 'retention_days', label: 'Días de retención', type: 'number', required: true, min: 0, placeholder: 'Ej: 365' },
    ];

    const ref = this.dialog.open(DynamicFormDialogComponent, {
      width: 'min(760px, 96vw)',
      maxWidth: '96vw',
      autoFocus: false,
      restoreFocus: false,
      data: {
        title: 'Crear retención',
        subtitle: 'Define el tipo y los días de retención',
        icon: 'add',
        // ✅ lo que te faltaba:
        fields,
        // ✅ por si tu dialog también usa formData:
        formData: { name: '', retention_days: 365 },
        readonlyFields: [],
        mode: 'create',
      },
    });

    const payload = await firstValueFrom(ref.afterClosed());
    if (!payload) return;

    const name = String(payload?.name ?? '').trim();
    const retention_days = Number(payload?.retention_days);

    if (!name) {
      Swal.fire('Falta el tipo', 'Debes indicar el tipo (name).', 'warning');
      return;
    }
    if (!Number.isFinite(retention_days) || retention_days < 0) {
      Swal.fire('Días inválidos', 'retention_days debe ser un número >= 0.', 'warning');
      return;
    }

    const exists = this.data.some((x) => x.name.trim().toUpperCase() === name.toUpperCase());
    if (exists) {
      Swal.fire('Duplicado', 'Ya existe un registro con ese tipo.', 'info');
      return;
    }

    this.data = [{ name, retention_days }, ...this.data];
    Swal.fire('Creado', 'Registro agregado.', 'success');
  }

  // =========================
  // EDIT
  // =========================
  async editar(row: RetencionRow): Promise<void> {
    const fields: DynamicField[] = [
      { key: 'name', label: 'Tipo', type: 'text', required: true, readonly: true },
      { key: 'retention_days', label: 'Días de retención', type: 'number', required: true, min: 0 },
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
        // ✅ lo que tu dialog necesita:
        fields,
        formData: { ...row },
        readonlyFields: ['name'],
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

    this.data = this.data.map((x) => (x.name === row.name ? { ...x, retention_days } : x));
    Swal.fire('Actualizado', 'Cambios guardados.', 'success');
  }

  // =========================
  // DELETE
  // =========================
  async eliminar(row: RetencionRow): Promise<void> {
    const r = await Swal.fire({
      title: 'Eliminar',
      text: `¿Seguro que deseas eliminar "${row.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });

    if (!r.isConfirmed) return;

    this.data = this.data.filter((x) => x.name !== row.name);
    Swal.fire('Eliminado', 'Registro eliminado.', 'success');
  }
}
