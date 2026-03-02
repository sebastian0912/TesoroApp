import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../../../shared/shared.module';
import { PrestamoService } from '../../service/prestamo/prestamo.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { MatDialog } from '@angular/material/dialog';
import { HistorialDialogComponent } from '../../../authorizations/pages/autorizacion-dinamica/historial-dialog/historial-dialog.component';
import { HistorialService } from '../../../history/service/historial/historial.service';

@Component({
  selector: 'app-prestamo-para-realizar',
  imports: [SharedModule],
  templateUrl: './prestamo-para-realizar.component.html',
  styleUrl: './prestamo-para-realizar.component.css',
})
export class PrestamoParaRealizarComponent implements OnInit, OnDestroy {
  searchForm!: FormGroup;
  loanForm!: FormGroup;

  datosOperario: any = null;
  nombreOperario: string = '';
  limiteDisponible: number = 0;

  user: any;
  rolUsuario: string = '';
  correoUsuario: string = '';

  constructor(
    private fb: FormBuilder,
    private autorizacionesService: AutorizacionesService,
    private prestamoService: PrestamoService,
    private utilityService: UtilityServiceService,
    private historialService: HistorialService,
    private router: Router,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    this.user = this.utilityService.getUser();
    if (this.user) {
      this.rolUsuario = this.user.rol?.nombre ?? '';
      this.correoUsuario = this.user.correo_electronico ?? '';
    }

    this.searchForm = this.fb.group({
      numero_documento: ['', [Validators.required, Validators.pattern(/^[A-Za-z]?\d+$/)]]
    });

    this.loanForm = this.fb.group({
      valor: ['', [Validators.required]],
      cuotas: ['', [Validators.required, Validators.min(1), Validators.max(4)]]
    });
  }

  ngOnDestroy() { }

  formatCurrencyValue(value: any): string {
    if (value === null || value === undefined || value === '') return '0';
    return Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  formatCurrencyInput(event: any) {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    value = Number(value).toLocaleString('es-CO');
    input.value = value;
  }

  async buscarEmpleado() {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }

    const doc = this.searchForm.value.numero_documento.trim().toUpperCase();

    Swal.fire({
      title: 'Buscando trabajador...',
      text: 'Por favor, espera.',
      allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      // Validar si existe, está activo y no bloqueado
      const statusData: any = await this.historialService.getPersonaTesoreriaStatus(doc).toPromise();

      if (!statusData || statusData.error) {
        Swal.fire({
          icon: 'error', title: 'Empleado no encontrado',
          text: 'Este empleado no existe, no está registrado en esta quincena o no pertenece a la empresa.',
        });
        return;
      }

      if (statusData.activo === false) {
        Swal.fire({
          icon: 'error', title: 'Empleado Inactivo',
          text: 'El empleado con el número de documento proporcionado se encuentra inactivo y no es válido para procesar autorizaciones.',
        });
        return;
      }

      if (statusData.bloqueado === true) {
        let fechaStr = 'fecha desconocida';
        if (statusData.fecha_bloqueo) {
          const d = new Date(statusData.fecha_bloqueo);
          fechaStr = d.toLocaleDateString('es-CO') + ' a las ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        }
        const motivo = statusData.observacion_bloqueo ? statusData.observacion_bloqueo : 'Sin motivo especificado';

        Swal.fire({
          icon: 'error', title: 'Empleado Bloqueado',
          text: `El empleado se encuentra bloqueado desde: ${fechaStr}.\n\nMotivo: ${motivo}`,
        });
        return;
      }

      const data = await this.autorizacionesService.traerPersonaTesoreria(doc);
      Swal.close();

      this.datosOperario = data;
      this.nombreOperario = data.nombre || '';

      // Cupo disponible (misma lógica que verificarCondiciones)
      this.limiteDisponible = this.autorizacionesService.calcularCupoDisponible(data, 'prestamo');

    } catch (error: any) {
      Swal.close();
      if (error?.status === 404) {
        Swal.fire('No encontrado', 'Este empleado no existe en la base de datos (puede que no esté registrado en la quincena actual o no pertenezca a la empresa).', 'error');
      } else {
        Swal.fire('Error', 'Hubo un problema al buscar el operario.', 'error');
      }
    }
  }

  cancelar() {
    this.datosOperario = null;
    this.nombreOperario = '';
    this.limiteDisponible = 0;
    this.searchForm.reset();
    this.loanForm.reset();
  }

  abrirHistorial() {
    if (!this.datosOperario) return;
    this.dialog.open(HistorialDialogComponent, {
      width: '80vw', maxWidth: '90vw', height: '80vh',
      panelClass: 'historial-dialog-panel',
      data: { numeroDocumento: this.datosOperario.numero_documento }
    });
  }

  async onSubmit() {
    if (this.loanForm.invalid || !this.datosOperario) {
      this.loanForm.markAllAsTouched();
      return;
    }

    const valorStr = this.loanForm.value.valor.replace(/\D/g, '');
    const valorNumerico = parseInt(valorStr, 10);
    const cuotas = parseInt(this.loanForm.value.cuotas);

    if (valorNumerico <= 0) { Swal.fire('Error', 'El valor debe ser mayor a 0.', 'error'); return; }

    // Verificar condiciones
    const sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);
    if (this.rolUsuario !== 'GERENCIA') {
      if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, valorNumerico, sumaPrestamos, 'prestamo')) {
        return;
      }
    }

    const confirmar = await Swal.fire({
      icon: 'question', title: '¿Confirmar préstamo?',
      html: `<p><strong>Empleado:</strong> ${this.nombreOperario}</p>
             <p><strong>Valor:</strong> $${this.formatCurrencyValue(valorNumerico)}</p>
             <p><strong>Cuotas:</strong> ${cuotas}</p>`,
      showCancelButton: true, confirmButtonText: 'Sí, Generar', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0369a1'
    });

    if (!confirmar.isConfirmed) return;

    Swal.fire({
      title: 'Procesando...', icon: 'info', text: 'Generando el préstamo...',
      allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const userName = `${this.user.datos_basicos.nombres} ${this.user.datos_basicos.apellidos}`;
      const sedeAutorizacion = this.user?.sede?.nombre || '';
      const doc = this.datosOperario.numero_documento;

      // 1. Autorizar (crea transacción PENDIENTE)
      const authResponse = await this.autorizacionesService.autorizarTransaccion(
        doc, valorNumerico, cuotas, 'Préstamo para hacer', userName, sedeAutorizacion
      );

      // 2. Ejecutar inmediatamente
      const execResponse = await this.autorizacionesService.ejecutarTransaccion(
        authResponse.codigo_autorizacion,
        valorNumerico,
        userName,
        sedeAutorizacion
      );

      // 3. Generar PDF
      this.autorizacionesService.generatePdf(
        this.datosOperario,
        valorNumerico,
        valorNumerico.toString(),
        '',
        '',
        authResponse.codigo_autorizacion,
        cuotas.toString(),
        'Préstamo',
        userName
      );

      Swal.close();
      Swal.fire({
        icon: 'success', title: '¡Éxito!',
        text: `Préstamo generado y ejecutado. Código: ${execResponse.codigo_ejecucion || authResponse.codigo_autorizacion}`,
        confirmButtonText: 'Aceptar', confirmButtonColor: '#0369a1'
      }).then(() => { this.cancelar(); });

    } catch (error: any) {
      Swal.close();
      const msg = error.error?.error || 'Hubo un error al generar el préstamo.';
      Swal.fire('Error', msg, 'error');
    }
  }
}
