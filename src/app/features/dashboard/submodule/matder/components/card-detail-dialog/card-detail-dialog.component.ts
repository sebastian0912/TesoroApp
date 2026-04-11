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
import { BoardService } from '../../services/board.service';
import { CardDetailResponse, CardStatus, CardPriority } from '../../models/board.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-card-detail-dialog',
  standalone: true,
  imports: [
    FormsModule, DatePipe, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatChipsModule,
    MatSelectModule, MatDividerModule, MatProgressSpinnerModule,
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

  statuses: CardStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
  priorities: CardPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  constructor(
    public dialogRef: MatDialogRef<CardDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { cardId: number },
    private boardService: BoardService,
  ) {}

  async ngOnInit(): Promise<void> { await this.loadCard(); }

  async loadCard(): Promise<void> {
    this.loading.set(true);
    try { this.card.set(await this.boardService.getCardDetail(this.data.cardId)); }
    catch { Swal.fire('Error', 'No se pudo cargar.', 'error'); }
    finally { this.loading.set(false); }
  }

  async updateField(field: string, value: any): Promise<void> {
    try { await this.boardService.updateCard(this.data.cardId, { [field]: value }); this.changed = true; await this.loadCard(); }
    catch { Swal.fire('Error', 'No se pudo actualizar.', 'error'); }
  }

  async addComment(): Promise<void> {
    if (!this.newComment.trim()) return;
    try { await this.boardService.createComment(this.data.cardId, this.newComment.trim()); this.newComment = ''; this.changed = true; await this.loadCard(); }
    catch { Swal.fire('Error', 'No se pudo comentar.', 'error'); }
  }

  async addChecklistItem(): Promise<void> {
    if (!this.newChecklistItem.trim()) return;
    try { await this.boardService.createChecklistItem(this.data.cardId, this.newChecklistItem.trim()); this.newChecklistItem = ''; this.changed = true; await this.loadCard(); }
    catch { Swal.fire('Error', 'No se pudo agregar.', 'error'); }
  }

  async toggleChecklistItem(itemId: number, current: boolean): Promise<void> {
    try { await this.boardService.updateChecklistItem(itemId, { completed: !current }); this.changed = true; await this.loadCard(); }
    catch {}
  }

  async uploadFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try { await this.boardService.uploadFile(this.data.cardId, file); this.changed = true; await this.loadCard(); }
    catch { Swal.fire('Error', 'No se pudo subir.', 'error'); }
  }

  async deleteCard(): Promise<void> {
    const c = await Swal.fire({ title: '¿Eliminar tarjeta?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar' });
    if (c.isConfirmed) { try { await this.boardService.deleteCard(this.data.cardId); this.dialogRef.close(true); } catch {} }
  }

  close(): void { this.dialogRef.close(this.changed); }

  priorityColor(p: string): string {
    const m: Record<string, string> = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', URGENT: '#7c3aed' };
    return m[p] ?? '#9e9e9e';
  }
}
