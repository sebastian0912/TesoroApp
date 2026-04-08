import {  Component, OnInit , ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { AutorizacionesService } from '../../services/autorizaciones/autorizaciones.service';
import Swal from 'sweetalert2';
import { ActivatedRoute, Router } from '@angular/router';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { MatDialog } from '@angular/material/dialog';
import { HistorialDialogComponent } from './historial-dialog/historial-dialog.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-autorizacion-dinamica',
  imports: [
    SharedModule
  ],
  templateUrl: './autorizacion-dinamica.component.html',
  styleUrl: './autorizacion-dinamica.component.css'
} )
export class AutorizacionDinamicaComponent implements OnInit {
  myForm!: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  showValor = false;
  showCuotas = false;
  celularLabel = 'Número';
  user: any;
  rolUsuario: string = '';
  correoUsuario: string = '';

  tipoAutorizacion: 'prestamo' | 'mercado' = 'prestamo';
  limiteDisponible: number = 0;

  constructor(
    private fb: FormBuilder,
    private autorizacionesService: AutorizacionesService,
    private utilityService: UtilityServiceService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    this.user = this.utilityService.getUser();
    if (this.user) {
      this.rolUsuario = this.user.rol?.nombre ?? '';
      this.correoUsuario = this.user.correo_electronico ?? '';
    }

    // Identificar el tipo basado en la ruta (data)
    this.tipoAutorizacion = this.route.snapshot.data['tipoAutorizacion'] || 'prestamo';

    this.myForm = this.fb.group({
      numero_documento: ['', [Validators.required, Validators.pattern(/^[A-Za-z]?\d+$/)]],
      tipo: [this.tipoAutorizacion === 'mercado' ? 'Mercado' : '', Validators.required],
      valor: ['', [Validators.required, this.currencyValidator.bind(this)]],
      cuotas: ['', [Validators.min(1), Validators.max(this.tipoAutorizacion === 'mercado' ? 2 : 4)]],
      formaPago: [''],
      celular: ['']
    });

    if (this.tipoAutorizacion === 'prestamo') {
      this.myForm.get('formaPago')?.setValidators([Validators.required]);
      this.myForm.get('formaPago')?.valueChanges.subscribe(value => {
        const celularControl = this.myForm.get('celular');
        if (value === 'Daviplata' || value === 'Master') {
          celularControl?.setValidators([
            Validators.required,
            Validators.pattern(/^\d{10}$/)
          ]);
        } else {
          celularControl?.clearValidators();
        }
        celularControl?.updateValueAndValidity();
      });
    }

    // Si es mercado, el concepto ya está pre-seleccionado, mostrar campos de valor y cuotas
    if (this.tipoAutorizacion === 'mercado') {
      this.showValor = true;
      this.showCuotas = true;
    }
  }

  formatCurrencyPipe(value: number): string {
    return Number(value).toLocaleString('es-CO');
  }

  formatCurrency(event: any) {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    value = Number(value).toLocaleString('es-CO');
    input.value = value;

    // Trigger validation
    this.myForm.get('valor')?.updateValueAndValidity();
  }

  currencyValidator(control: AbstractControl) {
    if (!control.value) return { required: true };
    const value = parseInt(control.value.replace(/\D/g, ''), 10);
    if (isNaN(value)) return { required: true };

    if (this.limiteDisponible > 0 && value > this.limiteDisponible) {
      return { maxLimite: true };
    }

    return null;
  }

  private trimField(fieldName: string) {
    const control = this.myForm.get(fieldName);
    if (control && control.value && typeof control.value === 'string') {
      control.setValue(control.value.trim().toUpperCase());
    }
  }

  // Función para buscar operario
  async buscarOperario() {
    this.trimField('numero_documento');
    const doc = this.myForm.value.numero_documento;

    if (!doc) {
      Swal.fire('Error', 'Por favor, ingrese un número de identificación válido.', 'error');
      this.myForm.markAllAsTouched();
      return;
    }

    Swal.fire({
      title: 'Buscando trabajador...',
      text: 'Por favor, espera mientras se procesa la información.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const data = await this.autorizacionesService.traerPersonaTesoreria(doc);
      Swal.close();

      this.datosOperario = data;
      this.nombreOperario = `${this.datosOperario.nombre}`;
      this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);
      this.limiteDisponible = 0;

      if (!this.datosOperario.activo) {
        this.datosOperario = null;
        Swal.fire('Empleado Inactivo', 'El empleado se encuentra inactivo y no puede solicitar autorizaciones.', 'error');
        return;
      }

      if (this.datosOperario.bloqueado) {
        const motivo = this.datosOperario.observacion_bloqueo ?? 'Sin observación';
        Swal.fire({
          icon: 'error',
          title: 'Empleado Bloqueado',
          html: `El empleado se encuentra bloqueado.<br><br><b>Motivo:</b> ${motivo}`
        });
        this.datosOperario = null;
        return;
      }

      // Validar condiciones generales y calcular límite si es mercado
      const isAdminOverrides = (this.rolUsuario === "GERENCIA" || this.correoUsuario === "mercarflorats@gmail.com" || this.correoUsuario === "mercarflora2.ts@gmail.com");

      if (!isAdminOverrides) {
        if (!this.autorizacionesService.verificarFondos(this.datosOperario)) {
          this.datosOperario = null;
          return; // El sevice ya muestra Swal
        }

        // Simular validación para calcular límite
        const isValid = this.autorizacionesService.verificarCondiciones(this.datosOperario, 0, this.sumaPrestamos, this.tipoAutorizacion);
        if (!isValid) {
          this.datosOperario = null;
          return;
        }

        // Calcular límite disponible para ambos tipos
        if (this.tipoAutorizacion === 'mercado') {
          let limiteBase = 350000;
          const rol = this.user?.rol?.nombre ?? '';
          if (rol === 'TIENDA' || rol === 'ESPECIAL') limiteBase += 50000;
          this.limiteDisponible = Math.max(0, limiteBase - this.sumaPrestamos);
        } else if (this.tipoAutorizacion === 'prestamo') {
          const saldoActual = Number(this.datosOperario.saldos || 0);
          const salario = Number(this.datosOperario.salario || 0);
          this.limiteDisponible = Math.max(0, salario - saldoActual);
        }
      }

    } catch (error: any) {
      Swal.close();
      if (error?.status === 404) {
        Swal.fire('Oops...', 'Este empleado no existe en la base de datos (puede que no esté registrado en la quincena actual o no pertenezca a la empresa).', 'error');
      } else {
        Swal.fire('Error de conexión', 'Hubo un problema al buscar el operario.', 'error');
      }
      this.datosOperario = null;
    }
  }

  onTipoChange(event: any) {
    const tipo = event.value;
    if (tipo === "Otro" || tipo === "Dinero" || tipo === "Mercado" || tipo === "Anchetas") {
      this.showValor = true;
      this.showCuotas = true;
    } else if (tipo === "Seguro Funerario") {
      this.showValor = true;
      this.showCuotas = false;
      this.myForm.patchValue({ cuotas: 1 });
    } else {
      this.showValor = false;
      this.showCuotas = false;
    }
  }

  onFormaPagoChange(event: any) {
    const formaPago = event.value;
    if (formaPago === "Daviplata") {
      this.celularLabel = "Número de Daviplata";
    } else if (formaPago === "Master") {
      this.celularLabel = "Número de tarjeta Master";
    } else if (formaPago === "Efectivo") {
      this.celularLabel = "Número";
    } else {
      this.celularLabel = "Número de cuenta";
    }
  }

  abrirHistorial() {
    if (!this.datosOperario) return;
    const doc = this.datosOperario.numero_documento || this.myForm.value.numero_documento;
    this.dialog.open(HistorialDialogComponent, {
      width: '80vw',
      maxWidth: '90vw',
      height: '80vh',
      panelClass: 'historial-dialog-panel',
      data: { numeroDocumento: doc }
    });
  }

  async onSubmit() {
    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };
    const valNumerico = parseInt(formValues.valor, 10);

    const isAdminOverrides = (this.rolUsuario === "GERENCIA" || this.correoUsuario === "mercarflorats@gmail.com" || this.correoUsuario === "mercarflora2.ts@gmail.com");

    if (!isAdminOverrides) {
      if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, valNumerico, this.sumaPrestamos, this.tipoAutorizacion)) {
        return; // Service muestra el Swal error
      }
    }

    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Generando la autorización...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => { Swal.showLoading(); }
    });

    let cuotasAux = formValues.cuotas || 1;
    let tituloAutorizador = this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos;
    let sedeAutorizacion = this.user?.sede?.nombre || '';

    try {
      // 1. Llamar al backend unificado para crear la transacción y obtener el código directamente
      const response = await this.autorizacionesService.autorizarTransaccion(
        formValues.numero_documento,
        valNumerico,
        cuotasAux,
        formValues.tipo,
        tituloAutorizador,
        sedeAutorizacion
      );

      const codigoOH = response.codigo_autorizacion || 'GENERIC-' + Math.floor(Math.random() * 1000000);

      // 2. Generar PDF (mantiene la lógica previa si es de préstamo, pero la aplicamos genérico)
      await this.autorizacionesService.generatePdf(
        this.datosOperario,
        valNumerico,
        formValues.valor,
        formValues.formaPago || 'N/A',
        formValues.celular || 'N/A',
        codigoOH,
        cuotasAux,
        this.tipoAutorizacion === 'prestamo' ? 'Prestamo' : 'Mercado',
        tituloAutorizador
      );

      Swal.close();

      Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: `La autorización ha sido aprobada. Código: ${codigoOH}`,
        confirmButtonText: 'Aceptar'
      }).then(() => {
        // Recargar ruta actual
        const currentUrl = this.router.url;
        this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
          this.router.navigate([currentUrl]);
        });
      });

    } catch (error: any) {
      Swal.close();
      const errorMsg = error.error?.error || error.error?.detail || 'Ocurrió un problema al procesar la autorización. Intenta nuevamente.';
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMsg,
        confirmButtonText: 'Aceptar'
      });
    }
  }

  private escapeHtml(value: string): string {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
  }
}
