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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
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
    MatTooltipModule, MatDatepickerModule, MatNativeDateModule,
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

  /**
   * Carga inicial: muestra spinner y reemplaza el contenido.
   * Para refrescos posteriores (después de editar campos), usa
   * ``refreshCard()`` que no toca el flag ``loading`` — así el header
   * con el botón de cerrar permanece siempre clickeable y no parpadea
   * la UI con cada update.
   */
  async loadCard(silent: boolean = false): Promise<void> {
    if (!silent) this.loading.set(true);
    try {
      const detail = await this.boardService.getCardDetail(this.data.cardId);
      this.card.set(detail);
      // Load board labels for the add label dropdown
      if (detail) {
        try {
          const labels = await this.boardService.getLabels(detail.board_id);
          // Filter out already assigned labels
          const assignedIds = new Set((detail.card_labels ?? []).map(cl => cl.label));
          this.availableLabels.set(labels.filter(l => !assignedIds.has(l.id)));
        } catch { /* ignore */ }
      }
    } catch {
      if (!silent) Swal.fire('Error', 'No se pudo cargar el detalle.', 'error');
    } finally {
      if (!silent) this.loading.set(false);
    }
  }

  async updateField(field: string, value: any): Promise<void> {
    try {
      await this.boardService.updateCard(this.data.cardId, { [field]: value });
      this.changed = true;
      await this.loadCard(true);  // refresh silencioso: no parpadea el header
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
      await this.loadCard(true);
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
        await this.loadCard(true);
      } catch {
        Swal.fire('Error', 'No se pudo eliminar.', 'error');
      }
    }
  }

  // --- Checklist (optimistic updates) ---
  async addChecklistItem(): Promise<void> {
    const text = this.newChecklistItem.trim();
    if (!text) return;
    this.newChecklistItem = '';
    try {
      const item = await this.boardService.createChecklistItem(this.data.cardId, text);
      this.changed = true;
      // Insert in-place sin recargar.
      const c = this.card();
      if (c) this.card.set({ ...c, checklist_items: [...c.checklist_items, item] });
    } catch {
      this.newChecklistItem = text;  // restore on failure
      Swal.fire('Error', 'No se pudo agregar.', 'error');
    }
  }

  async toggleChecklistItem(itemId: number, current: boolean): Promise<void> {
    // Flip local primero (responsive UI), luego PATCH.
    const c = this.card();
    if (!c) return;
    const before = c.checklist_items;
    const next = before.map(i => i.id === itemId ? { ...i, completed: !current } : i);
    this.card.set({ ...c, checklist_items: next });
    try {
      await this.boardService.updateChecklistItem(itemId, { completed: !current });
      this.changed = true;
    } catch {
      // Rollback en caso de error.
      this.card.set({ ...c, checklist_items: before });
    }
  }

  async deleteChecklistItem(itemId: number): Promise<void> {
    const c = this.card();
    if (!c) return;
    const before = c.checklist_items;
    this.card.set({ ...c, checklist_items: before.filter(i => i.id !== itemId) });
    try {
      await this.boardService.deleteChecklistItem(itemId);
      this.changed = true;
    } catch {
      this.card.set({ ...c, checklist_items: before });
    }
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
      await this.loadCard(true);
    } catch {
      Swal.fire('Error', 'No se pudo agregar la etiqueta.', 'error');
    }
  }

  async removeLabel(labelId: number): Promise<void> {
    try {
      await this.boardService.removeCardLabel(this.data.cardId, labelId);
      this.changed = true;
      await this.loadCard(true);
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
      await this.loadCard(true);
    } catch {
      Swal.fire('Error', 'No se pudo subir el archivo.', 'error');
    }
  }

  async deleteUpload(uploadUuid: string): Promise<void> {
    try {
      await this.boardService.deleteUpload(uploadUuid);
      this.changed = true;
      await this.loadCard(true);
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

  // --- Due date (datepicker) ---
  /** Convierte ``due_at`` (ISO string) del backend a Date para el datepicker. */
  dueDateValue(): Date | null {
    const c = this.card();
    return c?.due_at ? new Date(c.due_at) : null;
  }

  /** El datepicker emite Date; lo serializamos a ISO y disparamos updateField. */
  async onDueDateChange(d: Date | null): Promise<void> {
    if (!d) {
      await this.updateField('due_at', null);
      return;
    }
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0);
    await this.updateField('due_at', local.toISOString());
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
