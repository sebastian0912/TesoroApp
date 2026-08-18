import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicField, FieldMode, FieldOption, FieldValue, validateFieldValue } from '../field.model';

/** Contador módulo-nivel para ids únicos por instancia. */
let nextUid = 0;

/**
 * Campo MULTIPLE_CHOICE — grupo de checkboxes. Sigue el contrato uniforme de campos
 * (ver text-short-field.component.ts). REGLA DE ORO: el valor guardado/emitido es
 * string[] de LABELS de las opciones, nunca los values internos. Si ya se alcanzó
 * max_selected, los checkboxes NO marcados se deshabilitan.
 */
@Component({
  selector: 'app-multiple-choice-field',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="df-field" [class.df-field--error]="showErrors && error">
      <span class="df-field__label" [id]="labelId">
        {{ field.label }}
        @if (field.required) { <span class="df-field__req" aria-hidden="true">*</span> }
      </span>
      @if (field.schema.description) {
        <p class="df-field__desc">{{ field.schema.description }}</p>
      }

      @switch (mode) {
        @case ('readonly') {
          <p class="df-field__value">{{ asLabels.length ? asLabels.join(', ') : '—' }}</p>
        }
        @case ('config') {
          <div class="df-field__options">
            @for (opt of options; track $index) {
              <label class="df-field__option">
                <input type="checkbox" disabled />
                {{ opt.label }}
              </label>
            } @empty {
              <p class="df-field__desc">Sin opciones configuradas</p>
            }
          </div>
        }
        @default {
          <div class="df-field__options" role="group"
               [attr.aria-labelledby]="labelId"
               [attr.aria-required]="field.required"
               [attr.aria-invalid]="showErrors && !!error">
            @for (opt of options; track $index) {
              <label class="df-field__option" [attr.for]="optionId($index)">
                <input type="checkbox"
                       [id]="optionId($index)"
                       [checked]="isChecked(opt.label)"
                       [disabled]="maxReached && !isChecked(opt.label)"
                       (change)="onToggle(opt, $event)" />
                {{ opt.label }}
              </label>
            } @empty {
              <p class="df-field__desc">Sin opciones configuradas</p>
            }
          </div>
          @if (maxSelected != null) {
            <p class="df-field__desc">Máximo {{ maxSelected }} opciones</p>
          }
        }
      }

      @if (showErrors && error && mode === 'preview') {
        <p class="df-field__error" role="alert">{{ error }}</p>
      }
    </div>
  `,
  styleUrls: ['../field-shared.css'],
})
export class MultipleChoiceFieldComponent {
  @Input({ required: true }) field!: DynamicField;
  @Input() mode: FieldMode = 'preview';
  @Input() value: FieldValue = null;
  @Input() showErrors = false;
  @Output() valueChange = new EventEmitter<FieldValue>();

  private readonly uid = nextUid++;

  get options(): FieldOption[] {
    return this.field.schema?.options ?? [];
  }

  get labelId(): string {
    return `df-mc-${this.field.name ?? this.field.label}-${this.uid}-label`;
  }

  optionId(index: number): string {
    return `df-mc-${this.field.name ?? this.field.label}-${this.uid}-opt-${index}`;
  }

  /** Valor normalizado: solo strings (labels) del array actual. */
  get asLabels(): string[] {
    return Array.isArray(this.value)
      ? (this.value as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];
  }

  get maxSelected(): number | null {
    return this.field.schema?.validation?.max_selected ?? null;
  }

  get maxReached(): boolean {
    return this.maxSelected != null && this.asLabels.length >= this.maxSelected;
  }

  get error(): string | null {
    return validateFieldValue(this.field, this.value);
  }

  isChecked(label: string): boolean {
    return this.asLabels.includes(label);
  }

  onToggle(opt: FieldOption, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    // El array guarda LABELS en el orden de las opciones, sin re-mapear values internos.
    const next = checked
      ? this.options.map(o => o.label).filter(l => l === opt.label || this.asLabels.includes(l))
      : this.asLabels.filter(l => l !== opt.label);
    this.value = next.length ? next : null;
    this.valueChange.emit(this.value);
  }
}
