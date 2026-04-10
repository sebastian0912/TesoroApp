import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import { AuthResponse, AuthService } from '../../../core/services/auth/auth.service';
import { BoardResponse, BoardService } from '../../../core/services/board/board.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { FavoriteStat } from '../../models/favorites.models';

@Component({
  standalone: true,
  selector: 'app-favorites-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.css'
})
export class FavoritesPageComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private boardService = inject(BoardService);
  private favoritesService = inject(FavoritesService);
  private router = inject(Router);
  private shortDateFormatter = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short'
  });

  loading = true;
  user: AuthResponse | null = null;
  boards: BoardResponse[] = [];
  favoriteBoardIds: number[] = [];
  stats: FavoriteStat[] = [];
  uiMessage = 'Marca los tableros clave y recuperalos aqui en una vista rapida para entrar directo a trabajar.';

  filtersForm = this.fb.nonNullable.group({
    query: [''],
    workspaceId: ['all']
  });

  constructor() {
    this.loadFavoritesOverview();
  }

  get favoriteBoards(): BoardResponse[] {
    return this.boards.filter(board => this.favoriteBoardIds.includes(board.id));
  }

  get filteredFavoriteBoards(): BoardResponse[] {
    const query = this.filtersForm.controls.query.value.trim().toLowerCase();
    const selectedWorkspaceId = this.filtersForm.controls.workspaceId.value;

    return this.favoriteBoards.filter(board => {
      const matchesWorkspace = selectedWorkspaceId === 'all' || String(board.workspaceId) === selectedWorkspaceId;
      if (!matchesWorkspace) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableContent = `${board.name} ${board.workspaceName} ${board.description ?? ''}`.toLowerCase();
      return searchableContent.includes(query);
    });
  }

  get favoriteWorkspaces(): Array<{ id: number; name: string }> {
    const workspaceMap = new Map<number, string>();

    for (const board of this.favoriteBoards) {
      if (!workspaceMap.has(board.workspaceId)) {
        workspaceMap.set(board.workspaceId, board.workspaceName);
      }
    }

    return [...workspaceMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  get hasActiveFilters(): boolean {
    return this.filtersForm.controls.query.value.trim().length > 0
      || this.filtersForm.controls.workspaceId.value !== 'all';
  }

  get selectedWorkspaceLabel(): string {
    const selectedWorkspaceId = this.filtersForm.controls.workspaceId.value;
    if (selectedWorkspaceId === 'all') {
      return 'Todos los workspaces';
    }

    return this.favoriteWorkspaces.find(workspace => String(workspace.id) === selectedWorkspaceId)?.name ?? 'Workspace filtrado';
  }

  goToBoards(): void {
    void this.router.navigate(['/dashboard/madter/boards']);
  }

  goToDashboard(): void {
    void this.router.navigate(['/dashboard/madter/dashboard']);
  }

  openBoardPreview(boardId: number): void {
    void this.router.navigate(['/dashboard/madter/board', boardId]);
  }

  toggleFavorite(boardId: number): void {
    this.favoritesService.toggleBoard(boardId);
    this.favoriteBoardIds = this.favoritesService.getSnapshot();
    this.stats = this.buildStats(this.favoriteBoards, this.boards);
    this.uiMessage = this.favoriteBoardIds.includes(boardId)
      ? 'Tablero agregado a favoritos.'
      : 'Tablero removido de favoritos.';
  }

  clearFilters(): void {
    this.filtersForm.reset({
      query: '',
      workspaceId: 'all'
    });
    this.uiMessage = 'Filtros limpios. Estas viendo todos tus favoritos otra vez.';
  }

  trackBoard(_: number, board: BoardResponse): number {
    return board.id;
  }

  private loadFavoritesOverview(): void {
    forkJoin({
      user: this.authService.me(),
      boards: this.boardService.listMine()
    }).subscribe({
      next: ({ user, boards }) => {
        this.user = user;
        this.boards = this.sortBoards(boards);
        this.favoriteBoardIds = this.favoritesService.getSnapshot();
        this.stats = this.buildStats(this.favoriteBoards, this.boards);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        void this.router.navigate(['/dashboard/madter/dashboard']);
      }
    });
  }

  private buildStats(favoriteBoards: BoardResponse[], allBoards: BoardResponse[]): FavoriteStat[] {
    const favoriteWorkspaces = new Set(favoriteBoards.map(board => board.workspaceId)).size;
    const latestFavorite = favoriteBoards[0];

    return [
      {
        label: 'Favoritos',
        value: String(favoriteBoards.length),
        caption: favoriteBoards.length
          ? 'Tus tableros mas importantes estan a un clic de distancia.'
          : 'Marca tableros como favoritos para traerlos aqui.',
        icon: 'star'
      },
      {
        label: 'Workspaces',
        value: String(favoriteWorkspaces),
        caption: favoriteWorkspaces
          ? `${favoriteWorkspaces} workspaces tienen boards favoritos.`
          : 'Todavia no tienes favoritos repartidos en tus espacios.',
        icon: 'workspaces'
      },
      {
        label: 'Ultimo favorito',
        value: latestFavorite ? this.shortDateFormatter.format(new Date(latestFavorite.updatedAt)) : '--',
        caption: latestFavorite
          ? `${latestFavorite.name} es el favorito con actividad mas reciente.`
          : 'Cuando marques favoritos, el ultimo movimiento aparecera aqui.',
        icon: 'schedule'
      },
      {
        label: 'Sin destacar',
        value: String(Math.max(allBoards.length - favoriteBoards.length, 0)),
        caption: allBoards.length
          ? 'Todavia puedes destacar mas boards desde la vista general.'
          : 'Primero crea algunos tableros para empezar a destacar los importantes.',
        icon: 'dashboard_customize'
      }
    ];
  }

  private sortBoards(boards: BoardResponse[]): BoardResponse[] {
    return [...boards].sort((left, right) => (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    ));
  }
}
