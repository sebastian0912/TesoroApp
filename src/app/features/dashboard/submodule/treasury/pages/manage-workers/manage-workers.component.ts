import { SharedModule } from '@/app/shared/shared.module';
import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { MatTableDataSource } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import * as XLSX from 'xlsx';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { TesoreriaService } from '../../service/teroreria/tesoreria.service';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

@Component({
  selector: 'app-manage-workers',
  standalone: true,
  imports: [
    SharedModule,
    MatSlideToggleModule,
    StandardFilterTable
  ],
  templateUrl: './manage-workers.component.html',
  styleUrls: ['./manage-workers.component.css']
})
export class ManageWorkersComponent implements OnInit {
  /** Dataset que alimenta a la tabla dinámica */
  dataSource = new MatTableDataSource<any>([]);
  /** Copia completa para restaurar después de búsquedas */
  private allRows: any[] = [];

  /** Definición de columnas para StandardFilterTable */
columns: ColumnDefinition[] = [
  /** ======= Estados (sticky) ======= */
  { name: 'bloqueado',          header: 'Bloqueado',        type: 'custom', width: '12ch', stickyStart: true, filterable: false },
  { name: 'fechaBloqueo',       header: 'Fecha Bloqueo',    type: 'date',   width: '18ch'},
  { name: 'activo',             header: 'Activo',           type: 'custom', width: '12ch', stickyStart: true, filterable: false },

  /** ======= Identificación ======= */
  { name: 'codigo',             header: 'Código',           type: 'text',   width: '10ch' , filterable: false },
  { name: 'numero_de_documento',header: 'Número Documento', type: 'text',   width: '14ch' , stickyStart: true},
  { name: 'nombre',             header: 'Nombre',           type: 'text',   width: '26ch' },
  // Si "ingreso" llega como fecha ISO, cambia type:'date' y (opcional) aumenta a 14–16ch
  { name: 'ingreso',            header: 'Ingreso',          type: 'text',   width: '15ch' },
  { name: 'temporal',           header: 'Temporal',         type: 'text',   width: '20ch' },
  { name: 'finca',              header: 'Finca',            type: 'text',   width: '12ch' },

  /** ======= Números (alineados a la derecha automáticamente por type:'number') ======= */
  { name: 'salario',                    header: 'Salario',                 type: 'number', width: '12ch', filterable: false },
  { name: 'saldoPendiente',             header: 'Saldo Pendiente',         type: 'number', width: '14ch', filterable: false  },
  { name: 'saldos',                     header: 'Saldos',                  type: 'number', width: '12ch', filterable: false  },
  { name: 'fondos',                     header: 'Fondos',                  type: 'number', width: '12ch', filterable: false  },
  { name: 'mercados',                   header: 'Mercados',                type: 'number', width: '12ch', filterable: false  },
  { name: 'cuotasMercados',             header: 'Cuotas Mercados',         type: 'number', width: '12ch', filterable: false  },

  { name: 'prestamoParaDescontar',      header: 'Préstamo p/Descontar',    type: 'number', width: '16ch', filterable: false  },
  { name: 'cuotasPrestamosParaDescontar',header:'Cuotas Préstamo',         type: 'number', width: '12ch', filterable: false  },

  { name: 'casino',                     header: 'Casino',                  type: 'number', width: '10ch', filterable: false  },
  { name: 'valoranchetas',              header: 'Valor Anchetas',          type: 'number', width: '14ch', filterable: false  },
  { name: 'cuotasAnchetas',             header: 'Cuotas Anchetas',         type: 'number', width: '12ch', filterable: false  },

  { name: 'fondo',                      header: 'Fondo',                   type: 'number', width: '10ch', filterable: false  },
  { name: 'carnet',                     header: 'Carnet',                  type: 'number', width: '10ch', filterable: false  },
  { name: 'seguroFunerario',            header: 'Seguro Funerario',        type: 'number', width: '14ch', filterable: false  },

  { name: 'prestamoParaHacer',          header: 'Préstamo p/Hacer',        type: 'number', width: '14ch', filterable: false  },
  { name: 'cuotasPrestamoParahacer',    header: 'Cuotas p/Hacer',          type: 'number', width: '12ch', filterable: false  },

  { name: 'anticipoLiquidacion',        header: 'Anticipo Liquidación',    type: 'number', width: '16ch', filterable: false  },
  { name: 'cuentas',                     header: 'Cuentas',                type: 'number', width: '10ch', filterable: false  },
];


  showInactive = false;
  numeroActivo = 0;

  constructor(
    private tesoreriaService: TesoreriaService,
  ) { }

  ngOnInit(): void {
    this.getWorkers();
  }

  /** =================== Carga de datos =================== */
  async getWorkers() {
    Swal.fire({
      title: 'Cargando',
      icon: 'info',
      text: 'Por favor, espera...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const response = await this.tesoreriaService.traerDatosbaseGeneral();

      if (Array.isArray(response)) {
        this.allRows = response;
        this.dataSource.data = response;       // alimenta a la tabla dinámica
        this.numeroActivo = response.filter((w: any) => w.activo).length;
      } else {
        this.allRows = [];
        this.dataSource.data = [];
        this.numeroActivo = 0;
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo obtener la información de los trabajadores.',
      });
      this.allRows = [];
      this.dataSource.data = [];
      this.numeroActivo = 0;
    } finally {
      Swal.close();
    }
  }

  /** =================== Buscador rápido =================== */
  applyFilter(query: string): void {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) {
      this.dataSource.data = this.allRows;
      return;
    }

    // Filtra por cédula o código (puedes ampliar a nombre si quieres)
    this.dataSource.data = this.allRows.filter(r => {
      const cedula = (r?.numero_de_documento ?? '').toString().toLowerCase();
      const codigo = (r?.codigo ?? '').toString().toLowerCase();
      return cedula.includes(q) || codigo.includes(q);
    });
  }

  clearSearch(input: HTMLInputElement): void {
    input.value = '';
    this.applyFilter('');
  }

  /** =================== Lógica de switches =================== */
  async toggleEstado(worker: any, tipo: 'bloqueado' | 'activo'): Promise<void> {
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

    const cambios: {
      bloqueado?: boolean;
      activo?: boolean;
      fechaBloqueo?: string | null;
      fechaDesbloqueo?: string | null;
      observacion_bloqueo?: string;
      observacion_desbloqueo?: string;
    } = { [tipo]: nuevoEstado };

    if (tipo === 'bloqueado') {
      if (nuevoEstado) {
        cambios.fechaBloqueo = new Date().toISOString();
        cambios.observacion_bloqueo = observacion;
      } else {
        cambios.fechaBloqueo = null;
        cambios.fechaDesbloqueo = new Date().toISOString();
        cambios.observacion_desbloqueo = observacion;
      }
    }

    try {
      await this.tesoreriaService.actualizarEstado(worker.numero_de_documento, cambios);

      // UI inmediata
      worker[tipo] = nuevoEstado;
      if (tipo === 'bloqueado') {
        worker.fechaBloqueo = cambios.fechaBloqueo;
        (worker as any).fechaDesbloqueo = cambios.fechaDesbloqueo;
      }

      Swal.fire('Estado actualizado', `El estado de ${tipo} se ha actualizado correctamente`, 'success');
    } catch (error) {
      Swal.fire('Error', `No se pudo actualizar el estado de ${tipo}`, 'error');
    }
  }

  toggleShowInactive(event: any) {
    this.showInactive = event.checked;
    this.tesoreriaService.actualizarEstadoQuincena(!this.showInactive).then(() => { });
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

  traerDatosBase() {
    this.tesoreriaService.traerdatosbaseGeneral2()
      .then((datos) => {
        if (!datos.length) Swal.fire('Aviso', 'No se encontraron datos base.', 'info');
      })
      .catch(() => Swal.fire('Error', 'Error al extraer los datos base', 'error'));
  }

  private toNum(v: any) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    const n = Number(String(v).replace(/,/g, '.'));
    return isNaN(n) ? 0 : n;
  }

  generarExcelDatosBase() {
    Swal.fire({
      title: 'Generando Excel',
      text: 'Por favor, espera…',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    this.tesoreriaService
      .traerdatosbaseGeneral2()
      .then((rows: any[]) => {
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
          const cedula = r?.numero_de_documento ?? '';
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
            ' CUOTAS ': toNum(r?.cuotasMercados),

            ' PRESTAMO ': toNum(r?.prestamoParaDescontar),
            ' N. CUOTA ': toNum(r?.cuotasPrestamosParaDescontar),

            ' CASINOS ': toNum(r?.casino),

            ' ANCHETAS ': toNum(r?.valoranchetas),
            ' CUOTAS A ': toNum(r?.cuotasAnchetas),

            ' FONDO E': toNum(r?.fondo),

            ' CARNET ': toNum(r?.carnet),
            ' SEGURO FUNERARIO ': toNum(r?.seguroFunerario),

            ' PRESTAMOS  ': toNum(r?.prestamoParaHacer),
            ' N° CUOTA ': toNum(r?.cuotasPrestamoParahacer),

            ' Anticipo liq ': toNum(r?.anticipoLiquidacion),
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
      })
      .catch(() => Swal.fire('Error', 'Error al extraer los datos base', 'error'));
  }
}
