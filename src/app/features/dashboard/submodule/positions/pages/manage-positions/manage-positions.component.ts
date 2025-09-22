import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import Swal from 'sweetalert2';

import { StandardFilterTable, ColumnDefinition } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { PositionsService, Cargo } from '../../services/positions/positions.service';
import { DynamicFormDialogComponent, FieldConfig } from '@/app/shared/components/dynamic-form-dialog/dynamic-form-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-manage-positions',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule, StandardFilterTable, MatMenuModule],
  templateUrl: './manage-positions.component.html',
  styleUrls: ['./manage-positions.component.css']
})
export class ManagePositionsComponent implements OnInit {
  private svc = inject(PositionsService);
  private dialog = inject(MatDialog);
  @ViewChild('fileInp', { static: false }) fileInp!: ElementRef<HTMLInputElement>;

  viewData: Cargo[] = [];

  columns: ColumnDefinition[] = [
    { name: 'nombre', header: 'Nombre', type: 'text', stickyStart: true },
    { name: 'porcentaje_arl', header: 'Porcentaje ARL', type: 'number', align: 'right' },
    { name: 'actions', header: 'Acciones', type: 'custom', stickyEnd: true }
  ];

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.svc.list().subscribe({
      next: rows => this.viewData = rows || [],
      error: () => alert('Error cargando cargos') // si quieres, cámbialo por un toast propio
    });
  }

  // ---------- Nuevo ----------
  nuevo(): void {
    const fields: FieldConfig[] = [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true, maxLength: 150, hint: 'Máx. 150 caracteres' },
      {
        name: 'porcentaje_arl', label: 'ARL (0–100)', type: 'number',
        required: true, min: 0, max: 100, inputMode: 'decimal', suffix: '%',
        hint: 'Puedes usar coma o punto como separador',
        parse: (raw: any) => {
          if (raw == null) return null;
          const n = Number(String(raw).replace(',', '.'));
          return Number.isFinite(n) ? n : raw;
        }
      }
    ];

    const ref = this.dialog.open(DynamicFormDialogComponent, {
      width: '480px',
      autoFocus: true,
      data: { title: 'Nuevo cargo', fields }
    });

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const body: Cargo = { nombre: result.nombre, porcentaje_arl: result.porcentaje_arl };
      this.svc.create(body).subscribe({
        next: () => this.cargar(),
        error: (err) => alert(err?.error?.detail || 'No se pudo crear')
      });
    });
  }

  // ---------- Editar ----------
  editar(row: Cargo): void {
    const fields: FieldConfig[] = [
      { name: 'nombre', label: 'Nombre (no editable)', type: 'text', disabled: true },
      {
        name: 'porcentaje_arl', label: 'ARL (0–100)', type: 'number',
        required: true, min: 0, max: 100, inputMode: 'decimal', suffix: '%',
        parse: (raw: any) => {
          const n = Number(String(raw).replace(',', '.'));
          return Number.isFinite(n) ? n : raw;
        }
      }
    ];

    const ref = this.dialog.open(DynamicFormDialogComponent, {
      width: '480px',
      autoFocus: false,
      data: {
        title: `Editar: ${row.nombre}`,
        fields,
        value: { nombre: row.nombre, porcentaje_arl: row.porcentaje_arl }
      }
    });

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.svc.patch(row.nombre, { porcentaje_arl: result.porcentaje_arl }).subscribe({
        next: () => this.cargar(),
        error: () => alert('No se pudo actualizar')
      });
    });
  }

  // ---------- Eliminar / Importar / Exportar (sin cambios) ----------
  eliminar(row: Cargo) {
    if (!confirm(`¿Eliminar "${row.nombre}"?`)) return;
    this.svc.remove(row.nombre).subscribe({
      next: () => this.cargar(),
      error: (e) => alert(e?.error?.detail || 'No se pudo eliminar')
    });
  }

  triggerImport(): void { this.fileInp?.nativeElement?.click(); }
  onImportFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    this.svc.importExcel(file).subscribe({
      next: () => { this.cargar(); input.value = ''; },
      error: () => { alert('Error de importación'); input.value = ''; }
    });
  }
  exportar(): void { this.svc.downloadExcel(); }
}
