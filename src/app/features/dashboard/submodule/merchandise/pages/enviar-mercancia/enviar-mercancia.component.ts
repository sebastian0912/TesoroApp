import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { ComercializadoraService } from '../../service/comercializadora/comercializadora.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import {
  CatalogValue,
  GestionParametrizacionService,
} from '../../../users/services/gestion-parametrizacion/gestion-parametrizacion.service';

/** Meta-tabla (gestion_catalogos) que alimenta el selector de concepto. */
const TABLA_CONCEPTOS = 'TIPOS_BENEFICIOS';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-enviar-mercancia',
  imports: [
    SharedModule
  ],
  templateUrl: './enviar-mercancia.component.html',
  styleUrls: ['./enviar-mercancia.component.css']
} )
export class EnviarMercanciaComponent {
  myForm: FormGroup;

  // La app corre zoneless: si estas listas fueran campos normales, asignarlas
  // dentro de un subscribe no dispararía render y los select quedarían vacíos.
  readonly sedes = signal<any[]>([]);
  readonly conceptos = signal<CatalogValue[]>([]);
  readonly cargandoConceptos = signal(true);

  constructor(
    private fb: FormBuilder,
    private comercializadoraService: ComercializadoraService,
    private utilityService: UtilityServiceService,
    private catalogos: GestionParametrizacionService,
    private router: Router
  ) {

    this.myForm = this.fb.group({
      sede: ['', Validators.required],
      cantidad: ['', Validators.required],
      valor: ['', [Validators.required, this.currencyValidator]],
      concepto: ['', Validators.required],
      otroConcepto: ['',],
      nombrePersonaEnvio: ['',],
      comentarioEnvio: ['',]
    });

    this.myForm.get('concepto')?.valueChanges.subscribe(value => {
      this.updateOtroConceptoValidator(value);
    });

    (this.utilityService.traerSucursales()).subscribe((data: any) => {
      // ordenar por nombre
      if (data) {
        data.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
        this.sedes.set(data);
      }
    });

    this.cargarConceptos();
  }

  /** Conceptos desde la meta-tabla TIPOS_BENEFICIOS (solo valores activos). */
  private cargarConceptos(): void {
    this.catalogos
      .listDatosByTablaCodigo(TABLA_CONCEPTOS, { activo: true })
      .subscribe({
        next: (opciones) => {
          const ordenadas = [...(opciones ?? [])].sort((a, b) =>
            this.labelConcepto(a).localeCompare(this.labelConcepto(b)),
          );
          this.conceptos.set(ordenadas.filter((o) => this.labelConcepto(o)));
          this.cargandoConceptos.set(false);
        },
        error: (err) => {
          console.error(`[enviar-mercancia] Error cargando ${TABLA_CONCEPTOS}:`, err);
          this.conceptos.set([]);
          this.cargandoConceptos.set(false);
          Swal.fire({
            icon: 'warning',
            title: 'Error cargando conceptos',
            text: `No se pudo cargar la lista de conceptos (${TABLA_CONCEPTOS}). Recargue la página o contacte a soporte.`,
          });
        },
      });
  }

  /** Texto visible de un valor de catálogo: descripción si existe, si no el código. */
  labelConcepto(concepto: CatalogValue): string {
    return String(concepto?.descripcion || concepto?.codigo || '').trim();
  }

  /** El catálogo puede traer "Otro" / "OTRO"; se compara sin importar mayúsculas. */
  esOtroConcepto(valor: string | null | undefined): boolean {
    return String(valor ?? '').trim().toUpperCase() === 'OTRO';
  }

  updateOtroConceptoValidator(concepto: string) {
    const otroConceptoControl = this.myForm.get('otroConcepto');
    if (this.esOtroConcepto(concepto)) {
      otroConceptoControl?.setValidators([Validators.required]);
    } else {
      otroConceptoControl?.clearValidators();
      otroConceptoControl?.setValue('', { emitEvent: false });
    }
    otroConceptoControl?.updateValueAndValidity({ emitEvent: false });
  }

  formatCurrency(event: any) {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    value = Number(value).toLocaleString();
    input.value = value;
  }

  currencyValidator(control: AbstractControl) {
    if (!control.value) return { required: true };
    const value = control.value.replace(/\D/g, '');
    return value ? null : { required: true };
  }

  async onSubmit() {
    if (this.myForm.invalid) {
      return;
    }

    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };

    if (this.esOtroConcepto(formValues.concepto)) {
      formValues.concepto = formValues.otroConcepto;
    }

    // Generar un código aleatorio como SKU/Código de envío
    const codigoSku = Math.floor(Math.random() * 1000000).toString();

    // Obtener datos del usuario logueado
    const user = this.utilityService.getUser();
    let personaEnvia = formValues.nombrePersonaEnvio;
    if (!personaEnvia && user) {
      personaEnvia = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;
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

    try {
      const response = await this.comercializadoraService.enviarMercanciaNuevo(payload);
      // El backend retorna 201 Created si fue exitoso
      if (response && response.id) {
        Swal.fire('Envío de mercancía', `Envío realizado con éxito. Código: ${codigoSku}`, 'success').then(() => {
          this.myForm.reset();
          Object.keys(this.myForm.controls).forEach(key => {
            this.myForm.get(key)?.setErrors(null);
          });
        });
      } else {
        Swal.fire('Envío de mercancía', 'Error inesperado al realizar el envío', 'error');
      }
    } catch (error) {
      console.error('Error al realizar envío:', error);
      Swal.fire('Envío de mercancía', 'Error al realizar el envío', 'error');
    }
  }

}
