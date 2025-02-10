import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { ComercializadoraService } from '../../service/comercializadora/comercializadora.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-enviar-mercancia',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './enviar-mercancia.component.html',
  styleUrls: ['./enviar-mercancia.component.css']
})
export class EnviarMercanciaComponent {
  myForm: FormGroup;
  sedes: any
  conceptos: any

  constructor(
    private fb: FormBuilder,
    private comercializadoraService: ComercializadoraService,
    private utilityService: UtilityServiceService,
    private router: Router
  ) {

    this.myForm = this.fb.group({
      sede: ['', Validators.required],
      cantidad: ['', Validators.required],
      valor: ['', [Validators.required, this.currencyValidator]],
      concepto: ['', Validators.required],
      nombrePersonaEnvio: ['',],
      comentarioEnvio: ['',]
    });

    this.myForm.get('concepto')?.valueChanges.subscribe(value => {
      this.updateOtroConceptoValidator(value);
    });

    this.utilityService.traerSucursales().subscribe((data: any) => {
      this.sedes = data.sucursal;
    });

    this.comercializadoraService.traerCategorias(31).then((data: any) => {
      this.conceptos = data[0].opciones;
    });

  }

  updateOtroConceptoValidator(concepto: string) {
    const otroConceptoControl = this.myForm.get('otroConcepto');
    if (concepto === 'Otro') {
      otroConceptoControl?.setValidators([Validators.required]);
    } else {
      otroConceptoControl?.clearValidators();
    }
    otroConceptoControl?.updateValueAndValidity();
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

  async onSubmit() {
    let codigo: number;
    let encontrado: boolean = false;

    if (this.myForm.invalid) {
      return;
    }

    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };

    do {
      codigo = Math.floor(Math.random() * 1000000);
      try {
        const response = await this.comercializadoraService.traerComercio(codigo).toPromise();
        if (response.message === 'error') {
          encontrado = true;
        }
      } catch (error) {
        encontrado = true;  // Dependiendo de la lógica, puedes decidir si terminas el bucle en caso de error
      }
    } while (!encontrado);

    if (formValues.concepto === 'Otro') {
      formValues.concepto = formValues.otroConcepto;
    }

    try {
      const response = await this.comercializadoraService.enviarMercancia(
        codigo.toString(),
        formValues.sede,
        formValues.concepto,
        formValues.cantidad,
        formValues.valor,
        formValues.nombrePersonaEnvio,
        formValues.comentarioEnvio
      );
      if (response === 'success') {
        Swal.fire('Envio de mercancia', 'Envio realizado con exito', 'success').then(() => {
          this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
            this.router.navigate(["/dashboard/merchandise/send-merchandise"]);
          });
        });
      } else {
        Swal.fire('Envio de mercancia', 'Error al realizar el envio', 'error');
      }

    } catch (error) {
      Swal.fire('Envio de mercancia', 'Error al realizar el envio', 'error');
    }
  }

}
