import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
  FormControl,
  ValidatorFn,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_FORMATS, DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { HttpClient } from '@angular/common/http';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { MatChipsModule } from '@angular/material/chips';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { PositionsService } from '../../../positions/services/positions/positions.service';

export const MY_DATE_FORMATS = {
  parse: { dateInput: 'D/M/YYYY' },
  display: {
    dateInput: 'D/M/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

/** Grupos tipados del FormArray de municipios */
interface DistMunControls {
  municipio: FormControl<string>;
  cantidad: FormControl<number | null>;
}
type DistMunGroup = FormGroup<DistMunControls>;

@Component({
  selector: 'app-crear-editar-vacante',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    FormsModule,
    MatChipsModule,
  ],
  templateUrl: './crear-editar-vacante.component.html',
  styleUrls: ['./crear-editar-vacante.component.css'],
  providers: [
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
  ],
})
export class CrearEditarVacanteComponent implements OnInit {
  private readonly SI = 'Si';
  private readonly PRUEBA = 'Prueba';

  vacanteForm!: FormGroup;
  sedes: any[] = [];
  user: any;

  cargos: string[] = [];
  filteredCargos!: Observable<string[]>;
  centrosCostos: string[] = [];
  filteredCentrosCostos!: Observable<string[]>;
  municipiosColombia: string[] = [];
  municipiosFiltrados: string[] = [];
  municipioFiltro = '';
  municipioCtrl = new FormControl('');

  separatorKeysCodes: number[] = [ENTER, COMMA];
  @ViewChild('municipioInput', { static: false }) municipioInput!: ElementRef<HTMLInputElement>;

  areas: string[] = [
    'Rosa', 'Clavel', 'Astromelia', 'Pompon', 'Miniclavel', 'Diversificados', 'Lirios', 'Fumigación', 'Corte de Rosa', 'Oficios Varios', 'Otros',
  ];

  today: Date = new Date();

  private prevMunicipios: string[] = [];
  exigirIgualdadTotal = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public dialogRef: MatDialogRef<CrearEditarVacanteComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private adminService: UtilityServiceService,
    private vacantesService: VacantesService,
    private positionsService: PositionsService
  ) {
    this.today.setHours(0, 0, 0, 0);
  }

  async ngOnInit(): Promise<void> {
    this.user = JSON.parse(localStorage.getItem('user') || '{}');

    this.vacanteForm = this.fb.group(
      {
        cargo: ['', Validators.required],
        finca: ['', Validators.required],
        empresaUsuariaSolicita: ['', Validators.required],
        temporal: ['', Validators.required],

        experiencia: ['', Validators.required],
        observacionVacante: [''],
        descripcion: ['', Validators.required],
        fechaPublicado: [new Date()],
        quienpublicolavacante: [
          `${this.user?.datos_basicos?.nombres ?? ''} ${this.user?.datos_basicos?.apellidos ?? ''}`.trim(),
        ],
        estadovacante: ['Activa'],
        salario: [1423500, [Validators.required, Validators.min(0)]],
        codigoElite: [''],

        // Condicional 1: Fecha de ingreso
        tieneFechaIngreso: ['No', Validators.required],
        fechadeIngreso: [null], // Date | null

        // Condicional 2: Prueba o Contratación
        pruebaOContratacion: ['', Validators.required],
        fechadePruebatecnica: [null],   // Date | null (requerida si Prueba)
        horadePruebatecnica: [''],      // string HH:mm (requerida si Prueba)
        ubicacionPruebaTecnica: [''],   // opcional si Prueba

        tipoContratacion: ['', Validators.required],

        municipio: [[], Validators.required],

        personasSolicitadas: [null, [Validators.required, Validators.min(1)]],
        municipiosDistribucion: this.fb.array<DistMunGroup>([]),

        auxilioTransporte: [0, [Validators.required]],
        area: ['', Validators.required],

        // Oficinas
        oficinasSeleccionadas: [[], Validators.required],
        oficinasQueContratan: this.fb.array([]),
      },
      { validators: [this.sumNoExcedeTotalValidator()] }
    );

    if (this.data) this.cargarParaEdicion(this.data);

// ---------- Catálogos: CARGOS ----------
const cargoCtrl = this.vacanteForm.get('cargo')!;

// Inicializa para evitar undefined antes de la data
this.filteredCargos = cargoCtrl.valueChanges.pipe(
  startWith(cargoCtrl.value ?? ''),
  map((value: string) => this._filter(value || '', this.cargos))
);

this.positionsService.list()
  .pipe(
    map((rows: any[]) => (rows ?? []).map(c => c.nombre).filter(Boolean))
  )
  .subscribe({
    next: (nombres: string[]) => {
      this.cargos = nombres;
      // Reengancha el filtro con la lista ya cargada
      this.filteredCargos = cargoCtrl.valueChanges.pipe(
        startWith(cargoCtrl.value ?? ''),
        map((value: string) => this._filter(value || '', this.cargos))
      );
    },
    error: (err) => {
      console.error('Error cargando cargos', err);
      this.cargos = [];
      this.filteredCargos = cargoCtrl.valueChanges.pipe(
        startWith(cargoCtrl.value ?? ''),
        map((value: string) => this._filter(value || '', this.cargos))
      );
    }
  });





    this.vacantesService.listarCentrosCostos().subscribe((response: any) => {
      this.centrosCostos = response.data || [];
      this.filteredCentrosCostos = this.vacanteForm.get('finca')!.valueChanges.pipe(
        startWith(''),
        map((value) => this._filter(value || '', this.centrosCostos))
      );
    });

const sucursalesObservable = await this.adminService.traerSucursales();
sucursalesObservable.subscribe((sucursales: any[]) => {
  if (Array.isArray(sucursales)) {
    this.sedes = sucursales
      .filter(s => s?.activa !== false) // opcional: sólo activas
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  } else {
    this.sedes = [];
  }
});


    // Ofis seleccionadas -> array
    this.vacanteForm.get('oficinasSeleccionadas')!
      .valueChanges.subscribe((sel: string[]) => this.actualizarOficinasQueContratan(sel));

    // Municipios (catálogo + filtro)
    this.http.get<any[]>('./util/colombia.json').subscribe((data) => {
      this.municipiosColombia = data.flatMap((dep) => dep.ciudades)
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      this.municipiosFiltrados = [...this.municipiosColombia];
      this.resetFiltroMunicipio();
    });
    this.municipioCtrl.valueChanges.pipe(startWith('')).subscribe(() => this.filtrarMunicipios());

    // Sincroniza selección con la distribución
    this.vacanteForm.get('municipio')!.valueChanges
      .pipe(startWith(this.vacanteForm.get('municipio')!.value))
      .subscribe((actual: string[]) => this.syncDistribucionConSeleccion(actual));

    // Revalida si cambia el total
    this.vacanteForm.get('personasSolicitadas')!.valueChanges
      .subscribe(() => this.vacanteForm.updateValueAndValidity({ emitEvent: false }));

    // ====== Validaciones condicionales ======
    this.applyTieneFechaIngreso(this.vacanteForm.get('tieneFechaIngreso')!.value);
    this.vacanteForm.get('tieneFechaIngreso')!.valueChanges
      .subscribe(v => this.applyTieneFechaIngreso(v));

    this.applyPruebaContratacion(this.vacanteForm.get('pruebaOContratacion')!.value);
    this.vacanteForm.get('pruebaOContratacion')!.valueChanges
      .subscribe(v => this.applyPruebaContratacion(v));
  }

  // ---------- Validaciones condicionales ----------
  private applyTieneFechaIngreso(valor: string): void {
    const ctrl = this.vacanteForm.get('fechadeIngreso')!;
    if (valor === this.SI) {
      ctrl.enable({ emitEvent: false });
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.reset(null, { emitEvent: false });
      ctrl.clearValidators();
      ctrl.disable({ emitEvent: false });
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  private applyPruebaContratacion(valor: string): void {
    const fPrueba = this.vacanteForm.get('fechadePruebatecnica')!;
    const hPrueba = this.vacanteForm.get('horadePruebatecnica')!;
    const uPrueba = this.vacanteForm.get('ubicacionPruebaTecnica')!;

    if (valor === this.PRUEBA) {
      // Fecha y hora obligatorias
      fPrueba.enable({ emitEvent: false });
      fPrueba.setValidators([Validators.required]);
      hPrueba.enable({ emitEvent: false });
      hPrueba.setValidators([Validators.required]);

      // Ubicación opcional
      uPrueba.enable({ emitEvent: false });
      uPrueba.clearValidators();
    } else {
      // Limpiar y deshabilitar todo el bloque
      [fPrueba, hPrueba, uPrueba].forEach(c => {
        c.reset(null, { emitEvent: false });
        c.clearValidators();
        c.disable({ emitEvent: false });
      });
    }
    fPrueba.updateValueAndValidity({ emitEvent: false });
    hPrueba.updateValueAndValidity({ emitEvent: false });
    uPrueba.updateValueAndValidity({ emitEvent: false });
  }

  // ---------- Distribución por municipio ----------
  get municipiosDistribucion(): FormArray<DistMunGroup> {
    return this.vacanteForm.get('municipiosDistribucion') as FormArray<DistMunGroup>;
  }

  private syncDistribucionConSeleccion(actual: string[]): void {
    const curr = (actual || []).map((s) => (s ?? '').toString().trim());
    const added = curr.filter((m) => !this.prevMunicipios.includes(m));
    const removed = this.prevMunicipios.filter((m) => !curr.includes(m));

    for (const m of added) {
      this.municipiosDistribucion.push(
        this.fb.group<DistMunControls>({
          municipio: this.fb.control<string>(m, { nonNullable: true }),
          cantidad: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
        })
      );
    }
    for (const m of removed) {
      const idx = this.municipiosDistribucion.controls.findIndex(
        (c) => (c.get('municipio')!.value || '').toString().trim() === m
      );
      if (idx > -1) this.municipiosDistribucion.removeAt(idx);
    }

    this.prevMunicipios = curr;
    this.vacanteForm.updateValueAndValidity({ emitEvent: false });
  }

  get totalAsignado(): number {
    return this.municipiosDistribucion.controls
      .map((c) => Number(c.get('cantidad')!.value) || 0)
      .reduce((a, b) => a + b, 0);
  }

  get restante(): number {
    const total = Number(this.vacanteForm.get('personasSolicitadas')!.value) || 0;
    return Math.max(0, total - this.totalAsignado);
  }

  private sumNoExcedeTotalValidator(): ValidatorFn {
    return (group: AbstractControl) => {
      const total = Number(group.get('personasSolicitadas')?.value) || 0;
      const arr = group.get('municipiosDistribucion') as FormArray | null;
      if (!arr) return null;
      const suma = (arr.controls || [])
        .map((c) => Number(c.get('cantidad')?.value) || 0)
        .reduce((a, b) => a + b, 0);
      return suma <= total ? null : { excesoMunicipios: true };
    };
  }

  // ---------- Filtro de municipios ----------
  filtrarMunicipios(): void {
    const f = (this.municipioFiltro || '').toLowerCase();
    const seleccionados: string[] = this.vacanteForm.get('municipio')?.value || [];
    const noSeleccionados = this.municipiosColombia.filter(
      (m) => !seleccionados.includes(m) && m.toLowerCase().includes(f)
    );
    this.municipiosFiltrados = [...seleccionados, ...noSeleccionados];
  }

  resetFiltroMunicipio(): void {
    const seleccionados: string[] = this.vacanteForm.get('municipio')?.value || [];
    const noSeleccionados = this.municipiosColombia.filter((m) => !seleccionados.includes(m));
    this.municipiosFiltrados = [...seleccionados, ...noSeleccionados];
    this.municipioFiltro = '';
  }

  // ---------- Edición ----------
  private cargarParaEdicion(v: any): void {
    this.vacanteForm.patchValue({
      cargo: v.cargo,
      area: v.area,
      finca: v.finca,
      empresaUsuariaSolicita: v.empresaUsuariaSolicita,
      temporal: v.temporal,
      experiencia: v.experiencia,
      observacionVacante: v.observacionVacante,
      tieneFechaIngreso: v.fechadeIngreso ? this.SI : 'No',
      fechadeIngreso: v.fechadeIngreso ? new Date(v.fechadeIngreso) : null,
      descripcion: v.descripcion,
      fechaPublicado: new Date(v.fechaPublicado),
      quienpublicolavacante: v.quienpublicolavacante,
      estadovacante: v.estadovacante,
      salario: v.salario,
      codigoElite: v.codigoElite,
      oficinasSeleccionadas: (v.oficinasQueContratan || []).map((o: any) => o.nombre),
      pruebaOContratacion: v.pruebaOContratacion || '',
      fechadePruebatecnica: v.fechadePruebatecnica ? new Date(v.fechadePruebatecnica) : null,
      horadePruebatecnica: v.horadePruebatecnica || null,
      ubicacionPruebaTecnica: v.ubicacionPruebaTecnica || '',
      tipoContratacion: v.tipoContratacion || '',
      municipio: v.municipio || [],
      auxilioTransporte: v.auxilioTransporte,
      personasSolicitadas: v.personasSolicitadas ?? null,
    });

    // Oficinas
    const fa = this.oficinasQueContratan;
    fa.clear();
    (v.oficinasQueContratan || []).forEach((o: any) =>
      fa.push(this.fb.group({ nombre: [o.nombre, Validators.required], ruta: [!!o.ruta] }))
    );

    // Distribución
    const dist = Array.isArray(v.municipiosDistribucion) ? v.municipiosDistribucion : [];
    const distFA = this.municipiosDistribucion;
    distFA.clear();
    dist.forEach((d: any) => {
      distFA.push(
        this.fb.group<DistMunControls>({
          municipio: this.fb.control<string>((d.municipio ?? '').toString(), { nonNullable: true }),
          cantidad: this.fb.control<number | null>(Number(d.cantidad) || 0, [Validators.required, Validators.min(0)]),
        })
      );
    });

    // Reaplicar reglas condicionales con los valores que entraron
    this.applyTieneFechaIngreso(this.vacanteForm.get('tieneFechaIngreso')!.value);
    this.applyPruebaContratacion(this.vacanteForm.get('pruebaOContratacion')!.value);
    this.syncDistribucionConSeleccion(this.vacanteForm.get('municipio')!.value || []);
  }

  // ---------- Helpers ----------
  private _filter(value: string, list: string[]): string[] {
    const filterValue = (value || '').toLowerCase();
    return list.filter((item) => item.toLowerCase().includes(filterValue));
  }

  get oficinasQueContratan(): FormArray {
    return this.vacanteForm.get('oficinasQueContratan') as FormArray;
  }

  onCentroCostoSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedCentro = event.option.value;
    this.vacantesService.filtrarFinca(selectedCentro).subscribe((response) => {
      this.vacanteForm.get('empresaUsuariaSolicita')?.setValue(response?.[0]?.empresa_usuaria ?? null);
      const empresaTemporal = response?.[0]?.empresa_temporal;
      const opcionesValidas = ['APOYO LABORAL SAS', 'TU ALIANZA SAS'];
      this.vacanteForm.get('temporal')?.setValue(opcionesValidas.includes(empresaTemporal) ? empresaTemporal : null);
    });
  }

  actualizarOficinasQueContratan(seleccionadas: any[]): void {
    const formArray = this.oficinasQueContratan;
    formArray.clear();
    (seleccionadas || []).forEach((sede) => {
      formArray.push(this.fb.group({ nombre: [sede, Validators.required], ruta: [false] }));
    });
  }

  formatSalary(event: any): void {
    const input = event.target;
    const digits = (input.value || '').replace(/\D/g, '');
    this.vacanteForm.get('salario')?.setValue(Number(digits), { emitEvent: false });
    input.value = this.formatNumber(digits);
  }
  onBlur(): void {
    const value = this.vacanteForm.get('salario')?.value;
    if (value !== null && value !== undefined) {
      this.vacanteForm.get('salario')?.setValue(this.formatNumber(value), { emitEvent: false });
    }
  }
  formatNumber(value: string | number): string {
    return new Intl.NumberFormat('es-CO').format(Number(value || 0));
  }

  eliminarOficina(index: number): void {
    this.oficinasQueContratan.removeAt(index);
  }

  guardar(): void {
    this.vacanteForm.markAllAsTouched();
    if (this.vacanteForm.invalid) return;

    if (this.exigirIgualdadTotal) {
      const total = Number(this.vacanteForm.get('personasSolicitadas')!.value) || 0;
      if (this.totalAsignado !== total) {
        this.vacanteForm.setErrors({ sumaNoIgualTotal: true });
        return;
      }
    }
    this.dialogRef.close(this.vacanteForm.value);
  }
  cancelar(): void { this.dialogRef.close(); }

  // Dentro de la clase CrearEditarVacanteComponent
  isRequired(ctrlOrName: string | AbstractControl | null): boolean {
    const ctrl = typeof ctrlOrName === 'string' ? this.vacanteForm.get(ctrlOrName) : ctrlOrName;
    if (!ctrl || !ctrl.enabled) return false;

    // Angular 14+ trae hasValidator; en Angular 20 está disponible.
    const anyCtrl = ctrl as any;
    return typeof anyCtrl.hasValidator === 'function'
      ? anyCtrl.hasValidator(Validators.required)
      : false;
  }

}
