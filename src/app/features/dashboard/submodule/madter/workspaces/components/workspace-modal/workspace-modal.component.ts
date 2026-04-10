import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  standalone: true,
  selector: 'app-workspace-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './workspace-modal.component.html',
  styleUrl: './workspace-modal.component.css'
})
export class WorkspaceModalComponent {
  @Input() visible = false;
  @Input({ required: true }) form!: FormGroup;
  @Input() saving = false;
  @Input() error = '';

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  requestClose(): void {
    if (!this.saving) {
      this.closed.emit();
    }
  }

  getControlLength(controlName: string): number {
    return this.form.get(controlName)?.value?.length ?? 0;
  }
}

