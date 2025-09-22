import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'password' | 'date';

export interface FieldOption {
  label: string;
  value: any;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string | null;
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string | RegExp;
  options?: FieldOption[];     // para 'select'
  disabled?: boolean;
  step?: number;               // para number
  prefix?: string;
  suffix?: string;
  hint?: string;
  inputMode?: 'text' | 'search' | 'numeric' | 'decimal';
  parse?: (raw: any) => any;   // transformación antes de cerrar
}

export interface DynamicDialogData {
  title: string;
  submitText?: string;
  cancelText?: string;
  fields: FieldConfig[];
  value?: Record<string, any>;
}

@Component({
  selector: 'app-dynamic-form-dialog',
  standalone: true,
  templateUrl: './dynamic-form-dialog.component.html',
  styleUrls: ['./dynamic-form-dialog.component.css'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    // Material
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule
  ]
})
export class DynamicFormDialogComponent {
  form!: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DynamicDialogData,
    private ref: MatDialogRef<DynamicFormDialogComponent, any>
  ) {
    this.buildForm();
  }

  private buildForm(): void {
    const group: Record<string, FormControl> = {};
    const initial = this.data.value ?? {};

    for (const f of this.data.fields) {
      const validators = [];
      if (f.required) validators.push(Validators.required);
      if (typeof f.min === 'number') validators.push(Validators.min(f.min));
      if (typeof f.max === 'number') validators.push(Validators.max(f.max));
      if (typeof f.minLength === 'number') validators.push(Validators.minLength(f.minLength));
      if (typeof f.maxLength === 'number') validators.push(Validators.maxLength(f.maxLength));
      if (f.pattern) validators.push(Validators.pattern(f.pattern));

      group[f.name] = new FormControl(
        { value: initial[f.name] ?? this.defaultValueFor(f), disabled: !!f.disabled },
        { nonNullable: false, validators }
      );
    }
    this.form = new FormGroup(group);
  }

  private defaultValueFor(f: FieldConfig) {
    switch (f.type) {
      case 'checkbox': return false;
      default: return null;
    }
  }

  cancel(): void {
    this.ref.close(undefined);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = { ...this.form.getRawValue() };
    const out: Record<string, any> = {};

    // aplica parsers por campo y normaliza números decimales
    for (const f of this.data.fields) {
      let v = raw[f.name];
      if (f.parse) {
        v = f.parse(v);
      } else {
        // heurística para number: aceptamos coma o punto
        if (f.type === 'number' && typeof v === 'string') {
          const cleaned = v.trim().replace(',', '.');
          const n = cleaned === '' ? null : Number(cleaned);
          v = Number.isFinite(n) ? n : v;
        }
      }
      out[f.name] = v;
    }

    this.ref.close(out);
  }

  // helpers de mensajes
  showError(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
  errorMsg(name: string, f: FieldConfig): string {
    const c = this.form.get(name);
    if (!c || !c.errors) return '';
    if (c.errors['required']) return 'Este campo es obligatorio';
    if (c.errors['min']) return `El valor mínimo es ${f.min}`;
    if (c.errors['max']) return `El valor máximo es ${f.max}`;
    if (c.errors['minlength']) return `Mínimo ${f.minLength} caracteres`;
    if (c.errors['maxlength']) return `Máximo ${f.maxLength} caracteres`;
    if (c.errors['pattern']) return 'Formato inválido';
    return 'Valor inválido';
  }
}
