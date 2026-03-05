import { Component, OnInit, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { SharedModule } from '@/app/shared/shared.module';
import { ModulosService, ModuloCreateDTO } from '../../services/modulos/modulos.service';
import { MatTree, MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChangeDetectorRef } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { ModuloDialogComponent } from './components/modulo-dialog/modulo-dialog.component';
import Swal from 'sweetalert2';

interface ModuloNode {
  id: string;
  nombre: string;
  descripcion?: string | null;
  ruta?: string | null;
  icono?: string | null;
  orden?: number;
  modulo_padre?: string | null;
  submodulos?: ModuloNode[];
}

@Component({
  selector: 'app-gestion-modulos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule, MatTreeModule, MatIconModule, MatButtonModule, MatProgressBarModule],
  templateUrl: './gestion-modulos.component.html',
  styleUrl: './gestion-modulos.component.css'
})
export class GestionModulosComponent implements OnInit {
  @ViewChild(MatTree, { static: true }) tree!: MatTree<ModuloNode>;

  dataSource: ModuloNode[] = [];
  loading = false;

  constructor(
    private modulosService: ModulosService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void { this.cargar(); }

  // ===== Árbol (Material con childrenAccessor) =====
  childrenAccessor = (node: ModuloNode) => node.submodulos ?? [];
  hasChild = (_: number, node: ModuloNode) => !!node.submodulos && node.submodulos.length > 0;

  // ===== Data fetch =====
  cargar(): void {
    this.loading = true;
    this.modulosService.tree().subscribe({
      next: (modulos: any) => {
        this.dataSource = Array.isArray(modulos) ? modulos : [];
        this.loading = false;

        // Expandir todo apenas llegan los datos
        this.expandAllSoon();
      },
      error: () => {
        this.loading = false;
        Swal.fire({ icon: 'error', title: 'Error', text: 'Error cargando módulos' });
      }
    });
  }

  /** Expande todo el árbol apenas se haya renderizado */
  private expandAllSoon(): void {
    // Espera a que Angular pinte el árbol con los nuevos datos
    queueMicrotask(() => {
      if (!this.tree) return;

      // Si existe la API nativa expandAll() en MatTree, úsala
      const anyTree = this.tree as any;
      if (typeof anyTree.expandAll === 'function') {
        anyTree.expandAll();
      } else {
        // Fallback: expandir recursivamente cada nodo con hijos
        this.expandNodesRec(this.dataSource);
      }

      this.cdr.markForCheck();
    });
  }

  private expandNodesRec(nodes: ModuloNode[]): void {
    const anyTree = this.tree as any;
    for (const n of nodes) {
      if (this.hasChild(0, n)) {
        if (typeof anyTree.expand === 'function') anyTree.expand(n);
        if (n.submodulos?.length) this.expandNodesRec(n.submodulos);
      }
    }
  }

  // ===== CRUD (Optimistic UI) =====
  async crear(parent?: ModuloNode): Promise<void> {
    const vals = await this.promptModulo('Nuevo módulo');
    if (!vals) return;

    const tmpId = `tmp-${Date.now()}`;
    const nuevo: ModuloNode = {
      id: tmpId,
      nombre: vals.nombre,
      descripcion: vals.descripcion || null,
      ruta: vals.ruta || null,
      icono: vals.icono || 'widgets',
      orden: vals.orden || 0,
      modulo_padre: parent?.id ?? null,
      submodulos: []
    };

    this.dataSource = this.withInsertedChild(this.dataSource, parent?.id ?? null, nuevo);
    this.flashNode(tmpId);

    const dto: ModuloCreateDTO = {
      nombre: vals.nombre,
      descripcion: vals.descripcion || null,
      ruta: vals.ruta || null,
      icono: vals.icono || 'widgets',
      orden: vals.orden || 0,
      modulo_padre: parent?.id ?? null
    };

    this.modulosService.create(dto).subscribe({
      next: (real) => {
        this.dataSource = this.withUpdatedNode(this.dataSource, tmpId, n => ({ ...n, id: real.id }));
        this.expandAllSoon();
        this.flashNode(real.id);
        Swal.fire({ icon: 'success', title: 'Creado', text: 'Módulo creado correctamente', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        this.dataSource = this.withDeletedNode(this.dataSource, tmpId);
        const msg = err?.error?.nombre?.[0] || err?.error?.detail || 'Error creando el módulo';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
      }
    });
  }

  async editar(node: ModuloNode): Promise<void> {
    const original: ModuloNode = { ...node };
    const vals = await this.promptModulo('Editar módulo', {
      nombre: node.nombre,
      descripcion: node.descripcion ?? '',
      ruta: node.ruta ?? '',
      icono: node.icono ?? 'widgets',
      orden: node.orden ?? 0
    });
    if (!vals) return;

    this.dataSource = this.withUpdatedNode(this.dataSource, node.id, n => ({
      ...n,
      nombre: vals.nombre,
      descripcion: vals.descripcion || null,
      ruta: vals.ruta || null,
      icono: vals.icono || 'widgets',
      orden: vals.orden || 0
    }));
    this.flashNode(node.id);

    const dto: ModuloCreateDTO = {
      nombre: vals.nombre,
      descripcion: vals.descripcion || null,
      ruta: vals.ruta || null,
      icono: vals.icono || 'widgets',
      orden: vals.orden || 0,
      modulo_padre: node.modulo_padre ?? null
    };

    this.modulosService.update(node.id, dto).subscribe({
      next: () => {
        this.expandAllSoon();
        this.flashNode(node.id);
        Swal.fire({ icon: 'success', title: 'Actualizado', text: 'Módulo actualizado', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        this.dataSource = this.withUpdatedNode(this.dataSource, node.id, _ => original);
        const msg = err?.error?.nombre?.[0] || err?.error?.detail || 'Error actualizando el módulo';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
      }
    });
  }

  eliminar(node: ModuloNode): void {
    const parentId = this.findParentId(this.dataSource, node.id);

    Swal.fire({
      icon: 'warning',
      title: 'Eliminar módulo',
      text: `¿Eliminar "${node.nombre}"? Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(res => {
      if (!res.isConfirmed) return;

      const snapshot = node;
      this.dataSource = this.withDeletedNode(this.dataSource, node.id);

      this.modulosService.remove(node.id).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Eliminado', text: 'Módulo eliminado', timer: 1500, showConfirmButton: false });
        },
        error: (err) => {
          this.dataSource = this.withInsertedChild(this.dataSource, parentId, snapshot);
          const msg = err?.error?.detail || 'No se pudo eliminar (revise dependencias)';
          Swal.fire({ icon: 'error', title: 'Error', text: msg });
        }
      });
    });
  }

  // ===== UI helpers =====
  private flashNode(id: string) {
    setTimeout(() => {
      const el = document.querySelector(`[data-node-id="${id}"]`) as HTMLElement | null;
      if (!el) return;
      el.classList.add('flash');
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setTimeout(() => el.classList.remove('flash'), 1200);
    }, 0);
  }

  // ===== Árbol helpers =====
  private withInsertedChild(nodes: ModuloNode[], parentId: string | null, child: ModuloNode): ModuloNode[] {
    if (parentId == null) return [...nodes, child];
    let changed = false;
    const out = nodes.map(n => {
      if (n.id === parentId) { changed = true; return { ...n, submodulos: [...(n.submodulos ?? []), child] }; }
      if (n.submodulos?.length) {
        const ns = this.withInsertedChild(n.submodulos, parentId, child);
        if (ns !== n.submodulos) { changed = true; return { ...n, submodulos: ns }; }
      }
      return n;
    });
    return changed ? out : nodes;
  }

  private withUpdatedNode(nodes: ModuloNode[], id: string, updater: (n: ModuloNode) => ModuloNode): ModuloNode[] {
    let changed = false;
    const walk = (arr: ModuloNode[]): ModuloNode[] =>
      arr.map(n => {
        if (n.id === id) { changed = true; return updater(n); }
        if (n.submodulos?.length) {
          const ns = walk(n.submodulos);
          if (ns !== n.submodulos) { changed = true; return { ...n, submodulos: ns }; }
        }
        return n;
      });
    const res = walk(nodes);
    return changed ? res : nodes;
  }

  private withDeletedNode(nodes: ModuloNode[], id: string): ModuloNode[] {
    let changed = false;
    const walk = (arr: ModuloNode[]): ModuloNode[] => {
      const next: ModuloNode[] = [];
      for (const n of arr) {
        if (n.id === id) { changed = true; continue; }
        if (n.submodulos?.length) {
          const ns = walk(n.submodulos);
          if (ns !== n.submodulos) { changed = true; next.push({ ...n, submodulos: ns }); continue; }
        }
        next.push(n);
      }
      return next;
    };
    const res = walk(nodes);
    return changed ? res : nodes;
  }

  private findParentId(nodes: ModuloNode[], id: string, parent: string | null = null): string | null {
    for (const n of nodes) {
      if (n.id === id) return parent;
      if (n.submodulos?.length) {
        const found = this.findParentId(n.submodulos, id, n.id);
        if (found !== null) return found;
      }
    }
    return null;
  }

  private async promptModulo(
    title: string,
    initial?: { nombre?: string; descripcion?: string; ruta?: string; icono?: string; orden?: number }
  ): Promise<{ nombre: string; descripcion: string; ruta?: string; icono?: string; orden?: number } | null> {
    const dialogRef = this.dialog.open(ModuloDialogComponent, {
      width: '450px',
      panelClass: 'sf-filters-dialog-panel',
      backdropClass: 'sf-filters-backdrop',
      disableClose: true,
      data: {
        title,
        nombre: initial?.nombre,
        descripcion: initial?.descripcion,
        ruta: initial?.ruta,
        icono: initial?.icono,
        orden: initial?.orden
      }
    });

    const result = await dialogRef.afterClosed().toPromise();
    return result || null;
  }
}
