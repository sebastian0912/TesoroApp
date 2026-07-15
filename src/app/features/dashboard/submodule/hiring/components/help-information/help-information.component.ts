import { SharedModule } from '@/app/shared/shared.module';
import { 
  Component,
  effect, input, computed, signal, inject, DestroyRef, LOCALE_ID,
  OnInit
, ChangeDetectionStrategy } from '@angular/core';
import {
  FormGroup, FormBuilder, Validators
} from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, startWith } from 'rxjs/operators';
import { of } from 'rxjs';
import Swal from 'sweetalert2';

import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { GestionParametrizacionService } from '../../../users/services/gestion-parametrizacion/gestion-parametrizacion.service';
import { FormEntrevistaComponent } from '../form-entrevista/form-entrevista.component';
import { ProcesoUpdateByDocumentRequest, RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { SeleccionEstadoService } from '../../service/seleccion/seleccion-estado.service';

// ================== Constantes ==================
export const MY_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY'
  }
};

interface OficinaDTO { nombre: string; numeroDeGenteRequerida: number; ruta: boolean; }
interface PublicacionDTO {
  id: number;
  cargo: string;
  oficinasQueContratan: OficinaDTO[];
  empresaUsuariaSolicita: string;
  finca: string | null;
  ubicacionPruebaTecnica: string | null;
  experiencia: string | null;
  fechadePruebatecnica: string | null;
  horadePruebatecnica: string | null;
  observacionVacante: string | null;
  fechadeIngreso: string | null;
  temporal: string | null;
  descripcion: string | null;
  fechaPublicado: string;
  quienpublicolavacante: string | null;
  estadovacante: string | null;
  salario: string | null;
  codigoElite: string | null;
  area: string | null;
  pruebaOContratacion: string | null;
  tipoContratacion: string | null;
  municipio: string[] | null;
  auxilioTransporte: string | null;
  conteo_estados?: any;
  activo?: boolean;
}

@Component({
  selector: 'app-help-information',
  standalone: true,
  imports: [SharedModule, MatTabsModule, MatDatepickerModule, MatNativeDateModule, FormEntrevistaComponent],
  templateUrl: './help-information.component.html',
  styleUrl: './help-information.component.css',
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ]
})
export class HelpInformationComponent implements OnInit {

  // ========= Inputs/Outputs basados en signals =========
  candidatoSeleccionado = input<any | null>(null);

  // ========= Inyección =========
  private fb = inject(FormBuilder);
  private gp = inject(GestionParametrizacionService);
  private vacantesService = inject(VacantesService);
  public utilService = inject(UtilityServiceService);
  private destroyRef = inject(DestroyRef);
  private gc = inject(RegistroProcesoContratacion);
  private seleccionEstado = inject(SeleccionEstadoService);

  /**
   * El candidato quedó EN ESPERA de vacante o marcado NO APLICA (observación del
   * evaluador). Mientras sea true, la pestaña de Remisión se bloquea: no se puede
   * asignar vacante.
   */
  readonly bloqueado = this.seleccionEstado.bloqueado;
  /** Frase del motivo del bloqueo para el banner ("en espera de vacante" / "marcado como NO APLICA"). */
  readonly motivoBloqueo = this.seleccionEstado.motivoBloqueo;

  // ========= Estado local (signals) =========
  vacantes = signal<PublicacionDTO[]>([]);
  // id seleccionado desde el select o desde el proceso/candidato
  selectedVacanteId = signal<number | null>(null);

  // Vacante actualmente seleccionada (mantiene sincronía entre lista e id)
  vacanteSeleccionada = signal<PublicacionDTO | null>(null);

  // ========= Filtro y Búsqueda =========
  searchVacanteCtrl = this.fb.control<string>('', { nonNullable: true });
  searchVacanteSig = toSignal(this.searchVacanteCtrl.valueChanges.pipe(startWith('')));

  // ========= Formularios =========
  vacantesForm: FormGroup;

  sede: string | undefined;

  // ========= "Sin vacante" (quitar asignación) =========
  /** Valor centinela del <mat-select> para la opción "Sin vacante". */
  readonly SIN_VACANTE = -1;
  /**
   * El operador eligió "Sin vacante": al guardar se limpia la vacante y los
   * datos de remisión de la persona (publicacion=null + banderas en false).
   * No se asigna ninguna vacante nueva.
   */
  limpiarVacante = signal<boolean>(false);

  // ========= "No pasó la prueba técnica" =========
  /** El candidato fue remitido a prueba técnica pero NO la pasó. */
  noPasoPrueba = signal<boolean>(false);
  /** Fecha (ISO) en que se marcó que no pasó la prueba técnica. */
  noPasoPruebaAt = signal<string | null>(null);
  /** Motivo registrado de por qué no pasó la prueba técnica. */
  motivoNoPaso = signal<string | null>(null);

  // ========= Catálogos a signals =========
  private _estadosCiviles$ = this.gp
    .listMetaValoresByTablaCodigo('ESTADOS_CIVILES', { activo: true })
    .pipe(catchError(() => of([])));

  private _opcionesPromo$ = this.gp
    .listMetaValoresByTablaCodigo('CATALOGO_MARKETING', { activo: true })
    .pipe(catchError(() => of([])));

  estadosCiviles = toSignal(this._estadosCiviles$, { initialValue: [] as any[] });
  opcionesPromocion = toSignal(this._opcionesPromo$, { initialValue: [] as any[] });

  // ========= Derivados (computed) =========
  private tipoCtrl = this.fb.control<string>('', { nonNullable: true });
  tipoSig = toSignal(this.tipoCtrl.valueChanges.pipe(startWith(this.tipoCtrl.value)));
  isAutorizacion = computed(() => this.tipoSig() === 'Autorización de ingreso');
  isPrueba = computed(() => this.tipoSig() === 'Prueba técnica');

  totalRequerida = computed(() => {
    const v = this.vacanteSeleccionada();
    const ofs = Array.isArray(v?.oficinasQueContratan) ? v!.oficinasQueContratan : [];
    return ofs.reduce((acc, o) => acc + this.toInt(o?.numeroDeGenteRequerida), 0);
  });

  // ── Árbol de vacantes agrupadas (Empresa → Finca → Vacantes) ──
  vacantesAgrupadas = computed(() => {
    const list = this.vacantes();
    const map = new Map<string, Map<string, PublicacionDTO[]>>();

    const currentSelectedId = this.selectedVacanteId();
    const searchVal = this.utilService.normalizeText(this.searchVacanteSig() || '').toLowerCase();

    for (const v of list) {
      // 1) Filtrar inactivos EXCEPTUANDO si ya es la vacante seleccionada
      const isSelected = Number(v.id) === currentSelectedId;
      if (v.activo === false && !isSelected) continue;

      // 2) Filtrar las que tienen 0 faltantes, EXCEPTO la ya seleccionada
      if (this.falt(v) === 0 && !isSelected) continue;

      const emp = v.empresaUsuariaSolicita || 'Sin Empresa';
      const finca = v.finca || 'Sin Finca';
      const cargo = v.cargo || 'Sin Cargo';

      // 3) Filtro de búsqueda textual (Empresa, Finca, Cargo)
      if (searchVal && !isSelected) {
        const strEmp = this.utilService.normalizeText(emp).toLowerCase();
        const strFinca = this.utilService.normalizeText(finca).toLowerCase();
        const strCargo = this.utilService.normalizeText(cargo).toLowerCase();
        if (!strEmp.includes(searchVal) && !strFinca.includes(searchVal) && !strCargo.includes(searchVal)) {
          continue;
        }
      }

      if (!map.has(emp)) {
        map.set(emp, new Map());
      }
      const fincasMap = map.get(emp)!;

      if (!fincasMap.has(finca)) {
        fincasMap.set(finca, []);
      }
      fincasMap.get(finca)!.push(v);
    }

    const result = [];
    let totalItems = 0;
    const MAX_ITEMS = 60;

    for (const [empresa, fincasMap] of map.entries()) {
      if (totalItems >= MAX_ITEMS) break;
      const fincas = [];
      for (const [finca, vacs] of fincasMap.entries()) {
        if (totalItems >= MAX_ITEMS) break;

        let sortedVacs = vacs.sort((a, b) => (a.cargo || '').localeCompare(b.cargo || '', 'es', { sensitivity: 'base' }));
        if (totalItems + sortedVacs.length > MAX_ITEMS) {
          sortedVacs = sortedVacs.slice(0, MAX_ITEMS - totalItems);
        }

        fincas.push({
          finca,
          vacantes: sortedVacs
        });
        totalItems += sortedVacs.length;
      }
      fincas.sort((a, b) => a.finca.localeCompare(b.finca, 'es', { sensitivity: 'base' }));
      if (fincas.length > 0) result.push({ empresa, fincas });
    }

    return result.sort((a, b) => a.empresa.localeCompare(b.empresa, 'es', { sensitivity: 'base' }));
  });

  // ── Turno en cola de antecedentes ──
  turnoEnCola = computed(() => {
    const cand = this.candidatoSeleccionado();
    const cola = cand?.cola_antecedentes ?? cand?.colaAntecedentes;
    if (!cola) return null;

    // Ignoramos: 'medidas_correctivas' y 'fondo_pension' (AFP)
    const activeKeys = ['adress', 'policivo', 'ofac', 'contraloria', 'sisben', 'procuraduria'];
    let faltanMaxima = 0;
    let hayEnProgreso = false;
    let allFinished = true;

    for (const key of activeKeys) {
      const info = cola[key];
      if (info) {
        const est = (info.estado || '').toUpperCase();
        if (est !== 'FINALIZADO' && est !== 'DESCARGADO ROBOT') {
          allFinished = false;
          if (est === 'EN_PROGRESO') hayEnProgreso = true;

          if (typeof info.faltan_antes === 'number' && info.faltan_antes > faltanMaxima) {
            faltanMaxima = info.faltan_antes;
          }
        }
      } else {
        allFinished = false;
      }
    }

    if (allFinished) return { finalizado: true, faltan: 0 };
    return { finalizado: false, faltan: faltanMaxima, enProgreso: hayEnProgreso };
  });

  // ========= Constructor =========
  constructor() {
    // --- Form principal (inyectamos tipoCtrl para observarlo como signal)
    this.vacantesForm = this.fb.group({
      tipo: this.tipoCtrl,
      empresaUsuaria: [''],
      cargo: [''],
      area: [''],
      fechaIngreso: [''],
      salario: [''],
      fechaPruebaEntrevista: [''],
      horaPruebaEntrevista: [''],
      direccionEmpresa: ['']
    });

    // --- Effect: reaccionar a inputs (candidato)
    effect(() => {
      this.onInputsChanged(this.candidatoSeleccionado());
    });

    // --- Effect: mantener vacanteSeleccionada sincronizada al cambiar id o lista
    effect(() => {
      const id = this.selectedVacanteId();
      const list = this.vacantes();
      const v = id != null ? (list.find(x => Number(x.id) === Number(id)) || null) : null;
      this.vacanteSeleccionada.set(v);

      if (v) {
        // Rellenar sólo los campos que estén vacíos en el formulario con los datos de la vacante predeterminada
        const currentVals = this.vacantesForm.getRawValue();
        const toDate = (yyyyMmDd: string | null) => yyyyMmDd ? new Date(`${yyyyMmDd}T00:00:00`) : null;
        const toTime = (hhmmss: string | null) => hhmmss ? hhmmss.slice(0, 5) : null;
        const salarioNum = v.salario && v.salario !== '0.00' ? Number(v.salario) : null;

        this.vacantesForm.patchValue({
          tipo: currentVals.tipo || this.mapApiTipoToForm(v.pruebaOContratacion),
          empresaUsuaria: currentVals.empresaUsuaria || (v.empresaUsuariaSolicita ?? ''),
          cargo: currentVals.cargo || (v.cargo ?? ''),
          fechaIngreso: currentVals.fechaIngreso || toDate(v.fechadeIngreso),
          salario: currentVals.salario || salarioNum,
          area: currentVals.area || (v.area ?? ''),
          fechaPruebaEntrevista: currentVals.fechaPruebaEntrevista || toDate(v.fechadePruebatecnica),
          horaPruebaEntrevista: currentVals.horaPruebaEntrevista || toTime(v.horadePruebatecnica),
          direccionEmpresa: currentVals.direccionEmpresa || (v.ubicacionPruebaTecnica ?? '')
        }, { emitEvent: true }); // emitEvent true para que los signals de visibilidad (como isAutorizacion) reaccionen
      }
    });
  }

  ngOnInit() {
    const user = this.utilService.getUser();
    if (user) {
      this.sede = user.sede?.nombre || null;

      if (this.sede) {
        this.vacantesService.getVacantesPorOficina(this.sede).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: (vacantes) => {
            this.vacantes.set(vacantes);
          },
          error: () => {
            // Puedes loguear o toastear si lo deseas
          }
        });
      }
    }
  }

  // ===== Handlers =====
  private onInputsChanged(candidato: any | null) {
    // Al cambiar de candidato, descartamos cualquier intención previa de limpiar.
    this.limpiarVacante.set(false);
    // Reseteamos el estado de "no pasó la prueba técnica"; se rehidrata desde el proceso.
    this.noPasoPrueba.set(false);
    this.noPasoPruebaAt.set(null);
    this.motivoNoPaso.set(null);
    if (candidato && candidato?.id) {
      // Intenta cargar el proceso del candidato
      const proceso = candidato.entrevistas?.[0]?.proceso;
      if (proceso) {
        this.patchProcesoSeleccionToForms(proceso);
      } else {
        // Fallback si no hay proceso directamente anidado, aunque normalmente llega.
        const vacanteId = candidato.entrevistas?.[0]?.proceso?.publicacion;
        if (vacanteId != null) this.onVacanteIdChange(vacanteId);
      }
    }
  }

  onVacanteIdChange(id: number | string): void {
    const idNum = Number(id);

    // "Sin vacante": limpiar la selección y marcar la intención de quitar la
    // asignación. La persistencia ocurre al pulsar "Quitar vacante".
    if (idNum === this.SIN_VACANTE) {
      this.limpiarVacanteSeleccion();
      return;
    }

    this.limpiarVacante.set(false);
    this.selectedVacanteId.set(idNum);

    // Cuando el usuario elige del dropdown, rellenamos las fechas/salarios base de la vacante.
    const list = this.vacantes();
    const v = list.find(x => Number(x.id) === idNum);
    if (v) {
      this.patchVacanteToForm(v);
    }
  }

  /**
   * Limpia en la UI la vacante seleccionada y los campos de remisión, y marca la
   * intención de quitar la asignación. No toca el backend: eso ocurre al guardar
   * (guardarVacantes → limpiarVacanteEnBackend).
   */
  private limpiarVacanteSeleccion(): void {
    this.selectedVacanteId.set(null);
    this.vacanteSeleccionada.set(null);
    this.limpiarVacante.set(true);
    // Quitar la vacante también descarta el resultado de prueba técnica en la UI.
    this.noPasoPrueba.set(false);
    this.noPasoPruebaAt.set(null);
    this.motivoNoPaso.set(null);
    this.vacantesForm.reset(
      {
        tipo: '',
        empresaUsuaria: '',
        cargo: '',
        area: '',
        fechaIngreso: '',
        salario: '',
        fechaPruebaEntrevista: '',
        horaPruebaEntrevista: '',
        direccionEmpresa: '',
      },
      { emitEvent: true }
    );
  }



  async guardarInfoPersonal(): Promise<void> {
    console.log('Guardando info personal...');
  }

  private norm(s: any): string {
    return this.utilService.normalizeText(s).toLowerCase();
  }

  private mapApiTipoToForm(apiVal: any): '' | 'Prueba técnica' | 'Autorización de ingreso' {
    const t = this.norm(apiVal);
    if (t === 'prueba' || t === 'prueba tecnica' || t === 'prueba_tecnica') return 'Prueba técnica';
    if (t.startsWith('contrat') || (t.includes('autorizacion') && t.includes('ingreso'))) return 'Autorización de ingreso';
    return '';
  }

  private patchVacanteToForm(v: PublicacionDTO): void {
    const toDate = (yyyyMmDd: string | null) => yyyyMmDd ? new Date(`${yyyyMmDd}T00:00:00`) : null;
    const toTime = (hhmmss: string | null) => hhmmss ? hhmmss.slice(0, 5) : null;
    const salarioNum = v.salario && v.salario !== '0.00' ? Number(v.salario) : null;

    this.vacantesForm.patchValue({
      tipo: this.mapApiTipoToForm(v.pruebaOContratacion),
      empresaUsuaria: v.empresaUsuariaSolicita ?? '',
      cargo: v.cargo ?? '',
      fechaIngreso: toDate(v.fechadeIngreso),
      salario: salarioNum,
      area: v.area ?? '',
      fechaPruebaEntrevista: toDate(v.fechadePruebatecnica),
      horaPruebaEntrevista: toTime(v.horadePruebatecnica),
      direccionEmpresa: v.ubicacionPruebaTecnica ?? ''
    }, { emitEvent: true });
  }

  private patchProcesoSeleccionToForms(p: any): void {
    const toDate = (yyyyMmDd?: string | null) => (yyyyMmDd ? new Date(`${yyyyMmDd}T00:00:00`) : null);
    const toTime = (hhmm?: string | null) => (hhmm ? String(hhmm).slice(0, 5) : null);

    this.vacantesForm.patchValue({
      tipo: this.mapApiTipoToForm(p?.tipo ?? p?.pruebaOContratacion),
      empresaUsuaria: p?.centro_costo_entrevista ?? p?.empresa_usuario ?? '',
      cargo: p?.cargo ?? '',
      area: p?.area_entrevista ?? '',
      fechaPruebaEntrevista: toDate(p?.fecha_prueba_entrevista),
      horaPruebaEntrevista: toTime(p?.hora_prueba_entrevista),
      direccionEmpresa: p?.direccion_empresa ?? '',
      fechaIngreso: toDate(p?.fechaIngreso),
      salario: p?.salario ? Number(p.salario) : null
    }, { emitEvent: true });

    // Estado de "no pasó la prueba técnica" (resultado registrado en el proceso).
    this.noPasoPrueba.set(!!p?.no_paso_prueba_tecnica);
    this.noPasoPruebaAt.set(p?.no_paso_prueba_tecnica_at ?? null);
    this.motivoNoPaso.set(p?.motivo_no_paso_prueba_tecnica ?? null);

    // Si el proceso trae id de vacante, sincroniza selección
    if (p?.publicacion != null) {
      this.selectedVacanteId.set(Number(p.publicacion));
    } else if (p?.vacante != null) {
      this.selectedVacanteId.set(Number(p.vacante));
    }
  }

  private toYMD(value: any): string | null {
    if (!value) return null;

    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
  }


  async guardarVacantes(): Promise<void> {
    // Bloqueo: no se puede remitir si el candidato está EN ESPERA de vacante o NO APLICA.
    if (this.bloqueado()) {
      await Swal.fire({
        title: `Candidato ${this.motivoBloqueo()}`,
        text: 'No se puede asignar una vacante con la observación actual del evaluador.',
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
      });
      return;
    }

    // Caso "Sin vacante": el operador quiere quitar la asignación actual.
    if (this.limpiarVacante() && !this.vacanteSeleccionada()) {
      await this.limpiarVacanteEnBackend();
      return;
    }

    // 1) Validaciones básicas
    const v = this.vacanteSeleccionada();
    if (!v) {
      await Swal.fire({
        title: 'Selecciona una vacante primero.',
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    const tipo = this.vacantesForm.get('tipo')?.value as string | null;
    if (!tipo) {
      await Swal.fire({
        title: 'Selecciona el tipo (Contratación inmediata o Prueba técnica).',
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    const numeroDocumento = this.candidatoSeleccionado()?.numero_documento;
    if (!numeroDocumento) {
      await Swal.fire({
        title: 'No hay número de documento del candidato.',
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    // 2) Salario (form > vacante)
    const salarioForm = this.vacantesForm.get('salario')?.value;
    const salarioVac = v.salario;
    const vacante_salario = (salarioForm ?? salarioVac) ?? null;

    // === MAPEO solicitado para el select "tipo" ===
    const tipoValue = v.pruebaOContratacion ?? '';
    const vacante_tipo =
      tipoValue === 'Prueba'
        ? 'Prueba técnica'
        : tipoValue === 'Contratación'
          ? 'Autorización de ingreso'
          : null;



    // 3) Payload para /procesos/update-by-document
    const fechaPruebaControl = this.vacantesForm.get('fechaPruebaEntrevista')?.value;
    const vacanteFechaPrueba = this.toYMD(fechaPruebaControl);

    const payload: ProcesoUpdateByDocumentRequest = {
      numero_documento: numeroDocumento,
      publicacion: v.id,
      vacante_tipo, // ya mapeado
      vacante_fecha_prueba: vacanteFechaPrueba, // <-- YA en YYYY-MM-DD o null
      vacante_salario,
      ...(tipo === 'Prueba técnica' ? { prueba_tecnica: true } : {}),
      ...(tipo === 'Autorización de ingreso' ? { autorizado: true } : {}),
    };


    // 4) Llamar al backend
    try {
      Swal.fire({
        title: 'Guardando...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await this.gc.updateProcesoByDocumento(payload, 'PATCH').toPromise();

      await Swal.fire({
        title: 'Proceso actualizado correctamente.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });

      console.log('Proceso actualizado:', res?.proceso);
    } catch (err: any) {
      const msg = err?.error?.detail || 'No se pudo actualizar el proceso.';
      await Swal.fire({
        title: 'Error',
        text: msg,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      console.error(err);
    } finally {
      Swal.close();
    }
  }

  /**
   * Quita la vacante asignada al candidato: limpia publicacion y los datos de
   * remisión (tipo, salario, fecha de prueba) y desmarca las banderas
   * prueba_tecnica / autorizado. El backend ya soporta publicacion=null.
   */
  private async limpiarVacanteEnBackend(): Promise<void> {
    const numeroDocumento = this.candidatoSeleccionado()?.numero_documento;
    if (!numeroDocumento) {
      await Swal.fire({
        title: 'No hay número de documento del candidato.',
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    const confirm = await Swal.fire({
      title: '¿Quitar la vacante asignada?',
      text: 'Se limpiará la vacante y los datos de remisión de esta persona.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar',
    });
    if (!confirm.isConfirmed) return;

    const payload: ProcesoUpdateByDocumentRequest = {
      numero_documento: numeroDocumento,
      publicacion: null,
      vacante_tipo: null,
      vacante_salario: null,
      vacante_fecha_prueba: null,
      prueba_tecnica: false,
      autorizado: false,
    };

    try {
      Swal.fire({
        title: 'Quitando vacante...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await this.gc.updateProcesoByDocumento(payload, 'PATCH').toPromise();

      this.limpiarVacante.set(false);

      await Swal.fire({
        title: 'Vacante quitada correctamente.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err: any) {
      const msg = err?.error?.detail || 'No se pudo quitar la vacante.';
      await Swal.fire({
        title: 'Error',
        text: msg,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      console.error(err);
    } finally {
      Swal.close();
    }
  }

  /**
   * Marca que el candidato NO pasó la prueba técnica: pide el motivo y persiste
   * el resultado (con fecha sellada por el backend). Si ya estaba marcado,
   * permite editar el motivo.
   */
  async marcarNoPasoPrueba(): Promise<void> {
    if (this.bloqueado()) {
      await Swal.fire({
        title: `Candidato ${this.motivoBloqueo()}`,
        text: 'No se puede registrar el resultado de la prueba técnica con la observación actual.',
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
      });
      return;
    }

    const numeroDocumento = this.candidatoSeleccionado()?.numero_documento;
    if (!numeroDocumento) {
      await Swal.fire({
        title: 'No hay número de documento del candidato.',
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    const { value: motivo, isConfirmed } = await Swal.fire({
      title: 'No pasó la prueba técnica',
      input: 'textarea',
      inputLabel: 'Motivo por el que no pasó la prueba técnica',
      inputValue: this.motivoNoPaso() ?? '',
      inputPlaceholder: 'Describe el motivo…',
      inputAttributes: { maxlength: '500', 'aria-label': 'Motivo no pasó prueba técnica' },
      inputValidator: (val: any) => {
        const t = String(val ?? '').trim();
        if (!t) return 'El motivo es obligatorio.';
        if (t.length < 5) return 'Amplía un poco más el motivo (mínimo 5 caracteres).';
        return null;
      },
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: () => !Swal.isLoading(),
    });

    if (!isConfirmed) return;
    const motivoText = String(motivo ?? '').trim();

    const payload: ProcesoUpdateByDocumentRequest = {
      numero_documento: numeroDocumento,
      no_paso_prueba_tecnica: true,
      motivo_no_paso_prueba_tecnica: motivoText,
    };

    try {
      Swal.fire({
        title: 'Guardando...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await this.gc.updateProcesoByDocumento(payload, 'PATCH').toPromise();
      const proc: any = res?.proceso;

      this.noPasoPrueba.set(true);
      this.noPasoPruebaAt.set(proc?.no_paso_prueba_tecnica_at ?? new Date().toISOString());
      this.motivoNoPaso.set(proc?.motivo_no_paso_prueba_tecnica ?? motivoText);

      await Swal.fire({
        title: 'Resultado registrado: no pasó la prueba técnica.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err: any) {
      const msg = err?.error?.detail || 'No se pudo registrar el resultado.';
      await Swal.fire({ title: 'Error', text: msg, icon: 'error', confirmButtonText: 'OK' });
      console.error(err);
    } finally {
      Swal.close();
    }
  }

  /** Quita la marca de "no pasó la prueba técnica" (limpia fecha y motivo). */
  async quitarNoPasoPrueba(): Promise<void> {
    if (this.bloqueado()) return;

    const numeroDocumento = this.candidatoSeleccionado()?.numero_documento;
    if (!numeroDocumento) return;

    const confirm = await Swal.fire({
      title: '¿Quitar la marca de "no pasó"?',
      text: 'Se eliminará el resultado y el motivo registrados para la prueba técnica.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar',
    });
    if (!confirm.isConfirmed) return;

    const payload: ProcesoUpdateByDocumentRequest = {
      numero_documento: numeroDocumento,
      no_paso_prueba_tecnica: false,
    };

    try {
      Swal.fire({
        title: 'Quitando...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await this.gc.updateProcesoByDocumento(payload, 'PATCH').toPromise();

      this.noPasoPrueba.set(false);
      this.noPasoPruebaAt.set(null);
      this.motivoNoPaso.set(null);

      await Swal.fire({
        title: 'Marca quitada.',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true,
      });
    } catch (err: any) {
      const msg = err?.error?.detail || 'No se pudo quitar la marca.';
      await Swal.fire({ title: 'Error', text: msg, icon: 'error', confirmButtonText: 'OK' });
      console.error(err);
    } finally {
      Swal.close();
    }
  }

  // ── Wrapper para usar en el template con argumento ──
  totalRequeridaOf(v: any): number {
    return Number(v?.personasSolicitadas) || 0;
  }

  // ── KPIs granulares ──
  private ce(v: any): any { return v?.conteo_estados || {}; }
  entrev(v: any): number { return this.ce(v).entrevistado || 0; }
  prue(v: any): number { return this.ce(v).prueba_tecnica || 0; }
  auto(v: any): number { return this.ce(v).autorizado || 0; }
  exm(v: any): number { return this.ce(v).examenes_medicos || 0; }
  firm(v: any): number { return this.ce(v).contratado || 0; }

  falt(v: any): number {
    return Math.max(0, this.totalRequeridaOf(v) - this.firm(v));
  }
  oficinasResumen(ofs: any[]): string {
    if (!Array.isArray(ofs) || !ofs.length) return '—';
    return ofs.map(o => `${o?.nombre ?? 'Oficina'} (${this.toInt(o?.numeroDeGenteRequerida)})`).join(', ');
  }
  formatShortDate(d: any): string {
    if (!d) return '—';

    // Si viene como 'YYYY-MM-DD', parsea a local agregando T00:00:00
    const date = (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
      ? new Date(d + 'T00:00:00')  // ← local
      : new Date(d);

    if (isNaN(date.getTime())) return '—';

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }


  // ── Handler que el template invoca ──
  onTipoChange(tipo: string): void {
    if (tipo === 'Autorización de ingreso') {
      this.vacantesForm.patchValue({
        area: '',
        fechaPruebaEntrevista: '',
        horaPruebaEntrevista: '',
        direccionEmpresa: ''
      });
    } else if (tipo === 'Prueba técnica') {
      this.vacantesForm.patchValue({
        fechaIngreso: '',
        salario: ''
      });
    }
  }

  // ===== Utilidades varias =====
  private toInt(v: unknown): number {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string') { const m = v.match(/-?\d+/); return m ? parseInt(m[0], 10) : 0; }
    return 0;
  }
}
