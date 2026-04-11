import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { KanbanService } from '../../services/kanban.service';
import { KanbanBoard } from '../../models/kanban.models';
import { BoardDialogComponent } from '../../components/board-dialog/board-dialog.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-boards-list',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatDialogModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './boards-list.component.html',
  styleUrls: ['./boards-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardsListComponent implements OnInit {
  boards = signal<KanbanBoard[]>([]);
  loading = signal(true);
  searchTerm = '';

  constructor(
    private kanbanService: KanbanService,
    private router: Router,
    private dialog: MatDialog,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadBoards();
  }

  async loadBoards(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.kanbanService.getBoards();
      this.boards.set(data ?? []);
    } catch {
      this.boards.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  openBoard(boardId: number): void {
    this.router.navigate(['/dashboard/gestion-proyectos/board', boardId]);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(BoardDialogComponent, {
      width: '480px',
      data: { mode: 'create' },
    });
    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          await this.kanbanService.createBoard(result);
          await this.loadBoards();
          Swal.fire('Creado', 'Tablero creado correctamente.', 'success');
        } catch {
          Swal.fire('Error', 'No se pudo crear el tablero.', 'error');
        }
      }
    });
  }

  async deleteBoard(event: Event, board: KanbanBoard): Promise<void> {
    event.stopPropagation();
    const confirm = await Swal.fire({
      title: '¿Eliminar tablero?',
      text: `Se eliminará "${board.nombre}" y todas sus tarjetas.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (confirm.isConfirmed) {
      try {
        await this.kanbanService.deleteBoard(board.id);
        await this.loadBoards();
        Swal.fire('Eliminado', 'Tablero eliminado.', 'success');
      } catch {
        Swal.fire('Error', 'No se pudo eliminar el tablero.', 'error');
      }
    }
  }

  get filteredBoards(): KanbanBoard[] {
    const term = this.searchTerm.toLowerCase();
    if (!term) return this.boards();
    return this.boards().filter(b =>
      b.nombre.toLowerCase().includes(term) ||
      (b.descripcion ?? '').toLowerCase().includes(term)
    );
  }
}
