import { Component, OnInit } from '@angular/core';
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
  styleUrl: './calculo-nomina.component.css'
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
  displayedColumns: string[] = ['empleado', 'num_doc', 'salario', 'dias', 'devengado', 'aux_trans', 'salud', 'pension', 'neto'];
  loading: boolean = false;
  guardando: boolean = false;

  // Constantes de Ley / Negocio
  readonly SALARIO_MINIMO_2026 = 1500000; 
  readonly HORAS_DIARIAS = 7.33;
  
  constructor(
    private nominaService: NominaService,
    private dialog: MatDialog
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
    
    // Forzamos actualización de días antes de buscar
    this.actualizarDiasYNomina();

    this.loading = true;
    this.nominaService.getContratosFiltrados({
      cliente_id: this.selectedCliente.id_entidad,
      cecos: this.selectedCecoIds
    }).subscribe({
      next: (res: any) => {
        const data = res.data || res.results || res || [];
        this.contratos = data.map((c: any) => ({
          ...c,
          dias_laborados: this.diasCalculados
        }));
        this.loading = false;
        if (this.contratos.length === 0) {
          Swal.fire('Info', 'No hay empleados activos para esta selección', 'info');
        }
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'Fallo al cargar empleados', 'error');
      }
    });
  }

  // Cálculos dinámicos
  getDevengadoBasico(c: any): number {
    return ((Number(c.salario) || 0) / 30) * (Number(c.dias_laborados) || 0);
  }
  getAuxilioTransporte(c: any): number {
    return ((Number(c.auxilio_transporte) || 0) / 30) * (Number(c.dias_laborados) || 0);
  }
  getDeduccionSalud(c: any): number {
    return this.getDevengadoBasico(c) * 0.04;
  }
  getDeduccionPension(c: any): number {
    return this.getDevengadoBasico(c) * 0.04;
  }
  getNetoQuincena(c: any): number {
    return this.getDevengadoBasico(c) + this.getAuxilioTransporte(c) - this.getDeduccionSalud(c) - this.getDeduccionPension(c);
  }

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
    const detalles = this.contratos.map(c => ({
      id_contrato: c.id_contrato,
      id_empleado: c.id_empleado,
      dias: Number(c.dias_laborados),
      sueldo_q: this.getDevengadoBasico(c),
      aux_trans: this.getAuxilioTransporte(c),
      salud: this.getDeduccionSalud(c),
      pension: this.getDeduccionPension(c),
      neto: this.getNetoQuincena(c)
    }));

    const payload = {
      periodo_id: this.periodoControl.value.id_periodo,
      cliente_id: this.selectedCliente?.id_org || null,
      detalles
    };

    this.nominaService.guardarLiquidacion(payload).subscribe({
      next: (res) => {
        this.guardando = false;
        Swal.fire('Éxito', res.mensaje || 'Guardado exitoso', 'success');
        this.cargarPeriodos();
      },
      error: () => {
        this.guardando = false;
        Swal.fire('Error', 'No se pudo guardar en el histórico', 'error');
      }
    });
  }

  async exportToExcel(): Promise<void> {
    if (this.contratos.length === 0) return;
    const workbook = new ExcelJS.Workbook();
    
    // Configuración básica columnas
    const columns = [
      { header: 'Empresa', key: 'empresa', width: 25 },
      { header: 'Centro de Costo', key: 'ceco', width: 20 },
      { header: 'Código Contrato', key: 'codigo', width: 12 },
      { header: 'Empleado', key: 'empleado', width: 30 },
      { header: 'Tipo Doc', key: 'tipo_doc', width: 8 },
      { header: 'Num Doc', key: 'num_doc', width: 12 },
      { header: 'Salario Mes', key: 'salario', width: 14 },
      { header: 'Días', key: 'dias', width: 8 },
      { header: 'Horas', key: 'horas', width: 8 },
      { header: 'Sueldo Q', key: 'devengado', width: 14 },
      { header: 'Aux. Transporte', key: 'aux_trans', width: 14 },
      { header: 'Salud (4%)', key: 'salud', width: 12 },
      { header: 'Pensión (4%)', key: 'pension', width: 12 },
      { header: 'Neto a Pagar', key: 'neto', width: 16 },
      { header: 'Estado', key: 'estado', width: 15 },
    ];

    const cecosMap = new Map<number, any[]>();
    this.contratos.forEach(c => {
      // Usar id_ceco (nuevo campor en API) o ceco (relación base) como fallback
      const cecoId = c.id_ceco || c.ceco || 0;
      const list = cecosMap.get(cecoId) || [];
      list.push(c);
      cecosMap.set(cecoId, list);
    });

    cecosMap.forEach((empleados, id_ceco) => {
      const cecoName = empleados[0].centro_de_costo || `CECO ${id_ceco}`;
      const cecoSheet = workbook.addWorksheet(cecoName.substring(0, 31).replace(/[\/*?\[\]:]/g, ' '));
      cecoSheet.columns = columns;
      
      // Estilo de Cabecera Premium
      const headerRow = cecoSheet.getRow(1);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } }; // Azul oscuro profesional
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, 
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      empleados.forEach(c => {
        const row = cecoSheet.addRow({
          empresa: c.cliente,
          ceco: c.centro_de_costo,
          codigo: c.codigo_contrato,
          empleado: `${c.primer_nombre} ${c.primer_apellido}`,
          tipo_doc: c.tipo_documento,
          num_doc: c.numero_documento,
          salario: c.salario,
          dias: c.dias_laborados,
          horas: (c.dias_laborados * this.HORAS_DIARIAS).toFixed(2),
          devengado: this.getDevengadoBasico(c),
          aux_trans: this.getAuxilioTransporte(c),
          salud: this.getDeduccionSalud(c),
          pension: this.getDeduccionPension(c),
          neto: this.getNetoQuincena(c),
          estado: c.estado
        });
        row.alignment = { vertical: 'middle' };
      });

      // Totales al final de la hoja
      const totalRow = cecoSheet.addRow({});
      totalRow.getCell('D').value = 'SUBTOTALES:';
      totalRow.getCell('D').font = { bold: true };
      ['J', 'K', 'L', 'M', 'N'].forEach(col => {
        totalRow.getCell(col).value = { formula: `SUM(${col}2:${col}${cecoSheet.rowCount - 1})` };
        totalRow.getCell(col).font = { bold: true };
        totalRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F4F4' } };
      });
      ['G', 'J', 'K', 'L', 'M', 'N'].forEach(k => cecoSheet.getColumn(k).numFmt = '"$"#,##0');
    });

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
