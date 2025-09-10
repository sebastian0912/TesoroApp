import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { AutorizacionesService } from '../../services/autorizaciones/autorizaciones.service';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-autorizacion-prestamo',
  imports: [
    SharedModule
  ],
  templateUrl: './autorizacion-prestamo.component.html',
  styleUrl: './autorizacion-prestamo.component.css'
})
export class AutorizacionPrestamoComponent implements OnInit {
  myForm!: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  showValor = false;
  showCuotas = false;
  celularLabel = 'Número';
  user: any;
  rolUsuario: string = '';
  fechaIngreso: string = '';
  correoUsuario: string = '';

  constructor(
    private fb: FormBuilder,
    private autorizacionesService: AutorizacionesService,
    private utilityService: UtilityServiceService,
    private router: Router
  ) { }

  ngOnInit() {
    this.user = this.utilityService.getUser();
    if (this.user) {
      this.rolUsuario = this.user.rol?.nombre ?? '';
      this.correoUsuario = this.user.correo_electronico ?? '';
    }

    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
      tipo: ['', Validators.required],
      valor: ['', [Validators.required, this.currencyValidator]],
      cuotas: ['', [Validators.min(1), Validators.max(4)]],
      formaPago: ['', Validators.required],
      celular: ['']
    });

    this.myForm.get('formaPago')?.valueChanges.subscribe(value => {
      const celularControl = this.myForm.get('celular');
      if (value === 'Daviplata' || value === 'Master') {
        celularControl?.setValidators([
          Validators.required,
          Validators.pattern(/^\d{10,11}$/)
        ]);
      } else {
        celularControl?.clearValidators();
      }
      celularControl?.updateValueAndValidity();
    });

  }


  formatCurrency(event: any) {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    value = Number(value).toLocaleString();
    input.value = value;
  }

  currencyValidator(control: AbstractControl) {
    const value = control.value.replace(/\D/g, '');
    return value ? null : { required: true };
  }

  private trimFormFields() {
    Object.keys(this.myForm.controls).forEach(field => {
      const control = this.myForm.get(field);
      if (control && control.value && typeof control.value === 'string') {
        control.setValue(control.value.trim());
      }
    });
  }

  private trimField(fieldName: string) {
    const control = this.myForm.get(fieldName);
    if (control && control.value && typeof control.value === 'string') {
      control.setValue(control.value.trim());
    }
  }

  // Función para enviar el formulario
  async onSubmit() {
    let codigoOH: string = '';
    let concepto: string = '';

    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    this.trimFormFields();

    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };

    this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

    if (this.rolUsuario != "GERENCIA" && this.correoUsuario != "mercarflorats@gmail.com"
      && this.correoUsuario != "mercarflora2.ts@gmail.com") {
      if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, parseInt(formValues.valor), this.sumaPrestamos, "prestamo")) {
        return;
      }
    }

    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espera mientras se genera la autorización.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    let cuotasAux = formValues.cuotas;

    // Generar un código único
    while (true) {
      if (this.myForm.value.tipo === "Seguro Funerario") {
        codigoOH = 'SF' + Math.floor(Math.random() * 1000000);
        concepto = "Autorización Seguro Funerario";
        cuotasAux = 1;
        this.myForm.patchValue({ cuotas: 1 });
      } else if (this.myForm.value.tipo === "Dinero") {
        codigoOH = 'PH' + Math.floor(Math.random() * 1000000);
        concepto = "Autorización préstamo dinero";
      } else if (this.myForm.value.tipo === "Otro") {
        codigoOH = 'OT' + Math.floor(Math.random() * 1000000);
        concepto = "Autorización otro concepto";
      }

      try {
        const data = await this.autorizacionesService.buscarCodigo(codigoOH);
        if (data.codigo.length === 0) {
          break;  // Salir del bucle si el código no existe
        }
      } catch (error) {
        break;  // Salir del bucle si hay un error en la solicitud
      }
    }

    try {
      const historialData = await this.autorizacionesService.escribirHistorial(
        formValues.cedula,
        parseInt(formValues.valor),
        cuotasAux,
        concepto,
        codigoOH,
        this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos
      );
      const historial_id = historialData.historial_id;

      await this.autorizacionesService.escribirCodigo(
        formValues.cedula,
        formValues.valor,
        codigoOH,
        cuotasAux,
        formValues.tipo,
        historial_id,
        this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos,
        this.user.numero_de_documento
      );

      this.autorizacionesService.generatePdf(
        this.datosOperario,
        formValues.valor,
        formValues.valor,
        formValues.formaPago || '',
        formValues.celular || '',
        codigoOH,
        cuotasAux,
        "Prestamo",
        this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos,
      );

      Swal.close();

      Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: `El préstamo ha sido autorizado, se ha generado el código ${codigoOH}`,
        confirmButtonText: 'Aceptar'
      }).then(() => {
        this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
          this.router.navigate(["/dashboard/authorizations/money-loan"]);
        });
      });

    } catch (error) {
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un problema al procesar la autorización. Intenta nuevamente.',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  // Función para buscar operario
  buscarOperario() {
    // si cedula no es válida
    if (this.myForm.value.cedula.length == '') {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, ingrese una cédula válida.',
      });
      this.myForm.markAllAsTouched();
      return;
    }

    Swal.fire({
      title: 'Buscando trabajador...',
      icon: 'info',
      text: 'Por favor, espera mientras se procesa la información.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.autorizacionesService.traerOperarios(this.myForm.value.cedula).subscribe(
      (data: any) => {
        Swal.close();

        // Validar si el operario existe
        if (data.datosbase === "No se encontró el registro para el ID proporcionado") {
          this.datosOperario = null;
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'No se encontró el empleado con la cédula proporcionada',
          });
          return;
        }

        this.datosOperario = data.datosbase[0];
        this.nombreOperario = `${this.datosOperario.nombre} `;
        this.fechaIngreso = this.datosOperario.ingreso;

        if (!this.datosOperario.activo) {
          this.datosOperario = null;
          Swal.fire({
            icon: 'error',
            title: 'Empleado retirado',
            text: 'El empleado con la cédula proporcionada se encuentra retirado y no puede solicitar autorizaciones.',
          });
          return;
        }

        if (this.datosOperario.bloqueado) {
          this.datosOperario = null;
          Swal.fire({ icon: 'error', title: 'Empleado bloqueado', text: 'El empleado con la cédula proporcionada se encuentra bloqueado y no puede solicitar autorizaciones.' });
          return;
        }

        if (this.rolUsuario !== "GERENCIA") {
          /*
          // Validar si el operario tiene saldos pendientes mayores a 175000
          if (!this.autorizacionesService.verificarSaldo(this.datosOperario)) {
            this.datosOperario = null;
            Swal.fire({ icon: 'error', title: 'Saldo pendiente', text: 'El empleado con la cédula proporcionada tiene saldos pendientes mayores a $175.000 y no puede solicitar autorizaciones.' });
            return;
          }*/


          if (!this.autorizacionesService.verificarFondos(this.datosOperario)) {
            this.datosOperario = null;
            Swal.fire({ icon: 'error', title: 'Pertene Fondo', text: 'El empleado con la cédula proporcionada pertenece al fondo no puede solicitar autorizaciones.' });
            return;
          }
        }
      },
      (error: any) => {
        Swal.close();

        Swal.fire({
          icon: 'error',
          title: 'Error de conexión',
          text: 'Hubo un problema al buscar el operario. Intente nuevamente.',
        });
      }
    );
  }

  onTipoChange(event: any) {
    const tipo = event.value;
    if (tipo === "Otro" || tipo === "Dinero") {
      this.showValor = true;
      this.showCuotas = true;
    } else if (tipo === "Seguro Funerario") {
      this.showValor = true;
      this.showCuotas = false;
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
}
