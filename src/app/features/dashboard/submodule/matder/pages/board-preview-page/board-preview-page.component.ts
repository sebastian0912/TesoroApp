import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
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
import { BoardService } from '../../services/board.service';
import { BoardResponse, BoardListResponse, CardSummary } from '../../models/board.models';
import { CardDetailDialogComponent } from '../../components/card-detail-dialog/card-detail-dialog.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-board-preview-page',
  standalone: true,
  imports: [
    DatePipe, FormsModule, DragDropModule, MatButtonModule, MatIconModule,
    MatMenuModule, MatChipsModule, MatDialogModule, MatProgressSpinnerModule,
    MatTooltipModule, MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './board-preview-page.component.html',
  styleUrls: ['./board-preview-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPreviewPageComponent implements OnInit {
  board = signal<BoardResponse | null>(null);
  lists = signal<BoardListResponse[]>([]);
  loading = signal(true);
  newCardTitle = '';
  addingToListId: number | null = null;
  newListName = '';
  showNewListInput = false;

  constructor(
    private route: ActivatedRoute,
    private boardService: BoardService,
    private dialog: MatDialog,
  ) {}

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('boardId'));
    if (id) await this.loadBoard(id);
  }

  async loadBoard(id: number): Promise<void> {
    this.loading.set(true);
    try {
      const [b, ls] = await Promise.all([
        this.boardService.getBoard(id),
        this.boardService.getBoardLists(id),
      ]);
      this.board.set(b);
      this.lists.set(ls);
    } catch { Swal.fire('Error', 'No se pudo cargar el tablero.', 'error'); }
    finally { this.loading.set(false); }
  }

  getListIds(): string[] {
    return this.lists().map(l => 'list-' + l.id);
  }

  async onCardDrop(event: CdkDragDrop<CardSummary[]>, target: BoardListResponse): Promise<void> {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }
    const card = event.container.data[event.currentIndex];
    if (card) {
      try { await this.boardService.moveCard(card.id, target.id, event.currentIndex); }
      catch { Swal.fire('Error', 'No se pudo mover.', 'error'); await this.loadBoard(this.board()!.id); }
    }
  }

  startAddCard(listId: number): void { this.addingToListId = listId; this.newCardTitle = ''; }

  async addCard(list: BoardListResponse): Promise<void> {
    if (!this.newCardTitle.trim()) return;
    try {
      await this.boardService.createCard({ board_list: list.id, title: this.newCardTitle.trim(), position: list.cards?.length ?? 0 });
      this.addingToListId = null; this.newCardTitle = '';
      await this.loadBoard(this.board()!.id);
    } catch { Swal.fire('Error', 'No se pudo crear la tarjeta.', 'error'); }
  }

  cancelAddCard(): void { this.addingToListId = null; }

  openCardDetail(card: CardSummary): void {
    const ref = this.dialog.open(CardDetailDialogComponent, { width: '640px', maxHeight: '90vh', data: { cardId: card.id } });
    ref.afterClosed().subscribe(async (changed) => { if (changed) await this.loadBoard(this.board()!.id); });
  }

  async addList(): Promise<void> {
    if (!this.newListName.trim()) return;
    try {
      await this.boardService.createList({ board: this.board()!.id, name: this.newListName.trim(), position: this.lists().length });
      this.newListName = ''; this.showNewListInput = false;
      await this.loadBoard(this.board()!.id);
    } catch { Swal.fire('Error', 'No se pudo crear la lista.', 'error'); }
  }

  async deleteList(list: BoardListResponse): Promise<void> {
    const c = await Swal.fire({ title: `¿Eliminar "${list.name}"?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar' });
    if (c.isConfirmed) { try { await this.boardService.deleteList(list.id); await this.loadBoard(this.board()!.id); } catch {} }
  }

  priorityColor(p: string): string {
    const m: Record<string, string> = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', URGENT: '#7c3aed' };
    return m[p] ?? '#9e9e9e';
  }
}
