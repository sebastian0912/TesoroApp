import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
} from '@angular/forms';
import Swal from 'sweetalert2';
import { debounceTime } from 'rxjs/operators';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../../../shared/shared.module';
import { MercadoService } from '../../../market/service/mercado/mercado.service';
import { PrestamoService } from '../../service/prestamo/prestamo.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-prestamo-para-realizar',
  standalone: true,
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
    this.rolUsuario = this.user.rol;
    this.correoUsuario = this.user.correo_electronico;

    this.myForm
      .get('cedula')
      ?.valueChanges.pipe(
        debounceTime(3000) // Para evitar realizar la búsqueda en cada pulsación, esperamos 500 ms después del último cambio.
      )
      .subscribe((value) => {
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
    let codigoMOH: string = '';
    let concepto: string = 'Prestamo';
    let conceptoMOH: string = '';

    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    this.trimFormFields();

    const formValues = {
      ...this.myForm.value,
      valor: this.myForm.value.valor.replace(/\D/g, ''),
    };

    this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(
      this.datosOperario
    );

    // Verificar si la cedula pertenece al codigo
    if (this.rolUsuario != 'GERENCIA') {
      if (
        !this.autorizacionesService.verificarCondiciones(
          this.datosOperario,
          parseInt(formValues.valor),
          this.sumaPrestamos,
          'prestamo'
        )
      ) {
        return;
      }
    }

    // Generar codigo que no exista
    while (true) {
      codigoOH = 'OR' + Math.floor(Math.random() * 1000000);

      try {
        const data = await this.autorizacionesService.buscarCodigo(codigoOH);
        if (data.codigo.length === 0) {
          break; // Salir del bucle si el código no existe
        }
      } catch (error) {
        break; // Salir del bucle si hay un error en la solicitud
      }
    }

    try {
      // cuando el comercio es no
      const historialData = await this.autorizacionesService.escribirHistorial(
        formValues.cedula,
        parseInt(formValues.valor),
        formValues.cuotas,
        'Prestamo para hacer',
        codigoOH,
        this.user.primer_nombre + ' ' + this.user.primer_apellido
      );

      this.historial_id = historialData.historial_id;

      await this.autorizacionesService.escribirCodigo(
        formValues.cedula,
        formValues.valor,
        codigoOH,
        formValues.cuotas,
        'Prestamo para hacer',
        this.historial_id,
        this.user.primer_nombre + ' ' + this.user.primer_apellido,
        this.user.numero_de_documento
      );

      this.prestamoService
        .ejecutarPrestamoParaHacer(
          codigoOH,
          formValues.cedula,
          parseInt(formValues.valor),
          codigoOH,
          'Prestamo para hacer',
          this.historial_id,
          parseInt(formValues.cuotas)
        )
        .then((response) => {
          if (response.message == 'Actualización exitosa') {
            // Termino el proceso
            Swal.fire({
              icon: 'success',
              title: '¡Éxito!',
              text: 'El préstamo ha sido cargado exitosamente',
              confirmButtonText: 'Aceptar',
            }).then(() => {
              this.router
                .navigateByUrl('/home', { skipLocationChange: true })
                .then(() => {
                  this.router.navigate(['/prestamo-para-realizar']);
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
        .catch((error) => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
        });

      this.autorizacionesService.generatePdf(
        this.datosOperario,
        formValues.valor,
        formValues.valor,
        formValues.formaPago || '',
        formValues.celular || '',
        codigoOH,
        formValues.cuotas,
        'Pretamo',
        this.user.primer_nombre + ' ' + this.user.primer_apellido,
      );
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
    this.autorizacionesService
      .traerOperarios(this.myForm.value.cedula)
      .subscribe(
        (data: any) => {
          if (
            data.datosbase ===
            'No se encontró el registro para el ID proporcionado'
          ) {
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

          if (this.rolUsuario != 'GERENCIA') {
            // Validar si el operario tiene saldos pendientes mayores a 175000
            if (
              !this.autorizacionesService.verificarSaldo(this.datosOperario) ==
              true
            ) {
              this.datosOperario = null;
            }

            // Validar si el operario tiene fondos mayores a 0
            else if (
              !this.autorizacionesService.verificarFondos(this.datosOperario)
            ) {
              this.datosOperario = null;
              return;
            }
          }
        },
        (error: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
        }
      );
  }
}
