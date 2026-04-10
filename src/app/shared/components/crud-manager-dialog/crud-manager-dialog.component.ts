import {  Component, Inject, signal, computed , ChangeDetectionStrategy } from '@angular/core';

import {
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

// ── Re-export field types ──────────────────────────────────
export type FieldType =
    | 'text'
    | 'number'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'password'
    | 'date';

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
    options?: FieldOption[];
    multiple?: boolean;
    disabled?: boolean;
    step?: number;
    prefix?: string;
    suffix?: string;
    hint?: string;
    inputMode?: 'text' | 'search' | 'numeric' | 'decimal';
    parse?: (raw: any) => any;
    /** Nombre del grupo visual al que pertenece este campo */
    group?: string;
}

// ── Field group (sección visual) ───────────────────────────
export interface FieldGroup {
    key: string;
    label: string;
    icon?: string;
    fields: FieldConfig[];
}

// ── Dialog data ────────────────────────────────────────────
export interface CrudDialogData {
    title: string;
    subtitle?: string;
    mode?: 'create' | 'edit' | 'view';
    icon?: string;
    submitText?: string;
    cancelText?: string;
    fields: FieldConfig[];
    value?: Record<string, any>;
}

// ── Resolved group for template ────────────────────────────
interface ResolvedGroup {
    key: string;
    label: string;
    icon?: string;
    fields: FieldConfig[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-crud-manager-dialog',
    standalone: true,
    templateUrl: './crud-manager-dialog.component.html',
    styleUrl: './crud-manager-dialog.component.css',
    imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule
],
} )
export class CrudManagerDialogComponent {
    form!: FormGroup;
    showPwd: Record<string, boolean> = {};
    saving = signal(false);

    /** Resolved field groups for the template */
    resolvedGroups: ResolvedGroup[] = [];

    /** Mode helpers */
    get mode(): 'create' | 'edit' | 'view' {
        return this.data.mode ?? 'create';
    }
    get modeIcon(): string {
        if (this.data.icon) return this.data.icon;
        switch (this.mode) {
            case 'create':
                return 'add_circle';
            case 'edit':
                return 'edit_note';
            case 'view':
                return 'visibility';
        }
    }
    get modeColor(): string {
        switch (this.mode) {
            case 'create':
                return '#22c55e';
            case 'edit':
                return '#3b82f6';
            case 'view':
                return '#8b5cf6';
        }
    }

    /** Progress tracking */
    totalFields = signal(0);
    filledFields = signal(0);
    progressPercent = computed(() => {
        const t = this.totalFields();
        return t > 0 ? Math.round((this.filledFields() / t) * 100) : 0;
    });

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: CrudDialogData,
        private ref: MatDialogRef<CrudManagerDialogComponent, any>
    ) {
        this.buildForm();
        this.resolveGroups();
    }

    // ── Build form ──────────────────────────────────────────
    private buildForm(): void {
        const group: Record<string, FormControl> = {};
        const initial = this.data.value ?? {};

        for (const f of this.data.fields) {
            const validators = [];
            if (f.required) validators.push(Validators.required);
            if (typeof f.min === 'number') validators.push(Validators.min(f.min));
            if (typeof f.max === 'number') validators.push(Validators.max(f.max));
            if (typeof f.minLength === 'number')
                validators.push(Validators.minLength(f.minLength));
            if (typeof f.maxLength === 'number')
                validators.push(Validators.maxLength(f.maxLength));
            if (f.pattern) validators.push(Validators.pattern(f.pattern as any));

            let initialValue = initial[f.name] ?? this.defaultValueFor(f);

            if (f.type === 'date' && typeof initialValue === 'string') {
                const d = new Date(initialValue);
                initialValue = isNaN(d.getTime()) ? null : d;
            }

            const isDisabled = !!f.disabled || this.mode === 'view';

            group[f.name] = new FormControl(
                { value: initialValue, disabled: isDisabled },
                { nonNullable: false, validators }
            );

            if (f.type === 'password') {
                this.showPwd[f.name] = false;
            }
        }
        this.form = new FormGroup(group);

        // track progress
        this.totalFields.set(this.data.fields.filter((f) => f.required).length);
        this.updateFilledCount();

        this.form.valueChanges.subscribe(() => this.updateFilledCount());
    }

    private defaultValueFor(f: FieldConfig) {
        switch (f.type) {
            case 'checkbox':
                return false;
            case 'select':
                return f.multiple ? [] : null;
            default:
                return null;
        }
    }

    private updateFilledCount(): void {
        let filled = 0;
        for (const f of this.data.fields) {
            if (!f.required) continue;
            const c = this.form.get(f.name);
            if (!c) continue;
            const v = c.value;
            if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
                filled++;
            }
        }
        this.filledFields.set(filled);
    }

    // ── Resolve groups ──────────────────────────────────────
    private resolveGroups(): void {
        const grouped = new Map<string, FieldConfig[]>();
        const labels = new Map<string, string>();

        for (const f of this.data.fields) {
            const key = f.group ?? '__default__';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(f);
            if (!labels.has(key)) labels.set(key, f.group ?? '');
        }

        this.resolvedGroups = [];
        for (const [key, fields] of grouped) {
            this.resolvedGroups.push({
                key,
                label: labels.get(key) ?? '',
                fields,
            });
        }
    }

    // ── Actions ─────────────────────────────────────────────
    cancel(): void {
        this.ref.close(undefined);
    }

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.saving.set(true);

        const raw = { ...this.form.getRawValue() };
        const out: Record<string, any> = {};

        for (const f of this.data.fields) {
            let v = raw[f.name];

            if (f.parse) {
                v = f.parse(v);
            } else {
                if (f.type === 'number') {
                    if (typeof v === 'string') {
                        const cleaned = v.trim().replace(',', '.');
                        const n = cleaned === '' ? null : Number(cleaned);
                        v = Number.isFinite(n as number) ? n : v;
                    }
                }
                if (f.type === 'date' && v instanceof Date) {
                    v = isNaN(v.getTime()) ? null : v.toISOString();
                }
            }

            out[f.name] = v;
        }

        this.ref.close(out);
    }

    // ── Helpers ─────────────────────────────────────────────
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

    togglePwd(name: string): void {
        this.showPwd[name] = !this.showPwd[name];
    }

    /** Determines if a field should span full width (textarea, checkbox) */
    isFullWidth(f: FieldConfig): boolean {
        return f.type === 'textarea';
    }
}
