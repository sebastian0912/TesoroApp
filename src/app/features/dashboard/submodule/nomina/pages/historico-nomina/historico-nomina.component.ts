import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../../../../../shared/shared.module';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Observable, startWith, map } from 'rxjs';
import { NominaService, Client, CostCenter } from '../../service/nomina/nomina.service';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-historico-nomina',
  standalone: true,
  imports: [
    CommonModule, 
    SharedModule, 
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatDividerModule,
    MatCheckboxModule
  ],
  templateUrl: './historico-nomina.component.html',
  styleUrls: ['./historico-nomina.component.css']
})
export class HistoricoNominaComponent implements OnInit {
  
  // Controles de filtrado
  periodoControl = new FormControl<any>(null);
  periodoFilterCtrl = new FormControl('');
  
  clientControl = new FormControl<any>(null);
  cecoFilterCtrl = new FormControl('');
  
  queryControl = new FormControl('');

  periodos: any[] = [];
  clientes: Client[] = [];
  cecos: CostCenter[] = [];
  selectedCecoIds: number[] = [];
  
  filteredPeriodos$!: Observable<any[]>;
  filteredClientes$!: Observable<Client[]>;
  filteredCecos$!: Observable<CostCenter[]>;
  
  historicoDataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'identificacion', 'nombre_completo', 'ceco_nombre', 
    'total_devengado', 'total_deducido', 'neto_pagar', 
    'estado_pago', 'liquidado_at'
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  isLoading = false;

  constructor(private nominaService: NominaService) {}

  ngOnInit(): void {
    this.cargarDatosMaestros();
    
    this.filteredPeriodos$ = this.periodoFilterCtrl.valueChanges.pipe(
      startWith(''),
      map(val => this._filterPeriodos(val || ''))
    );

    this.filteredClientes$ = this.clientControl.valueChanges.pipe(
      startWith(''),
      map(value => typeof value === 'string' ? value : value?.nombre_legal || ''),
      map(nombre => nombre ? this._filterClients(nombre) : this.clientes.slice())
    );

    this.filteredCecos$ = this.cecoFilterCtrl.valueChanges.pipe(
      startWith(''),
      map(val => this._filterCecos(val || ''))
    );

    // Al cambiar cliente, cargar sus CECOs
    this.clientControl.valueChanges.subscribe(client => {
      if (client && typeof client === 'object' && client.id_entidad) {
        this.cargarCecos(client.id_entidad);
      } else {
        this.cecos = [];
        this.selectedCecoIds = [];
      }
    });
  }

  cargarDatosMaestros(): void {
    this.nominaService.getPeriodos().subscribe({
      next: (res: any) => {
        const data = res.results || res || [];
        this.periodos = Array.isArray(data) ? data : [];
        this.periodoFilterCtrl.setValue(''); // Disparar filtro para mostrar resultados
      }
    });

    this.nominaService.getClientes().subscribe({
      next: (res: any) => {
        this.clientes = res.results || res || [];
        this.clientControl.updateValueAndValidity(); // Disparar filtro para mostrar resultados
      }
    });
  }

  cargarCecos(clienteId: number): void {
    this.nominaService.getCentrosCostos(clienteId).subscribe({
      next: (res: any) => {
        this.cecos = res.results || res || [];
        this.cecoFilterCtrl.setValue('');
      }
    });
  }

  private _filterPeriodos(val: string): any[] {
    if (typeof val !== 'string') return [];
    const filterValue = val.toLowerCase();
    return this.periodos.filter(p => p.descripcion.toLowerCase().includes(filterValue));
  }

  private _filterClients(name: string): Client[] {
    const filterValue = name.toLowerCase();
    return this.clientes.filter(c => c.nombre_legal.toLowerCase().includes(filterValue));
  }

  private _filterCecos(val: string): CostCenter[] {
    const filterValue = val.toLowerCase();
    return this.cecos.filter(c => c.nombre.toLowerCase().includes(filterValue));
  }

  displayPeriodo(periodo: any): string {
    return periodo ? periodo.descripcion : '';
  }

  displayClient(client: Client): string {
    return client ? client.nombre_legal : '';
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

  buscarHistorico(): void {
    const periodo = this.periodoControl.value;
    if (!periodo || typeof periodo !== 'object') {
      Swal.fire('Atención', 'Seleccione un periodo de nómina', 'warning');
      return;
    }

    const params: any = {
      periodo_id: periodo.id_periodo
    };

    if (this.clientControl.value?.id_entidad) {
      params.cliente_id = this.clientControl.value.id_entidad;
    }

    if (this.selectedCecoIds.length > 0) {
      this.selectedCecoIds.forEach(id => {
        params['cecos[]'] = params['cecos[]'] || [];
        params['cecos[]'].push(id);
      });
    }

    if (this.queryControl.value) {
      params.query = this.queryControl.value;
    }

    this.isLoading = true;
    this.nominaService.getHistorico(params).subscribe({
      next: (data) => {
        this.historicoDataSource.data = data;
        this.historicoDataSource.paginator = this.paginator;
        this.historicoDataSource.sort = this.sort;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        Swal.fire('Error', 'No se pudo cargar el histórico', 'error');
      }
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.historicoDataSource.filter = filterValue.trim().toLowerCase();
  }

  exportarExcel(): void {
    if (this.historicoDataSource.data.length === 0) return;
    
    const p = this.periodoControl.value;
    const desc = p?.descripcion || 'Historico';

    const dataToExport = this.historicoDataSource.data.map(item => ({
      'Identificación': item.identificacion,
      'Nombre Completo': item.nombre_completo,
      'Centro de Costo': item.ceco_nombre,
      'Total Devengado': item.total_devengado,
      'Total Deducido': item.total_deducido,
      'Neto a Pagar': item.neto_pagar,
      'Estado': item.estado_pago,
      'Fecha Liquidación': new Date(item.liquidado_at).toLocaleString()
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    
    XLSX.writeFile(wb, `Historico_Nomina_${desc}.xlsx`);
  }
}
