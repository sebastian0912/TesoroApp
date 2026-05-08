import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SharedModule } from '../../../../../../shared/shared.module';
import { NominaService, Client, CostCenter } from '../../service/nomina/nomina.service';
import Swal from 'sweetalert2';
import { map, startWith } from 'rxjs/operators';
import { Observable } from 'rxjs';

// Importaciones Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PeriodoDialogComponent } from './periodo-dialog/periodo-dialog.component';
import { CalcularConNovedadesDialogComponent } from '../../components/calcular-con-novedades-dialog/calcular-con-novedades-dialog.component';

import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-calculo-nomina',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatAutocompleteModule,
    MatCheckboxModule,
    MatDividerModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatTooltipModule
  ],
  templateUrl: './calculo-nomina.component.html',
  styleUrl: './calculo-nomina.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculoNominaComponent implements OnInit {
  // Datos maestros
  clientes: Client[] = [];
  cecos: CostCenter[] = [];
  periodos: any[] = [];
  
  // Controles de búsqueda
  clientControl = new FormControl<string | Client>('', Validators.required);
  periodoControl = new FormControl<any>(null, Validators.required);
  
  // Filtros internos para los selects
  cecoFilterCtrl = new FormControl('');
  periodoFilterCtrl = new FormControl('');

  // Rango de Fechas
  startDate = new FormControl<Date | null>(null, Validators.required);
  endDate = new FormControl<Date | null>(null, Validators.required);
  diasCalculados: number = 0;

  filteredClientes$!: Observable<Client[]>;
  filteredCecos$!: Observable<CostCenter[]>;
  filteredPeriodos$!: Observable<any[]>;
  
  // Selecciones
  selectedCliente: Client | null = null;
  selectedCecoIds: number[] = [];
  
  // Resultados
  contratos: any[] = [];
  contratosFiltrados: any[] = [];
  // Snapshot crudo del último cálculo del backend, indexado por id_contrato.
  // Se usa para exportar la plantilla sin re-pegarle al backend (evita drift
  // entre lo que ve el usuario y lo que se baja).
  private _empleadosCalculados: Map<number, any> = new Map();
  filtroBusqueda: string = '';
  displayedColumns: string[] = ['empleado', 'num_doc', 'salario', 'dias', 'devengado', 'aux_trans', 'salud', 'pension', 'neto'];
  loading: boolean = false;
  guardando: boolean = false;

  // Constantes de Ley / Negocio
  readonly SALARIO_MINIMO_2026 = 1500000; 
  readonly HORAS_DIARIAS = 7.33;
  
  constructor(
    private nominaService: NominaService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarClientes();
    this.cargarPeriodos();
    
    this.filteredClientes$ = this.clientControl.valueChanges.pipe(
      startWith(''),
      map(value => typeof value === 'string' ? value : value?.nombre_legal || ''),
      map(nombre => nombre ? this._filterClients(nombre) : this.clientes.slice())
    );

    // Filtro reactivo para Centros de Costo
    this.filteredCecos$ = this.cecoFilterCtrl.valueChanges.pipe(
      startWith(''),
      map(val => this._filterCecos(val || ''))
    );

    // Filtro reactivo para Periodos
    this.filteredPeriodos$ = this.periodoFilterCtrl.valueChanges.pipe(
      startWith(''),
      map(val => this._filterPeriodos(val || ''))
    );

    // Al cambiar el periodo, auto-setear las fechas
    this.periodoControl.valueChanges.subscribe(p => {
      if (p && p.fecha_inicio && p.fecha_fin) {
        this.startDate.setValue(new Date(p.fecha_inicio + 'T00:00:00'));
        this.endDate.setValue(new Date(p.fecha_fin + 'T00:00:00'));
        this.actualizarDiasYNomina();
      }
    });

    // Cambios en fechas recalculan días
    this.startDate.valueChanges.subscribe(() => this.actualizarDiasYNomina());
    this.endDate.valueChanges.subscribe(() => this.actualizarDiasYNomina());
  }

  private _filterCecos(val: string): CostCenter[] {
    const filterValue = val.toLowerCase();
    return this.cecos.filter(c => c.nombre.toLowerCase().includes(filterValue));
  }

  abrirCalcularConPlantilla(): void {
    const periodo = this.periodoControl.value;
    if (!periodo?.id_periodo) {
      Swal.fire('Atención', 'Seleccione un periodo antes de cargar la plantilla.', 'warning');
      return;
    }
    if (!this.selectedCliente?.id_entidad) {
      Swal.fire('Atención', 'Seleccione un cliente: el homologador depende del cliente.', 'warning');
      return;
    }
    const ref = this.dialog.open(CalcularConNovedadesDialogComponent, {
      width: '90vw', maxWidth: '1100px', maxHeight: '90vh',
      disableClose: true,
      data: {
        periodo_id: periodo.id_periodo,
        periodo_descripcion: periodo.descripcion,
        cliente_id: this.selectedCliente.id_entidad,
        cliente_nombre: this.selectedCliente.nombre_legal,
        contrato_ids: this.contratos.map(c => c.id_contrato),
        cecos: this.selectedCecoIds,
      },
    });
    ref.afterClosed().subscribe((result) => {
      if (!result?.empleados?.length) return;

      // Garantiza que la tabla tenga filas para los contratos calculados:
      // si la pantalla estaba vacía o los IDs no coinciden, agregamos los
      // contratos faltantes desde contratos_data (mismo shape que el endpoint
      // de "Buscar Empleados").
      const idsCalculados = new Set<number>(
        (result.empleados as any[]).map(e => e.id_contrato),
      );
      const idsEnTabla = new Set<number>(this.contratos.map(c => c.id_contrato));
      const faltantes: any[] = (result.contratos_data || []).filter(
        (c: any) => idsCalculados.has(c.id_contrato) && !idsEnTabla.has(c.id_contrato),
      );
      if (faltantes.length) {
        const enriquecidos = faltantes.map(c => ({
          ...c,
          dias_laborados: 0,
          _devengado_basico: 0, _aux_trans: 0,
          _salud: 0, _pension: 0, _neto: 0,
        }));
        this.contratos = [...this.contratos, ...enriquecidos];
        this.aplicarFiltroEmpleados();
      }

      this.aplicarPreviewBackend(result.empleados);
      this.cdr.markForCheck();
    });
  }

  private _filterPeriodos(val: string): any[] {
    const filterValue = val.toLowerCase();
    return this.periodos.filter(p => p.descripcion.toLowerCase().includes(filterValue));
  }

  abrirDialogoPeriodo(periodo?: any): void {
    const dialogRef = this.dialog.open(PeriodoDialogComponent, {
      width: '550px',
      data: { periodo }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.cargarPeriodos();
      }
    });
  }

  private _filterClients(name: string): Client[] {
    const filterValue = name.toLowerCase();
    return this.clientes.filter(c => c.nombre_legal.toLowerCase().includes(filterValue));
  }

  displayClient(client: Client): string {
    return client ? client.nombre_legal : '';
  }

  displayPeriodo(periodo: any): string {
    return periodo ? periodo.descripcion : '';
  }

  cargarClientes(): void {
    this.nominaService.getClientes().subscribe({
      next: (res: any) => {
        this.clientes = res.results || res || [];
        this.clientControl.updateValueAndValidity(); // Disparar filtro
      },
      error: () => Swal.fire('Error', 'No se pudieron cargar los clientes', 'error')
    });
  }

  comparePeriodos(p1: any, p2: any): boolean {
    return p1 && p2 ? p1.id_periodo === p2.id_periodo : p1 === p2;
  }

  cargarPeriodos(): void {
    this.nominaService.getPeriodos().subscribe({
      next: (res: any) => {
        const data = res.results || res || [];
        this.periodos = Array.isArray(data) ? data.filter((p: any) => p.estado !== 'CERRADO') : [];
        this.periodoFilterCtrl.setValue(''); // Disparar filtro
      },
      error: (err) => {
        console.error('Error cargando periodos:', err);
        this.periodos = [];
      }
    });
  }

  onClienteSelected(client: Client): void {
    if (!client || typeof client === 'string') return;
    
    this.selectedCliente = client;
    this.cecos = [];
    this.selectedCecoIds = [];
    this.contratos = [];
    this.aplicarFiltroEmpleados();
    
    this.nominaService.getCentrosCostos(client.id_entidad).subscribe({
      next: (res: any) => {
        this.cecos = res.results || res || [];
        this.cecoFilterCtrl.setValue(''); // Disparar filtro para mostrar nuevos cecos
      },
      error: () => Swal.fire('Error', 'No se pudieron cargar los centros de costo', 'error')
    });
  }

  toggleAllCecos(selected: boolean): void {
    if (selected) {
      this.selectedCecoIds = this.cecos.map(c => c.id_ceco);
    } else {
      this.selectedCecoIds = [];
    }
  }

  isAllCecosSelected(): boolean {
    return this.cecos.length > 0 && this.selectedCecoIds.length === this.cecos.length;
  }

  actualizarDiasYNomina(): void {
    const periodo = this.periodoControl.value;
    
    // Priorizamos los días teóricos del periodo seleccionado
    if (periodo && periodo.dias_teoricos) {
      this.diasCalculados = Number(periodo.dias_teoricos);
    } else {
      // Fallback a cálculo por fechas si no hay periodo o días teóricos
      const start = this.startDate.value;
      const end = this.endDate.value;
      if (start && end) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        this.diasCalculados = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      } else {
        this.diasCalculados = 0;
      }
    }

    // Actualizar en caliente los contratos ya cargados
    this.contratos.forEach(c => {
      c.dias_laborados = this.diasCalculados;
    });
  }

  buscarEmpleados(): void {
    if (!this.selectedCliente) {
      Swal.fire('Atención', 'Debe seleccionar un cliente', 'warning');
      return;
    }
    if (!this.periodoControl.value) {
      Swal.fire('Atención', 'Seleccione el periodo de nómina', 'warning');
      return;
    }

    this.actualizarDiasYNomina();
    this.loading = true;

    // 1) Trae contratos filtrados (UI/listado).
    this.nominaService.getContratosFiltrados({
      cliente_id: this.selectedCliente.id_entidad,
      cecos: this.selectedCecoIds
    }).subscribe({
      next: (res: any) => {
        const data = res.data || res.results || res || [];
        this.contratos = data.map((c: any) => ({
          ...c,
          dias_laborados: this.diasCalculados,
          // placeholders mientras llega el preview oficial del backend
          _devengado_basico: 0, _aux_trans: 0,
          _salud: 0, _pension: 0, _neto: 0,
        }));
        this.aplicarFiltroEmpleados();

        if (this.contratos.length === 0) {
          this.loading = false;
          Swal.fire('Info', 'No hay empleados activos para esta selección', 'info');
          return;
        }

        // 2) Pide al backend el cálculo oficial (no persiste).
        this.nominaService.calcularLiquidacion({
          periodo_id: this.periodoControl.value.id_periodo,
          cliente_id: this.selectedCliente!.id_entidad,
          cecos: this.selectedCecoIds,
          contrato_ids: this.contratos.map(c => c.id_contrato),
        }).subscribe({
          next: (preview) => {
            this.aplicarPreviewBackend(preview.empleados || []);
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            Swal.fire('Error', 'No se pudo calcular la nómina en el servidor', 'error');
          }
        });
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'Fallo al cargar empleados', 'error');
      }
    });
  }

  /**
   * Mapea el desglose oficial calculado en backend sobre los contratos en pantalla.
   * Las fórmulas viven en el backend; aquí solo presentamos.
   */
  private aplicarPreviewBackend(empleados: any[]): void {
    this.mapearEmpleadosEnContratos(empleados);

    // Candidatos a rechazo: cualquiera con días = 0 en el periodo.
    const rechazables = this.contratos.filter(c => Number(c.dias_laborados) === 0);
    if (rechazables.length) {
      // Fire-and-forget: no bloquea el render. La tabla ya se ve con todos.
      this.preguntarInclusionRechazables(rechazables);
    }
  }

  /**
   * Mapeo puro del payload del backend a los contratos en pantalla.
   * No dispara el prompt de rechazables — pensado para re-consultas
   * posteriores a que el usuario ya eligió qué hacer con ellos.
   */
  private mapearEmpleadosEnContratos(empleados: any[]): void {
    const byContrato = new Map<number, any>();
    empleados.forEach(e => byContrato.set(e.id_contrato, e));
    // Guardamos el snapshot crudo para que "Exportar Soporte" pueda
    // bajar exactamente lo que el usuario vio sin recalcular.
    this._empleadosCalculados = byContrato;

    this.contratos = this.contratos.map(c => {
      const calc = byContrato.get(c.id_contrato);
      if (!calc) {
        return { ...c, dias_laborados: 0, _devengado_basico: 0, _aux_trans: 0,
          _salud: 0, _pension: 0, _total_devengado: 0, _total_deducido: 0,
          _neto: 0, _conceptos: [],
          _dias_efectivos: 0, _dias_no_rem: 0, _ibc: 0,
          _dev_sal: 0, _dev_nosal: 0, _ded_sal_ibc: 0, _observaciones: [] };
      }
      const find = (codigo: string) =>
        Number((calc.conceptos || []).find((x: any) => x.codigo === codigo)?.valor_total || 0);
      return {
        ...c,
        dias_laborados: calc.dias,
        _devengado_basico: find('SUELDO'),
        _aux_trans: find('AUX_TRANS'),
        _salud: find('SALUD_EMP'),
        _pension: find('PENSION_EMP'),
        _total_devengado: Number(calc.total_devengado || 0),
        _total_deducido: Number(calc.total_deducido || 0),
        _neto: Number(calc.neto || 0),
        _conceptos: calc.conceptos || [],
        _dias_efectivos: Number(calc.dias_efectivos || 0),
        _dias_no_rem: Number(calc.dias_no_remunerados || 0),
        _ibc: Number(calc.ibc || 0),
        _dev_sal: Number(calc.devengos_salariales || 0),
        _dev_nosal: Number(calc.devengos_no_salariales || 0),
        _ded_sal_ibc: Number(calc.deducciones_salariales_que_disminuyen_ibc || 0),
        _observaciones: Array.isArray(calc.observaciones_validacion)
          ? calc.observaciones_validacion : [],
      };
    });
    this.aplicarFiltroEmpleados();

    // Forzar re-render: OnPush + callbacks async no lo disparan por sí solos.
    this.cdr.markForCheck();
  }

  private async preguntarInclusionRechazables(rechazables: any[]): Promise<void> {
    const res = await Swal.fire({
      icon: 'question',
      title: `${rechazables.length} empleado(s) no laboraron en este periodo`,
      text: '¿Desea realizar el cálculo para todos? En cualquier caso se descargará el Excel con los no elegibles.',
      showCancelButton: true,
      confirmButtonText: 'Sí, calcular para todos',
      cancelButtonText: 'No, excluirlos',
    });
    // Ambas opciones descargan el Excel de rechazables.
    await this.exportarExcluidosExcel(rechazables);

    if (res.isConfirmed) {
      // Re-pedir al backend el cálculo forzando días completos para TODOS.
      this.loading = true;
      this.cdr.markForCheck();
      this.nominaService.calcularLiquidacion({
        periodo_id: this.periodoControl.value.id_periodo,
        cliente_id: this.selectedCliente!.id_entidad,
        cecos: this.selectedCecoIds,
        contrato_ids: this.contratos.map(c => c.id_contrato),
        forzar_dias_completos: true,
      }).subscribe({
        next: (preview) => {
          this.mapearEmpleadosEnContratos(preview.empleados || []);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
          Swal.fire('Error', 'No se pudo recalcular con días completos', 'error');
        }
      });
    } else {
      // "No, excluirlos": los elegibles ya tienen sus calculos correctos desde
      // la primera llamada al backend (aplicarPreviewBackend). Solo filtramos
      // la tabla y forzamos re-render. No hace falta re-pedir al backend, lo
      // cual ahorra varios segundos en listas grandes.
      //
      // Usamos detectChanges() en vez de markForCheck() porque en modo zoneless
      // markForCheck() puede postergarse hasta el proximo evento DOM (clic),
      // dando la falsa sensacion de "no pasa nada" hasta que el usuario toca la
      // pantalla. detectChanges() dispara el render inmediato.
      const ids = new Set(rechazables.map(c => c.id_contrato));
      this.contratos = [...this.contratos.filter(c => !ids.has(c.id_contrato))];
      this.aplicarFiltroEmpleados();
      this.cdr.detectChanges();
    }
  }

  private async exportarExcluidosExcel(descartados: any[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Excluidos');
    sheet.columns = [
      { header: 'Contrato', key: 'codigo_contrato', width: 15 },
      { header: 'Tipo Doc', key: 'tipo_documento', width: 10 },
      { header: 'Documento', key: 'numero_documento', width: 15 },
      { header: 'Primer Nombre', key: 'primer_nombre', width: 18 },
      { header: 'Segundo Nombre', key: 'segundo_nombre', width: 18 },
      { header: 'Primer Apellido', key: 'primer_apellido', width: 18 },
      { header: 'Segundo Apellido', key: 'segundo_apellido', width: 18 },
      { header: 'Cliente', key: 'cliente', width: 28 },
      { header: 'Centro de Costo', key: 'centro_de_costo', width: 22 },
      { header: 'CECO Código', key: 'ceco_codigo', width: 14 },
      { header: 'Sede', key: 'ceco_sede', width: 14 },
      { header: 'Fecha Ingreso', key: 'fecha_ingreso', width: 14 },
      { header: 'Fecha Retiro', key: 'fecha_retiro', width: 14 },
      { header: 'Salario Mes', key: 'salario', width: 14 },
      { header: 'Aux. Transporte', key: 'auxilio_transporte', width: 14 },
      { header: 'Motivo', key: 'motivo', width: 40 },
    ];
    const headerRow = sheet.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const periodoDesc = this.periodoControl.value?.descripcion || 'Periodo';
    descartados.forEach(c => {
      sheet.addRow({
        codigo_contrato: c.codigo_contrato,
        tipo_documento: c.tipo_documento,
        numero_documento: c.numero_documento,
        primer_nombre: c.primer_nombre,
        segundo_nombre: c.segundo_nombre,
        primer_apellido: c.primer_apellido,
        segundo_apellido: c.segundo_apellido,
        cliente: c.cliente,
        centro_de_costo: c.centro_de_costo,
        ceco_codigo: c.ceco_codigo,
        ceco_sede: c.ceco_sede,
        fecha_ingreso: c.fecha_ingreso,
        fecha_retiro: c.fecha_retiro,
        salario: Number(c.salario) || 0,
        auxilio_transporte: Number(c.auxilio_transporte) || 0,
        motivo: 'Vigencia del contrato no intersecta el periodo',
      });
    });
    ['N', 'O'].forEach(k => sheet.getColumn(k).numFmt = '#,##0');

    const buffer = await workbook.xlsx.writeBuffer();
    const nombre = `Excluidos_${this.selectedCliente?.nombre_legal || 'Cliente'}_${periodoDesc}.xlsx`
      .replace(/[\/\\?*\[\]:]/g, '_');
    saveAs(new Blob([buffer]), nombre);
  }

  /**
   * Filtra la tabla en vivo conforme el usuario escribe o pega texto.
   * Matchea contra nombre completo, documento y centro de costo (case-insensitive).
   */
  aplicarFiltroEmpleados(): void {
    const term = (this.filtroBusqueda || '').trim().toLowerCase();
    if (!term) {
      this.contratosFiltrados = [...this.contratos];
    } else {
      this.contratosFiltrados = this.contratos.filter(c => {
        const nombre = `${c.primer_nombre || ''} ${c.segundo_nombre || ''} ${c.primer_apellido || ''} ${c.segundo_apellido || ''}`.toLowerCase();
        const doc = String(c.numero_documento || '').toLowerCase();
        const ceco = String(c.centro_de_costo || '').toLowerCase();
        const codigo = String(c.codigo_contrato || '').toLowerCase();
        return nombre.includes(term) || doc.includes(term) || ceco.includes(term) || codigo.includes(term);
      });
    }
    this.cdr.markForCheck();
  }

  limpiarFiltroEmpleados(): void {
    this.filtroBusqueda = '';
    this.aplicarFiltroEmpleados();
  }

  // Lecturas de presentación (NO calculan: solo leen el preview oficial del backend)
  getDevengadoBasico(c: any): number { return Number(c?._devengado_basico || 0); }
  getAuxilioTransporte(c: any): number { return Number(c?._aux_trans || 0); }
  getDeduccionSalud(c: any): number { return Number(c?._salud || 0); }
  getDeduccionPension(c: any): number { return Number(c?._pension || 0); }
  getNetoQuincena(c: any): number { return Number(c?._neto || 0); }

  guardarEnHistorico(): void {
    if (!this.periodoControl.value) {
      Swal.fire('Atención', 'Seleccione el periodo de nómina correspondiente', 'warning');
      return;
    }
    if (this.contratos.length === 0) return;

    Swal.fire({
      title: '¿Guardar Liquidación?',
      text: `Se registrará la nómina de ${this.contratos.length} empleados para el periodo ${this.periodoControl.value.descripcion}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar'
    }).then(r => {
      if (r.isConfirmed) this.ejecutarGuardado();
    });
  }

  private ejecutarGuardado(): void {
    this.guardando = true;
    // El backend recalcula y persiste. El frontend solo identifica el alcance.
    const payload = {
      periodo_id: this.periodoControl.value.id_periodo,
      cliente_id: this.selectedCliente?.id_entidad || null,
      cecos: this.selectedCecoIds,
      contrato_ids: this.contratos.map(c => c.id_contrato),
    };

    this.nominaService.guardarLiquidacion(payload).subscribe({
      next: (res) => {
        this.guardando = false;
        Swal.fire('Éxito', res.mensaje || 'Guardado exitoso', 'success');
        this.cargarPeriodos();
      },
      error: (err) => {
        this.guardando = false;
        const msg = err.error?.error || err.error?.mensaje || 'No se pudo guardar la liquidación';
        Swal.fire('Error', msg, 'error');
      }
    });
  }

  exportarSoporte(): void {
    if (!this.periodoControl.value) {
      Swal.fire('Atención', 'Seleccione el periodo de nómina.', 'warning');
      return;
    }
    if (this.contratos.length === 0) {
      Swal.fire('Atención', 'No hay empleados para exportar.', 'warning');
      return;
    }
    if (this._empleadosCalculados.size === 0) {
      Swal.fire('Atención', 'Primero calcule la nómina (Buscar Empleados) antes de exportar el soporte.', 'warning');
      return;
    }

    // Solo exportamos los contratos que siguen en pantalla — si el usuario
    // excluyó rechazables o filtró, esos no van.
    const empleados = this.contratos
      .map(c => this._empleadosCalculados.get(c.id_contrato))
      .filter(e => e);

    if (empleados.length === 0) {
      Swal.fire('Atención', 'No hay empleados calculados que coincidan con la lista actual.', 'warning');
      return;
    }

    this.guardando = true;
    this.cdr.markForCheck();

    this.nominaService.exportarSoporte({
      periodo_id: this.periodoControl.value.id_periodo,
      cliente_id: this.selectedCliente?.id_entidad || null,
      empleados,
    }).subscribe({
      next: (resp) => {
        const blob = resp.body!;
        const cd = resp.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
        const filename = m
          ? decodeURIComponent(m[1])
          : `Soporte_${this.selectedCliente?.nombre_legal || 'Cliente'}.xlsx`;
        saveAs(blob, filename);
        this.guardando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardando = false;
        this.cdr.markForCheck();
        const msg = err?.error?.error || 'No se pudo generar el soporte Excel';
        Swal.fire('Error', msg, 'error');
      },
    });
  }

  async exportToExcel(): Promise<void> {
    if (this.contratos.length === 0) return;
    const workbook = new ExcelJS.Workbook();

    // Columnas base (las 16 originales) + bloque de novedades/IBC.
    const columns = [
      { header: 'Contrato', key: 'codigo', width: 12 },
      { header: 'Cedula', key: 'num_doc', width: 15 },
      { header: 'Apellido y nombres', key: 'empleado', width: 35 },
      { header: 'Ingreso', key: 'ingreso', width: 12 },
      { header: 'Retiro', key: 'retiro', width: 12 },
      { header: 'Empresa Usuaria', key: 'empresa', width: 25 },
      { header: 'Unidad de Negocio', key: 'ceco_nombre', width: 20 },
      { header: 'Centro de Costo', key: 'ceco_codigo', width: 15 },
      { header: 'Sede', key: 'sede', width: 10 },
      { header: 'Cod Archivo', key: 'cod_archivo', width: 12 },
      { header: 'Salario Básico (Mes)', key: 'salario_mes', width: 15 },
      { header: 'Auxilio Tr. (Mes)', key: 'aux_mes', width: 15 },
      { header: 'Sueldo Calculado', key: 'sueldo_q', width: 15 },
      { header: 'Auxilio Calculado', key: 'aux_q', width: 15 },
      { header: 'Dias Laborados', key: 'dias', width: 8 },
      { header: 'Dias Transporte', key: 'dias_t', width: 8 },
      // Bloque novedades/IBC
      { header: 'Días Efectivos', key: 'dias_ef', width: 10 },
      { header: 'Días No Rem.', key: 'dias_nr', width: 10 },
      { header: 'Devengos Salariales', key: 'dev_sal', width: 16 },
      { header: 'Devengos No Salariales', key: 'dev_nosal', width: 18 },
      { header: 'Total Deducciones', key: 'total_ded', width: 14 },
      { header: 'IBC', key: 'ibc', width: 14 },
      { header: 'Salud (4%)', key: 'salud', width: 12 },
      { header: 'Pensión (4%)', key: 'pension', width: 12 },
      { header: 'Neto', key: 'neto', width: 14 },
      { header: 'Observaciones', key: 'obs', width: 35 },
    ];

    // Columnas con formato monetario (índices 1-based: K=11, L=12, M=13, N=14,
    // S=19 dev_sal, T=20 dev_nosal, U=21 total_ded, V=22 ibc, W=23 salud,
    // X=24 pension, Y=25 neto).
    const moneyCols = ['K', 'L', 'M', 'N', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'];

    const buildRow = (c: any) => {
      const nombreCompleto = `${c.primer_apellido} ${c.segundo_apellido || ''} ${c.primer_nombre} ${c.segundo_nombre || ''}`.replace(/\s+/g, ' ').trim();
      return {
        codigo: c.codigo_contrato,
        num_doc: c.numero_documento,
        empleado: nombreCompleto,
        ingreso: c.fecha_ingreso,
        retiro: c.fecha_retiro,
        empresa: c.cliente,
        ceco_nombre: c.centro_de_costo,
        ceco_codigo: c.ceco_codigo,
        sede: c.ceco_sede,
        cod_archivo: '',
        salario_mes: Number(c.salario),
        aux_mes: Number(c.auxilio_transporte),
        sueldo_q: this.getDevengadoBasico(c),
        aux_q: this.getAuxilioTransporte(c),
        dias: c.dias_laborados,
        dias_t: c.auxilio_transporte_ley ? c.dias_laborados : 0,
        dias_ef: Number(c._dias_efectivos || 0),
        dias_nr: Number(c._dias_no_rem || 0),
        dev_sal: Number(c._dev_sal || 0),
        dev_nosal: Number(c._dev_nosal || 0),
        total_ded: Number(c._total_deducido || 0),
        ibc: Number(c._ibc || 0),
        salud: Number(c._salud || 0),
        pension: Number(c._pension || 0),
        neto: Number(c._neto || 0),
        obs: (c._observaciones || []).join(' | '),
      };
    };

    const cecosMap = new Map<number, any[]>();

    // 1. Hoja GENERAL
    const generalSheet = workbook.addWorksheet('GENERAL');
    generalSheet.columns = columns;
    const headerRowGen = generalSheet.getRow(1);
    headerRowGen.height = 25;
    headerRowGen.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    this.contratos.forEach(c => {
      generalSheet.addRow(buildRow(c));
      const cecoId = c.id_ceco || c.ceco || 0;
      const list = cecosMap.get(cecoId) || [];
      list.push(c);
      cecosMap.set(cecoId, list);
    });
    moneyCols.forEach(k => generalSheet.getColumn(k).numFmt = '#,##0');

    // 2. Hojas por CECO
    cecosMap.forEach((empleados, id_ceco) => {
      const cecoName = empleados[0].centro_de_costo || `CECO ${id_ceco}`;
      const cecoSheet = workbook.addWorksheet(cecoName.substring(0, 31).replace(/[\/*?\[\]:]/g, ' '));
      cecoSheet.columns = columns;

      const headerRow = cecoSheet.getRow(1);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      empleados.forEach(c => {
        const row = cecoSheet.addRow(buildRow(c));
        row.alignment = { vertical: 'middle' };
      });

      moneyCols.forEach(k => cecoSheet.getColumn(k).numFmt = '#,##0');
    });

    // 3. Hoja NOVEDADES — detalle línea por línea (auditoría por concepto).
    const novSheet = workbook.addWorksheet('NOVEDADES');
    novSheet.columns = [
      { header: 'Cedula', key: 'cedula', width: 15 },
      { header: 'Empleado', key: 'empleado', width: 35 },
      { header: 'CECO', key: 'ceco', width: 22 },
      { header: 'Código', key: 'codigo', width: 12 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Naturaleza', key: 'naturaleza', width: 12 },
      { header: 'Cantidad', key: 'cantidad', width: 10 },
      { header: 'Unidad', key: 'unidad', width: 8 },
      { header: 'Valor Unitario', key: 'vu', width: 14 },
      { header: 'Valor Total', key: 'vt', width: 14 },
      { header: 'Clasificación', key: 'clasif', width: 14 },
      { header: '¿Suma IBC?', key: 'ibc_flag', width: 11 },
      { header: 'Observación', key: 'obs', width: 35 },
    ];
    const novHeader = novSheet.getRow(1);
    novHeader.height = 25;
    novHeader.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    this.contratos.forEach(c => {
      const nombreCompleto = `${c.primer_apellido} ${c.segundo_apellido || ''} ${c.primer_nombre} ${c.segundo_nombre || ''}`.replace(/\s+/g, ' ').trim();
      (c._conceptos || []).forEach((linea: any) => {
        let ibcFlag = 'NO';
        if (linea.hace_base_ibc) ibcFlag = 'SÍ';
        else if (linea.disminuye_ibc) ibcFlag = '−IBC';
        novSheet.addRow({
          cedula: c.numero_documento,
          empleado: nombreCompleto,
          ceco: c.centro_de_costo,
          codigo: linea.codigo,
          descripcion: linea.descripcion,
          naturaleza: linea.naturaleza,
          cantidad: Number(linea.cantidad || 0),
          unidad: linea.unidad,
          vu: Number(linea.valor_unitario || 0),
          vt: Number(linea.valor_total || 0),
          clasif: linea.clasificacion || '',
          ibc_flag: ibcFlag,
          obs: linea.observacion || '',
        });
      });
    });
    // Formato monetario para Valor Unitario (I) y Valor Total (J).
    ['I', 'J'].forEach(k => novSheet.getColumn(k).numFmt = '#,##0.00');
    // Filtro automático para que el usuario pueda agrupar por código/empleado/etc.
    if (novSheet.rowCount > 1) {
      novSheet.autoFilter = { from: 'A1', to: 'M1' };
    }
    novSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Hoja de FACTURAS (Resumen)
    const factSheet = workbook.addWorksheet('Cobro General');
    factSheet.getColumn('B').width = 45;
    factSheet.getColumn('C').width = 20;
    let currentRow = 2;

    cecosMap.forEach((empleados, id_ceco) => {
      const cecoName = empleados[0].centro_de_costo || `CECO ${id_ceco}`;
      const jornales = empleados.reduce((acc, c) => acc + this.getDevengadoBasico(c) + this.getAuxilioTransporte(c), 0);
      const ss = jornales * 0.19;
      const sub1 = jornales + ss;
      const admin = sub1 * 0.05;
      const sub2 = sub1 + admin;
      const iva = sub2 * 0.1 * 0.19;
      const total = sub2 + iva;

      factSheet.mergeCells(`B${currentRow}:C${currentRow}`);
      const header = factSheet.getCell(`B${currentRow}`);
      header.value = `RESUMEN COBRO: ${cecoName}`;
      header.font = { bold: true, color: { argb: 'FFFFFF' } };
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '333333' } };
      currentRow += 2;

      const items = [
        ['Jornales y Auxilios', jornales],
        ['Seguridad Social (19%)', ss],
        ['Administración (5%)', admin],
        ['IVA (19% s. base 10%)', iva],
        ['TOTAL A FACTURAR', total]
      ];

      items.forEach(it => {
        factSheet.getCell(`B${currentRow}`).value = it[0];
        factSheet.getCell(`C${currentRow}`).value = it[1];
        factSheet.getCell(`C${currentRow}`).numFmt = '"$"#,##0';
        if (it[0].includes('TOTAL')) {
          factSheet.getRow(currentRow).font = { bold: true };
          factSheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9C4' } };
        }
        currentRow++;
      });
      currentRow += 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Nomina_${this.selectedCliente?.nombre_legal || 'Export'}.xlsx`);
  }
}
