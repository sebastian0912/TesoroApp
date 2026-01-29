import { Component, Inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';

type Item = { id: number; name: string };

@Component({
  selector: 'app-orden-union-dialog',
  imports: [
    CommonModule,
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
})
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
