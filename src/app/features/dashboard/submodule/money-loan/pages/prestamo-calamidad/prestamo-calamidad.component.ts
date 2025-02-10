import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import Swal from 'sweetalert2';
import { debounceTime } from 'rxjs/operators';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../../../shared/shared.module';
import { PrestamoService } from '../../service/prestamo/prestamo.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';


@Component({
  selector: 'app-prestamo-calamidad',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './prestamo-calamidad.component.html',
  styleUrl: './prestamo-calamidad.component.css'
})
export class PrestamoCalamidadComponent implements OnInit {
  myForm!: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  historial_id: number = 0;
  rolUsuario: string = '';
  correoUsuario: string = '';

  constructor(
    private fb: FormBuilder,
    private autorizacionesService: AutorizacionesService,
    private prestamoService: PrestamoService,
    private utilityService: UtilityServiceService,
    private router: Router
  ) {

    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
      cuotas: ['', [Validators.required, Validators.min(1), Validators.max(4)]],
      valor: ['', [Validators.required, this.currencyValidator]],
      codigoAutorizacion: ['', Validators.required],
    });

  }

  ngOnInit() {
    let user = this.utilityService.getUser();
    if (user) {
      this.rolUsuario = user.rol;
      this.correoUsuario = user.correo_electronico;
    }
    this.myForm.get('cedula')?.valueChanges.pipe(
      debounceTime(3000) // Para evitar realizar la búsqueda en cada pulsación, esperamos 500 ms después del último cambio.
    ).subscribe(value => {
      this.trimField('cedula');
      this.buscarOperario();
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
    let codigoMOH: string = '';
    let concepto: string = 'Mercado';
    let conceptoMOH: string = '';

    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    this.trimFormFields();


    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };

    // Buscar si el codigo ya existe
    const data = await this.autorizacionesService.buscarCodigo(formValues.codigoAutorizacion);

    this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

    // Verificar si el código ya ha sido utilizado
    if (data.codigo.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'El código no existe',
      });
      return;
    }

    // Verificar si el código ya ha sido utilizado
    if (data.codigo[0].estado === false) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'El código ya ha sido utilizado',
      });
      return;
    }


    // Verificar si la cedula pertenece al codigo
    this.utilityService.verificarCedulaCodigo(formValues.codigoAutorizacion, formValues.cedula).subscribe(
      (data: any) => {
        if (data === "false") {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'El código no pertenece a la cedula proporcionada',
          });
          return
        }
      },
      (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Hubo un error al verificar el código',
        });
      }
    );

    if (this.rolUsuario != "GERENCIA") {

      if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, parseInt(formValues.valor), this.sumaPrestamos, "prestamo")) {
        return;
      }

      if (!this.utilityService.verificarMontoCodigo(data, parseInt(formValues.valor))) {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El monto escrito supera que el monto del código',
        });
        return;
      }

    }


    try {

      let conceptoHistorial = 'Prestamo_Dinero_Libranza';
      codigoOH = 'OH' + Math.floor(Math.random() * 1000000);

      if (data.codigo[0].codigo.startsWith('SF')) {
        conceptoHistorial = 'Seguro_Funerario_Libranza';
      }
      else if (data.codigo[0].codigo.startsWith('OT')) {
        conceptoHistorial = 'Otro_Concepto_Libranza';
      }


      this.prestamoService.ejecutarPrestamoCalamidad(
        formValues.codigoAutorizacion,
        formValues.cedula,
        parseInt(formValues.valor),
        codigoOH,
        conceptoHistorial,
        data.codigo[0].historial,
        parseInt(formValues.cuotas)
      ).then(response => {
        if (response.message == "Actualización exitosa") {
          // Termino el proceso
          Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: 'El préstamo ha sido cargado exitosamente',
            confirmButtonText: 'Aceptar'
          }).then(() => {
            this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
              this.router.navigate(["/dashboard/money-loan/emergency-loan"]);
            });
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
        }
      })
        .catch(error => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
        });




    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
      });
    }
  }



  // Función para buscar operario
  buscarOperario() {
    this.autorizacionesService.traerOperarios(this.myForm.value.cedula).subscribe(
      (data: any) => {
        if (data.datosbase === "No se encontró el registro para el ID proporcionado") {
          this.datosOperario = null;
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'No se encontró el empleado con la cedula proporcionado',
          });
          return;
        }

        this.datosOperario = data.datosbase[0];
        this.nombreOperario = `${this.datosOperario.nombre} `;

        if (this.rolUsuario != "GERENCIA") {
          // Validar si el operario tiene saldos pendientes mayores a 175000
          if (!this.autorizacionesService.verificarSaldo(this.datosOperario) == true) {
            this.datosOperario = null;
          }

          // Validar si el operario tiene fondos mayores a 0
          else if (!this.autorizacionesService.verificarFondos(this.datosOperario)) {
            this.datosOperario = null;
            return;
          }
        }

      },
      (error: any) => {
      }
    );
  }


}
