import { Component, Inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BoardService } from '../../services/board.service';
import { CardDetailResponse, CardStatus, CardPriority, LabelResponse } from '../../models/board.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-card-detail-dialog',
  standalone: true,
  imports: [
    FormsModule, DatePipe, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatChipsModule,
    MatSelectModule, MatDividerModule, MatProgressSpinnerModule, MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './card-detail-dialog.component.html',
  styleUrls: ['./card-detail-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailDialogComponent implements OnInit {
  card = signal<CardDetailResponse | null>(null);
  loading = signal(true);
  changed = false;
  newComment = '';
  newChecklistItem = '';
  availableLabels = signal<LabelResponse[]>([]);

  statuses: CardStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
  priorities: CardPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  constructor(
    public dialogRef: MatDialogRef<CardDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { cardId: number },
    private boardService: BoardService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadCard();
  }

  async loadCard(): Promise<void> {
    this.loading.set(true);
    try {
      const detail = await this.boardService.getCardDetail(this.data.cardId);
      this.card.set(detail);
      // Load board labels for the add label dropdown
      if (detail) {
        try {
          const labels = await this.boardService.getLabels();
          // Filter out already assigned labels
          const assignedIds = new Set((detail.card_labels ?? []).map(cl => cl.label));
          this.availableLabels.set(labels.filter(l => !assignedIds.has(l.id)));
        } catch { /* ignore */ }
      }
    } catch {
      Swal.fire('Error', 'No se pudo cargar el detalle.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  async updateField(field: string, value: any): Promise<void> {
    try {
      await this.boardService.updateCard(this.data.cardId, { [field]: value });
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo actualizar.', 'error');
    }
  }

  // --- Comments ---
  async addComment(): Promise<void> {
    if (!this.newComment.trim()) return;
    try {
      await this.boardService.createComment(this.data.cardId, this.newComment.trim());
      this.newComment = '';
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo comentar.', 'error');
    }
  }

  async deleteComment(commentId: number): Promise<void> {
    const c = await Swal.fire({
      title: 'Eliminar comentario?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
    });
    if (c.isConfirmed) {
      try {
        await this.boardService.deleteComment(commentId);
        this.changed = true;
        await this.loadCard();
      } catch {
        Swal.fire('Error', 'No se pudo eliminar.', 'error');
      }
    }
  }

  // --- Checklist ---
  async addChecklistItem(): Promise<void> {
    if (!this.newChecklistItem.trim()) return;
    try {
      await this.boardService.createChecklistItem(this.data.cardId, this.newChecklistItem.trim());
      this.newChecklistItem = '';
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo agregar.', 'error');
    }
  }

  async toggleChecklistItem(itemId: number, current: boolean): Promise<void> {
    try {
      await this.boardService.updateChecklistItem(itemId, { completed: !current });
      this.changed = true;
      await this.loadCard();
    } catch { /* ignore */ }
  }

  async deleteChecklistItem(itemId: number): Promise<void> {
    try {
      await this.boardService.deleteChecklistItem(itemId);
      this.changed = true;
      await this.loadCard();
    } catch { /* ignore */ }
  }

  checklistProgress(c: CardDetailResponse): number {
    if (!c.checklist_items.length) return 0;
    return Math.round((this.checklistDone(c) / c.checklist_items.length) * 100);
  }

  checklistDone(c: CardDetailResponse): number {
    return c.checklist_items.filter(i => i.completed).length;
  }

  // --- Labels ---
  async addLabel(labelId: number): Promise<void> {
    try {
      await this.boardService.addCardLabel(this.data.cardId, labelId);
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo agregar la etiqueta.', 'error');
    }
  }

  async removeLabel(cardLabelId: number): Promise<void> {
    try {
      await this.boardService.removeCardLabel(cardLabelId);
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo quitar la etiqueta.', 'error');
    }
  }

  // --- Uploads ---
  async uploadFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await this.boardService.uploadFile(this.data.cardId, file);
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo subir el archivo.', 'error');
    }
  }

  async deleteUpload(uploadId: number): Promise<void> {
    try {
      await this.boardService.deleteUpload(uploadId);
      this.changed = true;
      await this.loadCard();
    } catch { /* ignore */ }
  }

  isImage(mime: string | null): boolean {
    return !!mime && mime.startsWith('image/');
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // --- Delete card ---
  async deleteCard(): Promise<void> {
    const c = await Swal.fire({
      title: 'Eliminar tarjeta?',
      text: 'Esta accion no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
    });
    if (c.isConfirmed) {
      try {
        await this.boardService.deleteCard(this.data.cardId);
        this.dialogRef.close(true);
      } catch {
        Swal.fire('Error', 'No se pudo eliminar.', 'error');
      }
    }
  }

  close(): void {
    this.dialogRef.close(this.changed);
  }

  // --- Helpers ---
  isOverdue(dueAt: string): boolean {
    return new Date(dueAt) < new Date();
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = { TODO: 'Por hacer', IN_PROGRESS: 'En progreso', BLOCKED: 'Bloqueado', DONE: 'Hecho' };
    return m[s] ?? s;
  }

  statusTone(s: string): string {
    return s.toLowerCase().replace(/_/g, '-');
  }

  priorityLabel(p: string): string {
    const m: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' };
    return m[p] ?? p;
  }

  priorityColor(p: string): string {
    const m: Record<string, string> = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', URGENT: '#7c3aed' };
    return m[p] ?? '#9e9e9e';
  }
}
