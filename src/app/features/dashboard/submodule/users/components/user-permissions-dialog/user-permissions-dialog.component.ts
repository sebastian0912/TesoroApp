import { Component, Inject, ChangeDetectionStrategy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { forkJoin, of } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

import { PermisosService } from '../../services/permiso/permisos.service';
import { SharedModule } from '@/app/shared/shared.module';
import { ModulosService, ModuloPermisosNode } from '../../services/modulos/modulos.service';

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

/* ----- Tipos de API (Flat) ----- */
type PermisoRaw = {
  id: string;
  nombre: string;
  accion: { nombre: string; etiqueta: string };
};

/* ----- Árbol Interno (Jerárquico) ----- */
type NodoTree = {
  id: string;
  nombre: string;
  hijos: NodoTree[];
  permisos: PermisoRaw[];
};

/* ----- Filas de la tabla con niveles ----- */
type GroupRow = { kind: 'group'; id: string; titulo: string; level: number };
type DataRow = {
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
    MatSlideToggleModule,
    MatButtonModule,
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

  // Tabla
  displayedColumns = ['modulo', 'leer', 'crear', 'actualizar', 'eliminar'];
  rows = signal<TableRow[]>([]);

  // Computed
  userFullName = computed(() => {
    const db = this.data.userfull.datos_basicos;
    if (!db) return 'Usuario';
    return `${db.nombres || ''} ${db.apellidos || ''}`.trim() || 'Usuario';
  });

  rolNombre = computed(() => this.data.userfull.rol?.nombre || 'Sin Rol');

  selectedModulesCount = computed(() => {
    return this.rows().filter(r => {
      if (r.kind !== 'data') return false;
      const d = r as DataRow;
      return d.leer.efectivo || d.crear.efectivo || d.actualizar.efectivo || d.eliminar.efectivo;
    }).length;
  });

  // Índices
  private permIndex = new Map<string, string>();      // `${modulo_id}#${accion}` -> permiso_id
  private moduleNameById = new Map<string, string>(); // modulo_id -> nombre
  private availableActions = new Map<string, Set<ActionCanonical>>(); // modulo_id -> acciones disponibles

  // Conjuntos de estado
  private roleSet = new Set<string>(); // permisos del rol
  private grantSet = new Set<string>(); // excepciones otorgadas
  private revokeSet = new Set<string>(); // excepciones revocadas

  // Predicados
  isGroup = (_: number, r: TableRow) => r.kind === 'group';
  isData = (_: number, r: TableRow) => r.kind === 'data';

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
      // API devuelve ModuloPermisosNode[] (Ya viene con estructura de árbol interna)
      rawModules: this.modulosSvc.treePermisos({ include_empty: true }),
      roleIds: rolId ? this.permisosSvc.getRolePermisoIds(rolId) : of<string[]>([]),
      overrides: this.permisosSvc.getUserOverrides(userId),
    })
      .pipe(
        map(({ rawModules, roleIds, overrides }) => {
          // 1) Adaptar estructura de árbol
          const rootNodes = this.adaptTree(rawModules as any[]);

          // 2) Indexar árbol (ahora sí tenemos objeto jerárquico y permisos array)
          this.indexTree(rootNodes);

          // 3) Cargar sets (rol / overrides)
          this.roleSet.clear();
          for (const id of (roleIds || [])) this.roleSet.add(String(id));

          this.grantSet.clear();
          this.revokeSet.clear();
          for (const ov of (overrides || [])) {
            const pid = String(ov.permiso);
            if (ov.otorgado) this.grantSet.add(pid);
            else this.revokeSet.add(pid);
          }

          // 4) Construir filas UI
          const rows = this.buildRows(rootNodes);
          return rows;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (rows) => this.rows.set(rows),
        error: () => this.errorMsg.set('No se pudieron cargar los permisos del usuario.'),
      });
  }

  /* ===================== Adaptación del árbol (API Recursivo -> Internal Tree) ===================== */
  private adaptTree(nodes: any[]): NodoTree[] {
    if (!nodes) return [];
    return nodes.map(n => ({
      id: n.id,
      nombre: n.nombre,
      // 'submodulos' es lo que usa rol-permissions-dialog principal, 'hijos' fallback
      hijos: this.adaptTree(n.submodulos || n.hijos || []),
      // 'permisos' viene como array de objetos en el JSON real
      permisos: n.permisos || []
    }));
  }



  private indexTree(roots: NodoTree[] = []): void {
    this.permIndex.clear();
    this.moduleNameById.clear();
    this.availableActions.clear();

    const canon = (s?: string | null): ActionCanonical | undefined => {
      if (!s) return undefined;
      const k = s.toUpperCase().trim();
      return this.actionSynonyms[k];
    };

    const visit = (n: NodoTree) => {
      this.moduleNameById.set(n.id, n.nombre);

      if (n.permisos?.length) {
        const set = this.availableActions.get(n.id) ?? new Set<ActionCanonical>();

        for (const p of n.permisos) {
          // El API trae accion.nombre (ej: "LEER") o accion.etiqueta
          // Aseguramos acceso seguro a nombre
          const rawAction = p.accion?.nombre || (typeof p.accion === 'string' ? p.accion : '');
          const a = canon(rawAction);
          if (a) {
            this.permIndex.set(`${n.id}#${a}`, p.id);
            set.add(a);
          }
        }
        this.availableActions.set(n.id, set);
      }

      (n.hijos ?? []).forEach(visit);
    };

    (roots ?? []).forEach(visit);
  }

  /* ===================== Construcción de filas (DFS con niveles) ===================== */

  private buildRows(roots: NodoTree[] = []): TableRow[] {
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
        leer: makeCell(pid(modId, 'LEER')),
        crear: makeCell(pid(modId, 'CREAR')),
        actualizar: makeCell(pid(modId, 'ACTUALIZAR')),
        eliminar: makeCell(pid(modId, 'ELIMINAR')),
      });
    };

    const dfs = (node: NodoTree, level = 0) => {
      const children = node.hijos ?? [];
      if (children.length > 0) {
        // Cualquier nodo con hijos es un grupo (título)
        out.push({ kind: 'group', id: node.id, titulo: node.nombre, level });
        for (const ch of children) {
          if ((ch.hijos?.length ?? 0) > 0) dfs(ch, level + 1);  // sub-grupo
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

  /* ===================== Interacción ===================== */

  /**
   * Smart Toggle:
   * - If Role=ON: Toggle OFF -> Revoke. Toggle ON -> Un-revoke.
   * - If Role=OFF: Toggle ON -> Grant. Toggle OFF -> Un-grant.
   */
  onToggle(row: DataRow | any, action: ActionCanonical, checked: boolean): void {
    const r = row as DataRow; // Safe cast since logic ensures this
    const pid = this.permIndex.get(`${r.modulo_id}#${action}`);
    if (!pid) return;

    const hasRole = this.roleSet.has(pid);

    if (checked) {
      // User wants ON
      if (hasRole) {
        // Restore role permission (remove revoke)
        this.revokeSet.delete(pid);
      } else {
        // Grant direct permission
        this.grantSet.add(pid);
      }
    } else {
      // User wants OFF
      if (hasRole) {
        // Revoke role permission
        this.revokeSet.add(pid);
      } else {
        // Remove direct grant
        this.grantSet.delete(pid);
      }
    }

    this.refreshRow(r.modulo_id, r.level);
  }

  /** Reset all overrides for a module (return to Default/Role state) */
  resetModule(modulo_id: string): void {
    const current = this.rows();
    const row = current.find(r => r.kind === 'data' && r.modulo_id === modulo_id) as DataRow;
    if (!row) return;

    this.ACTIONS.forEach(a => {
      const pid = this.permIndex.get(`${modulo_id}#${a}`);
      if (pid) {
        this.grantSet.delete(pid);
        this.revokeSet.delete(pid);
      }
    });

    this.refreshRow(modulo_id, row.level);
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
      leer: makeCell(pid('LEER')),
      crear: makeCell(pid('CREAR')),
      actualizar: makeCell(pid('ACTUALIZAR')),
      eliminar: makeCell(pid('ELIMINAR')),
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
