import { SharedModule } from '@/app/shared/shared.module';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControlStatus, FormGroup, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { AdminService } from '../../../users/services/admin.service';
import { VetadosService } from '../../service/vetados/vetados.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

/** Datos del candidato ya normalizados para pintar (el crudo se queda en el form). */
interface CandidatoVista {
  cedula: string;
  nombre: string;
  centroCosto: string;
  fechaContratacion: string;
}

type EstadoBusqueda = 'inicial' | 'buscando' | 'encontrado' | 'no-encontrado' | 'error';

/** Antes eran 3000 ms: la pantalla parecía muerta durante 3 s tras teclear la cédula. */
const BUSQUEDA_DEBOUNCE_MS = 500;
const CEDULA_MIN_LEN = 5;
const MSG_NO_ENCONTRADO = 'No se encontró el candidato con la cédula proporcionada';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-banned-report',
  imports: [
    SharedModule
  ],
  templateUrl: './banned-report.component.html',
  styleUrl: './banned-report.component.css'
})
export class BannedReportComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly vetadosService = inject(VetadosService);
  private readonly utilityService = inject(UtilityServiceService);
  private readonly destroyRef = inject(DestroyRef);

  /** Sede del usuario logueado. Es la que el backend guarda (ver nota en enviarReporte). */
  sede: any;

  readonly reporteForm: FormGroup = this.fb.group({
    cedula: ['', Validators.required],
    nombre: [{ value: '', disabled: true }],
    sede: ['', Validators.required],
    observacion: ['', Validators.required],
    reportadoPor: [{ value: '', disabled: true }],
    centro_costo_carnet: ['', Validators.required],
    fecha_contratacion: [{ value: '', disabled: true }],
  });

  readonly sedes = signal<any[]>([]);
  readonly cargandoSedes = signal(true);
  readonly sedesFallaron = signal(false);
  readonly reportadoPor = signal('');
  readonly candidato = signal<CandidatoVista | null>(null);
  readonly estadoBusqueda = signal<EstadoBusqueda>('inicial');
  readonly enviando = signal(false);

  /** El form no es señal: statusChanges lo empuja aquí para que la vista reaccione sin markForCheck. */
  private readonly formStatus = signal<FormControlStatus>('INVALID');

  readonly puedeEnviar = computed(() =>
    this.formStatus() === 'VALID' &&
    this.estadoBusqueda() === 'encontrado' &&
    !this.enviando()
  );

  /** Por qué está apagado el botón: sin esto el usuario no sabe qué le falta. */
  readonly motivoBloqueo = computed(() => {
    if (this.enviando()) return 'Enviando el reporte…';
    switch (this.estadoBusqueda()) {
      case 'inicial': return 'Ingresa la cédula del candidato para continuar.';
      case 'buscando': return 'Verificando la cédula…';
      case 'no-encontrado': return 'La cédula no corresponde a ningún candidato.';
      case 'error': return 'No se pudo verificar la cédula. Corrígela o reintenta.';
    }
    return this.formStatus() === 'VALID' ? '' : 'Completa la sede, el centro de costo y la observación.';
  });

  ngOnInit(): void {
    this.formStatus.set(this.reporteForm.status);
    this.reporteForm.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(status => this.formStatus.set(status));

    this.escucharCedula();
    this.cargarSedes();
    this.cargarUsuario();
  }

  private escucharCedula(): void {
    this.reporteForm.get('cedula')!.valueChanges
      .pipe(
        map(valor => String(valor ?? '').trim()),
        // Se limpia ANTES del debounce: si no, durante medio segundo se ve el nombre
        // del candidato anterior junto a una cédula que ya no es la suya.
        tap(cedula => this.invalidarCandidatoSiCambio(cedula)),
        debounceTime(BUSQUEDA_DEBOUNCE_MS),
        distinctUntilChanged(),
        filter(cedula => cedula.length >= CEDULA_MIN_LEN),
        tap(() => this.estadoBusqueda.set('buscando')),
        // switchMap: con subscribe anidado, dos búsquedas en vuelo podían pintar
        // el nombre de la cédula vieja sobre la nueva.
        switchMap(cedula => this.vetadosService.traerNombreCompletoCandidato(cedula).pipe(
          map(respuesta => ({ ok: true as const, cedula, respuesta })),
          catchError(error => of({ ok: false as const, cedula, error }))
        )),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(resultado => {
        if (resultado.ok) {
          this.aplicarCandidato(resultado.cedula, resultado.respuesta);
        } else {
          this.fallarBusqueda(resultado.error);
        }
      });
  }

  private cargarSedes(): void {
    this.adminService.traerSucursales()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: any) => {
          const sucursales = Array.isArray(data?.sucursal) ? [...data.sucursal] : [];
          sucursales.sort((a: any, b: any) => String(a?.nombre ?? '').localeCompare(String(b?.nombre ?? '')));
          this.sedes.set(sucursales);
          this.cargandoSedes.set(false);
          this.sedesFallaron.set(false);
        },
        error: () => {
          this.sedes.set([]);
          this.cargandoSedes.set(false);
          this.sedesFallaron.set(true);
        }
      });
  }

  private cargarUsuario(): void {
    const user = this.utilityService.getUser();
    if (!user) return;
    const nombre = `${user.datos_basicos?.nombres ?? ''} ${user.datos_basicos?.apellidos ?? ''} - ${user.rol?.nombre ?? ''}`.trim();
    this.sede = user.sede?.nombre;
    this.reportadoPor.set(nombre);
    this.reporteForm.patchValue({ reportadoPor: nombre });
  }

  /**
   * Si la cédula ya no es la del candidato cargado, sus datos dejan de ser válidos.
   * Si es la misma (p. ej. borrar y reescribir un dígito) no se toca nada: el
   * distinctUntilChanged de abajo bloquearía la re-búsqueda y la ficha no volvería.
   */
  private invalidarCandidatoSiCambio(cedula: string): void {
    if (this.candidato()?.cedula === cedula) return;
    if (!this.candidato() && this.estadoBusqueda() === 'inicial') return;
    this.limpiarCandidato();
  }

  private limpiarCandidato(): void {
    this.candidato.set(null);
    this.estadoBusqueda.set('inicial');
    this.reporteForm.patchValue({ nombre: '', centro_costo_carnet: '', fecha_contratacion: '' });
  }

  private aplicarCandidato(cedula: string, respuesta: any): void {
    const nombre = String(respuesta?.nombre_completo ?? '').trim();
    if (!nombre) {
      // 200 con cuerpo vacío: para el usuario es lo mismo que no encontrarlo.
      this.marcarNoEncontrado('no-encontrado');
      return;
    }

    const centroCosto = respuesta?.centro_costo_carnet ?? '';
    const fechaCruda = respuesta?.fechaContratacion ?? '';

    // Al form va el valor crudo (es lo que viaja en el POST); el formateo es solo para pintar.
    this.reporteForm.patchValue({
      nombre,
      centro_costo_carnet: centroCosto,
      fecha_contratacion: fechaCruda
    });
    this.reporteForm.get('nombre')?.setErrors(null);
    this.reporteForm.get('cedula')?.setErrors(null);

    this.candidato.set({
      cedula,
      nombre,
      centroCosto: String(centroCosto ?? '').trim(),
      fechaContratacion: this.formatearFecha(fechaCruda)
    });
    this.estadoBusqueda.set('encontrado');
  }

  private fallarBusqueda(error: any): void {
    // Antes solo se manejaba el mensaje exacto de "no encontrado": un 500 o un corte
    // de red dejaban en pantalla al candidato anterior y el form seguía válido.
    const noEncontrado = error?.status === 404 || error?.error?.message === MSG_NO_ENCONTRADO;
    this.marcarNoEncontrado(noEncontrado ? 'no-encontrado' : 'error');
  }

  private marcarNoEncontrado(estado: Extract<EstadoBusqueda, 'no-encontrado' | 'error'>): void {
    this.reporteForm.patchValue({ nombre: '', centro_costo_carnet: '', fecha_contratacion: '' });
    this.reporteForm.get('nombre')?.setErrors({ notFound: true });
    this.reporteForm.get('cedula')?.setErrors({ notFound: true });
    this.candidato.set(null);
    this.estadoBusqueda.set(estado);
  }

  /** Acepta ISO y dd/mm/aaaa; si no se puede leer, devuelve el crudo antes que romper. */
  private formatearFecha(valor: any): string {
    const crudo = String(valor ?? '').trim();
    if (!crudo) return '';

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(crudo);
    if (iso) return this.aTexto(Number(iso[1]), Number(iso[2]), Number(iso[3]));

    const local = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(crudo);
    if (local) return this.aTexto(Number(local[3]), Number(local[2]), Number(local[1]));

    const fecha = new Date(crudo);
    if (!isNaN(fecha.getTime())) return this.aTexto(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate());

    return crudo;
  }

  private aTexto(anio: number, mes: number, dia: number): string {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const nombreMes = meses[mes - 1];
    if (!nombreMes) return `${dia}/${mes}/${anio}`;
    return `${String(dia).padStart(2, '0')} ${nombreMes} ${anio}`;
  }

  enviarReporte(): void {
    if (this.enviando()) return;

    if (!this.puedeEnviar()) {
      this.reporteForm.markAllAsTouched();
      Swal.fire({
        title: 'Faltan datos',
        text: this.motivoBloqueo() || 'Por favor, completa todos los campos requeridos.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    this.enviando.set(true);
    const reporte = this.reporteForm.getRawValue();

    // OJO: VetadosService.enviarReporte pisa reporte.sede con la sede del usuario.
    this.vetadosService.enviarReporte(reporte, this.sede)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // Las señales se apagan ANTES del Swal: el .then() del modal no repinta la vista.
        next: () => {
          this.enviando.set(false);
          this.reiniciarFormulario();
          Swal.fire({
            title: 'Reporte enviado',
            text: 'El reporte 901 quedó registrado correctamente.',
            icon: 'success',
            confirmButtonText: 'Aceptar'
          });
        },
        error: () => {
          this.enviando.set(false);
          Swal.fire({
            title: 'Error',
            text: 'Hubo un problema al enviar el reporte. Inténtalo de nuevo.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
        }
      });
  }

  /** Deja la pantalla lista para el siguiente reporte y evita reenviar el mismo dos veces. */
  private reiniciarFormulario(): void {
    this.reporteForm.reset({
      cedula: '',
      nombre: '',
      sede: '',
      observacion: '',
      reportadoPor: this.reportadoPor(),
      centro_costo_carnet: '',
      fecha_contratacion: ''
    });
    this.candidato.set(null);
    this.estadoBusqueda.set('inicial');
  }
}
