import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, FormControl } from '@angular/forms';
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
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { COMMA, ENTER } from '@angular/cdk/keycodes';

export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'D/M/YYYY',
  },
  display: {
    dateInput: 'D/M/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};
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
    MatChipsModule
  ],
  templateUrl: './crear-editar-vacante.component.html',
  styleUrls: ['./crear-editar-vacante.component.css'],
  providers: [
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' }, // o 'es'
  ]
})
export class CrearEditarVacanteComponent implements OnInit {
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
  @ViewChild('municipioInput', { static: false })
  municipioInput!: ElementRef<HTMLInputElement>;


  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public dialogRef: MatDialogRef<CrearEditarVacanteComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private adminService: UtilityServiceService,
    private vacantesService: VacantesService
  ) { }

  async ngOnInit(): Promise<void> {
    this.user = JSON.parse(localStorage.getItem('user') || '{}');

    this.vacanteForm = this.fb.group({
      cargo: ['', Validators.required],
      finca: ['', Validators.required],
      empresaUsuariaSolicita: ['', Validators.required],
      temporal: ['', Validators.required],
      ubicacionPruebaTecnica: [''],
      experiencia: ['', Validators.required],
      presentaPruebaTecnica: [''],
      fechadePruebatecnica: [''],
      horadePruebatecnica: [''],
      observacionVacante: [''],
      tieneFechaIngreso: [''],
      fechadeIngreso: [''],
      descripcion: ['', Validators.required],
      fechaPublicado: [new Date()],
      quienpublicolavacante: [`${this.user.primer_nombre} ${this.user.primer_apellido}`],
      estadovacante: ['Activa'],
      salario: [1423500, [Validators.required, Validators.min(0)]],
      codigoElite: [''],
      oficinasSeleccionadas: [[]],
      oficinasQueContratan: this.fb.array([]),
      pruebaOContratacion: ['', Validators.required],
      tipoContratacion: ['', Validators.required],
      municipio: [[], Validators.required],
      auxilioTransporte: [0, [Validators.required]],
    });

    if (this.data) this.cargarParaEdicion(this.data);

    this.vacantesService.listarCargos().subscribe((cargos: any) => {
      this.cargos = cargos.sublabores || [];
      this.filteredCargos = this.vacanteForm.get('cargo')!.valueChanges.pipe(
        startWith(''),
        map(value => this._filter(value || '', this.cargos))
      );
    });

    this.vacantesService.listarCentrosCostos().subscribe((response: any) => {
      this.centrosCostos = response.data || [];
      this.filteredCentrosCostos = this.vacanteForm.get('finca')!.valueChanges.pipe(
        startWith(''),
        map(value => this._filter(value || '', this.centrosCostos))
      );
    });

    const sucursalesObservable = await this.adminService.traerSucursales();
    sucursalesObservable.subscribe((sucursales: any) => {
      this.sedes = sucursales.sucursal || [];
    });

    this.vacanteForm.get('oficinasSeleccionadas')!.valueChanges.subscribe((seleccionadas: string[]) => {
      this.actualizarOficinasQueContratan(seleccionadas);
    });

    this.vacanteForm.get('pruebaOContratacion')?.valueChanges.subscribe(valor => {
      if (valor !== 'Prueba') {
        this.vacanteForm.patchValue({
          presentaPruebaTecnica: '',
          fechadePruebatecnica: '',
          horadePruebatecnica: '',
          ubicacionPruebaTecnica: ''
        });
      }
    });

    /* Carga de municipios + filtro reactivo */
    this.http.get<any[]>('./util/colombia.json').subscribe(data => {
      this.municipiosColombia = data
        .flatMap(dep => dep.ciudades)
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      this.municipiosFiltrados = [...this.municipiosColombia];
    });

    this.municipioCtrl.valueChanges
      .pipe(startWith(''))
      .subscribe(value => this.filtrarMunicipios());
  }

  filtrarMunicipios() {
    const f = this.municipioFiltro.toLowerCase();
    // Los seleccionados actuales
    const seleccionados: string[] = this.vacanteForm.get('municipio')?.value || [];

    // Filtra los no seleccionados
    const noSeleccionados = this.municipiosColombia.filter(m =>
      !seleccionados.includes(m) && m.toLowerCase().includes(f)
    );

    // Siempre pon los seleccionados arriba
    this.municipiosFiltrados = [
      ...seleccionados,
      ...noSeleccionados
    ];
  }


  resetFiltroMunicipio() {
    // Siempre muestra todos los municipios, pero los seleccionados primero
    const seleccionados: string[] = this.vacanteForm.get('municipio')?.value || [];
    const noSeleccionados = this.municipiosColombia.filter(m => !seleccionados.includes(m));
    this.municipiosFiltrados = [...seleccionados, ...noSeleccionados];
    this.municipioFiltro = '';
  }




  private cargarParaEdicion(v: any): void {
    this.vacanteForm.patchValue({
      cargo: v.cargo,
      finca: v.finca,
      empresaUsuariaSolicita: v.empresaUsuariaSolicita,
      temporal: v.temporal,
      ubicacionPruebaTecnica: v.ubicacionPruebaTecnica,
      experiencia: v.experiencia,
      presentaPruebaTecnica: v.fechadePruebatecnica ? 'Si' : 'No',
      fechadePruebatecnica: v.fechadePruebatecnica ? new Date(v.fechadePruebatecnica) : null,
      horadePruebatecnica: v.horadePruebatecnica,
      observacionVacante: v.observacionVacante,
      tieneFechaIngreso: v.fechadeIngreso ? 'Si' : 'No',
      fechadeIngreso: v.fechadeIngreso ? new Date(v.fechadeIngreso) : null,
      descripcion: v.descripcion,
      fechaPublicado: new Date(v.fechaPublicado),
      quienpublicolavacante: v.quienpublicolavacante,
      estadovacante: v.estadovacante,
      salario: +v.salario,
      codigoElite: v.codigoElite,
      oficinasSeleccionadas: v.oficinasQueContratan.map((o: any) => o.nombre)
    });

    const fa = this.oficinasQueContratan;
    fa.clear();
    v.oficinasQueContratan.forEach((o: any) =>
      fa.push(this.fb.group({
        nombre: [o.nombre],
        numeroDeGenteRequerida: [o.numeroDeGenteRequerida, Validators.required],
        ruta: [o.ruta]
      }))
    );
  }

  private _filter(value: string, list: string[]): string[] {
    const filterValue = value.toLowerCase();
    return list.filter(item => item.toLowerCase().includes(filterValue));
  }

  get oficinasQueContratan(): FormArray {
    return this.vacanteForm.get('oficinasQueContratan') as FormArray;
  }

  onCentroCostoSelected(event: any) {
    const selectedCentro = event.option.value;
    this.vacantesService.filtrarFinca(selectedCentro).subscribe(response => {
      this.vacanteForm.get('empresaUsuariaSolicita')?.setValue(response[0].empresa_usuaria);
      const empresaTemporal = response[0].empresa_temporal;
      const opcionesValidas = ["APOYO LABORAL SAS", "TU ALIANZA SAS"];
      this.vacanteForm.get('temporal')?.setValue(opcionesValidas.includes(empresaTemporal) ? empresaTemporal : null);
    });
  }

  actualizarOficinasQueContratan(seleccionadas: any[]) {
    const formArray = this.oficinasQueContratan;
    formArray.clear();
    seleccionadas.forEach((sede) => {
      formArray.push(this.fb.group({
        nombre: [sede, Validators.required],
        numeroDeGenteRequerida: [0, Validators.required],
        ruta: [false]
      }));
    });
  }

  formatSalary(event: any) {
    const input = event.target;
    const digits = input.value.replace(/\D/g, '');
    this.vacanteForm.get('salario')?.setValue(Number(digits), { emitEvent: false });
    input.value = this.formatNumber(digits);
  }

  onBlur() {
    const value = this.vacanteForm.get('salario')?.value;
    if (value) {
      this.vacanteForm.get('salario')?.setValue(this.formatNumber(value), { emitEvent: false });
    }
  }

  formatNumber(value: string | number): string {
    return new Intl.NumberFormat('es-CO').format(Number(value));
  }

  eliminarOficina(index: number) {
    this.oficinasQueContratan.removeAt(index);
  }

  guardar() {
    if (this.vacanteForm.valid) {
      this.dialogRef.close(this.vacanteForm.value);
    } else {
      const camposFaltantes = Object.keys(this.vacanteForm.controls).filter(key => this.vacanteForm.get(key)?.invalid);
    }
  }

  cancelar() {
    this.dialogRef.close();
  }
}
