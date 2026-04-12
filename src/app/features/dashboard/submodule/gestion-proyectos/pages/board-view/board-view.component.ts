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
import { KanbanService } from '../../services/kanban.service';
import { KanbanBoard, KanbanBoardList, KanbanCardSummary } from '../../models/kanban.models';
import { CardDetailDialogComponent } from '../../components/card-detail-dialog/card-detail-dialog.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-board-view',
  standalone: true,
  imports: [
    DatePipe, FormsModule, DragDropModule, MatButtonModule, MatIconModule,
    MatMenuModule, MatChipsModule, MatDialogModule, MatProgressSpinnerModule,
    MatTooltipModule, MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './board-view.component.html',
  styleUrls: ['./board-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardViewComponent implements OnInit {
  board = signal<KanbanBoard | null>(null);
  loading = signal(true);
  newCardTitle = '';
  addingToListId: number | null = null;
  newListName = '';
  showNewListInput = false;

  constructor(
    private route: ActivatedRoute,
    private kanbanService: KanbanService,
    private dialog: MatDialog,
  ) {}

  async ngOnInit(): Promise<void> {
    const boardId = Number(this.route.snapshot.paramMap.get('boardId'));
    if (boardId) await this.loadBoard(boardId);
  }

  async loadBoard(id: number): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.kanbanService.getBoard(id);
      this.board.set(data);
    } catch {
      Swal.fire('Error', 'No se pudo cargar el tablero.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  getListIds(): string[] {
    return (this.board()?.listas ?? []).map(l => 'list-' + l.id);
  }

  async onCardDrop(event: CdkDragDrop<KanbanCardSummary[]>, targetList: KanbanBoardList): Promise<void> {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }
    const card = event.container.data[event.currentIndex];
    if (card) {
      try {
        await this.kanbanService.moveCard(card.id, targetList.id, event.currentIndex);
      } catch {
        Swal.fire('Error', 'No se pudo mover la tarjeta.', 'error');
        await this.loadBoard(this.board()!.id);
      }
    }
  }

  startAddCard(listId: number): void {
    this.addingToListId = listId;
    this.newCardTitle = '';
  }

  async addCard(lista: KanbanBoardList): Promise<void> {
    if (!this.newCardTitle.trim()) return;
    try {
      await this.kanbanService.createCard({
        lista: lista.id,
        titulo: this.newCardTitle.trim(),
        posicion: (lista.cards?.length ?? 0),
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
    this.newCardTitle = '';
  }

  openCardDetail(card: KanbanCardSummary): void {
    const dialogRef = this.dialog.open(CardDetailDialogComponent, {
      width: '640px',
      maxHeight: '90vh',
      data: { cardId: card.id },
    });
    dialogRef.afterClosed().subscribe(async (changed) => {
      if (changed) await this.loadBoard(this.board()!.id);
    });
  }

  async addList(): Promise<void> {
    if (!this.newListName.trim()) return;
    try {
      await this.kanbanService.createList({
        board: this.board()!.id,
        nombre: this.newListName.trim(),
        posicion: (this.board()?.listas?.length ?? 0),
      });
      this.newListName = '';
      this.showNewListInput = false;
      await this.loadBoard(this.board()!.id);
    } catch {
      Swal.fire('Error', 'No se pudo crear la lista.', 'error');
    }
  }

  async deleteList(lista: KanbanBoardList): Promise<void> {
    const confirm = await Swal.fire({
      title: '¿Eliminar lista?',
      text: `Se eliminará "${lista.nombre}" y todas sus tarjetas.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
    });
    if (confirm.isConfirmed) {
      try {
        await this.kanbanService.deleteList(lista.id);
        await this.loadBoard(this.board()!.id);
      } catch {
        Swal.fire('Error', 'No se pudo eliminar la lista.', 'error');
      }
    }
  }
}
