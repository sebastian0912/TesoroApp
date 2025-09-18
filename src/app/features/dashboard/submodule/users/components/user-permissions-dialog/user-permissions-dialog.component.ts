import { Component, Inject, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

import { PermisosService } from '../../services/permiso/permisos.service';
import { SharedModule } from '@/app/shared/shared.module';

export interface UserPermissionsData {
  userfull: {
    id: string;
    numero_de_documento?: string | null;
    datos_basicos?: {
      nombres?: string | null;
      apellidos?: string | null;
      celular?: string | null;
    } | null;
    rol?: {
      id?: string | null;
      nombre?: string | null;
    } | null;
  };
}

type ActionCanonical = 'LEER' | 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR';

type Cell = {
  rol: boolean;        // viene por Rol
  otorgado: boolean;   // excepción directa otorgada
  revocado: boolean;   // excepción directa revocada
  efectivo: boolean;   // resultado final
  tooltip: string;
};

type Row = {
  modulo_id: string;
  modulo_nombre: string;
  leer: Cell;
  crear: Cell;
  actualizar: Cell;
  eliminar: Cell;
};


@Component({
  selector: 'app-user-permissions-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    SharedModule
  ],
  templateUrl: './user-permissions-dialog.component.html',
  styleUrl: './user-permissions-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserPermissionsDialogComponent implements OnInit {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: UserPermissionsData,
    private dialogRef: MatDialogRef<UserPermissionsDialogComponent, null>,
    private permisosSvc: PermisosService,
  ) { }

  loading = signal(true);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  readonly ACTIONS: ActionCanonical[] = ['LEER', 'CREAR', 'ACTUALIZAR', 'ELIMINAR'];
  private actionSynonyms: Record<string, ActionCanonical> = {
    'LEER': 'LEER', 'READ': 'LEER', 'VER': 'LEER',
    'CREAR': 'CREAR', 'CREATE': 'CREAR',
    'ACTUALIZAR': 'ACTUALIZAR', 'UPDATE': 'ACTUALIZAR', 'EDITAR': 'ACTUALIZAR',
    'ELIMINAR': 'ELIMINAR', 'DELETE': 'ELIMINAR', 'BORRAR': 'ELIMINAR',
  };

  displayedColumns = ['modulo', 'leer', 'crear', 'actualizar', 'eliminar'];

  // dataset renderizado
  rows = signal<Row[]>([]);

  // Leyenda
  legend = [
    { icon: 'check_circle', cls: 'ok', label: 'Permiso efectivo' },
    { icon: 'block', cls: 'bad', label: 'Revocado por excepción' },
    { icon: 'radio_button_unchecked', cls: 'off', label: 'Sin permiso' },
  ];

  // Índice para obtener permiso_id por (modulo + acción)
  private permIndex = new Map<string, string>(); // key = `${modulo_id}#${accion}`

  // Conjuntos para estado actual
  private roleSet = new Set<string>(); // permisos que vienen del rol
  private grantSet = new Set<string>(); // excepciones otorgadas al usuario
  private revokeSet = new Set<string>(); // excepciones revocadas al usuario

  ngOnInit(): void {
    const user = this.data?.userfull ?? ({} as any);
    const userId = String(user?.id ?? '');
    const rolId: string | null = (user?.rol?.id ? String(user.rol.id) : null);

    if (!userId) {
      this.errorMsg.set('Falta el ID del usuario.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);

    forkJoin({
      // Catálogo de permisos con módulo y acción legible
      catalog: this.permisosSvc.listAllPermisos(),
      // IDs de permisos del rol (si hay rol)
      roleIds: rolId ? this.permisosSvc.getRolePermisoIds(rolId) : of<string[]>([]),
      // Excepciones del usuario (otorgados / revocados)
      overrides: this.permisosSvc.getUserOverrides(userId),
    })
      .pipe(
        map(({ catalog, roleIds, overrides }) => {
          // Normaliza campos del catálogo
          const items = (catalog || []).map((p: any) => ({
            id: String(p.id),
            modulo_id: String(p.modulo ?? p.modulo_id),
            modulo_nombre: String(p.modulo_nombre ?? p.modulo?.nombre ?? ''),
            accion_nombre: String(p.accion_nombre ?? p.accion ?? ''),
          }));

          const canon = (s: string): ActionCanonical | null => {
            if (!s) return null;
            const k = s.toUpperCase().trim();
            return this.actionSynonyms[k] ?? null;
          };

          // Limpia índices y sets
          this.permIndex.clear();
          this.roleSet.clear();
          this.grantSet.clear();
          this.revokeSet.clear();

          // Construye índice (modulo+acción) -> permiso_id
          for (const p of items) {
            const a = canon(p.accion_nombre);
            if (!a) continue;
            this.permIndex.set(`${p.modulo_id}#${a}`, p.id);
          }

          // Carga sets base (rol, overrides)
          for (const id of (roleIds || [])) this.roleSet.add(String(id));
          for (const ov of (overrides || [])) {
            const pid = String(ov.permiso);
            if (ov.otorgado) this.grantSet.add(pid);
            else this.revokeSet.add(pid);
          }

          // Módulos únicos para armar las filas
          const modules = Array.from(
            items.reduce((acc, p) => acc.set(p.modulo_id, p.modulo_nombre), new Map<string, string>())
          )
            .map(([modulo_id, modulo_nombre]) => ({ modulo_id, modulo_nombre }))
            .sort((a, b) => a.modulo_nombre.localeCompare(b.modulo_nombre, 'es'));

          // Construye filas
          const rows: Row[] = modules.map(m => this.computeRow(m.modulo_id, m.modulo_nombre));
          return rows;
        })
      )
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.errorMsg.set('No se pudieron cargar los permisos del usuario.');
          this.loading.set(false);
        }
      });
  }

  /** Genera una fila a partir de los sets actuales */
  private computeRow(modulo_id: string, modulo_nombre: string): Row {
    const pid = (a: ActionCanonical) => this.permIndex.get(`${modulo_id}#${a}`);

    const makeCell = (permId?: string): Cell => {
      const rol = !!(permId && this.roleSet.has(permId));
      const otorgado = !!(permId && this.grantSet.has(permId));
      const revocado = !!(permId && this.revokeSet.has(permId));
      const efectivo = (rol && !revocado) || otorgado;

      const tooltip =
        `Efectivo: ${efectivo ? 'Sí' : 'No'}\n` +
        `— Por rol: ${rol ? 'Sí' : 'No'}\n` +
        `— Otorgado directo: ${otorgado ? 'Sí' : 'No'}\n` +
        `— Revocado: ${revocado ? 'Sí' : 'No'}`;

      return { rol, otorgado, revocado, efectivo, tooltip };
    };

    return {
      modulo_id,
      modulo_nombre,
      leer: makeCell(pid('LEER')),
      crear: makeCell(pid('CREAR')),
      actualizar: makeCell(pid('ACTUALIZAR')),
      eliminar: makeCell(pid('ELIMINAR')),
    };
  }

  /** Recalcula en vivo una fila afectada */
  private refreshRow(modulo_id: string): void {
    const current = this.rows();
    const idx = current.findIndex(r => r.modulo_id === modulo_id);
    if (idx === -1) return;

    const nuevo = this.computeRow(modulo_id, current[idx].modulo_nombre);
    const next = current.slice();
    next[idx] = nuevo;
    this.rows.set(next);
  }

  /** Click en celda: clic = otorgar, Alt+clic = revocar, Ctrl+clic = limpiar */
  onCellClick(row: Row, action: ActionCanonical, ev: MouseEvent): void {
    const pid = this.permIndex.get(`${row.modulo_id}#${action}`);
    if (!pid) return;

    if (ev.ctrlKey) {
      // Limpiar excepción
      this.grantSet.delete(pid);
      this.revokeSet.delete(pid);
    } else if (ev.altKey) {
      // Toggle revocar
      if (this.revokeSet.has(pid)) this.revokeSet.delete(pid);
      else {
        this.revokeSet.add(pid);
        this.grantSet.delete(pid);
      }
    } else {
      // Toggle otorgar
      if (this.grantSet.has(pid)) this.grantSet.delete(pid);
      else {
        this.grantSet.add(pid);
        this.revokeSet.delete(pid);
      }
    }

    this.refreshRow(row.modulo_id);
  }

  /** Enviar al backend las excepciones actuales */
  guardar(): void {
    const userId = String(this.data?.userfull?.id ?? '');
    if (!userId) return;

    const otorgados = Array.from(this.grantSet);
    const revocados = Array.from(this.revokeSet);

    this.saving.set(true);
    this.permisosSvc
      .assignUserOverrides(userId, otorgados, revocados) // <-- 3 argumentos
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.close(),
        error: () => this.errorMsg.set('No se pudieron guardar los cambios.')
      });
  }

  close(): void {
    this.dialogRef.close(null);
  }

  iconFor(cell: Cell): string {
    if (cell.revocado) return 'block';
    if (cell.efectivo) return 'check_circle';
    return 'radio_button_unchecked';
  }

  clsFor(cell: Cell): string {
    if (cell.revocado) return 'bad';
    if (cell.efectivo) return 'ok';
    return 'off';
  }
}
