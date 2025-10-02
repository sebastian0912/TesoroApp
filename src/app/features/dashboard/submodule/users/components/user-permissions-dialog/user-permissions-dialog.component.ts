import { Component, Inject, ChangeDetectionStrategy, OnInit, signal, computed } from '@angular/core';
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
import { ModulosService } from '../../services/modulos/modulos.service';

export interface UserPermissionsData {
  userfull: {
    id: string;
    numero_de_documento?: string | null;
    datos_basicos?: { nombres?: string | null; apellidos?: string | null; celular?: string | null } | null;
    rol?: { id?: string | null; nombre?: string | null } | null;
  };
}

type ActionCanonical = 'LEER' | 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR';

type Cell = {
  rol: boolean;       // viene por Rol
  otorgado: boolean;  // excepción directa otorgada
  revocado: boolean;  // excepción directa revocada (otorgado=false)
  efectivo: boolean;  // resultado final
  tooltip: string;
};

/* ----- Árbol ----- */
type PermisoNode = { id: string; nombre: string; accion?: { nombre: string; etiqueta: string } };
type NodoModulo = { id: string; nombre: string; submodulos?: NodoModulo[]; permisos?: PermisoNode[] };

/* ----- Filas de la tabla con niveles ----- */
type GroupRow = { kind: 'group'; id: string; titulo: string; level: number };
type DataRow  = {
  kind: 'data';
  modulo_id: string;
  modulo_nombre: string;
  level: number;
  leer: Cell;
  crear: Cell;
  actualizar: Cell;
  eliminar: Cell;
};
type TableRow = GroupRow | DataRow;

@Component({
  selector: 'app-user-permissions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    SharedModule,
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
    private modulosSvc: ModulosService,
  ) {}

  loading = signal(true);
  saving  = signal(false);
  errorMsg = signal<string | null>(null);

  readonly ACTIONS: ActionCanonical[] = ['LEER', 'CREAR', 'ACTUALIZAR', 'ELIMINAR'];
  private actionSynonyms: Record<string, ActionCanonical> = {
    'LEER': 'LEER', 'READ': 'LEER', 'VER': 'LEER',
    'CREAR': 'CREAR', 'CREATE': 'CREAR',
    'ACTUALIZAR': 'ACTUALIZAR', 'UPDATE': 'ACTUALIZAR', 'EDITAR': 'ACTUALIZAR',
    'ELIMINAR': 'ELIMINAR', 'DELETE': 'ELIMINAR', 'BORRAR': 'ELIMINAR',
  };

  // Tabla
  displayedColumns = ['modulo', 'leer', 'crear', 'actualizar', 'eliminar'];
  rows = signal<TableRow[]>([]);

  // Leyenda (opcional para UI)
  legend = [
    { icon: 'check_circle', cls: 'ok',  label: 'Permiso efectivo' },
    { icon: 'block',        cls: 'bad', label: 'Revocado por excepción' },
    { icon: 'radio_button_unchecked', cls: 'off', label: 'Sin permiso' },
  ];

  // Índices
  private permIndex = new Map<string, string>();     // `${modulo_id}#${accion}` -> permiso_id
  private moduleNameById = new Map<string, string>(); // modulo_id -> nombre
  private availableActions = new Map<string, Set<ActionCanonical>>(); // modulo_id -> acciones disponibles

  // Conjuntos de estado
  private roleSet   = new Set<string>(); // permisos del rol
  private grantSet  = new Set<string>(); // excepciones otorgadas
  private revokeSet = new Set<string>(); // excepciones revocadas

  // Predicados para *matRowDef*
  isGroup = (_: number, r: TableRow) => r.kind === 'group';
  isData  = (_: number, r: TableRow) => r.kind === 'data';

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
      // Catálogo: árbol de módulos con permisos (legibles)
      catalog: this.modulosSvc.treePermisos(),
      // IDs del rol (si hay rol)
      roleIds: rolId ? this.permisosSvc.getRolePermisoIds(rolId) : of<string[]>([]),
      // Excepciones del usuario: [{ permiso, otorgado }]
      overrides: this.permisosSvc.getUserOverrides(userId),
    })
      .pipe(
        map(({ catalog, roleIds, overrides }) => {
          // 1) Indexar árbol (permIndex, moduleNameById, availableActions)
          this.indexTree(catalog as NodoModulo[]);

          // 2) Cargar sets (rol / overrides)
          this.roleSet.clear();
          for (const id of (roleIds || [])) this.roleSet.add(String(id));

          this.grantSet.clear();
          this.revokeSet.clear();
          for (const ov of (overrides || [])) {
            const pid = String(ov.permiso);
            if (ov.otorgado) this.grantSet.add(pid);
            else this.revokeSet.add(pid);
          }

          // 3) Construir filas (grupos + hojas con level)
          const rows = this.buildRows(catalog as NodoModulo[]);
          return rows;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (rows) => this.rows.set(rows),
        error: () => this.errorMsg.set('No se pudieron cargar los permisos del usuario.'),
      });
  }

  /* ===================== Indexación del árbol ===================== */

  private indexTree(roots: NodoModulo[] = []): void {
    this.permIndex.clear();
    this.moduleNameById.clear();
    this.availableActions.clear();

    const canon = (s?: string | null): ActionCanonical | undefined => {
      if (!s) return undefined;
      const k = s.toUpperCase().trim();
      return this.actionSynonyms[k];
    };

    const visit = (n: NodoModulo) => {
      this.moduleNameById.set(n.id, n.nombre);

      if (n.permisos?.length) {
        const set = this.availableActions.get(n.id) ?? new Set<ActionCanonical>();
        for (const p of n.permisos) {
          const a = canon(p.accion?.nombre || p.accion?.etiqueta);
          if (a) {
            this.permIndex.set(`${n.id}#${a}`, p.id);
            set.add(a);
          }
        }
        this.availableActions.set(n.id, set);
      }

      (n.submodulos ?? []).forEach(visit);
    };

    (roots ?? []).forEach(visit);
  }

  /* ===================== Construcción de filas (DFS con niveles) ===================== */

  private buildRows(roots: NodoModulo[] = []): TableRow[] {
    const out: TableRow[] = [];

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

    const pid = (modId: string, a: ActionCanonical) => this.permIndex.get(`${modId}#${a}`);

    const pushLeaf = (modId: string, level: number) => {
      out.push({
        kind: 'data',
        modulo_id: modId,
        modulo_nombre: this.moduleNameById.get(modId) || '—',
        level,
        leer:       makeCell(pid(modId, 'LEER')),
        crear:      makeCell(pid(modId, 'CREAR')),
        actualizar: makeCell(pid(modId, 'ACTUALIZAR')),
        eliminar:   makeCell(pid(modId, 'ELIMINAR')),
      });
    };

    const dfs = (node: NodoModulo, level = 0) => {
      const children = node.submodulos ?? [];
      if (children.length > 0) {
        // Cualquier nodo con hijos es un grupo (título)
        out.push({ kind: 'group', id: node.id, titulo: node.nombre, level });
        for (const ch of children) {
          if ((ch.submodulos?.length ?? 0) > 0) dfs(ch, level + 1);  // sub-grupo
          else pushLeaf(ch.id, level + 1);                           // hoja
        }
      } else {
        // raíz sin hijos -> hoja directa
        pushLeaf(node.id, level);
      }
    };

    (roots ?? []).forEach(r => dfs(r, 0));
    return out;
  }

  /* ===================== Helpers para el template ===================== */

  hasAction(modulo_id: string, action: ActionCanonical): boolean {
    const set = this.availableActions.get(modulo_id);
    return !!set && set.has(action);
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

  /* ===================== Interacción ===================== */

  /** Click en celda: clic = otorgar, Alt+clic = revocar, Ctrl+clic = limpiar */
  onCellClick(row: DataRow, action: ActionCanonical, ev: MouseEvent): void {
    const pid = this.permIndex.get(`${row.modulo_id}#${action}`);
    if (!pid) return;

    if (ev.ctrlKey) {
      // limpiar excepción
      this.grantSet.delete(pid);
      this.revokeSet.delete(pid);
    } else if (ev.altKey) {
      // toggle revocar
      if (this.revokeSet.has(pid)) this.revokeSet.delete(pid);
      else {
        this.revokeSet.add(pid);
        this.grantSet.delete(pid);
      }
    } else {
      // toggle otorgar
      if (this.grantSet.has(pid)) this.grantSet.delete(pid);
      else {
        this.grantSet.add(pid);
        this.revokeSet.delete(pid);
      }
    }

    // Recalcular solo la fila impactada
    this.refreshRow(row.modulo_id, row.level);
  }

  /** Recalcula una hoja específica (modulo_id) preservando su level */
  private refreshRow(modulo_id: string, level: number): void {
    const current = this.rows();
    const idx = current.findIndex(r => r.kind === 'data' && r.modulo_id === modulo_id);
    if (idx === -1) return;

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

    const updated: DataRow = {
      kind: 'data',
      modulo_id,
      modulo_nombre: (current[idx] as DataRow).modulo_nombre,
      level,
      leer:       makeCell(pid('LEER')),
      crear:      makeCell(pid('CREAR')),
      actualizar: makeCell(pid('ACTUALIZAR')),
      eliminar:   makeCell(pid('ELIMINAR')),
    };

    const next = current.slice();
    next[idx] = updated;
    this.rows.set(next);
  }

  /* ===================== Persistencia ===================== */

  guardar(): void {
    const userId = String(this.data?.userfull?.id ?? '');
    if (!userId) return;

    const otorgados = Array.from(this.grantSet);
    const revocados = Array.from(this.revokeSet);

    this.saving.set(true);
    this.permisosSvc
      .assignUserOverrides(userId, otorgados, revocados) // <- (userId, otorgados[], revocados[])
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.close(),
        error: () => this.errorMsg.set('No se pudieron guardar los cambios.'),
      });
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
