import {
  Component, ChangeDetectionStrategy, OnInit, signal, computed, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, Subject } from 'rxjs';

import {
  NominaService, Empleado, EmpleadosQuery, Client, CostCenter,
} from '../../service/nomina/nomina.service';
import { EmpleadoEditorDialogComponent } from '../empleado-editor-dialog/empleado-editor-dialog.component';

@Component({
  selector: 'app-empleados-lista',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatProgressSpinnerModule, MatDialogModule, MatTooltipModule,
  ],
  templateUrl: './empleados-lista.component.html',
  styleUrl: './empleados-lista.component.css',
})
export class EmpleadosListaComponent implements OnInit {
  private svc = inject(NominaService);
  private dialog = inject(MatDialog);

  empleados = signal<Empleado[]>([]);
  loading = signal(false);
  total = signal(0);
  pageIndex = signal(0);
  pageSize = signal(50);

  // Filtros (signals para CD en modo zoneless)
  q = signal('');
  clienteId = signal<number | null>(null);
  cecoId = signal<number | null>(null);
  estado = signal<string>('ACTIVO');

  clientes = signal<Client[]>([]);
  cecos = signal<CostCenter[]>([]);

  displayedColumns = [
    'documento', 'nombre', 'cliente', 'ceco', 'salario',
    'fecha_ingreso', 'estado', 'acciones',
  ];

  private searchSubject = new Subject<void>();

  ngOnInit(): void {
    this.svc.getClientesActivos().subscribe({
      next: (cs) => this.clientes.set(cs),
      error: () => this.clientes.set([]),
    });
    // Debounce búsqueda libre para no golpear al backend en cada tecla
    this.searchSubject.pipe(debounceTime(300)).subscribe(() => {
      this.pageIndex.set(0);
      this.fetch();
    });
    this.fetch();
  }

  onClienteChange(id: number | null): void {
    this.clienteId.set(id);
    this.cecoId.set(null);
    this.cecos.set([]);
    if (id) {
      this.svc.getCentrosCostos(id).subscribe({
        next: (cs) => this.cecos.set(cs),
        error: () => this.cecos.set([]),
      });
    }
    this.pageIndex.set(0);
    this.fetch();
  }

  onEstadoChange(value: string): void {
    this.estado.set(value);
    this.pageIndex.set(0);
    this.fetch();
  }

  onCecoChange(id: number | null): void {
    this.cecoId.set(id);
    this.pageIndex.set(0);
    this.fetch();
  }

  onSearchInput(): void { this.searchSubject.next(); }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.fetch();
  }

  limpiarFiltros(): void {
    this.q.set('');
    this.clienteId.set(null);
    this.cecoId.set(null);
    this.estado.set('ACTIVO');
    this.cecos.set([]);
    this.pageIndex.set(0);
    this.fetch();
  }

  private fetch(): void {
    this.loading.set(true);
    const query: EmpleadosQuery = {
      q: this.q(),
      cliente_id: this.clienteId(),
      ceco_id: this.cecoId(),
      estado: this.estado(),
      solo_con_contrato: 1,
      page: this.pageIndex() + 1,
      page_size: this.pageSize(),
    };
    this.svc.getEmpleados(query).subscribe({
      next: (resp) => {
        this.empleados.set(resp.results || []);
        this.total.set(resp.count || 0);
        this.loading.set(false);
      },
      error: () => {
        this.empleados.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  abrirEditor(emp?: Empleado): void {
    const ref = this.dialog.open(EmpleadoEditorDialogComponent, {
      width: '95vw', maxWidth: '1100px', height: '90vh',
      disableClose: true,
      data: { id_persona: emp?.id_persona ?? null },
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.changed) this.fetch();
    });
  }

  eliminar(emp: Empleado, ev: MouseEvent): void {
    ev.stopPropagation();
    if (!emp.id_persona) return;
    const nombre = emp.nombre_completo || emp.numero_documento;
    if (!confirm(`¿Retirar a ${nombre}? Sus contratos activos quedarán RETIRADOS con fecha de hoy.`)) return;

    this.svc.eliminarEmpleado(emp.id_persona).subscribe({
      next: () => this.fetch(),
      error: (err: HttpErrorResponse) => alert(err.error?.error || 'No se pudo retirar el empleado.'),
    });
  }

  fmtSalario = (v: any) => v == null ? '—'
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v));

  fmtFecha = (v: string | null | undefined) => v ? v.split('T')[0] : '—';

  /** Regla: si el número de documento empieza con 'X', el tipo siempre es PPT.
   *  Se aplica aquí como último cinturón de seguridad para datos legacy que
   *  aún no pasaron por el serializer actualizado. */
  tipoDoc(e: Empleado): string {
    const nd = (e.numero_documento || '').trim().toUpperCase();
    if (nd.startsWith('X')) return 'PPT';
    return e.tipo_documento || '';
  }
}
