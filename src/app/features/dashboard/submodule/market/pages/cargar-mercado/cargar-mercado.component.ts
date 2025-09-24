import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { MercadoService } from '../../service/mercado/mercado.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError, of, takeUntil, Subject, Observable } from 'rxjs';

@Component({
  selector: 'app-cargar-mercado',
  imports: [
    SharedModule
  ],
  templateUrl: './cargar-mercado.component.html',
  styleUrls: ['./cargar-mercado.component.css']
})

export class CargarMercadoComponent implements OnInit {
  myForm!: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  showValor = false;
  showCuotas = false;
  celularLabel = 'Número';

  correoUsuario: string = '';
  rolUsuario: string = '';
  private destroy$ = new Subject<void>();
  fechaIngreso: string = '';

  constructor(
    private fb: FormBuilder,
    private autorizacionesService: AutorizacionesService,
    private mercadoService: MercadoService,
    private utilityServiceService: UtilityServiceService,
    private router: Router
  ) { }

  ngOnInit() {
    let user = this.utilityServiceService.getUser();
    if (user) {
      this.rolUsuario = user.rol.nombre;
      this.correoUsuario = user.correo_electronico;
    }

    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
      valor: ['', [Validators.required, this.currencyValidator]],
      codigo: ['', Validators.required],
    });

    this.setupFormValueChanges();
  }

  private trimField(fieldName: string) {
    const control = this.myForm.get(fieldName);
    if (control && control.value && typeof control.value === 'string') {
      control.setValue(control.value.trim());
    }
  }

  private setupFormValueChanges() {

    this.myForm.get('cedula')?.valueChanges
      .pipe(
        debounceTime(3000), // Espera 1 segundo después del último cambio
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

      });
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



  // Función para enviar el formulario
  async onSubmit() {
    let codigoOH: string = '';
    let concepto: string = '';

    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    this.trimFormFields();

    // 🔵 Mostrar Swal de carga
    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espera mientras se verifica la información.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };
      this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

      // Buscar si el código ya existe
      const data = await this.autorizacionesService.buscarCodigo(formValues.codigo);

      codigoOH = 'MOH' + Math.floor(Math.random() * 1000000);
      concepto = 'Compra tienda de ' + this.utilityServiceService.getUser().datos_basicos.nombres + ' ' + this.utilityServiceService.getUser().datos_basicos.apellidos;

      // Verificar si el código ya ha sido utilizado o no existe
      if (data.codigo.length === 0) {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El código no existe',
        });
        return;
      }

      if (data.codigo[0].estado === false) {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El código ya ha sido utilizado',
        });
        return;
      }

      // Verificar si la cédula pertenece al código
      const cedulaValida = await this.utilityServiceService.verificarCedulaCodigo(formValues.codigo, formValues.cedula).toPromise();
      if (cedulaValida === "false") {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El código no pertenece a la cédula proporcionada',
        });
        return;
      }

      if (this.rolUsuario != "GERENCIA" && this.correoUsuario != "mercarflorats@gmail.com" && this.correoUsuario != "mercarflora2.ts@gmail.com" && this.correoUsuario != "servicioalcliente.tuapo1@gmail.com") {
        if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, parseInt(formValues.valor), this.sumaPrestamos, "mercado")) {
          return;
        }
        if (!this.utilityServiceService.verificarMontoCodigo(data, parseInt(formValues.valor), this.rolUsuario)) {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'El monto escrito supera el monto del código',
          });
          return;
        }
      }

      const response = await this.mercadoService.ejecutarMercadoTienda(
        formValues.codigo,
        formValues.cedula,
        parseInt(formValues.valor),
        codigoOH,
        concepto,
        data.codigo[0].historial
      );

      Swal.close();

      if (response.message === "Actualización exitosa") {
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'El préstamo ha sido cargado exitosamente',
          confirmButtonText: 'Aceptar'
        }).then(() => {
          this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
            this.router.navigate(["/dashboard/market/load-market"]);
          });
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
        });
      }
    } catch (error) {
      Swal.close();

      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
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
}
