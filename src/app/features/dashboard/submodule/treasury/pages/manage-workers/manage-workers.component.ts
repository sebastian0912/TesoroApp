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
  constructor(
    private tesoreriaService: TesoreriaService,
    private utilityService: UtilityServiceService,
    private loginService: LoginService,
    private cdr: ChangeDetectorRef // 🔹 Importar para forzar actualización de la vista

  ) { }

  ngOnInit(): void {
    this.getWorkers();

    this.loginService.getUser().then((user) => {
      if (!user) {
        return;
      }
      this.showInactive = user.estadoquincena;
      // Forzar actualización de la vista para reflejar el estado en el toggle
      this.cdr.detectChanges();
    });
  }

  toggleShowInactive(event: any) {
    this.showInactive = event.checked; // 🔹 Captura el cambio del toggle
    this.tesoreriaService.actualizarEstadoQuincena(this.showInactive).then(() => {
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


  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value.trim();

    this.dataSource.filterPredicate = (data: any, filter: string) => {
      return (
        data.numero_de_documento.toLowerCase() === filter.toLowerCase() ||
        data.codigo.toLowerCase() === filter.toLowerCase()
      );
    };

    this.dataSource.filter = filterValue;
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







}
