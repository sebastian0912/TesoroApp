import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnCellTemplateDirective } from '@/app/shared/directives/column-cell-template.directive';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import {
  DynamicFormDialogComponent,
  DynamicDialogData,
  FieldConfig,
} from '@/app/shared/components/dynamic-form-dialog/dynamic-form-dialog.component';
import { TarjetasService, Tarjeta, ImportResult } from '../../service/tarjetas.service';
import Swal from 'sweetalert2';

/** El atributo `accept` solo filtra el diálogo del sistema: al arrastrar no valida nada. */
const EXTENSIONES_VALIDAS = ['.xls', '.xlsx'];

@Component({
  selector: 'app-tarjetas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressBarModule,
    MatTooltipModule,
    StandardFilterTable,
    // Sin esta directiva el <ng-template> de la columna "actions" no lo recoge
    // nadie y la celda sale vacía (era el bug: no había Editar ni Eliminar).
    ColumnCellTemplateDirective,
  ],
  templateUrl: './tarjetas.component.html',
  styleUrls: ['./tarjetas.component.css'],
})
export class TarjetasComponent implements OnInit {
  private readonly tarjetasService = inject(TarjetasService);
  private readonly dialog = inject(MatDialog);

  readonly columns: ColumnDefinition[] = [
    { name: 'identification_number', header: 'Número de identificación', type: 'text', sortable: true, filterable: true },
    { name: 'card_number', header: 'Número de tarjeta', type: 'text', sortable: true, filterable: true },
    { name: 'created_at', header: 'Fecha de creación', type: 'date', sortable: true, filterable: true },
    { name: 'actions', header: 'Acciones', type: 'custom', filterable: false, sortable: false, stickyEnd: true, width: '104px', align: 'center' },
  ];

  /* Estado en signals a propósito. Con zoneless, una propiedad plana asignada
     dentro de un subscribe o de un .then() de Swal no repinta la vista: el dato
     llega y la pantalla se queda congelada. Con signals el repintado no depende
     de acordarse de llamar a markForCheck en cada rama (next/error/then). */
  readonly data = signal<Tarjeta[]>([]);
  readonly isLoading = signal(false);
  readonly isUploading = signal(false);
  readonly isDragging = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly importResult = signal<ImportResult | null>(null);

  readonly importErrors = computed(() => this.importResult()?.errors ?? []);

  readonly selectedFileSize = computed(() => {
    const file = this.selectedFile();
    if (!file) return '';
    const kb = file.size / 1024;
    return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.tarjetasService.list().subscribe({
      next: (res) => {
        this.data.set(Array.isArray(res) ? res : res?.results ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.data.set([]);
        this.isLoading.set(false);
        Swal.fire('Error', 'No se pudieron cargar las tarjetas.', 'error');
      },
    });
  }

  // ── Carga masiva ────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(input.files?.[0] ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    // Sin preventDefault el navegador abre el archivo soltado y se sale de la app.
    event.preventDefault();
    this.isDragging.set(false);
    // En un drop los archivos viven en dataTransfer, no en target.files.
    this.setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  private setFile(file: File | null): void {
    if (!file) return;

    const nombre = file.name.toLowerCase();
    if (!EXTENSIONES_VALIDAS.some((ext) => nombre.endsWith(ext))) {
      Swal.fire('Archivo no válido', 'Selecciona un archivo de Excel (.xls o .xlsx).', 'warning');
      return;
    }

    this.selectedFile.set(file);
    this.importResult.set(null);
  }

  clearFile(input: HTMLInputElement): void {
    this.selectedFile.set(null);
    this.resetInput(input);
  }

  dismissResult(): void {
    this.importResult.set(null);
  }

  onImport(input: HTMLInputElement): void {
    const file = this.selectedFile();
    if (!file || this.isUploading()) return;

    Swal.fire({
      title: '¿Importar archivo?',
      text: `Se procesará "${file.name}".`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, importar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) this.executeImport(file, input);
    });
  }

  private executeImport(file: File, input: HTMLInputElement): void {
    this.isUploading.set(true);

    this.tarjetasService.importExcel(file).subscribe({
      next: (res) => {
        this.isUploading.set(false);
        this.importResult.set(res);
        this.selectedFile.set(null);
        this.resetInput(input);
        this.loadData();
        Swal.fire(
          'Importación completada',
          `Creadas: ${res.created} · Actualizadas: ${res.updated}`,
          'success',
        );
      },
      error: (err) => {
        this.isUploading.set(false);
        console.error(err);
        Swal.fire('Error', 'Hubo un problema al importar el archivo.', 'error');
      },
    });
  }

  /** El input conserva su value: sin resetearlo, volver a elegir el MISMO
   *  archivo no dispara (change) y parece que la app se colgó. */
  private resetInput(input: HTMLInputElement): void {
    input.value = '';
  }

  // ── CRUD ────────────────────────────────────────────────────

  private get formFields(): FieldConfig[] {
    return [
      { name: 'identification_number', label: 'Número de identificación', type: 'text', required: true },
      { name: 'card_number', label: 'Número de tarjeta', type: 'text', required: true },
    ];
  }

  onCreate(): void {
    const dialogRef = this.dialog.open(DynamicFormDialogComponent, {
      data: { title: 'Crear tarjeta', fields: this.formFields } as DynamicDialogData,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      this.isLoading.set(true);
      this.tarjetasService.create(result).subscribe({
        next: () => {
          this.toast('Tarjeta creada');
          this.loadData();
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error(err);
          Swal.fire('Error', 'No se pudo crear la tarjeta. Verifica si el número ya existe.', 'error');
        },
      });
    });
  }

  onEdit(row: Tarjeta): void {
    const dialogRef = this.dialog.open(DynamicFormDialogComponent, {
      data: { title: 'Editar tarjeta', fields: this.formFields, value: row } as DynamicDialogData,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      this.isLoading.set(true);
      this.tarjetasService.update(row.id, result).subscribe({
        next: () => {
          this.toast('Tarjeta actualizada');
          this.loadData();
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error(err);
          Swal.fire('Error', 'No se pudo actualizar la tarjeta.', 'error');
        },
      });
    });
  }

  onDelete(row: Tarjeta): void {
    Swal.fire({
      title: '¿Eliminar tarjeta?',
      text: `Se eliminará la tarjeta ${row.card_number}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b42318',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.isLoading.set(true);
      this.tarjetasService.delete(row.id).subscribe({
        next: () => {
          this.toast('Tarjeta eliminada');
          this.loadData();
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error(err);
          Swal.fire('Error', 'No se pudo eliminar la tarjeta.', 'error');
        },
      });
    });
  }

  private toast(title: string): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title,
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true,
    });
  }
}
