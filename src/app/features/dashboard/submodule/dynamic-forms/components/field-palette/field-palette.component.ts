import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { FieldTypeInfo } from '../../models/dynamic-forms.models';

/**
 * Paleta de tipos de campo del builder. Los tipos vienen del catálogo del backend
 * (FieldTypeService) — agregar un tipo nuevo NO exige tocar este componente.
 *
 * Cada tipo se puede AGREGAR de dos maneras:
 *  - clic → (add) y la página lo apendiza a la sección activa;
 *  - arrastre (cdkDrag) hacia cualquier lista de sección del canvas: la paleta
 *    participa del cdkDropListGroup de la página con id fijo 'palette' y la página
 *    detecta ese id en el drop para CREAR el campo (copiar, nunca mover).
 */
@Component({
  selector: 'app-field-palette',
  standalone: true,
  imports: [CommonModule, CdkDropList, CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fp-panel">
      <h2 class="fp-title">
        <span class="material-symbols-outlined" aria-hidden="true">widgets</span>
        Tipos de campo
      </h2>
      <p class="fp-hint">Haz clic para agregar a la sección activa o arrastra al lienzo.</p>

      @if (types.length === 0) {
        <p class="fp-empty">Cargando catálogo de tipos…</p>
      }

      <div class="fp-list"
           cdkDropList
           id="palette"
           [cdkDropListData]="types"
           [cdkDropListSortingDisabled]="true"
           [cdkDropListEnterPredicate]="negarEntrada">
        @for (t of types; track t.code) {
          <button type="button" class="fp-item"
                  cdkDrag [cdkDragData]="t"
                  (click)="add.emit(t)"
                  [title]="t.description || t.name"
                  [attr.aria-label]="'Agregar campo ' + t.name">
            <span class="material-symbols-outlined fp-item__icon" aria-hidden="true">{{ t.icon || 'category' }}</span>
            <span class="fp-item__name">{{ t.name }}</span>
            <span class="material-symbols-outlined fp-item__plus" aria-hidden="true">add</span>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .fp-panel {
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: var(--r-md, 14px);
      padding: 14px;
      box-shadow: var(--shadow-sm, 0 6px 14px rgba(17,24,39,.08));
    }
    .fp-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 4px;
      font-size: 1rem;
      font-weight: 700;
      color: var(--navy, #21263c);
    }
    .fp-title .material-symbols-outlined { font-size: 20px; }
    .fp-hint {
      margin: 0 0 12px;
      font-size: 0.78rem;
      color: var(--slate-500, #64748b);
    }
    .fp-empty {
      margin: 0;
      font-size: 0.85rem;
      color: var(--slate-500, #64748b);
    }
    .fp-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .fp-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--slate-200, #e8edf3);
      border-radius: var(--r-sm, 10px);
      background: var(--slate-50, #f8fafc);
      color: var(--navy-deep, #0f172a);
      font: inherit;
      font-size: 0.88rem;
      text-align: left;
      cursor: grab;
    }
    .fp-item:hover {
      border-color: var(--navy, #21263c);
      background: var(--surface, #fff);
    }
    .fp-item:hover .fp-item__plus { opacity: 1; }
    .fp-item:focus-visible {
      outline: 2px solid var(--lime, #8cd50a);
      outline-offset: 1px;
    }
    .fp-item:active { cursor: grabbing; }
    .fp-item__icon {
      font-size: 20px;
      color: var(--navy, #21263c);
    }
    .fp-item__name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .fp-item__plus {
      font-size: 18px;
      color: var(--slate-500, #64748b);
      opacity: 0;
      transition: opacity .12s ease;
    }
    /* Vista del item mientras se arrastra (clon flotante fuera del panel). */
    .fp-item.cdk-drag-preview {
      box-shadow: var(--shadow-md, 0 10px 26px rgba(17,24,39,.10));
      background: var(--surface, #fff);
    }
  `],
})
export class FieldPaletteComponent {
  /** Catálogo de tipos servido por el backend, ya ordenado por order_no. */
  @Input() types: FieldTypeInfo[] = [];
  /** Clic sobre un tipo: la página lo agrega al final de la sección activa. */
  @Output() add = new EventEmitter<FieldTypeInfo>();

  /** La paleta nunca acepta drops (solo es origen de copias). */
  negarEntrada = (): boolean => false;
}
