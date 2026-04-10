import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { UserGroup } from '../../../core/services/user-group/user-group.service';
import { UserLookupResponse } from '../../../core/services/user/user.service';
import { BoardLabelChoice, CardPriorityOption, CardStatusOption, WorkLabelSuggestion } from '../../models/boards.models';

@Component({
  standalone: true,
  selector: 'app-card-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatNativeDateModule,
    MatSelectModule
  ],
  templateUrl: './card-modal.component.html',
  styleUrl: './card-modal.component.css'
})
export class CardModalComponent implements OnChanges {
  readonly timeOptions = this.buildTimeOptions();
  readonly labelControl = new FormControl('', { nonNullable: true });
  private readonly fallbackLabelPalette = ['#38bdf8', '#14b8a6', '#f59e0b', '#fb7185', '#8b5cf6', '#22c55e'];

  @Input() visible = false;
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) assigneeControl!: FormControl<UserLookupResponse | string | null>;
  @Input() saving = false;
  @Input() error = '';
  @Input() listName = '';
  @Input() isEditing = false;
  @Input() priorityOptions: CardPriorityOption[] = [];
  @Input() statusOptions: CardStatusOption[] = [];
  @Input() assigneeOptions: UserLookupResponse[] = [];
  @Input() assigneeLoading = false;
  @Input() selectedAssignee: UserLookupResponse | null = null;
  @Input() userGroups: UserGroup[] = [];
  @Input() availableLabels: BoardLabelChoice[] = [];
  @Input() selectedLabels: BoardLabelChoice[] = [];
  @Input() suggestedLabels: WorkLabelSuggestion[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();
  @Output() assigneeSelected = new EventEmitter<UserLookupResponse>();
  @Output() assigneeCleared = new EventEmitter<void>();
  @Output() labelAdded = new EventEmitter<BoardLabelChoice>();
  @Output() labelRemoved = new EventEmitter<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue) {
      this.labelControl.setValue('', { emitEvent: false });
    }
  }

  requestClose(): void {
    if (!this.saving) {
      this.closed.emit();
    }
  }

  getControlLength(controlName: string): number {
    return this.form.get(controlName)?.value?.length ?? 0;
  }

  displayAssignee(value: UserLookupResponse | string | null): string {
    if (!value) {
      return '';
    }

    return typeof value === 'string' ? value : value.email;
  }

  handleAssigneeSelection(event: MatAutocompleteSelectedEvent): void {
    this.assigneeSelected.emit(event.option.value as UserLookupResponse);
  }

  get filteredLabelOptions(): BoardLabelChoice[] {
    const query = this.normalizedLabelName(this.labelControl.value);
    const availableChoices = this.mergeLabelChoices([
      ...this.availableLabels,
      ...this.suggestedLabels.map(label => ({
        id: null,
        name: label.name,
        color: label.color,
        source: 'suggested' as const
      }))
    ]);

    return availableChoices.filter(label => {
      if (this.isSelectedLabel(label.name)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return this.normalizedLabelName(label.name).includes(query);
    });
  }

  get canCreateCurrentLabel(): boolean {
    const query = this.normalizedLabelName(this.labelControl.value);
    return query.length >= 2 && !this.labelExistsAnywhere(query);
  }

  clearAssignee(): void {
    this.assigneeControl.setValue('');
    this.assigneeCleared.emit();
  }

  handleLabelOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const labelName = String(event.option.value ?? '').trim();
    const option = this.findLabelChoiceByName(labelName);
    if (!option) {
      this.addCurrentLabel();
      return;
    }

    this.labelAdded.emit(option);
    this.labelControl.setValue('', { emitEvent: false });
  }

  addCurrentLabel(): void {
    const rawValue = this.labelControl.value.trim();
    if (rawValue.length < 2) {
      return;
    }

    const existingOption = this.findLabelChoiceByName(rawValue);
    if (existingOption) {
      if (!this.isSelectedLabel(existingOption.name)) {
        this.labelAdded.emit(existingOption);
      }
      this.labelControl.setValue('', { emitEvent: false });
      return;
    }

    this.labelAdded.emit({
      id: null,
      name: this.formatLabelName(rawValue),
      color: this.resolveCustomLabelColor(rawValue),
      source: 'custom'
    });
    this.labelControl.setValue('', { emitEvent: false });
  }

  removeLabel(label: BoardLabelChoice): void {
    this.labelRemoved.emit(label.name);
  }

  toggleSuggestedLabel(suggestion: WorkLabelSuggestion): void {
    if (this.isSelectedLabel(suggestion.name)) {
      this.labelRemoved.emit(suggestion.name);
      return;
    }

    const existingChoice = this.findLabelChoiceByName(suggestion.name);
    this.labelAdded.emit(existingChoice ?? {
      id: null,
      name: suggestion.name,
      color: suggestion.color,
      source: 'suggested'
    });
  }

  isSelectedLabel(name: string): boolean {
    const normalized = this.normalizedLabelName(name);
    return this.selectedLabels.some(label => this.normalizedLabelName(label.name) === normalized);
  }

  clearDueDate(): void {
    this.form.get('dueDate')?.setValue(null);
  }

  onDateSelected(date: Date | null, menuTrigger: MatMenuTrigger): void {
    if (date) {
      this.form.get('dueDate')?.setValue(date);
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    requestAnimationFrame(() => {
      menuTrigger.closeMenu();
    });
  }

  private buildTimeOptions(): string[] {
    const options: string[] = [];

    for (let hour = 0; hour < 24; hour += 1) {
      for (const minute of [0, 30]) {
        const normalizedHour = String(hour).padStart(2, '0');
        const normalizedMinute = String(minute).padStart(2, '0');
        options.push(`${normalizedHour}:${normalizedMinute}`);
      }
    }

    return options;
  }

  private findLabelChoiceByName(name: string): BoardLabelChoice | null {
    const normalized = this.normalizedLabelName(name);
    return this.mergeLabelChoices([
      ...this.availableLabels,
      ...this.suggestedLabels.map(label => ({
        id: null,
        name: label.name,
        color: label.color,
        source: 'suggested' as const
      }))
    ]).find(label => this.normalizedLabelName(label.name) === normalized) ?? null;
  }

  private labelExistsAnywhere(normalizedName: string): boolean {
    return this.mergeLabelChoices([
      ...this.availableLabels,
      ...this.selectedLabels,
      ...this.suggestedLabels.map(label => ({
        id: null,
        name: label.name,
        color: label.color,
        source: 'suggested' as const
      }))
    ]).some(label => this.normalizedLabelName(label.name) === normalizedName);
  }

  private mergeLabelChoices(labels: BoardLabelChoice[]): BoardLabelChoice[] {
    const labelMap = new Map<string, BoardLabelChoice>();

    for (const label of labels) {
      const normalizedName = this.normalizedLabelName(label.name);
      if (!normalizedName) {
        continue;
      }

      if (!labelMap.has(normalizedName) || label.id !== null) {
        labelMap.set(normalizedName, {
          ...label,
          name: this.formatLabelName(label.name)
        });
      }
    }

    return [...labelMap.values()].sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  private resolveCustomLabelColor(name: string): string {
    const normalized = this.normalizedLabelName(name);
    const charSum = [...normalized].reduce((total, character) => total + character.charCodeAt(0), 0);
    return this.fallbackLabelPalette[charSum % this.fallbackLabelPalette.length];
  }

  private formatLabelName(name: string): string {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      return '';
    }

    return trimmed
      .split(' ')
      .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  private normalizedLabelName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
