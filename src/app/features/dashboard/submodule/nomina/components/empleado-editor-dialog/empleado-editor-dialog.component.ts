import {
  Component, ChangeDetectionStrategy, OnInit, Inject, signal, inject, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

import {
  NominaService, Empleado, EmpleadoContrato, Client, CostCenter,
} from '../../service/nomina/nomina.service';

type DialogData = { id_persona: number | null };

@Component({
  selector: 'app-empleado-editor-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatTabsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatTooltipModule,
    MatDatepickerModule, MatNativeDateModule,
    MatCardModule, MatChipsModule, MatDividerModule,
  ],
  templateUrl: './empleado-editor-dialog.component.html',
  styleUrl: './empleado-editor-dialog.component.css',
})
export class EmpleadoEditorDialogComponent implements OnInit {
  private svc = inject(NominaService);
  private ref = inject(MatDialogRef<EmpleadoEditorDialogComponent>);

  readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  isNew = signal(false);
  loading = signal(true);
  saving = signal(false);
  error = signal<string>('');
  changed = signal(false);

  empleado = signal<Empleado>({});
  contratos = signal<EmpleadoContrato[]>([]);
  contratoIdx = signal(0);   // índice del contrato seleccionado

  // Catálogos
  clientes = signal<Client[]>([]);
  cecos = signal<CostCenter[]>([]);
  bancos = signal<Client[]>([]);
  epss = signal<Client[]>([]);
  afps = signal<Client[]>([]);
  ccfs = signal<Client[]>([]);

  // Contrato actualmente editado
  contratoActual = computed(() => this.contratos()[this.contratoIdx()] ?? null);

  ngOnInit(): void {
    this.isNew.set(this.data.id_persona == null);

    // Cargar catálogos en paralelo (no bloquean la carga del empleado)
    this.svc.getEntidadesPorTipo('CLIENTE').subscribe(x => this.clientes.set(x || []));
    this.svc.getEntidadesPorTipo('BANCO').subscribe(x => this.bancos.set(x || []));
    this.svc.getEntidadesPorTipo('EPS').subscribe(x => this.epss.set(x || []));
    this.svc.getEntidadesPorTipo('AFP').subscribe(x => this.afps.set(x || []));
    this.svc.getEntidadesPorTipo('CCF').subscribe(x => this.ccfs.set(x || []));

    if (this.isNew()) {
      this.empleado.set({
        tipo_documento: 'CC', numero_documento: '',
        primer_nombre: '', primer_apellido: '',
        es_pensionado: false, cantidad_hijos: 0,
      });
      this.contratos.set([{
        estado: 'ACTIVO', auxilio_transporte_ley: true,
        fecha_ingreso: new Date().toISOString().slice(0, 10),
      }]);
      this.loading.set(false);
      return;
    }

    this.svc.getEmpleado(this.data.id_persona!).subscribe({
      next: (emp) => {
        this.empleado.set(emp);
        const lista = (emp.contratos || []).slice().sort((a, b) => {
          const da = a.fecha_ingreso || '';
          const db = b.fecha_ingreso || '';
          return db.localeCompare(da); // más reciente primero
        });
        this.contratos.set(lista.length ? lista : [{
          estado: 'ACTIVO', auxilio_transporte_ley: true,
          fecha_ingreso: new Date().toISOString().slice(0, 10),
        }]);
        // Cargar CECOs del cliente del contrato activo para el dropdown
        const cId = this.contratoActual()?.id_cliente;
        if (cId) this.cargarCecosDe(cId);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error || 'No se pudo cargar el empleado.');
        this.loading.set(false);
      },
    });
  }

  onClienteContratoChange(idCliente: number | null): void {
    this.patchContratoActual({ id_cliente: idCliente, id_ceco: null });
    if (idCliente) this.cargarCecosDe(idCliente);
    else this.cecos.set([]);
  }

  private cargarCecosDe(idCliente: number): void {
    this.svc.getCentrosCostos(idCliente).subscribe({
      next: (cs) => this.cecos.set(cs || []),
      error: () => this.cecos.set([]),
    });
  }

  patchEmpleado(patch: Partial<Empleado>): void {
    this.empleado.update(e => {
      const next = { ...e, ...patch };
      // Regla: documentos que empiezan con 'X' son PPT por convención.
      const nd = (next.numero_documento || '').trim().toUpperCase();
      if (nd.startsWith('X')) {
        next.tipo_documento = 'PPT';
      }
      return next;
    });
  }

  patchContratoActual(patch: Partial<EmpleadoContrato>): void {
    const idx = this.contratoIdx();
    this.contratos.update(arr => {
      const copy = arr.slice();
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  agregarContrato(): void {
    this.contratos.update(arr => [...arr, {
      estado: 'ACTIVO', auxilio_transporte_ley: true,
      fecha_ingreso: new Date().toISOString().slice(0, 10),
    }]);
    this.contratoIdx.set(this.contratos().length - 1);
  }

  eliminarContratoLocal(): void {
    if (this.contratos().length <= 1) return;
    const idx = this.contratoIdx();
    this.contratos.update(arr => arr.filter((_, i) => i !== idx));
    this.contratoIdx.set(Math.max(0, idx - 1));
  }

  terminarContrato(): void {
    const idp = this.empleado().id_persona;
    const c = this.contratoActual();
    if (!idp || !c?.id_contrato) {
      // Es un contrato nuevo aún no guardado: solo actualizar local
      this.patchContratoActual({
        estado: 'RETIRADO',
        fecha_retiro: new Date().toISOString().slice(0, 10),
      });
      return;
    }
    if (!confirm('¿Marcar este contrato como RETIRADO con fecha de hoy?')) return;

    this.saving.set(true);
    this.svc.terminarContratoEmpleado(idp, c.id_contrato).subscribe({
      next: (updated) => {
        const idx = this.contratoIdx();
        this.contratos.update(arr => {
          const copy = arr.slice();
          copy[idx] = updated;
          return copy;
        });
        this.changed.set(true);
        this.saving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error || 'No se pudo terminar el contrato.');
        this.saving.set(false);
      },
    });
  }

  guardar(): void {
    this.error.set('');
    const emp = this.empleado();

    // Validación mínima
    if (!emp.numero_documento || !emp.primer_nombre || !emp.primer_apellido) {
      this.error.set('Documento, primer nombre y primer apellido son obligatorios.');
      return;
    }

    this.saving.set(true);

    if (this.isNew()) {
      // Crear persona + primer contrato
      const body = { ...emp, contrato_inicial: this.sanitizeContrato(this.contratos()[0] || {}) };
      this.svc.crearEmpleado(body).subscribe({
        next: () => { this.changed.set(true); this.saving.set(false); this.ref.close({ changed: true }); },
        error: (err: HttpErrorResponse) => {
          this.error.set(this.formatError(err));
          this.saving.set(false);
        },
      });
      return;
    }

    // Editar persona existente
    const idp = emp.id_persona!;
    this.svc.actualizarEmpleado(idp, this.sanitizePersona(emp)).subscribe({
      next: () => {
        this.changed.set(true);
        this.persistirContratos(idp);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.formatError(err));
        this.saving.set(false);
      },
    });
  }

  private persistirContratos(idp: number): void {
    const lista = this.contratos();
    const ops = lista.map(c => {
      const body = this.sanitizeContrato(c);
      if (c.id_contrato) return this.svc.actualizarContratoEmpleado(idp, c.id_contrato, body);
      return this.svc.crearContratoEmpleado(idp, body);
    });

    if (!ops.length) { this.saving.set(false); this.ref.close({ changed: true }); return; }

    // Secuencial para que los errores paren al primero
    let i = 0;
    const run = () => {
      if (i >= ops.length) {
        this.saving.set(false);
        this.ref.close({ changed: true });
        return;
      }
      ops[i].subscribe({
        next: () => { i++; run(); },
        error: (err: HttpErrorResponse) => {
          this.error.set(`Contrato ${i + 1}: ${this.formatError(err)}`);
          this.saving.set(false);
          // Cerramos con changed=true igual, porque la persona ya se actualizó
        },
      });
    };
    run();
  }

  private sanitizePersona(emp: Empleado): Partial<Empleado> {
    return {
      tipo_documento: emp.tipo_documento,
      numero_documento: emp.numero_documento,
      primer_nombre: emp.primer_nombre,
      segundo_nombre: emp.segundo_nombre || null,
      primer_apellido: emp.primer_apellido,
      segundo_apellido: emp.segundo_apellido || null,
      fecha_nacimiento: emp.fecha_nacimiento || null,
      genero: emp.genero || null,
      email: emp.email || null,
      es_pensionado: !!emp.es_pensionado,
      cantidad_hijos: emp.cantidad_hijos ?? 0,
    };
  }

  private sanitizeContrato(c: Partial<EmpleadoContrato>): Partial<EmpleadoContrato> {
    const out: any = { ...c };
    // Campos read-only del serializer, no se envían
    delete out.centro_de_costo;
    delete out.cliente_nombre;
    delete out.banco_nombre;
    delete out.eps_nombre;
    delete out.afp_nombre;
    delete out.ccf_nombre;
    // Normalizar strings vacíos a null
    ['fecha_retiro', 'codigo_contrato_client', 'numero_cuenta_bancaria', 'forma_pago',
     'fecha_inicio_prima', 'fecha_inicio_cesantias', 'fecha_inicio_vacaciones']
      .forEach(k => { if (out[k] === '') out[k] = null; });
    return out;
  }

  private formatError(err: HttpErrorResponse): string {
    if (!err?.error) return err.message || 'Error desconocido';
    if (typeof err.error === 'string') return err.error;
    if (err.error.error) return err.error.error;
    // Validation errors de DRF: { field: ['msg1', 'msg2'] }
    const msgs: string[] = [];
    Object.entries(err.error).forEach(([k, v]) => {
      const arr = Array.isArray(v) ? v : [v];
      msgs.push(`${k}: ${arr.join(', ')}`);
    });
    return msgs.join(' | ') || 'Error de validación';
  }

  cerrar(): void { this.ref.close({ changed: this.changed() }); }
}
