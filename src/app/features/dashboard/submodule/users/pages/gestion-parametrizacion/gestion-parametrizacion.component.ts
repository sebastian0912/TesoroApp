// src/app/features/parametrizacion/components/gestion-parametrizacion/gestion-parametrizacion.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { StandardFilterTable,  } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { SharedModule } from '@/app/shared/shared.module';
import { DynamicFormDialogComponent, FieldConfig } from '@/app/shared/components/dynamic-form-dialog/dynamic-form-dialog.component';
import { MetaConfigDialogComponent } from '../../components/meta-config-dialog/meta-config-dialog.component';
import { GestionParametrizacionService, MetaTabla } from '../../services/gestion-parametrizacion/gestion-parametrizacion.service';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

@Component({
  selector: 'app-gestion-parametrizacion',
  standalone: true,
  imports: [
    SharedModule, CommonModule, StandardFilterTable, MatSnackBarModule,
    MatDialogModule, MatIconModule, MatButtonModule
  ],
  templateUrl: './gestion-parametrizacion.component.html',
  styleUrls: ['./gestion-parametrizacion.component.css'] // ✅ styleUrls (plural)
})
export class GestionParametrizacionComponent implements OnInit {
  private svc = inject(GestionParametrizacionService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  data = signal<MetaTabla[]>([]);

  // Columnas (incluye 'actions' para botones Campos/Valores)
  columns: ColumnDefinition[] = [
    { name: 'actions', header: 'Acciones', type: 'custom', stickyStart: true, width: '136px', filterable: false },
    { name: 'codigo', header: 'Código', type: 'text', filterable: true, stickyStart: true },
    { name: 'descripcion', header: 'Descripción', type: 'text', filterable: true, width: '40%' },
    {
      name: 'activo',
      header: 'Activo',
      type: 'status',
      statusConfig: {
        true: { color: '#0b8043', background: '#e6f4ea' },
        false: { color: '#a50e0e', background: '#fce8e6' },
      },
    },
    { name: 'updated_at', header: 'Actualizado', type: 'date' },
  ];

  pageSizeOptions = [10, 20, 50];
  defaultPageSize = 10;

  ngOnInit(): void {
    this.cargarTablas();
  }

  cargarTablas(): void {
    this.svc.listMetaTablas().subscribe({
      next: res => this.data.set(res || []),
      error: () => this.snack.open('No se pudieron cargar las MetaTablas', 'Cerrar', { duration: 3500 }),
    });
  }

  // === Crear ===
  onNuevaTabla(): void {
    const fields = this.buildTablaFields(false);
    const ref = this.dialog.open(DynamicFormDialogComponent, {
      width: '50vw',
      data: { title: 'Nueva MetaTabla', submitText: 'Crear', fields }
    });

    ref.afterClosed().subscribe((formValue: any) => {
      if (!formValue) return;
      this.svc.createMetaTabla(formValue).subscribe({
        next: () => { this.snack.open('Tabla creada', 'OK', { duration: 2500 }); this.cargarTablas(); },
        error: () => this.snack.open('No se pudo crear la tabla', 'Cerrar', { duration: 3500 })
      });
    });
  }

  // === Editar (click de fila) ===
  onEditarTabla(tabla: MetaTabla): void {
    const fields = this.buildTablaFields(true);
    const ref = this.dialog.open(DynamicFormDialogComponent, {
      width: '50vw',
      data: {
        title: `Editar: ${tabla.codigo}`,
        submitText: 'Guardar',
        fields,
        value: {
          codigo: tabla.codigo,
          descripcion: tabla.descripcion ?? '',
          activo: tabla.activo,
        }
      }
    });

    ref.afterClosed().subscribe((formValue: any) => {
      if (!formValue) return;
      this.svc.updateMetaTabla(tabla.codigo, {
        descripcion: formValue.descripcion,
        activo: formValue.activo,
      }).subscribe({
        next: () => { this.snack.open('Tabla actualizada', 'OK', { duration: 2500 }); this.cargarTablas(); },
        error: () => this.snack.open('No se pudo actualizar la tabla', 'Cerrar', { duration: 3500 })
      });
    });
  }

  /**
   * Recibe el click de fila desde <app-standard-filter-table>.
   * Si el hijo emitió la fila, edita de una; si no, intenta extraerla.
   */
  onRowClick(evt: any): void {
    // Caso típico: la fila directamente
    if (this.isMetaTabla(evt)) {
      this.onEditarTabla(evt);
      return;
    }
    // CustomEvent con detail
    const detail = evt?.detail;
    if (detail && this.isMetaTabla(detail)) {
      this.onEditarTabla(detail);
      return;
    }
    // {row}|{data}|{item}
    const candidate = evt?.row ?? evt?.data ?? evt?.item ?? null;
    if (candidate && this.isMetaTabla(candidate)) {
      this.onEditarTabla(candidate);
      return;
    }
    // Índice
    const idx = typeof evt?.index === 'number' ? evt.index : undefined;
    if (typeof idx === 'number') {
      const arr = this.data();
      if (arr[idx]) this.onEditarTabla(arr[idx]);
    }
  }

  private isMetaTabla(x: any): x is MetaTabla {
    return !!x && typeof x === 'object'
      && typeof x.codigo === 'string'
      && 'allow_extra_fields' in x
      && 'activo' in x;
  }

  private buildTablaFields(isEdit: boolean): FieldConfig[] {
    return [
      {
        name: 'codigo',
        label: 'Código',
        type: 'text',
        required: true,
        maxLength: 64,
        placeholder: 'p.ej. AFILIADO',
        disabled: isEdit,
        pattern: /^[A-Z0-9_.-]{2,64}$/
      },
      {
        name: 'descripcion',
        label: 'Descripción',
        type: 'textarea',
        maxLength: 1000
      },
      {
        name: 'activo',
        label: 'Activo',
        type: 'checkbox'
      }
    ];
  }

  descargarExcelServidor(): void {
    this.svc.descargarExcel('/descargar/meta_tablas.xlsx').subscribe({
      next: blob => this.svc.saveBlobAs('meta_tablas.xlsx', blob),
      error: () => this.snack.open('Error descargando Excel', 'Cerrar', { duration: 3000 }),
    });
  }

  descargarZipServidor(): void {
    this.svc.descargarZip('/descargar/meta_tablas.zip').subscribe({
      next: blob => this.svc.saveBlobAs('meta_tablas.zip', blob),
      error: () => this.snack.open('Error descargando ZIP', 'Cerrar', { duration: 3000 }),
    });
  }

  /** ===== Diálogo de Config (Campos / Valores) desde acciones ===== */
  openMetaConfig(row: MetaTabla, mode: 'campos' | 'valores') {
    const ref = this.dialog.open(MetaConfigDialogComponent, {
      minWidth: '70vw',
      data: { mode, tabla: row }   // ← pasa el objeto completo, más robusto
    });

    ref.afterClosed().subscribe(out => {
      if (out?.refresh) this.cargarTablas();
    });
  }




}
