import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin, switchMap } from 'rxjs';
import { AuthResponse, AuthService } from '../../../core/services/auth/auth.service';
import { BoardResponse, BoardService } from '../../../core/services/board/board.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { WorkspaceResponse, WorkspaceService } from '../../../core/services/workspace/workspace.service';
import { BoardModalComponent } from '../../components/board-modal/board-modal.component';
import { BOARD_COLOR_OPTIONS } from '../../config/board.config';

@Component({
  standalone: true,
  selector: 'app-boards-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    BoardModalComponent
  ],
  templateUrl: './boards-page.component.html',
  styleUrl: './boards-page.component.css'
})
export class BoardsPageComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private boardService = inject(BoardService);
  private favoritesService = inject(FavoritesService);
  private route = inject(ActivatedRoute);
  private workspaceService = inject(WorkspaceService);
  private router = inject(Router);
  private shortDateFormatter = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short'
  });

  loading = true;
  user: AuthResponse | null = null;
  workspaces: WorkspaceResponse[] = [];
  boards: BoardResponse[] = [];
  uiMessage = 'Aqui puedes ver todos tus tableros, filtrarlos por workspace y crear nuevos sin salir de la vista.';
  boardColorOptions = BOARD_COLOR_OPTIONS;
  isBoardModalOpen = false;
  boardSaving = false;
  boardError = '';
  editingBoard: BoardResponse | null = null;
  deletingBoardId: number | null = null;

  filtersForm = this.fb.nonNullable.group({
    query: [''],
    workspaceId: ['all'],
    favoriteState: ['all']
  });

  boardForm = this.fb.nonNullable.group({
    workspaceId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(280)]],
    accent: ['#38bdf8', [Validators.required]]
  });

  constructor() {
    this.loadBoardsOverview();
  }

  get userInitials(): string {
    if (!this.user?.username) {
      return 'M';
    }

    return this.user.username.slice(0, 2).toUpperCase();
  }

  get filteredBoards(): BoardResponse[] {
    const query = this.filtersForm.controls.query.value.trim().toLowerCase();
    const selectedWorkspaceId = this.filtersForm.controls.workspaceId.value;
    const selectedFavoriteState = this.filtersForm.controls.favoriteState.value;

    return this.boards.filter(board => {
      const matchesWorkspace = selectedWorkspaceId === 'all' || String(board.workspaceId) === selectedWorkspaceId;
      if (!matchesWorkspace) {
        return false;
      }

      const isFavorite = this.isBoardFavorite(board.id);
      const matchesFavoriteState = selectedFavoriteState === 'all'
        || (selectedFavoriteState === 'favorites' && isFavorite)
        || (selectedFavoriteState === 'regular' && !isFavorite);

      if (!matchesFavoriteState) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableContent = `${board.name} ${board.workspaceName} ${board.description ?? ''}`.toLowerCase();
      return searchableContent.includes(query);
    });
  }

  get hasActiveFilters(): boolean {
    return this.filtersForm.controls.query.value.trim().length > 0
      || this.filtersForm.controls.workspaceId.value !== 'all'
      || this.filtersForm.controls.favoriteState.value !== 'all';
  }

  get selectedWorkspaceLabel(): string {
    const selectedWorkspaceId = this.filtersForm.controls.workspaceId.value;

    if (selectedWorkspaceId === 'all') {
      return 'Todos los workspaces';
    }

    return this.workspaces.find(workspace => String(workspace.id) === selectedWorkspaceId)?.name ?? 'Workspace seleccionado';
  }

  get creatableWorkspaces(): WorkspaceResponse[] {
    return this.workspaces.filter(workspace => workspace.canCreateBoards);
  }

  goToDashboard(): void {
    void this.router.navigate(['/dashboard/madter/dashboard']);
  }

  goToWorkspaces(): void {
    void this.router.navigate(['/dashboard/madter/workspaces']);
  }

  openBoardPreview(boardId: number): void {
    void this.router.navigate(['/dashboard/madter/board', boardId]);
  }

  isBoardFavorite(boardId: number): boolean {
    return this.favoritesService.isBoardFavorite(boardId);
  }

  toggleBoardFavorite(board: BoardResponse): void {
    this.favoritesService.toggleBoard(board.id);
    this.uiMessage = this.isBoardFavorite(board.id)
      ? `Tablero "${board.name}" agregado a favoritos.`
      : `Tablero "${board.name}" removido de favoritos.`;
  }

  clearFilters(): void {
    this.filtersForm.reset({
      query: '',
      workspaceId: 'all',
      favoriteState: 'all'
    });
    this.uiMessage = 'Filtros limpios. Estas viendo todos tus tableros otra vez.';
  }

  openBoardModal(): void {
    if (!this.creatableWorkspaces.length) {
      this.uiMessage = this.workspaces.length
        ? 'Tu rol actual no permite crear tableros en los workspaces visibles.'
        : 'Primero crea un workspace desde el dashboard para poder guardar tableros dentro de el.';
      return;
    }

    const selectedWorkspaceId = this.filtersForm.controls.workspaceId.value;
    const canUseSelectedWorkspace = this.creatableWorkspaces.some(workspace => String(workspace.id) === selectedWorkspaceId);
    const defaultWorkspaceId = canUseSelectedWorkspace
      ? selectedWorkspaceId
      : String(this.creatableWorkspaces[0].id);

    this.boardError = '';
    this.editingBoard = null;
    this.boardForm.reset({
      workspaceId: defaultWorkspaceId,
      name: '',
      description: '',
      accent: '#38bdf8'
    });
    this.isBoardModalOpen = true;
  }

  closeBoardModal(): void {
    if (this.boardSaving) {
      return;
    }

    this.isBoardModalOpen = false;
    this.editingBoard = null;
    this.boardError = '';
    this.boardForm.reset({
      workspaceId: this.creatableWorkspaces.length ? String(this.creatableWorkspaces[0].id) : '',
      name: '',
      description: '',
      accent: '#38bdf8'
    });
  }

  setBoardAccent(accent: string): void {
    this.boardForm.controls.accent.setValue(accent);
  }

  openEditBoardModal(board: BoardResponse): void {
    if (!board.canManageContent) {
      this.uiMessage = `Tu rol actual no permite editar el tablero "${board.name}".`;
      return;
    }

    this.boardError = '';
    this.editingBoard = board;
    this.boardForm.reset({
      workspaceId: String(board.workspaceId),
      name: board.name,
      description: board.description ?? '',
      accent: board.accent
    });
    this.isBoardModalOpen = true;
  }

  submitBoard(): void {
    if (this.boardForm.invalid || this.boardSaving) {
      this.boardForm.markAllAsTouched();
      return;
    }

    this.boardSaving = true;
    this.boardError = '';

    const rawValue = this.boardForm.getRawValue();
    const createPayload = {
      workspaceId: Number(rawValue.workspaceId),
      name: rawValue.name,
      description: rawValue.description,
      accent: rawValue.accent
    };
    const updatePayload = {
      name: rawValue.name,
      description: rawValue.description,
      accent: rawValue.accent
    };

    this.authService.initCsrf().pipe(
      switchMap(() => this.editingBoard
        ? this.boardService.update(this.editingBoard.id, updatePayload)
        : this.boardService.create(createPayload))
    ).subscribe({
      next: board => {
        this.boards = this.sortBoards(
          this.editingBoard
            ? this.boards.map(item => item.id === board.id ? board : item)
            : [board, ...this.boards]
        );
        this.uiMessage = this.editingBoard
          ? `Tablero "${board.name}" actualizado correctamente.`
          : `Tablero "${board.name}" creado dentro de ${board.workspaceName}.`;
        this.boardSaving = false;
        this.closeBoardModal();
      },
      error: err => {
        this.boardSaving = false;
        this.boardError = err?.error?.message ?? 'No pudimos crear el tablero. Intenta otra vez.';
      }
    });
  }

  trackBoard(_: number, board: BoardResponse): number {
    return board.id;
  }

  deleteBoard(board: BoardResponse): void {
    if (!board.canManageContent) {
      this.uiMessage = `Tu rol actual no permite eliminar el tablero "${board.name}".`;
      return;
    }

    if (this.deletingBoardId) {
      return;
    }

    if (!confirm(`Vas a eliminar el tablero "${board.name}" con sus listas y tareas. Quieres continuar?`)) {
      return;
    }

    this.deletingBoardId = board.id;
    this.authService.initCsrf().pipe(
      switchMap(() => this.boardService.delete(board.id))
    ).subscribe({
      next: () => {
        this.boards = this.boards.filter(item => item.id !== board.id);
        if (this.editingBoard?.id === board.id) {
          this.closeBoardModal();
        }
        this.uiMessage = `Tablero "${board.name}" eliminado correctamente.`;
        this.deletingBoardId = null;
      },
      error: err => {
        this.deletingBoardId = null;
        this.uiMessage = err?.error?.message ?? 'No pudimos eliminar el tablero. Intenta otra vez.';
      }
    });
  }

  private loadBoardsOverview(): void {
    forkJoin({
      csrf: this.authService.initCsrf(),
      user: this.authService.me(),
      workspaces: this.workspaceService.listMine(),
      boards: this.boardService.listMine()
    }).subscribe({
      next: ({ user, workspaces, boards }) => {
        this.user = user;
        this.workspaces = workspaces;
        this.boards = this.sortBoards(boards);
        this.applyWorkspaceFilterFromQueryParam();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        void this.router.navigate(['/dashboard/madter/dashboard']);
      }
    });
  }



  private sortBoards(boards: BoardResponse[]): BoardResponse[] {
    return [...boards].sort((left, right) => (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    ));
  }

  private applyWorkspaceFilterFromQueryParam(): void {
    const workspaceId = this.route.snapshot.queryParamMap.get('workspaceId');

    if (!workspaceId) {
      return;
    }

    const workspaceExists = this.workspaces.some(workspace => String(workspace.id) === workspaceId);
    if (!workspaceExists) {
      return;
    }

    this.filtersForm.patchValue({ workspaceId });
    this.uiMessage = 'Filtramos los tableros segun el workspace que elegiste.';
  }
}
