import {
  Component, Inject, OnInit, ChangeDetectionStrategy, signal, computed, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { GestionRolesSService, Rol } from '../../services/gestion-roles/gestion-roles-s.service';
import { finalize, startWith } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { Permiso, PermisosService } from '../../services/permiso/permisos.service';
import { Subscription } from 'rxjs';

export interface RolePermissionsData {
  rol: Rol;
}

type ActionCanonical = 'LEER' | 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR';

@Component({
  selector: 'app-rol-permissions-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    ReactiveFormsModule,
    MatTableModule,
    MatCheckboxModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatDividerModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rol-permissions-dialog.component.html',
  styleUrl: './rol-permissions-dialog.component.css'
})
export class RolPermissionsDialogComponent implements OnInit {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: RolePermissionsData,
    private dialogRef: MatDialogRef<RolPermissionsDialogComponent, { ok: boolean } | null>,
    private fb: FormBuilder,
    private svc: PermisosService,
    private rolesSvc: GestionRolesSService
  ) { }

  // Loader flags
  loading = signal(true);
  saving = signal(false);
  // Muestra el nombre del módulo en el input del autocomplete
  displayModule = (opt?: { id: string; nombre: string } | null): string =>
    opt?.nombre ?? '';

  // Catálogo completo de permisos
  allPerms = signal<Permiso[]>([]);
  // Permisos actuales (por id) del rol
  rolePermIds = signal<Set<string>>(new Set<string>());

  // Acciones canónicas + mapeo de sinónimos
  readonly ACTIONS: ActionCanonical[] = ['LEER', 'CREAR', 'ACTUALIZAR', 'ELIMINAR'];
  private actionSynonyms: Record<string, ActionCanonical> = {
    'LEER': 'LEER', 'READ': 'LEER', 'VER': 'LEER',
    'CREAR': 'CREAR', 'CREATE': 'CREAR',
    'ACTUALIZAR': 'ACTUALIZAR', 'UPDATE': 'ACTUALIZAR', 'EDITAR': 'ACTUALIZAR',
    'ELIMINAR': 'ELIMINAR', 'DELETE': 'ELIMINAR', 'BORRAR': 'ELIMINAR',
  };

  // Lista única de módulos (derivada del catálogo)
  modules = computed(() => {
    const map = new Map<string, string>();
    for (const p of this.allPerms()) map.set(p.modulo_id, p.modulo_nombre);
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  // Estado editable de la grilla: modulo_id -> Set<accion>
  private gridMap = signal<Map<string, Set<ActionCanonical>>>(new Map());

  // ---- Autocomplete y filtro (sin toSignal) ----
  moduleFilter = new FormControl<string>('');
  private filterSub?: Subscription;
  query = signal<string>(''); // lo que escribe el usuario en el input

  selectedModules = signal<{ id: string; nombre: string }[]>([]);
  hasAllModules = computed(() => {
    const all = this.modules();
    if (all.length === 0) return false;
    const assignedIds = new Set<string>(Array.from(this.gridMap().keys()));
    return all.every(m => assignedIds.has(m.id));
  });

  filteredModuleOptions = computed(() => {
    const q = this.query().toLowerCase();
    const selIds = new Set(this.selectedModules().map(m => m.id));
    const assignedIds = new Set<string>(Array.from(this.gridMap().keys()));

    return this.modules().filter(m => {
      if (selIds.has(m.id)) return false;       // ocultar ya seleccionados (chips)
      if (assignedIds.has(m.id)) return false;  // ocultar los ya en la tabla
      return q ? m.nombre.toLowerCase().includes(q) : true;
    });
  });

  // Chips de acciones a aplicar al agregar módulos
  selectedAddActions = signal<Set<ActionCanonical>>(new Set(['LEER']));

  displayedColumns: string[] = ['modulo', ...this.ACTIONS.map(a => a.toLowerCase())];

  // Tabla derivada del grid
  rows = computed(() => {
    const rows: Array<{
      modulo_id: string;
      modulo_nombre: string;
      LEER: boolean; CREAR: boolean; ACTUALIZAR: boolean; ELIMINAR: boolean;
    }> = [];
    const m = this.gridMap();
    const mods = this.modules();
    const nameById = new Map(mods.map(x => [x.id, x.nombre]));
    m.forEach((actions, modulo_id) => {
      rows.push({
        modulo_id,
        modulo_nombre: nameById.get(modulo_id) || '(desconocido)',
        LEER: actions.has('LEER'),
        CREAR: actions.has('CREAR'),
        ACTUALIZAR: actions.has('ACTUALIZAR'),
        ELIMINAR: actions.has('ELIMINAR')
      });
    });
    return rows.sort((a, b) => a.modulo_nombre.localeCompare(b.modulo_nombre, 'es'));
  });

  ngOnInit(): void {
    // Vincula el input del autocomplete al signal `query`
    this.filterSub = this.moduleFilter.valueChanges
      .pipe(startWith(this.moduleFilter.value ?? ''))
      .subscribe(val => this.query.set((val ?? '').trim()));

    // Carga inicial: catálogo + permisos actuales
    this.loading.set(true);
    Swal.fire({ title: 'Cargando permisos…', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    this.svc.listAllPermisos().subscribe({
      next: (catalog: Permiso[]) => {
        this.allPerms.set(catalog);
        this.svc.getRolePermisoIds(this.data.rol.id).subscribe({
          next: (ids: string[]) => {
            this.rolePermIds.set(new Set(ids));
            this.buildGridFromCurrent();
            this.loading.set(false);
            Swal.close();
          },
          error: () => {
            this.loading.set(false);
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los permisos del rol.' });
          }
        });
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el catálogo de permisos.' });
      }
    });
  }

  ngOnDestroy(): void {
    this.filterSub?.unsubscribe();
  }

  // Construye el gridMap desde rolePermIds + allPerms
  private buildGridFromCurrent(): void {
    const ids = this.rolePermIds();
    const map = new Map<string, Set<ActionCanonical>>();
    for (const p of this.allPerms()) {
      if (!ids.has(p.id)) continue;
      const canon = this.toCanonical(p.accion);
      if (!canon) continue;
      if (!map.has(p.modulo_id)) map.set(p.modulo_id, new Set());
      map.get(p.modulo_id)!.add(canon);
    }
    this.gridMap.set(map);
  }

  // Normaliza acción
  private toCanonical(x: string | null | undefined): ActionCanonical | null {
    if (!x) return null;
    const k = x.toString().toUpperCase().trim();
    return (this.actionSynonyms[k] ?? null) as ActionCanonical | null;
  }

  // Toggle de checkbox en la grilla
  toggleCell(modulo_id: string, action: ActionCanonical, checked: boolean): void {
    const map = new Map(this.gridMap());
    if (!map.has(modulo_id)) map.set(modulo_id, new Set());
    const set = new Set(map.get(modulo_id)!);
    if (checked) set.add(action); else set.delete(action);
    if (set.size === 0) map.delete(modulo_id); else map.set(modulo_id, set);
    this.gridMap.set(map);
  }

  // Quitar fila completa
  quitarModulo(modulo_id: string): void {
    const map = new Map(this.gridMap());
    map.delete(modulo_id);
    this.gridMap.set(map);
  }

  // Chips de acciones (panel agregar)
  isAddActionSelected(a: ActionCanonical): boolean {
    return this.selectedAddActions().has(a);
  }
  toggleAddAction(a: ActionCanonical): void {
    const s = new Set(this.selectedAddActions());
    if (s.has(a)) s.delete(a); else s.add(a);
    if (s.size === 0) s.add('LEER'); // al menos una
    this.selectedAddActions.set(s);
  }

  // Autocomplete selección de módulos
  selectModule(ev: MatAutocompleteSelectedEvent): void {
    const mod = ev.option.value as { id: string; nombre: string };
    const curr = this.selectedModules();
    if (!curr.find(m => m.id === mod.id)) {
      this.selectedModules.set([...curr, mod]);
    }
    this.moduleFilter.setValue('');
  }
  removeSelectedModule(modId: string): void {
    this.selectedModules.set(this.selectedModules().filter(m => m.id !== modId));
  }

  // Agregar módulos seleccionados al grid con las acciones elegidas
  agregarSeleccion(): void {
    const mods = this.selectedModules();
    if (mods.length === 0) return;

    const actions = this.selectedAddActions();
    const map = new Map(this.gridMap());
    for (const m of mods) {
      const set = new Set(map.get(m.id) || []);
      actions.forEach(a => set.add(a));
      map.set(m.id, set);
    }
    this.gridMap.set(map);
    this.selectedModules.set([]);
    this.moduleFilter.setValue('');
  }

  // Guardar: mapea grid -> permiso_ids y llama asignarPermisos
  guardar(): void {
    const map = this.gridMap();
    Swal.fire({ title: 'Guardando…', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    this.saving.set(true);

    // indice: modulo_id -> accion_canon -> permiso_id
    const cat = this.allPerms();
    const idx = new Map<string, Map<ActionCanonical, string>>();
    for (const p of cat) {
      const canon = this.toCanonical(p.accion);
      if (!canon) continue;
      if (!idx.has(p.modulo_id)) idx.set(p.modulo_id, new Map());
      idx.get(p.modulo_id)!.set(canon, p.id);
    }

    const wantedIds: string[] = [];
    map.forEach((actions, modulo_id) => {
      const byAction = idx.get(modulo_id);
      if (!byAction) return;
      actions.forEach(a => {
        const pid = byAction.get(a);
        if (pid) wantedIds.push(pid);
      });
    });

    this.rolesSvc.asignarPermisos(this.data.rol.id, wantedIds)
      .pipe(finalize(() => { this.saving.set(false); Swal.close(); }))
      .subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Permisos actualizados', timer: 1300, showConfirmButton: false });
          this.dialogRef.close({ ok: true });
        },
        error: (err: any) => {
          Swal.fire({ icon: 'error', title: 'No se pudieron actualizar', text: err?.error?.detail ?? 'Intenta nuevamente.' });
        }
      });
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
