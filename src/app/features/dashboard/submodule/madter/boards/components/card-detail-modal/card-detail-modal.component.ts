import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  CardCommentResponse,
  CardDetailResponse,
  ChecklistItemResponse,
  CardResponse,
  UploadAttachment
} from '../../../core/services/card/card.service';
import { LabelResponse } from '../../../core/services/label/label.service';
import { CARD_PRIORITY_OPTIONS, CARD_STATUS_OPTIONS } from '../../config/board.config';
import { UploadService } from '../../../core/services/upload/upload.service';
import { environment } from '@/environments/environment';

@Component({
  standalone: true,
  selector: 'app-card-detail-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './card-detail-modal.component.html',
  styleUrl: './card-detail-modal.component.css'
})
export class CardDetailModalComponent {
  private readonly priorityOptions = CARD_PRIORITY_OPTIONS;
  private readonly statusOptions = CARD_STATUS_OPTIONS;
  readonly uploadSvc = inject(UploadService);
  readonly apiUrl = environment.apiUrl;

  @Input() visible = false;
  @Input() loading = false;
  @Input() error = '';
  @Input() detail: CardDetailResponse | null = null;
  @Input() currentUserId: number | null = null;
  @Input({ required: true }) commentForm!: FormGroup;
  @Input({ required: true }) checklistForm!: FormGroup;
  @Input() commentSaving = false;
  @Input() checklistSaving = false;
  @Input() assignmentSaving = false;
  @Input() allBoardLabels: LabelResponse[] = [];
  @Input() labelsSaving = false;
  @Input() readOnly = false;
  @Input() pendingUploads: UploadAttachment[] = [];
  @Input() uploadingFile = false;

  @Output() closed = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<void>();
  @Output() assignRequested = new EventEmitter<void>();
  @Output() unassignRequested = new EventEmitter<void>();
  @Output() commentSubmitted = new EventEmitter<void>();
  @Output() commentDeleted = new EventEmitter<number>();
  @Output() checklistSubmitted = new EventEmitter<void>();
  @Output() checklistDeleted = new EventEmitter<number>();
  @Output() checklistToggled = new EventEmitter<{ itemId: number; completed: boolean; content: string }>();
  @Output() labelAssigned = new EventEmitter<number>();
  @Output() labelUnassigned = new EventEmitter<number>();
  @Output() fileSelected = new EventEmitter<File>();
  @Output() attachmentRemoved = new EventEmitter<string>(); // emits uuid

  requestClose(): void {
    if (!this.loading && !this.commentSaving && !this.checklistSaving && !this.assignmentSaving) {
      this.closed.emit();
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
      input.value = '';
    }
  }

  isAssignedToCurrentUser(): boolean {
    return !!this.detail?.assignee && this.detail.assignee.id === this.currentUserId;
  }

  checklistProgress(): string {
    const total = this.detail?.checklistItems.length ?? 0;
    const completed = this.detail?.checklistItems.filter(item => item.completed).length ?? 0;
    return `${completed}/${total}`;
  }

  checklistCompletionRatio(): number {
    const total = this.detail?.checklistItems.length ?? 0;
    if (!total) {
      return 0;
    }

    const completed = this.detail?.checklistItems.filter(item => item.completed).length ?? 0;
    return Math.round((completed / total) * 100);
  }

  commentLength(): number {
    return this.commentForm.get('body')?.value?.length ?? 0;
  }

  checklistLength(): number {
    return this.checklistForm.get('content')?.value?.length ?? 0;
  }

  toggleChecklistItem(item: ChecklistItemResponse): void {
    this.checklistToggled.emit({
      itemId: item.id,
      completed: !item.completed,
      content: item.content
    });
  }

  deleteComment(comment: CardCommentResponse): void {
    this.commentDeleted.emit(comment.id);
  }

  deleteChecklistItem(item: ChecklistItemResponse): void {
    this.checklistDeleted.emit(item.id);
  }

  isLabelOnCard(labelId: number): boolean {
    return !!this.detail?.labels?.some(l => l.id === labelId);
  }

  toggleLabel(labelId: number): void {
    if (this.labelsSaving || this.readOnly) return;
    if (this.isLabelOnCard(labelId)) {
      this.labelUnassigned.emit(labelId);
    } else {
      this.labelAssigned.emit(labelId);
    }
  }

  isOwnComment(comment: CardCommentResponse): boolean {
    return comment.authorId === this.currentUserId;
  }

  commentInitials(comment: CardCommentResponse): string {
    const source = comment.authorUsername || 'Usuario';
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(chunk => chunk[0]?.toUpperCase() ?? '')
      .join('') || 'U';
  }

  statusLabel(status: CardResponse['status'] | CardDetailResponse['status']): string {
    return this.statusOptions.find(option => option.value === status)?.label ?? status;
  }

  statusTone(status: CardResponse['status'] | CardDetailResponse['status']): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  priorityLabel(priority: CardResponse['priority'] | CardDetailResponse['priority']): string {
    return this.priorityOptions.find(option => option.value === priority)?.label ?? priority;
  }
}
