import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import Swal from 'sweetalert2';
import { catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../../../shared/shared.module';
import { MercadoService } from '../../../market/service/mercado/mercado.service';
import { PrestamoService } from '../../service/prestamo/prestamo.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { Observable, of, Subject } from 'rxjs';

@Component({
  selector: 'app-prestamo-para-realizar',
  imports: [SharedModule],
  templateUrl: './prestamo-para-realizar.component.html',
  styleUrl: './prestamo-para-realizar.component.css',
})
export class PrestamoParaRealizarComponent {
  myForm!: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  user: any;
  historial_id: number = 0;

  rolUsuario: string = '';
  correoUsuario: string = '';
  private destroy$ = new Subject<void>();
  fechaIngreso: string = '';

  constructor(
    private fb: FormBuilder,
    private autorizacionesService: AutorizacionesService,
    private mercadoService: MercadoService,
    private prestamoService: PrestamoService,
    private utilityService: UtilityServiceService,
    private router: Router
  ) {
    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
      cuotas: ['', [Validators.required, Validators.min(1), Validators.max(4)]],
      valor: ['', [Validators.required, this.currencyValidator]],
    });
  }

  ngOnInit() {
    this.user = this.utilityService.getUser();
    if (!this.user) {
      return;
    }
    this.rolUsuario = this.user.rol.nombre;
    this.correoUsuario = this.user.correo_electronico;

    this.myForm.get('cedula')?.valueChanges
      .pipe(
        debounceTime(2500), // Espera 1 segundo después del último cambio
        distinctUntilChanged(), // Evita búsquedas innecesarias si el usuario escribe el mismo valor
        switchMap(value => {
          this.trimField('cedula');



          return this.buscarOperario(value);
        }),
        catchError(() => of(null)), // Si hay error, simplemente no hace nada
        takeUntil(this.destroy$) // Limpia la suscripción cuando se destruye el componente
      )
      .subscribe(result => {
        Swal.close(); // 🔴 Cierra Swal de carga antes de mostrar cualquier error

        if (!result || result.datosbase === "No se encontró el registro para el ID proporcionado") {
          this.datosOperario = null;
          this.mostrarError('No se encontró el empleado con la cédula proporcionada.');
          return;
        }

        this.datosOperario = result.datosbase[0];
        this.nombreOperario = `${this.datosOperario.nombre} `;
        this.fechaIngreso = this.datosOperario.ingreso;

        // 🔴 Validar si el operario está inactivo (retirado)
        if (!this.datosOperario.activo) {
          this.datosOperario = null;
          this.mostrarError('El empleado se encuentra retirado y no puede solicitar autorizaciones.');
          return;
        }

        if (this.datosOperario.bloqueado) {
          this.datosOperario = null;
          this.mostrarError('El empleado se encuentra bloqueado y no puede solicitar autorizaciones.');
          return;
        }

        if (this.rolUsuario !== "GERENCIA" || this.correoUsuario === 'antcontable6.ts@gmail.com') {
          if (!this.autorizacionesService.verificarFondos(this.datosOperario)) {
            this.datosOperario = null;
            this.mostrarError('El operario pertenece al fondo');
            return;
          }
        }
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
    Object.keys(this.myForm.controls).forEach((field) => {
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
    let concepto: string = 'Préstamo para hacer';

    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    this.trimFormFields();

    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espera mientras se realiza la operación.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const formValues = {
        ...this.myForm.value,
        valor: this.myForm.value.valor.replace(/\D/g, ''),
      };

      this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

      // Verificar si la cédula pertenece al código
      if (this.rolUsuario !== 'GERENCIA') {
        Swal.close();
        const validacion = this.autorizacionesService.verificarCondiciones(
          this.datosOperario,
          parseInt(formValues.valor),
          this.sumaPrestamos,
          'prestamo'
        );
        if (!validacion) {
          return;
        }
      }

      // Generar un código único
      while (true) {
        codigoOH = 'OR' + Math.floor(Math.random() * 1000000);

        try {
          const data = await this.autorizacionesService.buscarCodigo(codigoOH);
          if (data.codigo.length === 0) break; // Salir del bucle si el código no existe
        } catch (error) {
          break; // Salir del bucle si hay un error en la solicitud
        }
      }

      // Escritura en historial
      const historialData = await this.autorizacionesService.escribirHistorial(
        formValues.cedula,
        parseInt(formValues.valor),
        formValues.cuotas,
        concepto,
        codigoOH,
        this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos
      );

      this.historial_id = historialData.historial_id;

      // Escritura de código
      await this.autorizacionesService.escribirCodigo(
        formValues.cedula,
        formValues.valor,
        codigoOH,
        formValues.cuotas,
        concepto,
        this.historial_id,
        this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos,
        this.user.numero_de_documento
      );

      // Ejecutar préstamo
      const response = await this.prestamoService.ejecutarPrestamoParaHacer(
        codigoOH,
        formValues.cedula,
        parseInt(formValues.valor),
        codigoOH,
        concepto,
        this.historial_id,
        parseInt(formValues.cuotas)
      );

      Swal.close();

      if (response.message === 'Actualización exitosa') {
        await Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'El préstamo ha sido cargado exitosamente',
          confirmButtonText: 'Aceptar',
        });
        this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
          this.router.navigate(['/dashboard/money-loan/loan-to-perform']);
        });
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Hubo un error al realizar el cargue, por favor intente de nuevo.',
        });
      }

      // Generar PDF
      this.autorizacionesService.generatePdf(
        this.datosOperario,
        formValues.valor,
        formValues.valor,
        formValues.formaPago || '',
        formValues.celular || '',
        codigoOH,
        formValues.cuotas,
        'Préstamo',
        this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos
      );

    } catch (error) {
      Swal.close();
      await Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Hubo un error al realizar el cargue, por favor intente de nuevo.',
      });
    }
  }

  // Función para buscar operario
  buscarOperario(cedula: string): Observable<any> {
    if (!cedula) {
      return of(null); // Evita hacer la solicitud si la cédula está vacía
    }

    // 🔵 Mostrar Swal de carga
    Swal.fire({
      title: 'Buscando trabajador...',
      text: 'Por favor, espera mientras se procesa la información.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    return this.autorizacionesService.traerOperarios(cedula).pipe(
      catchError(error => {
        Swal.close(); // 🔴 Cierra Swal en caso de error
        this.mostrarError('Hubo un problema al buscar el operario. Intente nuevamente.');
        return of(null); // Evita que la aplicación falle
      })
    );
  }

  // 🔵 Función para mostrar errores sin permitir que el usuario cierre el Swal fuera de él
  mostrarError(mensaje: string) {
    Swal.fire({
      icon: 'error',
      title: 'Aviso',
      text: mensaje,
      showConfirmButton: true, // Muestra un botón para cerrar
      allowOutsideClick: false, // Evita que se cierre al hacer clic fuera
      allowEscapeKey: false, // Evita que se cierre con la tecla Esc
    });
  }

  // 🔹 Limpieza de suscripción al destruir el componente
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
