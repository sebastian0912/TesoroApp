import { SharedModule } from '@/app/shared/shared.module';
import { Component, ElementRef, OnInit, ViewChild, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { VetadosService } from '../../service/vetados/vetados.service';
import { AutorizarVetadoComponent } from '../../components/autorizar-vetado/autorizar-vetado.component';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnCellTemplateDirective } from '@/app/shared/directives/column-cell-template.directive';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

type Vista = 'pendientes' | 'revisados';

/** Estados que significan "todavía sin resolver". Se comparan normalizados
 *  (sin tildes, minúsculas) porque el backend no expone un enum estable. */
const ESTADOS_PENDIENTES = new Set(['reportado', 'pendiente', 'por revisar', 'sin revisar']);

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-banned-management',
  imports: [
    SharedModule,
    StandardFilterTable,
    ColumnCellTemplateDirective,
  ],
  templateUrl: './banned-management.component.html',
  styleUrl: './banned-management.component.css'
})
export class BannedManagementComponent implements OnInit {

  @ViewChild('file901') file901!: ElementRef<HTMLInputElement>;

  // Signals: en zoneless una propiedad plana asignada dentro de un subscribe
  // no repinta la vista. Con signals la notificación es automática.
  readonly pendientes = signal<any[]>([]);
  readonly revisados = signal<any[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly subiendo = signal(false);
  readonly vista = signal<Vista>('pendientes');

  readonly totalPendientes = computed(() => this.pendientes().length);
  readonly totalRevisados = computed(() => this.revisados().length);

  /** Reportes 901 aún sin clasificar: es la cola de trabajo de esta pantalla. */
  readonly columnasPendientes: ColumnDefinition[] = [
    // La cédula es un identificador, no una cantidad: type 'number' le metería
    // separador de miles (1.098.765.432) y dejaría de ser buscable.
    { name: 'cedula', header: 'Cédula', type: 'text', width: '120px', align: 'left' },
    { name: 'nombre_completo', header: 'Nombre completo', type: 'text', width: '230px', align: 'left' },
    { name: 'centro_costo_carnet', header: 'Centro de costo', type: 'text', width: '150px', align: 'left' },
    { name: 'sede', header: 'Sede', type: 'text', width: '140px', align: 'left' },
    { name: 'fecha', header: 'Fecha', type: 'date', width: '140px', align: 'left' },
    { name: 'reportado_por', header: 'Reportado por', type: 'text', width: '190px', align: 'left' },
    { name: 'observacion', header: 'Observación', type: 'text', width: '260px', align: 'left' },
    { name: 'estado', header: 'Estado', type: 'text', width: '120px', align: 'left' },
    { name: 'actions', header: 'Acciones', type: 'custom', width: '110px', align: 'center', filterable: false, sortable: false },
  ];

  /** 901 ya clasificados con su categoría. Solo consulta: no se editan aquí. */
  readonly columnasRevisados: ColumnDefinition[] = [
    { name: 'cedula', header: 'Cédula', type: 'text', width: '120px', align: 'left' },
    { name: 'nombre_completo', header: 'Nombre completo', type: 'text', width: '230px', align: 'left' },
    { name: 'categoria_id', header: 'Categoría', type: 'text', width: '100px', align: 'center' },
    // Cabeceras invertidas en la versión anterior: 'clasificacion' se rotulaba
    // "Descripción" y viceversa.
    { name: 'categoria_clasificacion', header: 'Clasificación', type: 'text', width: '180px', align: 'left' },
    { name: 'categoria_descripcion', header: 'Descripción', type: 'text', width: '260px', align: 'left' },
    { name: 'fecha', header: 'Fecha', type: 'date', width: '140px', align: 'left' },
    { name: 'sede', header: 'Sede', type: 'text', width: '140px', align: 'left' },
    { name: 'reportado_por', header: 'Reportado por', type: 'text', width: '190px', align: 'left' },
    { name: 'autorizado_por', header: 'Autorizado por', type: 'text', width: '190px', align: 'left' },
    { name: 'observacion', header: 'Observación', type: 'text', width: '260px', align: 'left' },
    { name: 'estado', header: 'Estado', type: 'text', width: '120px', align: 'left' },
  ];

  constructor(
    private vetadosService: VetadosService,
    public dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.cargar();
  }

  setVista(v: Vista): void {
    this.vista.set(v);
  }

  cargar(): void {
    this.loading.set(true);
    this.vetadosService.listarReportesVetados()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data: any) => {
          this.pendientes.set(data?.reportados ?? []);
          this.revisados.set((data?.revisados ?? []).map((r: any) => this.aplanarRevisado(r)));
          this.loadError.set(false);
        },
        error: () => {
          this.loadError.set(true);
          // Con la tabla ya poblada el estado de error no se ve: hay que avisar.
          if (this.pendientes().length || this.revisados().length) {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudieron recargar los reportes 901.',
              confirmButtonText: 'Entendido',
            });
          }
        },
      });
  }

  /** La tabla compartida lee `row[col.name]` plano: sin aplanar, ni la categoría
   *  se pinta ni se puede filtrar u ordenar por ella. */
  private aplanarRevisado(r: any): any {
    return {
      ...r,
      categoria_id: r?.categoria?.id ?? '',
      categoria_clasificacion: r?.categoria?.clasificacion ?? '',
      categoria_descripcion: r?.categoria?.descripcion ?? '',
    };
  }

  /** Un 901 ya revisado que sigue en estado pendiente es la anomalía a marcar. */
  esEstadoPendiente(estado: any): boolean {
    const v = String(estado ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    return ESTADOS_PENDIENTES.has(v);
  }

  // ---------------------------------------------------------------- acciones

  verDetalle(element: any): void {
    const dialogRef = this.dialog.open(AutorizarVetadoComponent, {
      width: '850px',
      maxWidth: '95vw',
      data: { element }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (!result) return;

      Swal.fire({
        title: 'Guardando...',
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      (await this.vetadosService.actualizarReporte(element, result))
        .pipe(finalize(() => Swal.close()))
        .subscribe({
          next: () => {
            this.toastOk('Reporte clasificado');
            this.cargar();
          },
          error: (err: any) => {
            Swal.fire({
              icon: 'error',
              title: 'No se pudo clasificar el reporte',
              text: err?.error?.detail ?? 'Intenta nuevamente.',
              confirmButtonText: 'Cerrar',
            });
          },
        });
    });
  }

  async eliminar(element: any): Promise<void> {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar el reporte 901?',
      html: `Se eliminará el reporte de <b>${element?.nombre_completo ?? element?.cedula ?? 'este candidato'}</b>. Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonColor: '#b42318',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
    });

    if (!isConfirmed) return;

    // Sin await: el loader debe quedar abierto mientras corre la petición.
    Swal.fire({
      title: 'Eliminando...',
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    this.vetadosService.eliminarReporte(element.id)
      .pipe(finalize(() => Swal.close()))
      .subscribe({
        next: () => {
          this.toastOk('Reporte eliminado');
          this.cargar();
        },
        error: (err: any) => {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo eliminar el reporte',
            text: err?.error?.detail ?? 'Intenta nuevamente.',
            confirmButtonText: 'Cerrar',
          });
        },
      });
  }

  triggerUpload901(): void {
    this.file901?.nativeElement.click();
  }

  onFileSelected901(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset antes de salir: permite re-seleccionar el mismo archivo.
    input.value = '';
    if (!file) return;

    this.subirReporte901(file);
  }

  private subirReporte901(file: File): void {
    this.subiendo.set(true);
    Swal.fire({
      title: 'Subiendo 901...',
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    this.vetadosService.uploadReporte901(file)
      .pipe(finalize(() => {
        this.subiendo.set(false);
        Swal.close();
      }))
      .subscribe({
        next: (resp: any) => {
          Swal.fire({
            icon: 'success',
            title: 'Archivo procesado',
            text: resp?.message ?? resp?.detail ?? 'El reporte 901 se cargó correctamente.',
            confirmButtonText: 'Aceptar',
          });
          // La carga masiva crea reportes: sin recargar, la tabla queda mintiendo.
          this.cargar();
        },
        error: (err: any) => {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo subir el archivo',
            text: err?.error?.detail ?? 'Revisa el formato del archivo e intenta nuevamente.',
            confirmButtonText: 'Cerrar',
          });
        },
      });
  }

  private toastOk(title: string): void {
    Swal.fire({
      icon: 'success',
      title,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500,
      timerProgressBar: true,
    });
  }
}
