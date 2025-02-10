import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { AutorizacionesService } from '../../services/autorizaciones/autorizaciones.service';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';


@Component({
  selector: 'app-autorizacion-mercado',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './autorizacion-mercado.component.html',
  styleUrl: './autorizacion-mercado.component.css'
})
export class AutorizacionMercadoComponent implements OnInit {
  myForm!: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  showValor = false;
  showCuotas = false;
  celularLabel = 'Número';
  user : any;
  rolUsuario: string = '';
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
      this.rolUsuario = this.user.rol;
    }

    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
      valor: ['', [Validators.required, this.currencyValidator]],
      formaPago: ['', Validators.required],
      celular: ['']
    });

    this.myForm.get('formaPago')?.valueChanges.subscribe(value => {
      const celularControl = this.myForm.get('celular');
      if (value === 'Daviplata' || value === 'Master') {
        celularControl?.setValidators([Validators.required, Validators.pattern(/^\d{10}$/)]);
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
    let empresa = null;
    let NIT = null;
    let direcccion = null;
    let concepto: string = '';

    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    this.trimFormFields();

    this.correoUsuario = this.utilityService.getUser().correo_electronico;

    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };

    this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

    if (this.correoUsuario != "lola@gmail.com" && this.rolUsuario != "GERENCIA") {
      if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, parseInt(formValues.valor), this.sumaPrestamos, "mercado")) {
        return;
      }
    }

    let cuotasAux = formValues.cuotas;

    // Generar codigo que no exista
    while (true) {

      codigoOH = 'M' + Math.floor(Math.random() * 1000000);
      concepto = "Mercado";

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
        2,
        "Autorizacion de Mercado",
        codigoOH,
        this.user.primer_nombre + ' ' + this.user.primer_apellido
      );
      const historial_id = historialData.historial_id;

      await this.autorizacionesService.escribirCodigo(
        formValues.cedula,
        formValues.valor,
        codigoOH,
        String(2),
        "Autorizacion de Mercado",
        historial_id,
        this.user.primer_nombre + ' ' + this.user.primer_apellido,
        this.user.numero_de_documento
      );

      this.autorizacionesService.generatePdf(

        this.datosOperario,
        formValues.valor,
        formValues.valor,
        formValues.formaPago || '',
        formValues.celular || '',
        codigoOH,
        String(2),
        "Mercado",
        this.user.primer_nombre + ' ' + this.user.primer_apellido,
      );

      // Swal al darle click se recarga la pagina
      Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: 'El préstamo ha sido autorizado, se ha generado el código ' + codigoOH,
        confirmButtonText: 'Aceptar'
      }).then(() => {
        this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
          this.router.navigate(["/dashboard/authorizations/market-bonus"]);
        });
      });

    } catch (error) {
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
        }

      },
      (error: any) => {
      }
    );
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
