import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { MercadoService } from '../../service/mercado/mercado.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';

@Component({
  selector: 'app-cargar-mercado',
  standalone: true,
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
      this.rolUsuario = user.rol;
      this.correoUsuario = user.correo_electronico;
    }

    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
      valor: ['', [Validators.required, this.currencyValidator]],
      codigo: ['', Validators.required],
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



  // Función para enviar el formulario
  async onSubmit() {
    let codigoOH: string = '';
    let concepto: string = '';

    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    this.trimFormFields();

    // Validar si el operario existe y tiene saldos pendientes
    const operarioEncontrado = await this.buscarOperario();

    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };
    this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

    // Buscar si el codigo ya existe
    const data = await this.autorizacionesService.buscarCodigo(formValues.codigo);

    codigoOH = 'MOH' + Math.floor(Math.random() * 1000000);
    concepto = 'Compra tienda de ' + this.utilityServiceService.getUser().primer_nombre + ' ' + this.utilityServiceService.getUser().primer_apellido;

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
    this.utilityServiceService.verificarCedulaCodigo(formValues.codigo, formValues.cedula).subscribe(
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
      }
    );



    if (this.correoUsuario != "lola@gmail.com" && this.rolUsuario != "GERENCIA") {

      if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, parseInt(formValues.valor), this.sumaPrestamos, "mercado")) {
        return;
      }

      if (!this.utilityServiceService.verificarMontoCodigo(data, parseInt(formValues.valor))) {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El monto escrito supera que el monto del código',
        });
        return;
      }

    }


    this.mercadoService.ejecutarMercadoTienda(
      formValues.codigo,
      formValues.cedula,
      parseInt(formValues.valor),
      codigoOH,
      concepto,
      data.codigo[0].historial
    )
      .then(response => {
        if (response.message == "Actualización exitosa") {
          // Termino el proceso
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
      })
      .catch(error => {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
        });
      });

  }

  // Función para buscar operario
  async buscarOperario(): Promise<boolean> {
    return new Promise((resolve) => {
      this.autorizacionesService.traerOperarios(this.myForm.value.cedula).subscribe(
        (data: any) => {
          if (data.datosbase === "No se encontró el registro para el ID proporcionado") {
            this.datosOperario = null;
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: 'No se encontró el empleado con la cedula proporcionado',
            });
            resolve(false);
            return;
          }

          this.datosOperario = data.datosbase[0];
          this.nombreOperario = `${this.datosOperario.nombre} `;
          resolve(true);
        },
        (error: any) => {
          resolve(false);
        }
      );
    });
  }
}
