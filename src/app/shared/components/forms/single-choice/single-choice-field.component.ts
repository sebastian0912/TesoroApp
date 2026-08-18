import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicField, FieldMode, FieldOption, FieldValue, validateFieldValue } from '../field.model';

/** Contador módulo-nivel para que el name del grupo de radios sea único por instancia. */
let nextUid = 0;

/**
 * Campo SINGLE_CHOICE — grupo de radios. Sigue el contrato uniforme de campos
 * (ver text-short-field.component.ts). REGLA DE ORO: el valor guardado/emitido
 * es el LABEL de la opción (string), nunca el value interno.
 */
@Component({
  selector: 'app-single-choice-field',
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
          <p class="df-field__value">{{ asText || '—' }}</p>
        }
        @case ('config') {
          <div class="df-field__options">
            @for (opt of options; track $index) {
              <label class="df-field__option">
                <input type="radio" disabled [name]="groupName" />
                {{ opt.label }}
              </label>
            } @empty {
              <p class="df-field__desc">Sin opciones configuradas</p>
            }
          </div>
        }
        @default {
          <div class="df-field__options" role="radiogroup"
               [attr.aria-labelledby]="labelId"
               [attr.aria-required]="field.required"
               [attr.aria-invalid]="showErrors && !!error">
            @for (opt of options; track $index) {
              <label class="df-field__option" [attr.for]="optionId($index)">
                <input type="radio"
                       [id]="optionId($index)"
                       [name]="groupName"
                       [checked]="asText === opt.label"
                       (change)="onSelect(opt)" />
                {{ opt.label }}
              </label>
            } @empty {
              <p class="df-field__desc">Sin opciones configuradas</p>
            }
          </div>
        }
      }

      @if (showErrors && error && mode === 'preview') {
        <p class="df-field__error" role="alert">{{ error }}</p>
      }
    </div>
  `,
  styleUrls: ['../field-shared.css'],
})
export class SingleChoiceFieldComponent {
  @Input({ required: true }) field!: DynamicField;
  @Input() mode: FieldMode = 'preview';
  @Input() value: FieldValue = null;
  @Input() showErrors = false;
  @Output() valueChange = new EventEmitter<FieldValue>();

  /** Sufijo único por instancia: evita colisión de names si el mismo campo se pinta dos veces. */
  private readonly uid = nextUid++;

  get options(): FieldOption[] {
    return this.field.schema?.options ?? [];
  }

  get groupName(): string {
    return `df-sc-${this.field.name ?? this.field.label}-${this.uid}`;
  }

  get labelId(): string {
    return `${this.groupName}-label`;
  }

  optionId(index: number): string {
    return `${this.groupName}-opt-${index}`;
  }

  get asText(): string {
    return typeof this.value === 'string' ? this.value : '';
  }

  get error(): string | null {
    return validateFieldValue(this.field, this.value);
  }

  onSelect(opt: FieldOption): void {
    // Se emite el LABEL de la opción: el detalle pinta el valor tal cual, sin re-mapear.
    this.value = opt.label;
    this.valueChange.emit(this.value);
  }
}
