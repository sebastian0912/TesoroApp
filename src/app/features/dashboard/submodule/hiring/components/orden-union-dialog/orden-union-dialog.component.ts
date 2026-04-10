import {  Component, Inject, computed, signal , ChangeDetectionStrategy } from '@angular/core';

import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

type Item = { id: number; name: string };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-orden-union-dialog',
  imports: [
    MatDialogModule,
    DragDropModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatBadgeModule,
    MatTooltipModule
],
  templateUrl: './orden-union-dialog.component.html',
  styleUrl: './orden-union-dialog.component.css'
} )
export class OrdenUnionDialogComponent {
  /** Orden editable en la vista */
  readonly items = signal<Item[]>([]);
  /** Copia para "Restablecer" */
  private readonly initialOrder: Item[] = [];

  /** Selección (IDs incluidos) */
  readonly selected = signal<Set<number>>(new Set<number>());

  /** Contador seleccionado */
  readonly selectedCount = computed(() => this.selected().size);

  constructor(
    public dialogRef: MatDialogRef<OrdenUnionDialogComponent, number[]>,
    @Inject(MAT_DIALOG_DATA) public data: { antecedentes: Item[] }
  ) {
    const source = (data?.antecedentes ?? []).map(a => ({ ...a }));
    this.items.set(source);
    this.initialOrder = source.map(a => ({ ...a }));
    // Por defecto: todo seleccionado
    this.selected.set(new Set<number>(source.map(a => a.id)));
  }

  drop(ev: CdkDragDrop<Item[]>) {
    const arr = [...this.items()];
    moveItemInArray(arr, ev.previousIndex, ev.currentIndex);
    this.items.set(arr);
  }

  toggleSelection(id: number, event: MatCheckboxChange) {
    const s = new Set(this.selected());
    event.checked ? s.add(id) : s.delete(id);
    this.selected.set(s);
  }

  /** Número de orden 1..n basado en el ORDEN DE SELECCIÓN */
  badgeNumber(id: number): string {
    const s = this.selected();
    if (!s.has(id)) return '';
    // Convertir Set a Array para obtener índice (orden de inserción)
    const index = [...s].indexOf(id);
    return String(index + 1);
  }

  selectAll() {
    this.selected.set(new Set(this.items().map(i => i.id)));
  }

  clearAll() {
    this.selected.set(new Set());
  }

  /** Orden predeterminado de paquete de contratación */
  private readonly PRESET_ORDER: number[] = [
    34, 29, 6, 3, 4, 5, 103, 32, 107,
    25, 104, 30, 27, 7, 11,
    15, 16, 17, 86,
  ];

  aplicarOrdenPredeterminado() {
    const allItems = this.items();
    const idMap = new Map(allItems.map(i => [i.id, i]));

    // Primero los del preset que existan, luego el resto en su orden actual
    const ordered: Item[] = [];
    const selectedIds = new Set<number>();

    for (const id of this.PRESET_ORDER) {
      const item = idMap.get(id);
      if (item) {
        ordered.push(item);
        selectedIds.add(id);
        idMap.delete(id);
      }
    }
    // Agregar los restantes al final (no seleccionados)
    for (const item of allItems) {
      if (idMap.has(item.id)) {
        ordered.push(item);
      }
    }

    this.items.set(ordered);
    this.selected.set(selectedIds);
  }

  resetOrder() {
    this.items.set(this.initialOrder.map(a => ({ ...a })));
    // Opcional: ¿Resetear selección también? 
    // Por UX, "Restablecer" suele referirse a todo (orden + selección original) o solo orden.
    // Asumiremos que el usuario quiere volver al estado iniciar puro (todo seleccionado en orden original).
    this.selected.set(new Set<number>(this.initialOrder.map(a => a.id)));
  }

  cancelar() {
    this.dialogRef.close();
  }

  confirmar() {
    // Devolvemos los IDs en el orden en que fueron SELECCIONADOS
    const s = this.selected();
    this.dialogRef.close([...s]);
  }
}
