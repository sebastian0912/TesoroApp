import { TesoreriaService } from '@/app/features/dashboard/service/teroreria/tesoreria.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { SharedModule } from '@/app/shared/shared.module';
import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import Swal from 'sweetalert2';
import { MatTableDataSource } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { LoginService } from '@/app/features/auth/service/login.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-manage-workers',
  imports: [SharedModule, MatSlideToggleModule, MatPaginatorModule, MatSortModule],
  templateUrl: './manage-workers.component.html',
  styleUrl: './manage-workers.component.css'
})
export class ManageWorkersComponent implements OnInit {
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'bloqueado', 'fechaBloqueo', 'activo', 'saldoPendiente',
    'numero_de_documento', 'codigo', 'nombre', 'ingreso', 'temporal', 'finca',
    'salario', 'saldos', 'fondos', 'mercados', 'cuotasMercados',
    'prestamoParaDescontar', 'cuotasPrestamosParaDescontar', 'casino',
    'valoranchetas', 'cuotasAnchetas', 'fondo', 'carnet', 'seguroFunerario',
    'prestamoParaHacer', 'cuotasPrestamoParahacer', 'anticipoLiquidacion',
    'cuentas'
  ];
  // ViewChild para el paginator y sort
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  showInactive = false;
  numeroActivo = 0;

  constructor(
    private tesoreriaService: TesoreriaService,
    private utilityService: UtilityServiceService,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef // 🔹 Importar para forzar actualización de la vista

  ) { }

  ngOnInit(): void {
    this.getWorkers();

  }

  toggleShowInactive(event: any) {
    this.showInactive = event.checked; // 🔹 Captura el cambio del toggle
    this.tesoreriaService.actualizarEstadoQuincena(!this.showInactive).then(() => {
    });

    // Aquí podrías enviar este estado al backend si es necesario
  }

  ngAfterViewInit(): void {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }


  async getWorkers() {
    Swal.fire({
      title: 'Cargando',
      icon: 'info',
      text: 'Por favor, espera...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const response = await this.tesoreriaService.traerDatosbaseGeneral();

      if (response && Array.isArray(response)) {
        this.dataSource.data = response;
        // cuantos estan con activo

        this.numeroActivo = response.filter((worker: any) => worker.activo).length;
      } else {
        this.dataSource.data = [];
      }

      // Asignamos paginator y sort después de que dataSource tenga datos
      setTimeout(() => {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      });

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo obtener la información de los trabajadores.'
      });
    } finally {
      Swal.close();
    }
  }


  applyFilter(query: string): void {
    const q = (query ?? '').trim().toLowerCase();
    // tu lógica de filtrado aquí
     this.dataSource.filter = q;  // si usas MatTableDataSource
  }

  clearSearch(input: HTMLInputElement): void {
    input.value = '';
    this.applyFilter('');
  }


  async toggleEstado(worker: any, tipo: 'bloqueado' | 'activo'): Promise<void> {
    const nuevoEstado = !worker[tipo]; // Invertir el estado antes de enviarlo
    let observacion = '';

    // Solo pedir observación si se está BLOQUEANDO o DESBLOQUEANDO
    if (tipo === 'bloqueado') {
      const { value: comentario } = await Swal.fire({
        title: nuevoEstado ? 'Motivo del bloqueo' : 'Motivo del desbloqueo',
        input: 'textarea',
        inputPlaceholder: 'Escribe una observación...',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
          if (!value) {
            return 'Debes escribir una observación';
          }
          return null; // Evita el error de TypeScript
        }
      });

      if (comentario === undefined) {
        return; // Si el usuario cancela, no hacer nada
      }

      observacion = comentario;
    }

    const cambios: {
      bloqueado?: boolean;
      activo?: boolean;
      fechaBloqueo?: string | null;
      fechaDesbloqueo?: string | null;
      observacion_bloqueo?: string;
      observacion_desbloqueo?: string;
    } = {
      [tipo]: nuevoEstado,
    };

    // Si es un bloqueo, agregamos la fecha y la observación
    if (tipo === 'bloqueado') {
      if (nuevoEstado) {
        cambios.fechaBloqueo = new Date().toISOString();
        cambios.observacion_bloqueo = observacion; // Guardar observación del bloqueo
      } else {
        cambios.fechaBloqueo = null;
        cambios.fechaDesbloqueo = new Date().toISOString();
        cambios.observacion_desbloqueo = observacion; // Guardar observación del desbloqueo
      }
    }

    try {
      await this.tesoreriaService.actualizarEstado(worker.numero_de_documento, cambios);

      // Si la API responde correctamente, actualizar en la UI
      worker[tipo] = nuevoEstado;
      if (tipo === 'bloqueado') {
        worker.fechaBloqueo = cambios.fechaBloqueo;
        worker.fechaDesbloqueo = cambios.fechaDesbloqueo;
      }

      Swal.fire('Estado actualizado', `El estado de ${tipo} se ha actualizado correctamente`, 'success');
    } catch (error) {
      // Si hay error, revertir los cambios en la UI
      worker[tipo] = !nuevoEstado;
      if (tipo === 'bloqueado') {
        worker.fechaBloqueo = !nuevoEstado ? null : worker.fechaBloqueo;
        worker.fechaDesbloqueo = !nuevoEstado ? worker.fechaDesbloqueo : null;
      }

      Swal.fire('Error', `No se pudo actualizar el estado de ${tipo}`, 'error');
    }
  }



  resetearValores() {
    this.tesoreriaService.resetearValoresQuincena().then(() => {
      Swal.fire('Valores reseteados', 'Los valores de la quincena han sido reseteados correctamente.', 'success');
      this.getWorkers(); // Refrescar la lista de trabajadores
    }).catch(() => {
      Swal.fire('Error', 'Error al resetear los valores', 'error');
    });
  }

  traerDatosBase() {
    this.tesoreriaService.traerdatosbaseGeneral2()
      .then((datos) => {
        console.log('Datos base:', datos);

        if (!datos.length) {
          Swal.fire('Aviso', 'No se encontraron datos base.', 'info');
        }
      })
      .catch(() => {
        Swal.fire('Error', 'Error al extraer los datos base', 'error');
      });
  }

  private toNum(v: any) {
    if (v === null || v === undefined || v === '') return 0;
    // si ya es número, devuélvelo
    if (typeof v === 'number') return v;
    // si viene como string numérica ("0","12.5"), conviértela
    const n = Number(String(v).replace(/,/g, '.'));
    return isNaN(n) ? 0 : n;
  }

  generarExcelDatosBase() {
    // Loader
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

        // Orden y títulos EXACTOS pedidos
        const HEADERS = [
          'CODIGO', 'CEDULA', 'NOMBRE', 'INGRESO', 'TEMPORAL', 'FINCA', 'SALARIO',
          ' SALDOS  ', ' FONDO ', ' MERCADO ', ' CUOTAS ', ' PRESTAMO ', ' N. CUOTA ',
          ' CASINOS ', ' ANCHETAS ', ' CUOTAS ', ' FONDO ', ' CARNET ', ' SEGURO FUNERARIO ',
          ' PRESTAMOS  ', ' N° CUOTA ', ' Anticipo liq ', ' CUENTAS '
        ];

        // Mapeo de cada fila a las columnas, respetando duplicados
        const data = rows.map((r) => {
          const cedula = r?.numero_de_documento ?? '';
          const cedulaStr = typeof cedula === 'string' ? cedula : String(cedula);

          return {
            // Básicos
            'CODIGO': r?.codigo ?? '',
            'CEDULA': cedulaStr, // se fuerza tipo texto más abajo
            'NOMBRE': r?.nombre ?? '',
            'INGRESO': r?.ingreso ?? '',
            'TEMPORAL': r?.temporal ?? '',
            'FINCA': r?.finca ?? '',
            'SALARIO': toNum(r?.salario),

            // Saldos / Fondo (plural en el objeto)
            ' SALDOS  ': toNum(r?.saldos),
            ' FONDO ': toNum(r?.fondos),

            // Mercado + Cuotas (primera pareja de "CUOTAS")
            ' MERCADO ': toNum(r?.mercados),
            ' CUOTAS ': toNum(r?.cuotasMercados),

            // Préstamo para descontar + #cuota
            ' PRESTAMO ': toNum(r?.prestamoParaDescontar),
            ' N. CUOTA ': toNum(r?.cuotasPrestamosParaDescontar),

            // Casinos
            ' CASINOS ': toNum(r?.casino),

            // Anchetas + Cuotas (segunda aparición de "CUOTAS")
            ' ANCHETAS ': toNum(r?.valoranchetas),
            ' CUOTAS A ': toNum(r?.cuotasAnchetas),

            // Fondo (singular en el objeto)
            ' FONDO E': toNum(r?.fondo),

            // Otros
            ' CARNET ': toNum(r?.carnet),
            ' SEGURO FUNERARIO ': toNum(r?.seguroFunerario),

            // Préstamo para hacer + #cuota
            ' PRESTAMOS  ': toNum(r?.prestamoParaHacer),
            ' N° CUOTA ': toNum(r?.cuotasPrestamoParahacer),

            // Anticipo y cuentas
            ' Anticipo liq ': toNum(r?.anticipoLiquidacion),
            ' CUENTAS ': toNum(r?.cuentas),
          };
        });

        // Generar hoja con orden fijo
        const ws = XLSX.utils.json_to_sheet(data, { header: HEADERS });

        // Forzar columna CEDULA (B) como string para preservar "X..." y ceros
        if (ws['!ref']) {
          const range = XLSX.utils.decode_range(ws['!ref']);
          for (let R = range.s.r + 1; R <= range.e.r; R++) {
            const addr = XLSX.utils.encode_cell({ c: 1, r: R }); // B
            if (ws[addr]) ws[addr].t = 's';
          }
        }

        // Ancho de columnas (opcional)
        ws['!cols'] = [
          { wch: 12 }, // CODIGO
          { wch: 16 }, // CEDULA
          { wch: 28 }, // NOMBRE
          { wch: 12 }, // INGRESO
          { wch: 12 }, // TEMPORAL
          { wch: 16 }, // FINCA
          { wch: 12 }, // SALARIO
          { wch: 12 }, // SALDOS
          { wch: 10 }, // FONDO (fondos)
          { wch: 10 }, // MERCADO
          { wch: 10 }, // CUOTAS mercado
          { wch: 12 }, // PRESTAMO p/descontar
          { wch: 10 }, // N. CUOTA p/descontar
          { wch: 10 }, // CASINOS
          { wch: 12 }, // ANCHETAS
          { wch: 10 }, // CUOTAS anchetas
          { wch: 10 }, // FONDO (fondo)
          { wch: 10 }, // CARNET
          { wch: 16 }, // SEGURO FUNERARIO
          { wch: 12 }, // PRESTAMOS p/hacer
          { wch: 10 }, // N° CUOTA p/hacer
          { wch: 14 }, // Anticipo liq
          { wch: 12 }, // CUENTAS
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Datos base');

        const d = new Date();
        const fname = `datos_base_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.xlsx`;

        // Cierra el loader ANTES de descargar (mejor UX)
        Swal.close();

        XLSX.writeFile(wb, fname);

        // Toast de éxito
        Swal.fire({
          icon: 'success',
          title: 'Excel generado',
          text: 'El archivo se descargó correctamente.',
          timer: 1800,
          showConfirmButton: false,
        });
      })
      .catch(() => {
        // Error
        Swal.fire('Error', 'Error al extraer los datos base', 'error');
      });
  }



}
