import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { ComercializadoraService } from '../../service/comercializadora/comercializadora.service';
import { SharedModule } from '../../../../../../shared/shared.module';

@Component({
  selector: 'app-editar-envio',
  imports: [
    SharedModule
  ],
  templateUrl: './editar-envio.component.html',
  styleUrl: './editar-envio.component.css'
})

export class EditarEnvioComponent {
  myForm: FormGroup;
  datosEnvio: any;

  sedes = [
    "FACA_PRINCIPAL",
    "FACA_CENTRO",
    "ROSAL",
    "CARTAGENITA",
    "MADRID",
    "FUNZA",
    "SOACHA",
    "FONTIBÓN",
    "SUBA",
    "TOCANCIPÁ",
    "BOSA",
    "BOGOTÁ"
  ];

  conceptos = [
    "Mercado",
    "Kit escolar",
    "Kit aseo",
    "Anchetas",
    "Matrimonios",
    "Kit velitas",
    "Kit amor y amistad",
    "Kit Día de las Madres",
    "Juguetes",
    "Kit dulces",
    "Combo Carne",
    "Fruver",
    "Verdura",
    "Carne",
    "Pollo",
    "Embutidos",
    "Otro"
  ];

  constructor(
    private fb: FormBuilder,
    private comercializadoraService: ComercializadoraService,
    private router: Router
  ) {

    this.myForm = this.fb.group({
      codigoEnvio: ['', Validators.required],
      cantidad: ['', Validators.required],
      valor: ['', Validators.required],
      concepto: ['', Validators.required],
      sede: ['', Validators.required],
      otroConcepto: [''],
    });

    this.myForm.get('concepto')?.valueChanges.subscribe(value => {
      this.updateOtroConceptoValidator(value);
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


  updateOtroConceptoValidator(concepto: string) {
    const otroConceptoControl = this.myForm.get('otroConcepto');
    if (concepto === 'Otro') {
      otroConceptoControl?.setValidators([Validators.required]);
    } else {
      otroConceptoControl?.clearValidators();
    }
    otroConceptoControl?.updateValueAndValidity();
  }



  async onSubmit() {
    let codigo: number;
    let encontrado: boolean = false;

    if (this.myForm.invalid) {
      return;
    }

    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };

    try {
      const response = await this.comercializadoraService.EditarEnvio(
        formValues.codigoEnvio,
        formValues.sede,
        formValues.concepto,
        formValues.cantidad,
        formValues.valor
      );
      if (response === 'success') {
        Swal.fire('Envio de mercancia', 'Envio realizado con exito', 'success').then(() => {
          this.router.navigateByUrl('/dashboaard', { skipLocationChange: true }).then(() => {
            this.router.navigate(["/edit-merchandise"]);
          });
        });
      } else {
        Swal.fire('Envio de mercancia', 'Error al realizar el envio', 'error');
      }

    } catch (error) {
      Swal.fire('Envio de mercancia', 'Error al realizar el envio', 'error');
    }
  }

  async buscarEnvio() {
    try {
      let codigo = this.myForm.get('codigoEnvio')?.value;
      const response = await firstValueFrom(this.comercializadoraService.traerComercio(codigo));
      if (response.message === 'Comercio no encontrado' || response.message === 'error') {
        Swal.fire('Opss', 'Envio no encontrado', 'error');
      } else {
        this.datosEnvio = response;
        this.datosEnvio = response.comercio[0];
        this.myForm.patchValue({
          cantidad: this.datosEnvio.cantidadEnvio,
          valor: this.datosEnvio.valorUnidad,
          concepto: this.datosEnvio.concepto,
          otroConcepto: this.datosEnvio.concepto === 'Otro' ? this.datosEnvio.otroConcepto : '',
          sede: this.datosEnvio.destino,
          nombrePersonaEnvio: this.datosEnvio.personaQueLleva,
          comentarioEnvio: this.datosEnvio.comentariosEnvio
        });
      }
    } catch (error) {
      Swal.fire('Opss', 'Error al buscar el envio', 'error');
    }
  }



}
