import { Component, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
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
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSortModule } from '@angular/material/sort';

import { Subscription } from 'rxjs';

import {
  PreviewDialogData,
  PreviewDialogResult,
  PreviewIssue,
  PreviewSchema,
  PreviewField,
  PreviewOption,
} from './../../model/validation-preview';

@Component({
  selector: 'app-validation-preview-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,

    MatDialogModule,
    MatTableModule,
    MatSortModule,
    MatDividerModule,

    MatIconModule,
    MatButtonModule,

    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,

    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './validation-preview-dialog.component.html',
  styleUrl: './validation-preview-dialog.component.css',
})
export class ValidationPreviewDialogComponent<TItem = any, TResult = any>
  implements OnDestroy {
  // base
  schema: PreviewSchema<TItem, TResult>;
  items: TItem[];

  // UI state
  selected: TItem | null = null;
  selectedId = '';

  form!: FormGroup;
  issues: PreviewIssue[] = [];

  // filtro (sin ngModel)
  readonly filterCtrl = new FormControl<string>('', { nonNullable: true });
  showErrorsOnly = false;

  private removedIds = new Set<string>();

  // 2 fases
  phase: 'pre' | 'post' = 'pre';
  externalIssues: PreviewIssue[] = [];
  private resolvedExternalIssueIds = new Set<string>();

  // summary (para no usar arrow functions en template)
  totalErrors = 0;
  totalWarns = 0;

  // header texts (sin casts en template)
  titleText = 'Previsualización de validación';
  subtitleText = 'Corrige los datos aquí antes de continuar.';

  private formSub?: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly ref: MatDialogRef<
      ValidationPreviewDialogComponent<TItem, TResult>,
      PreviewDialogResult<TResult>
    >,
    @Inject(MAT_DIALOG_DATA) data: PreviewDialogData<TItem, TResult>,
  ) {
    this.schema = data.schema;
    this.items = [...(data.items ?? [])];

    this.phase = data.phase ?? 'pre';
    this.externalIssues = [...(data.externalIssues ?? [])];

    // prioridad: overrides del diálogo > schema > defaults
    this.titleText = data.title ?? this.schema.title ?? this.titleText;
    this.subtitleText = data.subtitle ?? this.schema.subtitle ?? this.subtitleText;

    this.uploadHandler = data.uploadHandler;

    this.recomputeIssues();

    this.recomputeIssues();

    // Prioridad: Seleccionar el primer registro con errores o issues externos
    const firstInvalid = this.items.find(it => {
      const id = this.schema.itemId(it);
      return this.issues.some(iss => iss.itemId === id && (iss.severity === 'error' || iss.severity === 'warn'));
    });

    const first = firstInvalid ?? this.filteredItems()[0] ?? null;
    if (first) this.select(first);
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  get globalIssues(): PreviewIssue[] {
    return this.issues.filter((x) => x.itemId === 'GLOBAL' || x.itemId === 'general');
  }

  // ----------------------------
  // Table helpers
  // ----------------------------

  displayedColumns(): string[] {
    return ['__status', ...this.schema.columns.map((c) => c.key), '__actions'];
  }

  filteredItems(): TItem[] {
    const q = (this.filterCtrl.value ?? '').trim().toLowerCase();

    // Base filter: not removed
    let items = this.items.filter((it) => !this.removedIds.has(this.schema.itemId(it)));

    // Error filter
    if (this.showErrorsOnly) {
      items = items.filter(it => this.issueCount(it) > 0 || this.warnCount(it) > 0);
    }

    // Text filter
    if (!q) return items;

    return items.filter((it) => {
      const row = this.schema.columns
        .map((c) => String(c.cell(it) ?? '').toLowerCase())
        .join(' | ');
      return row.includes(q);
    });
  }

  clearFilter(): void {
    this.filterCtrl.setValue('');
  }

  get filteredCount(): number {
    return this.filteredItems().length;
  }

  get externalCount(): number {
    return this.externalIssues.length;
  }

  issueCount(item: TItem): number {
    const id = this.schema.itemId(item);
    return this.issues.filter((x) => x.itemId === id && x.severity === 'error').length;
  }

  warnCount(item: TItem): number {
    const id = this.schema.itemId(item);
    return this.issues.filter((x) => x.itemId === id && x.severity === 'warn').length;
  }

  anyBlockingErrors(): boolean {
    return this.totalErrors > 0;
  }

  severityIcon(sev: string): string {
    if (sev === 'error') return 'error';
    if (sev === 'warn') return 'warning';
    return 'info';
  }

  // ----------------------------
  // Selection + form
  // ----------------------------

  select(item: TItem): void {
    this.selected = item;
    this.selectedId = this.schema.itemId(item);
    this.buildForm(item);
  }

  private buildForm(item: TItem): void {
    // evitar subs acumuladas
    this.formSub?.unsubscribe();

    const group: Record<string, FormControl> = {};

    for (const f of this.schema.editFields) {
      const visible = f.visible ? f.visible(item) : true;
      if (!visible) continue;

      const raw = (item as any)[f.key];

      const validatorsArr = [];
      if (f.required) validatorsArr.push(Validators.required);

      const ctrl = new FormControl(raw, validatorsArr);

      // disabled dinámico (si aplica)
      const disabled = f.disabled ? f.disabled(item) : false;
      if (disabled) ctrl.disable({ emitEvent: false });

      group[f.key] = ctrl;
    }

    this.form = this.fb.group(group);

    // Live update in-memory + recalcular issues
    this.formSub = this.form.valueChanges.subscribe(() => {
      if (!this.selected) return;

      for (const f of this.schema.editFields) {
        const visible = f.visible ? f.visible(this.selected) : true;
        if (!visible) continue;

        const ctrl = this.form.get(f.key);
        if (!ctrl) continue;

        const v = ctrl.value;
        const nv = f.normalize ? f.normalize(v, this.selected) : v;

        (this.selected as any)[f.key] = nv;
        if (f.onChange) f.onChange(this.selected);

        // si llegó del backend y tocaste el campo, lo marcamos como resuelto
        this.resolveExternalIssuesForField(this.selectedId, f.key);
      }

      this.recomputeIssues();
    });
  }

  showAllFields = false;

  fieldError(fieldKey: string): string | null {
    if (!this.selected) return null;

    const itemId = this.schema.itemId(this.selected);
    const issue = this.issues.find(
      (x) => x.itemId === itemId && x.field === fieldKey && x.severity === 'error',
    );

    return issue ? issue.message : null;
  }

  shouldShowField(f: PreviewField<any>): boolean {
    if (this.showAllFields) return true;

    // Si hay error en el campo, mostrarlo
    if (this.fieldError(f.key)) return true;

    // Si el item NO tiene ningún error, mostramos todo (para revisión)
    // O si preferimos, solo mostramos si hay error.
    // El usuario dijo: "solo los campos que tengo que corregir".
    // Pero si corregimos uno, y queda valido, desaparece? 
    // Vamos a permitir que si el item es valido (sin errores bloqueantes), mostremos todo.
    if (this.selected && !this.anyBlockingErrorsForSelected()) return true;

    return false;
  }

  anyBlockingErrorsForSelected(): boolean {
    if (!this.selected) return false;
    return this.issueCount(this.selected) > 0;
  }

  toggleShowAll(): void {
    this.showAllFields = !this.showAllFields;
  }

  applyEdits(): void {
    if (!this.selected || !this.form) return;

    for (const f of this.schema.editFields) {
      const visible = f.visible ? f.visible(this.selected) : true;
      if (!visible) continue;

      const ctrl = this.form.get(f.key);
      if (!ctrl) continue;

      const v = ctrl.value;
      const nv = f.normalize ? f.normalize(v, this.selected) : v;

      (this.selected as any)[f.key] = nv;
      if (f.onChange) f.onChange(this.selected);

      this.resolveExternalIssuesForField(this.selectedId, f.key);
    }

    this.recomputeIssues();
  }

  removeSelected(): void {
    if (!this.schema.allowRemove || !this.selected) return;

    const id = this.schema.itemId(this.selected);
    this.removedIds.add(id);

    const next = this.filteredItems()[0] ?? null;

    this.selected = null;
    this.selectedId = '';

    if (next) this.select(next);

    this.recomputeIssues();
  }

  // ----------------------------
  // Issues helpers (para template sin arrow fn)
  // ----------------------------

  selectedIssues(): PreviewIssue[] {
    if (!this.selectedId) return [];
    return this.issues.filter((i) => i.itemId === this.selectedId);
  }

  hasSelectedIssues(): boolean {
    return this.selectedIssues().length > 0;
  }

  // form helpers (template limpio)
  fieldLabel(f: PreviewField<any>): string {
    return f.label || f.key;
  }

  fieldPlaceholder(f: PreviewField<any>): string {
    return f.placeholder ?? '';
  }

  fieldHint(f: PreviewField<any>): string {
    return f.hint ?? '';
  }

  isSelectField(f: PreviewField<any>): boolean {
    return f.type === 'select';
  }

  inputTypeFor(f: PreviewField<any>): string {
    return f.type === 'number' ? 'number' : 'text';
  }

  optionsFor(f: PreviewField<any>): PreviewOption<any>[] {
    return (f.options ?? []) as PreviewOption<any>[];
  }

  // ----------------------------
  // External issues resolution (POST)
  // ----------------------------

  private resolveExternalIssuesForField(itemId: string, fieldKey: string): void {
    for (const iss of this.externalIssues) {
      if (iss.itemId === itemId && iss.field === fieldKey) {
        this.resolvedExternalIssueIds.add(iss.id);
      }
    }
  }

  // ----------------------------
  // Issues aggregation
  // ----------------------------

  private recomputeIssues(): void {
    const activeItems = this.items.filter((it) => !this.removedIds.has(this.schema.itemId(it)));

    // issues por item (schema.validateItem)
    const base = activeItems.flatMap((it) => this.schema.validateItem(it));

    // issues por field.validate
    const fieldIssues: PreviewIssue[] = [];
    for (const it of activeItems) {
      const itemId = this.schema.itemId(it);

      for (const f of this.schema.editFields) {
        const visible = f.visible ? f.visible(it) : true;
        if (!visible) continue;

        if (!f.validate) continue;

        const v = (it as any)[f.key];
        const msg = f.validate(v, it);
        if (!msg) continue;

        fieldIssues.push({
          id: `field:${itemId}:${f.key}`,
          itemId,
          severity: 'error',
          field: f.key,
          message: msg,
        });
      }
    }

    // issues cruzados
    const cross = this.schema.validateAll ? this.schema.validateAll(activeItems) : [];

    // issues externos (backend) filtrados por resueltos
    const external = this.externalIssues.filter((x) => !this.resolvedExternalIssueIds.has(x.id));

    this.issues = [...base, ...fieldIssues, ...cross, ...external];

    // summary para template
    this.totalErrors = this.issues.filter((i) => i.severity === 'error').length;
    this.totalWarns = this.issues.filter((i) => i.severity === 'warn').length;
  }

  // ----------------------------
  // Dialog actions
  // ----------------------------

  cancel(): void {
    if (this.schema.allowCancel === false) return;
    this.ref.close({ accepted: false });
  }

  accept(): void {
    this.applyEdits();
    if (this.anyBlockingErrors()) return;

    const finalItems = this.items.filter((it) => !this.removedIds.has(this.schema.itemId(it)));
    const result = this.schema.buildResult(finalItems);

    this.ref.close({
      accepted: true,
      result,
      items: finalItems,
    });
  }

  // ----------------------------
  // Resolution Actions (Upload, etc.)
  // ----------------------------

  private uploadHandler?: (file: File, itemId: string) => Promise<void> | void;
  private pendingUploadIssue: PreviewIssue | null = null;

  triggerUpload(issue: PreviewIssue, inputRef: HTMLInputElement): void {
    if (!this.uploadHandler) return;
    this.pendingUploadIssue = issue;
    inputRef.value = ''; // reset
    inputRef.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.pendingUploadIssue) return;

    const file = input.files[0];
    const itemId = this.pendingUploadIssue.itemId;

    try {
      if (this.uploadHandler) {
        await this.uploadHandler(file, itemId);
      }
      // Re-run validations
      this.recomputeIssues();
    } catch (err) {
      console.error('Error uploading file from preview:', err);
    } finally {
      this.pendingUploadIssue = null;
    }
  }
}