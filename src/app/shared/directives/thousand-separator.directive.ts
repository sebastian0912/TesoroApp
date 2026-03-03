import {
  Directive, ElementRef, HostListener, forwardRef, Inject, LOCALE_ID
} from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { formatNumber } from '@angular/common';

@Directive({
  selector: 'input[thousandSeparator]',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => ThousandSeparatorDirective),
    multi: true
  }]
})

export class ThousandSeparatorDirective implements ControlValueAccessor {
  private _value: number | null = null;
  private onChange: (value: number | null) => void = () => { };
  private onTouched: () => void = () => { };

  constructor(
    private el: ElementRef<HTMLInputElement>,
    @Inject(LOCALE_ID) private locale: string
  ) { }

  // Formatea enteros; para decimales cambia a '1.0-2'
  private format(val: number): string {
    return formatNumber(val, this.locale, '1.0-0');
  }
  private unformat(viewVal: string): number | null {
    // Deja solo dígitos (enteros). Para decimales adapta el regex.
    const digits = viewVal.replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
  }

  writeValue(value: number | null): void {
    this._value = (value === null || value === undefined || isNaN(+value)) ? null : Number(value);
    // Muestra formateado cuando no está en foco
    this.el.nativeElement.value = this._value !== null ? this.format(this._value) : '';
  }
  registerOnChange(fn: (value: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.el.nativeElement.disabled = isDisabled; }

  @HostListener('focus')
  onFocus() {
    // Al enfocar, muestra el número crudo (sin separadores)
    this.el.nativeElement.value = this._value !== null ? String(this._value) : '';
    // Coloca el cursor al final
    setTimeout(() => this.el.nativeElement.setSelectionRange(
      this.el.nativeElement.value.length,
      this.el.nativeElement.value.length
    ));
  }

  @HostListener('blur')
  onBlur() {
    // Al salir, vuelve a formatear visualmente
    this.onTouched();
    this.el.nativeElement.value = this._value !== null ? this.format(this._value) : '';
  }

  @HostListener('input', ['$event'])
  onInput(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    if (!inputElement) return;

    const viewVal = inputElement.value;
    // Mantén el valor del formulario como número, sin separadores
    const num = this.unformat(viewVal);
    this._value = num;
    this.onChange(num);
    // No formatees aquí para no saltar el cursor; se formatea en blur/writeValue
  }
}
