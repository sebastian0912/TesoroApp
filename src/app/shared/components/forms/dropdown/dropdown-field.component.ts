import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicField, FieldMode, FieldOption, FieldValue, validateFieldValue } from '../field.model';

/** Contador módulo-nivel para ids únicos por instancia. */
let nextUid = 0;

/**
 * Campo DROPDOWN — lista desplegable nativa. Sigue el contrato uniforme de campos
 * (ver text-short-field.component.ts). REGLA DE ORO: el valor guardado/emitido
 * es el LABEL de la opción (string), nunca el value interno.
 */
@Component({
  selector: 'app-dropdown-field',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="df-field" [class.df-field--error]="showErrors && error">
      <label class="df-field__label" [attr.for]="inputId">
        {{ field.label }}
        @if (field.required) { <span class="df-field__req" aria-hidden="true">*</span> }
      </label>
      @if (field.schema.description) {
        <p class="df-field__desc">{{ field.schema.description }}</p>
      }

      @switch (mode) {
        @case ('readonly') {
          <p class="df-field__value">{{ asText || '—' }}</p>
        }
        @case ('config') {
          <select class="df-field__select" disabled>
            <option>{{ field.schema.placeholder || 'Selecciona…' }}</option>
          </select>
        }
        @default {
          <select class="df-field__select"
                  [id]="inputId"
                  [attr.aria-required]="field.required"
                  [attr.aria-invalid]="showErrors && !!error"
                  (change)="onSelect($event)">
            <option value="" [selected]="asText === ''">Selecciona…</option>
            @for (opt of options; track $index) {
              <option [value]="opt.label" [selected]="asText === opt.label">{{ opt.label }}</option>
            }
          </select>
        }
      }

      @if (showErrors && error && mode === 'preview') {
        <p class="df-field__error" role="alert">{{ error }}</p>
      }
    </div>
  `,
  styleUrls: ['../field-shared.css'],
})
export class DropdownFieldComponent {
  @Input({ required: true }) field!: DynamicField;
  @Input() mode: FieldMode = 'preview';
  @Input() value: FieldValue = null;
  @Input() showErrors = false;
  @Output() valueChange = new EventEmitter<FieldValue>();

  private readonly uid = nextUid++;

  get inputId(): string {
    return `df-dd-${this.field.name ?? this.field.label}-${this.uid}`;
  }

  get options(): FieldOption[] {
    return this.field.schema?.options ?? [];
  }

  get asText(): string {
    return typeof this.value === 'string' ? this.value : '';
  }

  get error(): string | null {
    return validateFieldValue(this.field, this.value);
  }

  onSelect(event: Event): void {
    // El value de cada <option> ya ES el label: se emite tal cual, sin re-mapear.
    const label = (event.target as HTMLSelectElement).value;
    this.value = label === '' ? null : label;
    this.valueChange.emit(this.value);
  }
}
