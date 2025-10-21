import { SharedModule } from '@/app/shared/shared.module';
import {
  Component,
  effect, input, computed, signal, inject, DestroyRef, LOCALE_ID,
  OnInit, ViewChild, ElementRef
} from '@angular/core';
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
}

@Component({
  selector: 'app-help-information',
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

  // ========= Estado local (signals) =========
  vacantes = signal<PublicacionDTO[]>([]);
  // id seleccionado desde el select o desde el proceso/candidato
  selectedVacanteId = signal<number | null>(null);

  // Filtro por finca (para el mat-select con buscador)
  filtroFinca = signal<string>('');

  // Para enfocar el input del filtro cuando abre el panel del select
  @ViewChild('filtroInput') filtroInput!: ElementRef<HTMLInputElement>;

  // Vacante actualmente seleccionada (mantiene sincronía entre lista e id)
  vacanteSeleccionada = signal<PublicacionDTO | null>(null);

  // ========= Formularios =========
  vacantesForm: FormGroup;

  sede: string | undefined;

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

  // Lista de vacantes filtrada por finca
  filteredVacantes = computed(() => {
    const q = this.norm(this.filtroFinca());
    const list = this.vacantes();
    if (!q) return list;
    return list.filter(v => this.norm(v.finca).includes(q));
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
      if (v) this.patchVacanteToForm(v);
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
    if (candidato && candidato?.id) {
      // Obtén el id de la publicación (vacante) desde el proceso
      const vacanteId = candidato.entrevistas?.[0]?.proceso?.publicacion;
      if (vacanteId != null) this.onVacanteIdChange(vacanteId);
    }
  }

  onVacanteIdChange(id: number | string): void {
    const idNum = Number(id);
    this.selectedVacanteId.set(idNum);
    // La sincronización y el patch al form lo hace el effect().
  }

  onOpen(opened: boolean) {
    if (opened) {
      // Enfoca el input del filtro cuando abre el panel
      setTimeout(() => this.filtroInput?.nativeElement?.focus(), 0);
    } else {
      // Opcional: limpiar filtro al cerrar
      // this.filtroFinca.set('');
    }
  }

  clearFiltro() {
    this.filtroFinca.set('');
    setTimeout(() => this.filtroInput?.nativeElement?.focus(), 0);
  }

  async guardarInfoPersonal(): Promise<void> {
    console.log('Guardando info personal...');
  }

  private norm(s: any): string {
    return (s ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
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

    // Si el proceso trae id de vacante, sincroniza selección
    if (p?.vacante != null) {
      this.selectedVacanteId.set(Number(p.vacante));
    }
  }

  async guardarVacantes(): Promise<void> {
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
        title: 'Selecciona el tipo (Autorización de ingreso o Prueba técnica).',
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
    const payload: ProcesoUpdateByDocumentRequest = {
      numero_documento: numeroDocumento,
      publicacion: v.id,
      vacante_tipo,               // 👈 ya mapeado
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

  // ── Wrapper para usar en el template con argumento ──
  totalRequeridaOf(v: any): number {
    const ofs = Array.isArray(v?.oficinasQueContratan) ? v.oficinasQueContratan : [];
    return ofs.reduce((acc: number, o: any) => acc + this.toInt(o?.numeroDeGenteRequerida), 0);
  }

  // ── KPIs/estilos que usa el template ──
  countPre(v: any): number {
    const p = v?.preseleccionados;
    return Array.isArray(p) ? p.length : this.toInt(p);
  }
  countCont(v: any): number {
    const c = v?.contratados;
    return Array.isArray(c) ? c.length : this.toInt(c);
  }
  pillClasePre(v: any): string {
    const req = this.totalRequeridaOf(v);
    const pre = this.countPre(v);
    return pre >= req ? 'pill-ok' : 'pill-error';
  }
  pillClaseCont(v: any): string {
    const req = this.totalRequeridaOf(v);
    const pre = this.countPre(v);
    const cont = this.countCont(v);
    if (cont >= req) return 'pill-ok';
    if (pre >= req && cont < req) return 'pill-warn';
    return 'pill-error';
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
