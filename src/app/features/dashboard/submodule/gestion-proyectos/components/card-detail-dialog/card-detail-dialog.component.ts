import { Component, Inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { DatePipe } from '@angular/common';
import { KanbanService } from '../../services/kanban.service';
import { KanbanCard, KanbanCardEstado } from '../../models/kanban.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-card-detail-dialog',
  standalone: true,
  imports: [
    FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatChipsModule,
    MatSelectModule, MatDividerModule, MatProgressSpinnerModule, DatePipe,
  ],
  templateUrl: './card-detail-dialog.component.html',
  styleUrls: ['./card-detail-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailDialogComponent implements OnInit {
  card = signal<KanbanCard | null>(null);
  loading = signal(true);
  changed = false;

  newComment = '';
  newChecklistItem = '';

  estados: KanbanCardEstado[] = ['abierta', 'en_progreso', 'completada', 'archivada'];

  constructor(
    public dialogRef: MatDialogRef<CardDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { cardId: number },
    private kanbanService: KanbanService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadCard();
  }

  async loadCard(): Promise<void> {
    this.loading.set(true);
    try {
      const c = await this.kanbanService.getCard(this.data.cardId);
      this.card.set(c);
    } catch {
      Swal.fire('Error', 'No se pudo cargar la tarjeta.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  async updateField(field: string, value: any): Promise<void> {
    try {
      await this.kanbanService.updateCard(this.data.cardId, { [field]: value } as any);
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo actualizar.', 'error');
    }
  }

  async toggleFavorite(): Promise<void> {
    const c = this.card();
    if (c) await this.updateField('favorita', !c.favorita);
  }

  async addComment(): Promise<void> {
    if (!this.newComment.trim()) return;
    try {
      await this.kanbanService.createComment({ card: this.data.cardId, cuerpo: this.newComment.trim() });
      this.newComment = '';
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo agregar el comentario.', 'error');
    }
  }

  async addChecklistItem(): Promise<void> {
    if (!this.newChecklistItem.trim()) return;
    try {
      await this.kanbanService.createChecklistItem({ card: this.data.cardId, contenido: this.newChecklistItem.trim() });
      this.newChecklistItem = '';
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo agregar el elemento.', 'error');
    }
  }

  async toggleChecklistItem(itemId: number): Promise<void> {
    try {
      await this.kanbanService.toggleChecklistItem(itemId);
      this.changed = true;
      await this.loadCard();
    } catch {
      Swal.fire('Error', 'No se pudo cambiar el estado.', 'error');
    }
  }

  async uploadFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await this.kanbanService.uploadFile(this.data.cardId, file);
      this.changed = true;
      await this.loadCard();
      Swal.fire('Subido', 'Archivo adjuntado.', 'success');
    } catch {
      Swal.fire('Error', 'No se pudo subir el archivo.', 'error');
    }
  }

  async deleteCard(): Promise<void> {
    const confirm = await Swal.fire({
      title: '¿Eliminar tarjeta?', icon: 'warning',
      showCancelButton: true, confirmButtonText: 'Eliminar',
    });
    if (confirm.isConfirmed) {
      try {
        await this.kanbanService.deleteCard(this.data.cardId);
        this.dialogRef.close(true);
      } catch {
        Swal.fire('Error', 'No se pudo eliminar.', 'error');
      }
    }
  }

  close(): void {
    this.dialogRef.close(this.changed);
  }
}
