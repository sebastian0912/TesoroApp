import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { ComercializadoraService } from '../../service/comercializadora/comercializadora.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-enviar-mercancia',
  imports: [
    SharedModule
  ],
  templateUrl: './enviar-mercancia.component.html',
  styleUrls: ['./enviar-mercancia.component.css']
})
export class EnviarMercanciaComponent {
  myForm: FormGroup;
  sedes: any[] = [];
  conceptos: any[] = [];
  enviando = false;

  constructor(
    private fb: FormBuilder,
    private comercializadoraService: ComercializadoraService,
    private utilityService: UtilityServiceService,
    private cdr: ChangeDetectorRef
  ) {

    this.myForm = this.fb.group({
      sede: ['', Validators.required],
      cantidad: ['', Validators.required],
      valor: ['', [Validators.required, this.currencyValidator]],
      concepto: ['', Validators.required],
      // La plantilla enlaza otroConcepto cuando el concepto es "Otro"; sin el control
      // declarado aquí, formControlName revienta al mostrar ese campo.
      otroConcepto: [''],
      nombrePersonaEnvio: [''],
      comentarioEnvio: ['']
    });

    this.myForm.get('concepto')?.valueChanges.subscribe(value => {
      this.updateOtroConceptoValidator(value);
    });

    this.utilityService.traerSucursales().subscribe({
      next: (data: any) => {
        if (data) {
          data.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
          this.sedes = data;
        }
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('Error cargando sedes:', error);
        this.cdr.markForCheck();
      }
    });

    this.comercializadoraService.traerCategorias(31)
      .then((data: any) => {
        this.conceptos = data?.[0]?.opciones ?? [];
      })
      .catch((error: any) => {
        console.error('Error cargando conceptos:', error);
      })
      .finally(() => this.cdr.markForCheck());
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
    if (!control.value) return { required: true };
    const value = String(control.value).replace(/\D/g, '');
    return value ? null : { required: true };
  }

  async onSubmit() {
    if (this.myForm.invalid || this.enviando) {
      return;
    }

    const formValues = {
      ...this.myForm.value,
      valor: String(this.myForm.value.valor ?? '').replace(/\D/g, '')
    };

    if (formValues.concepto === 'Otro') {
      formValues.concepto = formValues.otroConcepto;
    }

    // Generar un código aleatorio como SKU/Código de envío
    const codigoSku = Math.floor(Math.random() * 1000000).toString();

    // Obtener datos del usuario logueado
    const user = this.utilityService.getUser();
    let personaEnvia = formValues.nombrePersonaEnvio;
    if (!personaEnvia && user?.datos_basicos?.nombres) {
      personaEnvia = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos ?? ''}`.trim();
    }

    const payload = {
      codigo_sku: codigoSku,
      concepto: formValues.concepto,
      cantidad: formValues.cantidad,
      valor_unitario: formValues.valor,
      destino: formValues.sede,
      persona_envia: personaEnvia,
      comentario: formValues.comentarioEnvio || ''
    };

    this.enviando = true;
    this.cdr.markForCheck();

    try {
      const response = await this.comercializadoraService.enviarMercanciaNuevo(payload);
      // El backend retorna 201 Created si fue exitoso
      if (response && response.id) {
        Swal.fire('Envío de mercancía', `Envío realizado con éxito. Código: ${codigoSku}`, 'success').then(() => {
          this.myForm.reset();
          Object.keys(this.myForm.controls).forEach(key => {
            this.myForm.get(key)?.setErrors(null);
          });
          this.cdr.markForCheck();
        });
      } else {
        Swal.fire('Envío de mercancía', 'Error inesperado al realizar el envío', 'error');
      }
    } catch (error) {
      console.error('Error al realizar envío:', error);
      Swal.fire('Envío de mercancía', 'Error al realizar el envío', 'error');
    } finally {
      this.enviando = false;
      this.cdr.markForCheck();
    }
  }

}
