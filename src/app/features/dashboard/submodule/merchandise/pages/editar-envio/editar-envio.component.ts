import {  Component, OnInit , ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { ComercializadoraService } from '../../service/comercializadora/comercializadora.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-editar-envio',
  imports: [
    SharedModule
  ],
  templateUrl: './editar-envio.component.html',
  styleUrl: './editar-envio.component.css'
} )

export class EditarEnvioComponent implements OnInit {
  myForm: FormGroup;
  datosEnvio: any;
  sedes: any;
  conceptos: any;
  enviosDisponibles: any[] = [];
  enviosFiltrados: any[] = [];

  constructor(
    private fb: FormBuilder,
    private comercializadoraService: ComercializadoraService,
    private utilityService: UtilityServiceService,
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

    (this.utilityService.traerSucursales()).subscribe((data: any) => {
      // ordenar por nombre
      if (data) {
        data.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
        this.sedes = data;
      }
    });

    this.comercializadoraService.traerCategorias(31).then((data: any) => {
      this.conceptos = data[0].opciones;
    });
  }

  ngOnInit() {
    this.loadPendientes();
  }

  async loadPendientes() {
    try {
      // No filtramos por sede para que el usuario pueda ver lo que ha enviado
      // Podría filtrarse por realizado_por si el usuario solo puede ver lo suyo
      const response = await this.comercializadoraService.listarPendientesRecepcion('');
      this.enviosDisponibles = response.map((item: any) => ({
        codigo: item.id.toString(),
        concepto: item.producto_nombre,
        cantidad: item.cantidad,
        valor_unitario: item.valor_unitario,
        sede: item.numero_documento_destino,
        fecha: item.realizado_en,
        comentario: item.comentario
      }));
      // Ordenar por fecha descendente
      this.enviosDisponibles.sort(
        (a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );
      this.enviosFiltrados = [...this.enviosDisponibles];
    } catch (error) {
      console.error('Error cargando envíos pendientes:', error);
      Swal.fire('Oops...', 'Error al cargar los envíos pendientes', 'error');
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value.toLowerCase();
    this.enviosFiltrados = this.enviosDisponibles.filter(envio =>
      envio.codigo.includes(filterValue) ||
      envio.concepto.toLowerCase().includes(filterValue) ||
      envio.sede.toLowerCase().includes(filterValue)
    );
  }

  seleccionarEnvio(envio: any) {
    this.datosEnvio = envio;
    this.myForm.patchValue({
      codigoEnvio: envio.codigo,
      cantidad: envio.cantidad,
      valor: envio.valor_unitario,
      concepto: envio.concepto,
      sede: envio.sede,
      otroConcepto: ''
    });

    const isKnownConcept = this.conceptos.some((c: any) => c.valor === envio.concepto);
    if (!isKnownConcept) {
      this.myForm.patchValue({ concepto: 'Otro', otroConcepto: envio.concepto });
    }
  }

  volver() {
    this.datosEnvio = null;
    this.myForm.reset();
    this.loadPendientes();
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
    if (this.myForm.invalid) {
      return;
    }

    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };

    if (formValues.concepto === 'Otro') {
      formValues.concepto = formValues.otroConcepto;
    }

    const payload = {
      concepto: formValues.concepto,
      cantidad: formValues.cantidad,
      valor_unitario: formValues.valor,
      destino: formValues.sede
    };

    try {
      const response = await this.comercializadoraService.editarEnvioNuevo(formValues.codigoEnvio, payload);
      if (response && response.id) {
        Swal.fire('Edición de Envío', 'Envío editado con éxito', 'success').then(() => {
          this.volver();
        });
      } else {
        Swal.fire('Edición de Envío', 'Error al realizar la edición', 'error');
      }
    } catch (error) {
      console.error('Error al editar envío:', error);
      Swal.fire('Edición de Envío', 'Error al realizar la edición', 'error');
    }
  }




}
