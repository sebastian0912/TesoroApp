
import { Component, OnInit, signal, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { TesoreriaService, PersonaTesoreriaItem } from '../../service/teroreria/tesoreria.service';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import { ColumnCellTemplateDirective } from '@/app/shared/directives/column-cell-template.directive';
import { EditWorkerDialogComponent } from './components/edit-worker-dialog/edit-worker-dialog.component';

// Use the service interface directly
export type Worker = PersonaTesoreriaItem;

@Component({
  selector: 'app-manage-workers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSlideToggleModule,
    MatMenuModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatFormFieldModule,
    StandardFilterTable,
    ColumnCellTemplateDirective,
  ],
  templateUrl: './manage-workers.component.html',
  styleUrls: ['./manage-workers.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManageWorkersComponent implements OnInit {
  private tesoreriaService = inject(TesoreriaService);
  private dialog = inject(MatDialog);

  // --- State Signals ---
  rows = signal<Worker[]>([]);
  loading = signal<boolean>(true);
  showInactive = signal(false);
  totalActivos = signal<number>(0);

  // Search State
  searchCedula = signal<string>('');

  // Computed metric
  numeroActivo = computed(() => this.totalActivos());

  /** Definición de columnas para StandardFilterTable */
  readonly columns: ColumnDefinition[] = [
    /** ======= Acciones ======= */
    { name: 'acciones', header: 'Acciones', type: 'custom', width: '8ch', stickyStart: true, filterable: false },

    /** ======= Estados (sticky) ======= */
    { name: 'bloqueado', header: 'Bloqueado', type: 'custom', width: '12ch', stickyStart: true, filterable: false },
    { name: 'fecha_bloqueo', header: 'Fecha Bloqueo', type: 'date', width: '18ch' },
    { name: 'activo', header: 'Activo', type: 'custom', width: '12ch', stickyStart: true, filterable: false },

    /** ======= Identificación ======= */
    { name: 'codigo', header: 'Código', type: 'text', width: '10ch', filterable: false },
    { name: 'numero_documento', header: 'Número Documento', type: 'text', width: '14ch', stickyStart: true },
    { name: 'nombre', header: 'Nombre', type: 'text', width: '26ch' },
    { name: 'ingreso', header: 'Ingreso', type: 'text', width: '15ch' },
    { name: 'temporal', header: 'Temporal', type: 'text', width: '20ch' },
    { name: 'finca', header: 'Finca', type: 'text', width: '12ch' },

    /** ======= Números ======= */
    { name: 'salario', header: 'Salario', type: 'number', width: '12ch', filterable: false },
    { name: 'saldo_pendiente', header: 'Saldo Pendiente', type: 'number', width: '14ch', filterable: false },
    { name: 'saldos', header: 'Saldos', type: 'number', width: '12ch', filterable: false },
    { name: 'fondos', header: 'Fondos', type: 'number', width: '12ch', filterable: false },
    { name: 'mercados', header: 'Mercados', type: 'number', width: '12ch', filterable: false },
    { name: 'cuotas_mercados', header: 'Cuotas Mercados', type: 'number', width: '12ch', filterable: false },

    { name: 'prestamo_para_descontar', header: 'Préstamo p/Descontar', type: 'number', width: '16ch', filterable: false },
    { name: 'cuotas_prestamos_para_descontar', header: 'Cuotas Préstamo', type: 'number', width: '12ch', filterable: false },

    { name: 'casino', header: 'Casino', type: 'number', width: '10ch', filterable: false },
    { name: 'valor_anchetas', header: 'Valor Anchetas', type: 'number', width: '14ch', filterable: false },
    { name: 'cuotas_anchetas', header: 'Cuotas Anchetas', type: 'number', width: '12ch', filterable: false },

    { name: 'fondo', header: 'Fondo', type: 'number', width: '10ch', filterable: false },
    { name: 'carnet', header: 'Carnet', type: 'number', width: '10ch', filterable: false },
    { name: 'seguro_funerario', header: 'Seguro Funerario', type: 'number', width: '14ch', filterable: false },

    { name: 'prestamo_para_hacer', header: 'Préstamo p/Hacer', type: 'number', width: '14ch', filterable: false },
    { name: 'cuotas_prestamo_para_hacer', header: 'Cuotas p/Hacer', type: 'number', width: '12ch', filterable: false },

    { name: 'anticipo_liquidacion', header: 'Anticipo Liquidación', type: 'number', width: '16ch', filterable: false },
    { name: 'cuentas', header: 'Cuentas', type: 'number', width: '10ch', filterable: false },
  ];

  ngOnInit(): void {
    this.getWorkers();
  }

  /** =================== Carga de datos =================== */
  async getWorkers() {
    this.loading.set(true);

    try {
      const response = await this.tesoreriaService.traerDatosbaseGeneral(1000, 0);

      if (response && Array.isArray(response.results)) {
        let info = response.results;

        // Filter out inactive if toggle is off
        if (!this.showInactive()) {
          info = info.filter(w => w.activo);
        }

        this.rows.set(info);
        this.totalActivos.set(response.results.filter(w => w.activo).length);
      } else {
        this.rows.set([]);
        this.totalActivos.set(0);
      }
    } catch (error) {
      this.mostrarErrorCarga();
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  /** =================== Buscar por Cédula =================== */
  async buscarPorCedula() {
    const cedula = this.searchCedula().trim();
    if (!cedula) {
      this.getWorkers();
      return;
    }

    this.loading.set(true);
    try {
      // Intenta usar el search endpoint para tolerar búsquedas parciales (opcional),
      // pero usar el endpoint exacto (por ID) es más rápido para consultas por cédula directa
      const worker = await this.tesoreriaService.traerDatosbasePorDocumento(cedula);
      if (worker) {
        this.rows.set([worker]); // Mostrar solo el encontrado
      } else {
        this.rows.set([]);
        Swal.fire({
          icon: 'info',
          title: 'No encontrado',
          text: `No se encontró ningún trabajador con el documento ${cedula}`,
          timer: 2000
        });
      }
    } catch (error) {
      this.mostrarErrorCarga();
    } finally {
      this.loading.set(false);
    }
  }

  limpiarBusqueda() {
    this.searchCedula.set('');
    this.getWorkers();
  }

  private mostrarErrorCarga() {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo obtener la información.',
    });
  }

  /** =================== Edicion =================== */
  openEditDialog(worker: Worker) {
    const dialogRef = this.dialog.open(EditWorkerDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: { worker }
    });

    dialogRef.afterClosed().subscribe(async (result: Worker | undefined) => {
      if (!result) return; // Cancelado

      this.loading.set(true);
      try {
        await this.tesoreriaService.actualizarDatosbaseCompleto(result.numero_documento, result);

        // Optimistic Update
        this.rows.update(current =>
          current.map(w => w.numero_documento === result.numero_documento ? result : w)
        );

        Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'El trabajador ha sido actualizado correctamente.',
          timer: 2000,
          showConfirmButton: false
        });

      } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo actualizar el trabajador. Verifique que todos los campos sean válidos.', 'error');
      } finally {
        this.loading.set(false);
      }
    });
  }

  /** =================== Lógica de switches =================== */
  async toggleEstado(worker: Worker, tipo: 'bloqueado' | 'activo'): Promise<void> {
    const nuevoEstado = !worker[tipo];
    let observacion = '';

    if (tipo === 'bloqueado') {
      const { value: comentario } = await Swal.fire({
        title: nuevoEstado ? 'Motivo del bloqueo' : 'Motivo del desbloqueo',
        input: 'textarea',
        inputPlaceholder: 'Escribe una observación...',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => (!value ? 'Debes escribir una observación' : null as any),
      });
      if (comentario === undefined) return;
      observacion = comentario;
    }

    const cambios: any = { [tipo]: nuevoEstado };

    if (tipo === 'bloqueado') {
      if (nuevoEstado) {
        cambios.fecha_bloqueo = new Date().toISOString();
        cambios.observacion_bloqueo = observacion || undefined;
      } else {
        cambios.fecha_bloqueo = null;
        cambios.fecha_desbloqueo = new Date().toISOString();
        cambios.observacion_desbloqueo = observacion || undefined;
      }
    }

    try {
      await this.tesoreriaService.actualizarEstado(String(worker.numero_documento), cambios);

      // Optimistic update via Signals
      this.rows.update(current =>
        current.map(w => {
          if (w.numero_documento === worker.numero_documento) {
            return { ...w, ...cambios };
          }
          return w;
        })
      );

      Swal.fire('Estado actualizado', `El estado de ${tipo} se ha actualizado correctamente`, 'success');
    } catch (error) {
      Swal.fire('Error', `No se pudo actualizar el estado de ${tipo}`, 'error');
    }
  }

  toggleShowInactive(event: any) {
    const isChecked = event.checked;
    this.showInactive.set(isChecked);
    this.getWorkers(); // Recargar aplicando el filtro
  }

  /** =================== Utilidades existentes =================== */
  resetearValores() {
    this.tesoreriaService.resetearValoresQuincena()
      .then(() => {
        Swal.fire('Valores reseteados', 'Los valores de la quincena han sido reseteados correctamente.', 'success');
        this.getWorkers();
      })
      .catch(() => Swal.fire('Error', 'Error al resetear los valores', 'error'));
  }

  async generarExcelDatosBase() {
    Swal.fire({
      title: 'Generando Excel',
      text: 'Por favor, espera…',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // Usar limit alto para traerlos todos a Excel
      const response = await this.tesoreriaService.traerDatosbaseGeneral(5000, 0);
      const rows = response.results || [];

      if (!Array.isArray(rows) || rows.length === 0) {
        Swal.fire('Aviso', 'No se encontraron datos base.', 'info');
        return;
      }

      const toNum = (v: any) => {
        const n = Number(String(v ?? '').toString().replace(/[, ]/g, ''));
        return Number.isFinite(n) ? n : 0;
      };

      const HEADERS = [
        'CODIGO', 'CEDULA', 'NOMBRE', 'INGRESO', 'TEMPORAL', 'FINCA', 'SALARIO',
        ' SALDOS  ', ' FONDO ', ' MERCADO ', ' CUOTAS ', ' PRESTAMO ', ' N. CUOTA ',
        ' CASINOS ', ' ANCHETAS ', ' CUOTAS ', ' FONDO ', ' CARNET ', ' SEGURO FUNERARIO ',
        ' PRESTAMOS  ', ' N° CUOTA ', ' Anticipo liq ', ' CUENTAS '
      ];

      const data = rows.map((r) => {
        const cedula = r?.numero_documento ?? '';
        const cedulaStr = typeof cedula === 'string' ? cedula : String(cedula);

        return {
          'CODIGO': r?.codigo ?? '',
          'CEDULA': cedulaStr,
          'NOMBRE': r?.nombre ?? '',
          'INGRESO': r?.ingreso ?? '',
          'TEMPORAL': r?.temporal ?? '',
          'FINCA': r?.finca ?? '',
          'SALARIO': toNum(r?.salario),
          ' SALDOS  ': toNum(r?.saldos),
          ' FONDO ': toNum(r?.fondos),
          ' MERCADO ': toNum(r?.mercados),
          ' CUOTAS ': toNum(r?.cuotas_mercados),
          ' PRESTAMO ': toNum(r?.prestamo_para_descontar),
          ' N. CUOTA ': toNum(r?.cuotas_prestamos_para_descontar),
          ' CASINOS ': toNum(r?.casino),
          ' ANCHETAS ': toNum(r?.valor_anchetas),
          ' CUOTAS A ': toNum(r?.cuotas_anchetas),
          ' FONDO E': toNum(r?.fondo),
          ' CARNET ': toNum(r?.carnet),
          ' SEGURO FUNERARIO ': toNum(r?.seguro_funerario),
          ' PRESTAMOS  ': toNum(r?.prestamo_para_hacer),
          ' N° CUOTA ': toNum(r?.cuotas_prestamo_para_hacer),
          ' Anticipo liq ': toNum(r?.anticipo_liquidacion),
          ' CUENTAS ': toNum(r?.cuentas),
        };
      });

      const ws = XLSX.utils.json_to_sheet(data, { header: HEADERS });

      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; R++) {
          const addr = XLSX.utils.encode_cell({ c: 1, r: R }); // B
          if (ws[addr]) ws[addr].t = 's';
        }
      }

      ws['!cols'] = [
        { wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Datos base');

      const d = new Date();
      const fname = `datos_base_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.xlsx`;

      Swal.close();
      XLSX.writeFile(wb, fname);

      Swal.fire({
        icon: 'success',
        title: 'Excel generado',
        text: 'El archivo se descargó correctamente.',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire('Error', 'Error al extraer los datos base', 'error');
    }
  }
}
