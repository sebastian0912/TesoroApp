import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BoardService } from '../../services/board.service';
import { BoardResponse, BoardListResponse, CardSummary } from '../../models/board.models';
import { CardDetailDialogComponent } from '../../components/card-detail-dialog/card-detail-dialog.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-board-preview-page',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, DragDropModule, MatButtonModule, MatIconModule,
    MatMenuModule, MatChipsModule, MatDialogModule, MatProgressSpinnerModule,
    MatTooltipModule, MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  templateUrl: './board-preview-page.component.html',
  styleUrls: ['./board-preview-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPreviewPageComponent implements OnInit {
  board = signal<BoardResponse | null>(null);
  lists = signal<BoardListResponse[]>([]);
  loading = signal(true);

  // Add card
  newCardTitle = '';
  addingToListId: number | null = null;

  // Add list
  newListName = '';
  showNewListInput = false;

  // Edit list
  editingListId: number | null = null;
  editListName = '';

  // Card modal
  showCardModal = false;
  editingCardId: number | null = null;
  editingCardListId: number | null = null;
  cardFormTitle = '';
  cardFormDesc = '';
  cardFormStatus = 'TODO';
  cardFormPriority = 'MEDIUM';
  cardFormDueDate = '';
  cardSaving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private boardService: BoardService,
    private dialog: MatDialog,
  ) {}

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('boardId'));
    if (id) await this.loadBoard(id);
    else this.loading.set(false);
  }

  async loadBoard(id: number): Promise<void> {
    this.loading.set(true);
    try {
      const [b, ls] = await Promise.all([
        this.boardService.getBoard(id),
        this.boardService.getBoardLists(id),
      ]);
      this.board.set(b);
      this.lists.set(ls.sort((a, c) => a.position - c.position));
    } catch {
      this.board.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  get totalCardCount(): number {
    return this.lists().reduce((sum, l) => sum + (l.cards?.length ?? 0), 0);
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }

  getListIds(): string[] {
    return this.lists().map(l => 'list-' + l.id);
  }

  // --- Drag & drop ---
  async onCardDrop(event: CdkDragDrop<CardSummary[]>, target: BoardListResponse): Promise<void> {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }
    const card = event.container.data[event.currentIndex];
    if (card) {
      try {
        await this.boardService.moveCard(card.id, target.id, event.currentIndex);
      } catch {
        Swal.fire('Error', 'No se pudo mover la tarea.', 'error');
        await this.loadBoard(this.board()!.id);
      }
    }
  }

  // --- Add card inline ---
  startAddCard(listId: number): void {
    this.addingToListId = listId;
    this.newCardTitle = '';
  }

  async addCard(list: BoardListResponse): Promise<void> {
    if (!this.newCardTitle.trim()) return;
    try {
      await this.boardService.createCard({
        board_list: list.id,
        title: this.newCardTitle.trim(),
        position: list.cards?.length ?? 0,
      });
      this.addingToListId = null;
      this.newCardTitle = '';
      await this.loadBoard(this.board()!.id);
    } catch {
      Swal.fire('Error', 'No se pudo crear la tarjeta.', 'error');
    }
  }

  cancelAddCard(): void {
    this.addingToListId = null;
  }

  // --- List management ---
  async addList(): Promise<void> {
    if (!this.newListName.trim()) return;
    try {
      await this.boardService.createList({
        board: this.board()!.id,
        name: this.newListName.trim(),
        position: this.lists().length,
      });
      this.newListName = '';
      this.showNewListInput = false;
      await this.loadBoard(this.board()!.id);
    } catch {
      Swal.fire('Error', 'No se pudo crear la lista.', 'error');
    }
  }

  startEditList(list: BoardListResponse): void {
    this.editingListId = list.id;
    this.editListName = list.name;
  }

  cancelEditList(): void {
    this.editingListId = null;
    this.editListName = '';
  }

  async submitListEdit(list: BoardListResponse): Promise<void> {
    if (!this.editListName.trim()) return;
    try {
      await this.boardService.updateList(list.id, { name: this.editListName.trim() });
      this.editingListId = null;
      await this.loadBoard(this.board()!.id);
    } catch {
      Swal.fire('Error', 'No se pudo actualizar la lista.', 'error');
    }
  }

  async deleteList(list: BoardListResponse): Promise<void> {
    const c = await Swal.fire({
      title: `Eliminar "${list.name}"?`,
      text: 'Se eliminaran todas las tareas de esta lista.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
    });
    if (c.isConfirmed) {
      try {
        await this.boardService.deleteList(list.id);
        await this.loadBoard(this.board()!.id);
      } catch {
        Swal.fire('Error', 'No se pudo eliminar la lista.', 'error');
      }
    }
  }

  // --- Card detail ---
  openCardDetail(card: CardSummary): void {
    const ref = this.dialog.open(CardDetailDialogComponent, {
      width: '700px',
      maxHeight: '90vh',
      data: { cardId: card.id },
    });
    ref.afterClosed().subscribe(async (changed) => {
      if (changed) await this.loadBoard(this.board()!.id);
    });
  }

  // --- Card modal (create/edit) ---
  openEditCard(card: CardSummary): void {
    this.editingCardId = card.id;
    this.editingCardListId = card.board_list;
    this.cardFormTitle = card.title;
    this.cardFormDesc = '';
    this.cardFormStatus = card.status;
    this.cardFormPriority = card.priority;
    this.cardFormDueDate = card.due_at ? card.due_at.substring(0, 10) : '';
    this.showCardModal = true;
    // Load full detail for description
    this.boardService.getCardDetail(card.id).then(detail => {
      this.cardFormDesc = detail.description ?? '';
    }).catch(() => {});
  }

  openCreateCardForList(listId: number): void {
    this.editingCardId = null;
    this.editingCardListId = listId;
    this.cardFormTitle = '';
    this.cardFormDesc = '';
    this.cardFormStatus = 'TODO';
    this.cardFormPriority = 'MEDIUM';
    this.cardFormDueDate = '';
    this.showCardModal = true;
  }

  closeCardModal(): void {
    this.showCardModal = false;
    this.editingCardId = null;
  }

  async submitCardForm(): Promise<void> {
    if (!this.cardFormTitle.trim() || this.cardSaving) return;
    this.cardSaving = true;
    try {
      const payload: Record<string, any> = {
        title: this.cardFormTitle.trim(),
        description: this.cardFormDesc.trim(),
        status: this.cardFormStatus,
        priority: this.cardFormPriority,
        due_at: this.cardFormDueDate || null,
      };
      if (this.editingCardId) {
        await this.boardService.updateCard(this.editingCardId, payload);
      } else {
        payload['board_list'] = this.editingCardListId;
        payload['position'] = 0;
        await this.boardService.createCard(payload as any);
      }
      this.closeCardModal();
      await this.loadBoard(this.board()!.id);
    } catch {
      Swal.fire('Error', 'No se pudo guardar la tarea.', 'error');
    } finally {
      this.cardSaving = false;
    }
  }

  // --- Delete card ---
  async deleteCard(_list: BoardListResponse, card: CardSummary): Promise<void> {
    const c = await Swal.fire({
      title: `Eliminar "${card.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
    });
    if (c.isConfirmed) {
      try {
        await this.boardService.deleteCard(card.id);
        await this.loadBoard(this.board()!.id);
      } catch {
        Swal.fire('Error', 'No se pudo eliminar la tarea.', 'error');
      }
    }
  }

  // --- Helpers ---
  priorityColor(p: string): string {
    const m: Record<string, string> = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', URGENT: '#7c3aed' };
    return m[p] ?? '#9e9e9e';
  }

  priorityLabel(p: string): string {
    const m: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' };
    return m[p] ?? p;
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = { TODO: 'Por hacer', IN_PROGRESS: 'En progreso', BLOCKED: 'Bloqueado', DONE: 'Hecho' };
    return m[s] ?? s;
  }

  statusTone(s: string): string {
    return s.toLowerCase().replace(/_/g, '-');
  }
}
