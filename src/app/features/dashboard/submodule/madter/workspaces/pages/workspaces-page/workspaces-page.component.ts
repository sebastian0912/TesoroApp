import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth/auth.service';
import { BoardResponse, BoardService } from '../../../core/services/board/board.service';
import { WorkspaceResponse, WorkspaceService } from '../../../core/services/workspace/workspace.service';
import { WorkspaceModalComponent } from '../../components/workspace-modal/workspace-modal.component';
import { WorkspaceViewModel } from '../../models/workspaces.models';

@Component({
  standalone: true,
  selector: 'app-workspaces-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    WorkspaceModalComponent
  ],
  templateUrl: './workspaces-page.component.html',
  styleUrl: './workspaces-page.component.css'
})
export class WorkspacesPageComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);
  private boardService = inject(BoardService);
  private router = inject(Router);

  loading = true;
  workspaceCards: WorkspaceViewModel[] = [];
  uiMessage = 'Aqui concentras todos tus workspaces y el acceso directo a los tableros que viven dentro de cada uno.';
  isWorkspaceModalOpen = false;
  workspaceSaving = false;
  workspaceError = '';
  deletingWorkspaceId: number | null = null;

  filtersForm = this.fb.nonNullable.group({
    query: [''],
    boardState: ['all']
  });

  workspaceForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(280)]]
  });

  constructor() {
    this.loadWorkspaceOverview();
  }

  get filteredWorkspaces(): WorkspaceViewModel[] {
    const query = this.filtersForm.controls.query.value.trim().toLowerCase();
    const selectedBoardState = this.filtersForm.controls.boardState.value;

    if (!query) {
      return this.workspaceCards.filter(workspace => this.matchesBoardState(workspace, selectedBoardState));
    }

    return this.workspaceCards.filter(workspace => {
      if (!this.matchesBoardState(workspace, selectedBoardState)) {
        return false;
      }

      const searchableContent = `${workspace.name} ${workspace.description ?? ''} ${workspace.latestBoardName ?? ''}`.toLowerCase();
      return searchableContent.includes(query);
    });
  }

  get hasActiveFilters(): boolean {
    return this.filtersForm.controls.query.value.trim().length > 0
      || this.filtersForm.controls.boardState.value !== 'all';
  }

  clearFilters(): void {
    this.filtersForm.reset({
      query: '',
      boardState: 'all'
    });
    this.uiMessage = 'Filtros limpios. Estas viendo todos tus workspaces otra vez.';
  }

  goToDashboard(): void {
    void this.router.navigate(['/dashboard/madter/dashboard']);
  }

  goToBoards(workspaceId?: number): void {
    void this.router.navigate(['/dashboard/madter/boards'], {
      queryParams: workspaceId ? { workspaceId } : undefined
    });
  }

  openWorkspaceMembers(workspaceId: number): void {
    void this.router.navigate(['/dashboard/madter/workspaces', workspaceId]);
  }

  openWorkspaceModal(): void {
    this.workspaceError = '';
    this.workspaceForm.reset({
      name: '',
      description: ''
    });
    this.isWorkspaceModalOpen = true;
  }

  closeWorkspaceModal(): void {
    if (this.workspaceSaving) {
      return;
    }

    this.isWorkspaceModalOpen = false;
    this.workspaceError = '';
    this.workspaceForm.reset({
      name: '',
      description: ''
    });
  }

  submitWorkspace(): void {
    if (this.workspaceForm.invalid || this.workspaceSaving) {
      this.workspaceForm.markAllAsTouched();
      return;
    }

    this.workspaceSaving = true;
    this.workspaceError = '';

    const payload = this.workspaceForm.getRawValue();
    this.authService.initCsrf().pipe(
      switchMap(() => this.workspaceService.create(payload))
    ).subscribe({
      next: workspace => {
        const workspaceCard: WorkspaceViewModel = {
          ...workspace,
          boardCount: 0,
          latestBoardName: null
        };
        this.workspaceCards = this.sortWorkspaces([workspaceCard, ...this.workspaceCards]);
        this.uiMessage = `Workspace "${workspace.name}" creado correctamente y listo para recibir tableros.`;
        this.workspaceSaving = false;
        this.closeWorkspaceModal();
      },
      error: err => {
        this.workspaceSaving = false;
        this.workspaceError = err?.error?.message ?? 'No pudimos crear el workspace. Intenta otra vez.';
      }
    });
  }

  trackWorkspace(_: number, workspace: WorkspaceViewModel): number {
    return workspace.id;
  }

  deleteWorkspace(workspace: WorkspaceViewModel): void {
    if (!workspace.canDeleteWorkspace) {
      this.uiMessage = `Tu rol actual no permite eliminar el workspace "${workspace.name}".`;
      return;
    }

    if (this.deletingWorkspaceId) {
      return;
    }

    if (!confirm(`Vas a eliminar el workspace "${workspace.name}" con sus tableros, listas y tareas. Quieres continuar?`)) {
      return;
    }

    this.deletingWorkspaceId = workspace.id;
    this.authService.initCsrf().pipe(
      switchMap(() => this.workspaceService.delete(workspace.id))
    ).subscribe({
      next: () => {
        this.workspaceCards = this.workspaceCards.filter(item => item.id !== workspace.id);
        this.uiMessage = `Workspace "${workspace.name}" eliminado correctamente.`;
        this.deletingWorkspaceId = null;
      },
      error: err => {
        this.deletingWorkspaceId = null;
        this.uiMessage = err?.error?.message ?? 'No pudimos eliminar el workspace. Intenta otra vez.';
      }
    });
  }

  private loadWorkspaceOverview(): void {
    forkJoin({
      csrf: this.authService.initCsrf(),
      workspaces: this.workspaceService.listMine(),
      boards: this.boardService.listMine()
    }).subscribe({
      next: ({ workspaces, boards }) => {
        this.workspaceCards = this.sortWorkspaces(this.buildWorkspaceCards(workspaces, boards));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        void this.router.navigate(['/dashboard/madter/dashboard']);
      }
    });
  }

  private buildWorkspaceCards(workspaces: WorkspaceResponse[], boards: BoardResponse[]): WorkspaceViewModel[] {
    return workspaces.map(workspace => {
      const boardsInWorkspace = boards.filter(board => board.workspaceId === workspace.id);

      return {
        ...workspace,
        boardCount: boardsInWorkspace.length,
        latestBoardName: boardsInWorkspace[0]?.name ?? null
      };
    });
  }

  private sortWorkspaces(workspaces: WorkspaceViewModel[]): WorkspaceViewModel[] {
    return [...workspaces].sort((left, right) => (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    ));
  }

  private matchesBoardState(workspace: WorkspaceViewModel, boardState: string): boolean {
    if (boardState === 'withBoards') {
      return workspace.boardCount > 0;
    }

    if (boardState === 'empty') {
      return workspace.boardCount === 0;
    }

    return true;
  }
}
