import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { WorkspaceResponse } from '../../../core/services/workspace/workspace.service';
import { BoardColorOption } from '../../models/boards.models';

@Component({
  standalone: true,
  selector: 'app-board-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './board-modal.component.html',
  styleUrl: './board-modal.component.css'
})
export class BoardModalComponent {
  @Input() visible = false;
  @Input({ required: true }) form!: FormGroup;
  @Input() saving = false;
  @Input() error = '';
  @Input() workspaces: WorkspaceResponse[] = [];
  @Input() colorOptions: BoardColorOption[] = [];
  @Input() isEditing = false;
  @Input() workspaceName = '';

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();
  @Output() accentSelected = new EventEmitter<string>();

  requestClose(): void {
    if (!this.saving) {
      this.closed.emit();
    }
  }

  getControlLength(controlName: string): number {
    return this.form.get(controlName)?.value?.length ?? 0;
  }
}

