import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import Swal from 'sweetalert2';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { DynamicFormDialogComponent, FieldConfig } from '@/app/shared/components/dynamic-form-dialog/dynamic-form-dialog.component';
import { FarmsService } from '../../services/farms/farms.service';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

type AnyObj = Record<string, any>;

interface CentroCostoView {
  id: number;
  finca: string;
  ccostos: string;
  subcentro: string;
  categoria: string;
  operacion: string;
  sublabor: string;
  salario: number;
  auxilio: 'SI' | 'NO';
  ruta: 'SI' | 'NO';
  valor_transporte: number;
  empresa: string;
  centro_de_costo: string;
  ciudad: string;
  telefono_gestor: string;
  temporal: string;
}

@Component({
  selector: 'app-farms',
  standalone: true,
  imports: [
    MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule, StandardFilterTable, MatMenuModule
  ],
  templateUrl: './farms.component.html',
  styleUrls: ['./farms.component.css']
})
export class FarmsComponent implements OnInit {
  private svc = inject(FarmsService);
  private dialog = inject(MatDialog);

  @ViewChild('fileInp', { static: false }) fileInp!: ElementRef<HTMLInputElement>;

  // Data que se muestra en la tabla
  viewData: CentroCostoView[] = [];

  // Definición de columnas (elige las más útiles para la vista)
  columns: ColumnDefinition[] = [
    { name: 'finca', header: 'Finca', type: 'text', stickyStart: true },
    { name: 'ccostos', header: 'Ccostos', type: 'text' },
    { name: 'subcentro', header: 'Subcentro', type: 'text' },
    { name: 'categoria', header: 'Categoría', type: 'text' },
    { name: 'operacion', header: 'Operación', type: 'text' },
    { name: 'sublabor', header: 'Sublabor', type: 'text' },
    { name: 'salario', header: 'Salario', type: 'number', align: 'right' },
    { name: 'auxilio', header: 'Aux. Transp.', type: 'text' },
    { name: 'ruta', header: 'Ruta', type: 'text' },
    { name: 'valor_transporte', header: 'Val. Transporte', type: 'number', align: 'right' },
    { name: 'empresa', header: 'Empresa', type: 'text' },
    { name: 'centro_de_costo', header: 'Centro de costo', type: 'text' },
    { name: 'ciudad', header: 'Ciudad', type: 'text' },
    { name: 'telefono_gestor', header: 'Tel. Gestor', type: 'text' },
    { name: 'temporal', header: 'Temporal', type: 'text' },
    { name: 'actions', header: 'Acciones', type: 'custom', stickyEnd: true }
  ];

  ngOnInit(): void {
    this.cargar();
  }

  // ================== Cargar listado ==================
  cargar(search?: string): void {
    this.svc.list(search).subscribe({
      next: rows => this.viewData = (rows ?? []).map((it: AnyObj) => this.toView(it)),
      error: () => Swal.fire('Error', 'Error cargando centros de costo', 'error')
    });
  }


  // Backend -> ViewModel
  private toView(it: AnyObj): CentroCostoView {
    return {
      id: it['id'],
      finca: it['FINCA'] ?? '',
      ccostos: it['Ccostos'] ?? '',
      subcentro: it['Subcentro'] ?? '',
      categoria: it['Categoría'] ?? '',
      operacion: it['Operación'] ?? '',
      sublabor: it['Sublabor'] ?? '',
      salario: Number(it['Salario'] ?? 0),
      auxilio: (it['AUXILIO DE TRANSPORTE'] ?? 'NO') === 'SI' ? 'SI' : 'NO',
      ruta: (it['RUTA'] ?? 'NO') === 'SI' ? 'SI' : 'NO',
      valor_transporte: Number(it['Valor Transporte'] ?? 0),
      empresa: it['Empresa '] ?? '',
      centro_de_costo: it['Centro de costo'] ?? '',
      ciudad: it['Ciudad'] ?? '',
      telefono_gestor: it['Telefono de Contato Gestor'] ?? '',
      temporal: it['Temporal'] ?? ''
    };
  }

  // ViewModel -> payload "tal cual Excel"
  private toPayload(v: Partial<CentroCostoView>): AnyObj {
    return {
      'FINCA': v.finca ?? '',
      'Ccostos': v.ccostos ?? '',
      'Subcentro': v.subcentro ?? '',
      'Grupo': '', // opcional si no lo manejas en UI
      'Categoría': v.categoria ?? '',
      'Operación': v.operacion ?? '',
      'Sublabor': v.sublabor ?? '',
      'Salario': this.n(v.salario),
      'AUXILIO DE TRANSPORTE': (v.auxilio ?? 'NO'),
      'RUTA': (v.ruta ?? 'NO'),
      'Valor Transporte': this.n(v.valor_transporte),
      'Empresa ': v.empresa ?? '',
      'Centro de costo': v.centro_de_costo ?? '',
      'Dirección': '', // opcional
      'LINEA CONTRATO': '', // opcional
      'Indicaciones para Llegar': '', // opcional
      'Ciudad': v.ciudad ?? '',
      'Telefono de Contato Gestor': v.telefono_gestor ?? '',
      'Temporal': v.temporal ?? ''
    };
  }

  private n(x: any): number {
    if (x == null) return 0;
    const n = Number(String(x).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  // ================== Nuevo ==================
  nuevo(): void {
    const fields: FieldConfig[] = [
      { name: 'finca', label: 'Finca', type: 'text', required: true, maxLength: 200 },
      { name: 'ccostos', label: 'Ccostos', type: 'text', required: true, maxLength: 50 },
      { name: 'subcentro', label: 'Subcentro', type: 'text', required: true, maxLength: 80 },
      { name: 'categoria', label: 'Categoría', type: 'text', required: true, maxLength: 120 },
      { name: 'operacion', label: 'Operación', type: 'text', required: true, maxLength: 120 },
      { name: 'sublabor', label: 'Sublabor', type: 'textarea', required: true },
      {
        name: 'salario', label: 'Salario', type: 'number', required: true, min: 0,
        parse: (raw: any) => this.n(raw)
      },
      {
        name: 'auxilio', label: 'Auxilio de transporte', type: 'select', required: true,
        options: [{ label: 'SI', value: 'SI' }, { label: 'NO', value: 'NO' }],
      },
      {
        name: 'ruta', label: 'Ruta', type: 'select', required: true,
        options: [{ label: 'SI', value: 'SI' }, { label: 'NO', value: 'NO' }],
      },
      {
        name: 'valor_transporte', label: 'Valor transporte', type: 'number', required: true, min: 0,
        parse: (raw: any) => this.n(raw)
      },
      { name: 'empresa', label: 'Empresa', type: 'text', required: true, maxLength: 200 },
      { name: 'centro_de_costo', label: 'Centro de costo', type: 'text', required: true, maxLength: 200 },
      { name: 'ciudad', label: 'Ciudad', type: 'text', required: true, maxLength: 120 },
      { name: 'telefono_gestor', label: 'Teléfono Gestor', type: 'text', required: true, maxLength: 50 },
      { name: 'temporal', label: 'Temporal', type: 'text', required: true, maxLength: 120 }
    ];

    const ref = this.dialog.open(DynamicFormDialogComponent, {
      width: '720px',
      autoFocus: true,
      data: { title: 'Nuevo centro de costo', fields }
    });

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const payload = this.toPayload(result as Partial<CentroCostoView>);
      this.svc.create(payload).subscribe({
        next: () => {
          Swal.fire('Creado', 'Registro creado correctamente', 'success');
          this.cargar();
        },
        error: (err) => {
          Swal.fire('Error', err?.error?.detail || 'No se pudo crear', 'error');
        }
      });
    });
  }

  // ================== Editar (parcial) ==================
  editar(row: CentroCostoView): void {
    const fields: FieldConfig[] = [
      { name: 'finca', label: 'Finca', type: 'text', disabled: true },
      { name: 'ccostos', label: 'Ccostos', type: 'text', disabled: true },
      { name: 'subcentro', label: 'Subcentro', type: 'text', disabled: true },
      {
        name: 'salario', label: 'Salario', type: 'number', required: true, min: 0,
        parse: (raw: any) => this.n(raw)
      },
      {
        name: 'valor_transporte', label: 'Valor transporte', type: 'number', required: true, min: 0,
        parse: (raw: any) => this.n(raw)
      },
      {
        name: 'auxilio', label: 'Auxilio de transporte', type: 'select', required: true,
        options: [{ label: 'SI', value: 'SI' }, { label: 'NO', value: 'NO' }]
      },
      {
        name: 'ruta', label: 'Ruta', type: 'select', required: true,
        options: [{ label: 'SI', value: 'SI' }, { label: 'NO', value: 'NO' }]
      }
    ];

    const ref = this.dialog.open(DynamicFormDialogComponent, {
      width: '560px',
      autoFocus: false,
      data: { title: `Editar: ${row.finca} - ${row.ccostos}`, fields, value: row }
    });

    ref.afterClosed().subscribe(result => {
      if (!result) return;

      // Solo mandamos los campos editados en formato "tal cual Excel" (PATCH)
      const patch: AnyObj = {
        'Salario': this.n(result.salario),
        'Valor Transporte': this.n(result.valor_transporte),
        'AUXILIO DE TRANSPORTE': result.auxilio,
        'RUTA': result.ruta
      };

      this.svc.updatePartial(row.id, patch).subscribe({
        next: () => {
          Swal.fire('Actualizado', 'Registro actualizado', 'success');
          this.cargar();
        },
        error: () => {
          Swal.fire('Error', 'No se pudo actualizar', 'error');
        }
      });
    });
  }

  // ================== Eliminar ==================
  eliminar(row: CentroCostoView): void {
    Swal.fire({
      title: '¿Eliminar?',
      text: `Se eliminará el registro de "${row.finca}" (${row.ccostos}).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(res => {
      if (!res.isConfirmed) return;
      this.svc.remove(row.id).subscribe({
        next: () => {
          Swal.fire('Eliminado', 'Registro eliminado', 'success');
          this.cargar();
        },
        error: (e) => {
          Swal.fire('Error', e?.error?.detail || 'No se pudo eliminar', 'error');
        }
      });
    });
  }

  // ================== Importar / Exportar ==================
  triggerImport(): void {
    this.fileInp?.nativeElement?.click();
  }

  onImportFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.svc.uploadExcel(file).subscribe({
      next: (r) => {
        Swal.fire('Importado', `Carga masiva realizada (${r.insertados} insertados)`, 'success');
        this.cargar();
        input.value = '';
      },
      error: (err) => {
        Swal.fire('Error', err?.error?.error || 'Error de importación', 'error');
        input.value = '';
      }
    });
  }

  exportar(): void {
    this.svc.downloadExcelAndSave('centros_costos.xlsx').subscribe({
      next: () => Swal.fire('Descargado', 'Archivo generado', 'success'),
      error: () => Swal.fire('Error', 'No se pudo descargar el Excel', 'error')
    });
  }
}
