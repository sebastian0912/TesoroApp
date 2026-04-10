import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { EMPTY, Observable, catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthResponse, AuthService } from '../../../core/services/auth/auth.service';
import { BoardListResponse, BoardListService } from '../../../core/services/board-list/board-list.service';
import { BoardResponse, BoardService } from '../../../core/services/board/board.service';
import { LabelResponse, LabelService } from '../../../core/services/label/label.service';
import { UserGroup, UserGroupService } from '../../../core/services/user-group/user-group.service';
import { UserLookupResponse, UserService } from '../../../core/services/user/user.service';
import {
  CardCommentResponse,
  CardDetailResponse,
  CardStatus,
  CardResponse,
  CardService,
  ChecklistItemResponse,
  UploadAttachment
} from '../../../core/services/card/card.service';
import { FavoritesService } from '../../../core/services/favorites/favorites.service';
import { CardDetailModalComponent } from '../../components/card-detail-modal/card-detail-modal.component';
import { CardModalComponent } from '../../components/card-modal/card-modal.component';
import { CARD_PRIORITY_OPTIONS, CARD_STATUS_OPTIONS, WORK_LABEL_SUGGESTIONS } from '../../config/board.config';
import { BoardLabelChoice, CardPriorityOption, CardStatusOption, WorkLabelSuggestion } from '../../models/boards.models';
import { UploadService } from '../../../core/services/upload/upload.service';

@Component({
  standalone: true,
  selector: 'app-board-preview-page',
  imports: [
    CommonModule,
    DragDropModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    CardDetailModalComponent,
    CardModalComponent
  ],
  templateUrl: './board-preview-page.component.html',
  styleUrl: './board-preview-page.component.css'
})
export class BoardPreviewPageComponent {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private boardService = inject(BoardService);
  private boardListService = inject(BoardListService);
  private cardService = inject(CardService);
  private labelService = inject(LabelService);
  private userService = inject(UserService);
  private userGroupService = inject(UserGroupService);
  private favoritesService = inject(FavoritesService);
  private uploadService = inject(UploadService);

  loading = true;
  notFound = false;
  user: AuthResponse | null = null;
  board: BoardResponse | null = null;
  boardLists: BoardListResponse[] = [];
  cardsByListId: Record<number, CardResponse[]> = {};
  uiMessage = 'Tablero listo para trabajar.';
  priorityOptions: CardPriorityOption[] = CARD_PRIORITY_OPTIONS;
  statusOptions: CardStatusOption[] = CARD_STATUS_OPTIONS;
  suggestedLabels: WorkLabelSuggestion[] = WORK_LABEL_SUGGESTIONS;
  isListComposerOpen = false;
  listSaving = false;
  listError = '';
  editingListId: number | null = null;
  editingListSaving = false;
  editingListError = '';
  deletingListId: number | null = null;
  selectedListForCard: BoardListResponse | null = null;
  editingCard: CardResponse | null = null;
  isCardModalOpen = false;
  cardSaving = false;
  cardError = '';
  deletingCardId: number | null = null;
  movingCardId: number | null = null;
  movingListId: number | null = null;
  isCardDetailOpen = false;
  cardDetailLoading = false;
  cardDetailError = '';
  selectedCardDetail: CardDetailResponse | null = null;
  assignmentSaving = false;
  commentSaving = false;
  checklistSaving = false;
  allBoardLabels: LabelResponse[] = [];
  labelsSaving = false;
  selectedCardLabels: BoardLabelChoice[] = [];
  assigneeOptions: UserLookupResponse[] = [];
  assigneeLoading = false;
  selectedAssignee: UserLookupResponse | null = null;
  userGroups: UserGroup[] = [];
  selectedGroup: UserGroup | null = null;
  pendingUploads: UploadAttachment[] = [];
  uploadingFile = false;

  listForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]]
  });

  editListForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]]
  });

  cardForm = this.fb.group({
    title: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]),
    description: this.fb.nonNullable.control('', [Validators.maxLength(600)]),
    status: this.fb.nonNullable.control<CardStatus>('TODO', [Validators.required]),
    priority: this.fb.nonNullable.control('MEDIUM', [Validators.required]),
    dueDate: this.fb.control<Date | null>(null),
    dueTime: this.fb.nonNullable.control('09:00', [Validators.required]),
    assigneeGroupId: this.fb.control<number | null>(null)
  });

  assigneeControl = new FormControl<UserLookupResponse | string | null>(null);

  commentForm = this.fb.nonNullable.group({
    body: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(600)]]
  });

  checklistForm = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]]
  });

  constructor() {
    this.bindAssigneeSearch();
    this.loadBoardPreview();
  }

  get userInitials(): string {
    if (!this.user?.username) {
      return 'M';
    }

    return this.user.username.slice(0, 2).toUpperCase();
  }

  get boardListCount(): string {
    return String(this.boardLists.length);
  }

  get totalCardCount(): string {
    return String(this.boardLists.reduce((total, boardList) => (
      total + this.cardsForList(boardList.id).length
    ), 0));
  }

  get connectedDropListIds(): string[] {
    return this.boardLists.map(boardList => this.dropListId(boardList.id));
  }

  get canManageContent(): boolean {
    return this.board?.canManageContent ?? false;
  }

  get firstBoardList(): BoardListResponse | null {
    return this.boardLists[0] ?? null;
  }

  get hasAnyCards(): boolean {
    return this.boardLists.some(boardList => this.cardsForList(boardList.id).length > 0);
  }

  get availableCardLabelChoices(): BoardLabelChoice[] {
    return this.allBoardLabels.map(label => this.toBoardLabelChoice(label));
  }

  goToBoards(): void {
    void this.router.navigate(['/dashboard/madter/boards']);
  }

  goToDashboard(): void {
    void this.router.navigate(['/dashboard/madter/dashboard']);
  }

  goToWorkspaceManagement(): void {
    if (!this.board?.workspaceId) {
      return;
    }
    void this.router.navigate(['/dashboard/madter/workspaces', this.board.workspaceId]);
  }

  showComingSoon(area: string): void {
    this.uiMessage = `El módulo de ${area} estará habilitado próximamente.`;
  }

  openSuggestedTaskFlow(): void {
    const firstBoardList = this.firstBoardList;
    if (!firstBoardList) {
      this.openListComposer();
      this.uiMessage = 'Primero crea una lista. Esa lista sera una columna del tablero, y dentro de ella podras crear tareas.';
      return;
    }

    this.openCreateCardModal(firstBoardList);
    this.uiMessage = `Vas a crear una tarea dentro de la lista "${firstBoardList.name}".`;
  }

  isBoardFavorite(boardId: number): boolean {
    return this.favoritesService.isBoardFavorite(boardId);
  }

  toggleFavorite(board: BoardResponse): void {
    this.favoritesService.toggleBoard(board.id);
    this.uiMessage = this.isBoardFavorite(board.id)
      ? `Tablero "${board.name}" agregado a favoritos.`
      : `Tablero "${board.name}" removido de favoritos.`;
  }

  openListComposer(): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('crear listas');
      return;
    }

    this.listError = '';
    this.listForm.reset({ name: '' });
    this.isListComposerOpen = true;
  }

  closeListComposer(): void {
    if (this.listSaving) {
      return;
    }

    this.isListComposerOpen = false;
    this.listError = '';
    this.listForm.reset({ name: '' });
  }

  submitList(): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('crear listas');
      return;
    }

    if (!this.board || this.listForm.invalid || this.listSaving) {
      this.listForm.markAllAsTouched();
      return;
    }

    this.listSaving = true;
    this.listError = '';

    const payload = this.listForm.getRawValue();
    this.authService.initCsrf().pipe(
      switchMap(() => this.boardListService.create(this.board!.id, payload))
    ).subscribe({
      next: boardList => {
        this.boardLists = this.sortLists([...this.boardLists, boardList]);
        this.uiMessage = `Lista "${boardList.name}" creada dentro del tablero "${this.board?.name}".`;
        this.listSaving = false;
        this.closeListComposer();
      },
      error: err => {
        this.listSaving = false;
        this.listError = err?.error?.message ?? 'No pudimos crear la lista. Intenta otra vez.';
      }
    });
  }

  startEditingList(boardList: BoardListResponse): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage(`editar la lista "${boardList.name}"`);
      return;
    }

    this.editingListId = boardList.id;
    this.editingListError = '';
    this.editListForm.reset({
      name: boardList.name
    });
  }

  cancelEditingList(): void {
    if (this.editingListSaving) {
      return;
    }

    this.editingListId = null;
    this.editingListError = '';
    this.editListForm.reset({ name: '' });
  }

  submitListEdition(boardListId: number): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('editar listas');
      return;
    }

    if (this.editListForm.invalid || this.editingListSaving) {
      this.editListForm.markAllAsTouched();
      return;
    }

    this.editingListSaving = true;
    this.editingListError = '';

    const payload = this.editListForm.getRawValue();
    this.authService.initCsrf().pipe(
      switchMap(() => this.boardListService.update(boardListId, payload))
    ).subscribe({
      next: updatedList => {
        this.boardLists = this.sortLists(this.boardLists.map(boardList => (
          boardList.id === updatedList.id ? updatedList : boardList
        )));
        this.uiMessage = `Lista "${updatedList.name}" actualizada correctamente.`;
        this.editingListSaving = false;
        this.cancelEditingList();
      },
      error: err => {
        this.editingListSaving = false;
        this.editingListError = err?.error?.message ?? 'No pudimos actualizar la lista. Intenta otra vez.';
      }
    });
  }

  deleteList(boardList: BoardListResponse): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage(`eliminar la lista "${boardList.name}"`);
      return;
    }

    if (this.deletingListId) {
      return;
    }

    if (!confirm(`Vas a eliminar la lista "${boardList.name}". Quieres continuar?`)) {
      return;
    }

    this.deletingListId = boardList.id;
    this.authService.initCsrf().pipe(
      switchMap(() => this.boardListService.delete(boardList.id))
    ).subscribe({
      next: () => {
        this.boardLists = this.boardLists.filter(item => item.id !== boardList.id);
        delete this.cardsByListId[boardList.id];
        if (this.editingListId === boardList.id) {
          this.cancelEditingList();
        }
        if (this.selectedListForCard?.id === boardList.id) {
          this.closeCardModal();
        }
        this.uiMessage = `Lista "${boardList.name}" eliminada correctamente.`;
        this.deletingListId = null;
      },
      error: err => {
        this.deletingListId = null;
        this.uiMessage = err?.error?.message ?? 'No pudimos eliminar la lista. Intenta otra vez.';
      }
    });
  }

  cardsForList(listId: number): CardResponse[] {
    return this.cardsByListId[listId] ?? [];
  }

  openCreateCardModal(boardList: BoardListResponse): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage(`crear tareas en "${boardList.name}"`);
      return;
    }

    this.selectedListForCard = boardList;
    this.editingCard = null;
    this.cardError = '';
    this.cardForm.reset({
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
      dueTime: '09:00'
    });
    this.selectedCardLabels = [];
    this.selectedAssignee = null;
    this.selectedGroup = null;
    this.assigneeOptions = [];
    this.assigneeControl.setValue('', { emitEvent: true });
    this.isCardModalOpen = true;
  }

  openEditCardModal(boardList: BoardListResponse, card: CardResponse): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage(`editar la tarea "${card.title}"`);
      return;
    }

    this.selectedListForCard = boardList;
    this.editingCard = card;
    this.cardError = '';
    this.cardForm.reset({
      title: card.title,
      description: card.description ?? '',
      status: card.status,
      priority: card.priority,
      dueDate: this.toDueDateValue(card.dueAt),
      dueTime: this.toDueTimeValue(card.dueAt)
    });
    this.selectedAssignee = card.assignee
      ? {
          id: card.assignee.id,
          username: card.assignee.username,
          email: card.assignee.email,
          fullName: card.assignee.fullName ?? card.assignee.username
        }
      : null;
    this.selectedGroup = card.assigneeGroup
      ? {
          id: card.assigneeGroup.id,
          uuid: card.assigneeGroup.uuid,
          name: card.assigneeGroup.name,
          description: null,
          createdAt: '',
          updatedAt: ''
        }
      : null;
    this.selectedCardLabels = (card.labels ?? []).map(label => this.toBoardLabelChoice(label));
    this.assigneeOptions = this.selectedAssignee ? [this.selectedAssignee] : [];
    this.assigneeControl.setValue(this.selectedAssignee, { emitEvent: true });
    this.cardForm.patchValue({ assigneeGroupId: this.selectedGroup?.id ?? null });
    this.isCardModalOpen = true;
  }

  closeCardModal(): void {
    if (this.cardSaving) {
      return;
    }

    this.isCardModalOpen = false;
    this.selectedListForCard = null;
    this.editingCard = null;
    this.cardError = '';
    this.cardForm.reset({
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
      dueTime: '09:00'
    });
    this.selectedCardLabels = [];
    this.selectedAssignee = null;
    this.assigneeOptions = [];
    this.assigneeControl.setValue('', { emitEvent: false });
  }

  openCardDetail(card: CardResponse): void {
    this.isCardDetailOpen = true;
    this.cardDetailLoading = true;
    this.cardDetailError = '';
    this.selectedCardDetail = null;
    this.commentForm.reset({ body: '' });
    this.checklistForm.reset({ content: '' });
    this.refreshCardDetail(card.id);
  }

  closeCardDetail(): void {
    if (this.assignmentSaving || this.commentSaving || this.checklistSaving || this.cardDetailLoading) {
      return;
    }

    this.isCardDetailOpen = false;
    this.cardDetailLoading = false;
    this.cardDetailError = '';
    this.selectedCardDetail = null;
    this.pendingUploads = [];
    this.commentForm.reset({ body: '' });
    this.checklistForm.reset({ content: '' });
  }

  openEditFromDetail(): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('editar esta tarea');
      return;
    }

    if (!this.selectedCardDetail) {
      return;
    }

    const boardList = this.boardLists.find(item => item.id === this.selectedCardDetail!.boardListId);
    if (!boardList) {
      return;
    }

    const card = this.cardsForList(boardList.id).find(item => item.id === this.selectedCardDetail!.id) ?? this.selectedCardDetail;
    this.closeCardDetail();
    this.openEditCardModal(boardList, card);
  }

  submitCard(): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('guardar tareas');
      return;
    }

    if (!this.selectedListForCard || this.cardForm.invalid || this.cardSaving) {
      this.cardForm.markAllAsTouched();
      return;
    }

    this.cardSaving = true;
    this.cardError = '';

    const rawValue = this.cardForm.getRawValue();
    const payload = {
      title: rawValue.title,
      description: rawValue.description ?? '',
      status: rawValue.status,
      priority: rawValue.priority,
      dueAt: this.buildDueAtPayload(rawValue.dueDate, rawValue.dueTime),
      assigneeId: this.selectedAssignee?.id ?? null,
      assigneeGroupId: rawValue.assigneeGroupId
    };

    const request$ = this.editingCard
      ? this.cardService.update(this.editingCard.id, payload)
      : this.cardService.create(this.selectedListForCard.id, payload);

    this.authService.initCsrf().pipe(
      switchMap(() => request$),
      switchMap(card => this.authService.initCsrf().pipe(
        map(() => card)
      )),
      switchMap(card => this.syncSelectedLabelsForCard(card).pipe(
        map(labels => ({ card, labels, labelSyncWarning: '' })),
        catchError(err => of({
          card,
          labels: card.labels ?? [],
          labelSyncWarning: err?.error?.message ?? 'La tarea se guardo, pero no pudimos aplicar sus etiquetas.'
        }))
      ))
    ).subscribe({
      next: ({ card, labels, labelSyncWarning }) => {
        const listId = card.boardListId;
        const currentCards = this.cardsByListId[listId] ?? [];
        const hydratedCard: CardResponse = {
          ...card,
          labels
        };
        const nextCards = this.editingCard
          ? currentCards.map(existingCard => existingCard.id === hydratedCard.id ? hydratedCard : existingCard)
          : [...currentCards, hydratedCard];

        this.cardsByListId = {
          ...this.cardsByListId,
          [listId]: this.sortCards(nextCards)
        };

        this.uiMessage = this.editingCard
          ? `Tarea "${card.title}" actualizada dentro de ${this.selectedListForCard?.name}.`
          : `Tarea "${card.title}" creada dentro de ${this.selectedListForCard?.name}.`;

        if (labelSyncWarning) {
          this.uiMessage = `${this.uiMessage} ${labelSyncWarning}`;
        }

        if (this.selectedCardDetail?.id === card.id) {
          this.selectedCardDetail = {
            ...this.selectedCardDetail,
            ...hydratedCard,
            labels
          };
        }

        this.cardSaving = false;
        this.closeCardModal();
      },
      error: err => {
        this.cardSaving = false;
        this.cardError = err?.error?.message ?? 'No pudimos guardar la tarea. Intenta otra vez.';
      }
    });
  }

  handleAssigneeSelected(option: UserLookupResponse): void {
    this.selectedAssignee = option;
    this.assigneeOptions = [option];
    this.assigneeControl.setValue(option, { emitEvent: false });
  }

  handleCardLabelAdded(label: BoardLabelChoice): void {
    const normalizedName = this.normalizeLabelName(label.name);
    if (!normalizedName) {
      return;
    }

    const existingBoardLabel = this.findBoardLabelByName(label.name);
    const nextLabel: BoardLabelChoice = existingBoardLabel
      ? this.toBoardLabelChoice(existingBoardLabel)
      : {
          ...label,
          name: this.formatLabelName(label.name)
        };

    if (this.selectedCardLabels.some(item => this.normalizeLabelName(item.name) === normalizedName)) {
      return;
    }

    this.selectedCardLabels = [...this.selectedCardLabels, nextLabel]
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  handleCardLabelRemoved(labelName: string): void {
    const normalizedName = this.normalizeLabelName(labelName);
    this.selectedCardLabels = this.selectedCardLabels.filter(label => (
      this.normalizeLabelName(label.name) !== normalizedName
    ));
  }

  clearCardAssignee(): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('actualizar el responsable');
      return;
    }

    this.selectedAssignee = null;
    this.assigneeOptions = [];
    this.assigneeControl.setValue('', { emitEvent: false });
  }

  assignSelectedCardToMe(): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('asignarte tareas');
      return;
    }

    if (!this.selectedCardDetail || !this.user || this.assignmentSaving) {
      return;
    }

    this.assignmentSaving = true;
    const payload = { 
      assigneeId: this.user!.id,
      assigneeGroupId: this.selectedCardDetail?.assigneeGroup?.id ?? null
    };
    this.authService.initCsrf().pipe(
      switchMap(() => this.cardService.updateAssignment(this.selectedCardDetail!.id, payload))
    ).subscribe({
      next: detail => {
        this.selectedCardDetail = {
          ...detail,
          comments: this.sortComments(detail.comments),
          checklistItems: this.sortChecklistItems(detail.checklistItems)
        };
        this.syncCardSummary({
          id: detail.id,
          boardListId: detail.boardListId,
          assignee: detail.assignee
        });
        this.assignmentSaving = false;
        this.uiMessage = `Tarea "${detail.title}" asignada a ${detail.assignee?.fullName ?? detail.assignee?.username}.`;
      },
      error: err => {
        this.assignmentSaving = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos asignar la tarea.';
      }
    });
  }

  unassignSelectedCard(): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('actualizar el responsable');
      return;
    }

    if (!this.selectedCardDetail || this.assignmentSaving) {
      return;
    }

    this.assignmentSaving = true;
    const payload = { 
      assigneeId: null,
      assigneeGroupId: this.selectedCardDetail?.assigneeGroup?.id ?? null
    };
    this.authService.initCsrf().pipe(
      switchMap(() => this.cardService.updateAssignment(this.selectedCardDetail!.id, payload))
    ).subscribe({
      next: detail => {
        this.selectedCardDetail = {
          ...detail,
          comments: this.sortComments(detail.comments),
          checklistItems: this.sortChecklistItems(detail.checklistItems)
        };
        this.syncCardSummary({
          id: detail.id,
          boardListId: detail.boardListId,
          assignee: detail.assignee
        });
        this.assignmentSaving = false;
        this.uiMessage = `Tarea "${detail.title}" quedo sin responsable.`;
      },
      error: err => {
        this.assignmentSaving = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos actualizar el responsable.';
      }
    });
  }

  submitCardComment(): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('comentar tareas');
      return;
    }

    if (!this.selectedCardDetail || this.commentForm.invalid || this.commentSaving) {
      this.commentForm.markAllAsTouched();
      return;
    }

    this.commentSaving = true;
    const payload = {
      ...this.commentForm.getRawValue(),
      uploadUuids: this.pendingUploads.map(u => u.uuid)
    };
    this.authService.initCsrf().pipe(
      switchMap(() => this.cardService.createComment(this.selectedCardDetail!.id, payload))
    ).subscribe({
      next: comment => {
        if (this.selectedCardDetail) {
          this.selectedCardDetail = {
            ...this.selectedCardDetail,
            comments: this.sortComments([...this.selectedCardDetail.comments, comment])
          };
        }
        this.commentSaving = false;
        this.pendingUploads = [];
        this.commentForm.reset({ body: '' });
        this.uiMessage = 'Comentario agregado correctamente a la tarea.';
      },
      error: err => {
        this.commentSaving = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos publicar el comentario.';
      }
    });
  }

  handleFileSelected(file: File): void {
    if (this.pendingUploads.length >= 5) {
      this.uiMessage = 'Solo puedes adjuntar hasta 5 archivos por comentario.';
      return;
    }
    this.uploadingFile = true;
    this.uploadService.upload(file).subscribe({
      next: response => {
        this.pendingUploads = [...this.pendingUploads, response as UploadAttachment];
        this.uploadingFile = false;
      },
      error: err => {
        this.uploadingFile = false;
        this.uiMessage = err?.error?.message ?? 'No pudimos subir el archivo. Verifica tipo y tamaño.';
      }
    });
  }

  removePendingUpload(uuid: string): void {
    this.uploadService.delete(uuid).subscribe();
    this.pendingUploads = this.pendingUploads.filter(u => u.uuid !== uuid);
  }

  deleteCardComment(commentId: number): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('eliminar comentarios');
      return;
    }

    if (!this.selectedCardDetail || this.commentSaving) {
      return;
    }

    if (!confirm('Vas a eliminar este comentario. Quieres continuar?')) {
      return;
    }

    this.commentSaving = true;
    this.authService.initCsrf().pipe(
      switchMap(() => this.cardService.deleteComment(commentId))
    ).subscribe({
      next: () => {
        if (this.selectedCardDetail) {
          this.selectedCardDetail = {
            ...this.selectedCardDetail,
            comments: this.selectedCardDetail.comments.filter(comment => comment.id !== commentId)
          };
        }
        this.commentSaving = false;
        this.uiMessage = 'Comentario eliminado correctamente.';
      },
      error: err => {
        this.commentSaving = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos eliminar el comentario.';
      }
    });
  }

  submitChecklistItem(): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('actualizar el checklist');
      return;
    }

    if (!this.selectedCardDetail || this.checklistForm.invalid || this.checklistSaving) {
      this.checklistForm.markAllAsTouched();
      return;
    }

    this.checklistSaving = true;
    const payload = this.checklistForm.getRawValue();
    this.authService.initCsrf().pipe(
      switchMap(() => this.cardService.createChecklistItem(this.selectedCardDetail!.id, payload))
    ).subscribe({
      next: item => {
        if (this.selectedCardDetail) {
          this.selectedCardDetail = {
            ...this.selectedCardDetail,
            checklistItems: this.sortChecklistItems([...this.selectedCardDetail.checklistItems, item])
          };
        }
        this.checklistSaving = false;
        this.checklistForm.reset({ content: '' });
        this.uiMessage = 'Checklist actualizado con un nuevo item.';
      },
      error: err => {
        this.checklistSaving = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos agregar el item.';
      }
    });
  }

  toggleChecklistItem(update: { itemId: number; completed: boolean; content: string }): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('actualizar el checklist');
      return;
    }

    if (!this.selectedCardDetail || this.checklistSaving) {
      return;
    }

    this.checklistSaving = true;
    this.authService.initCsrf().pipe(
      switchMap(() => this.cardService.updateChecklistItem(update.itemId, {
        content: update.content,
        completed: update.completed
      }))
    ).subscribe({
      next: item => {
        if (this.selectedCardDetail) {
          this.selectedCardDetail = {
            ...this.selectedCardDetail,
            checklistItems: this.sortChecklistItems(this.selectedCardDetail.checklistItems.map(existingItem => (
              existingItem.id === item.id ? item : existingItem
            )))
          };
        }
        this.checklistSaving = false;
        this.uiMessage = item.completed
          ? 'Checklist item marcado como completado.'
          : 'Checklist item marcado como pendiente.';
      },
      error: err => {
        this.checklistSaving = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos actualizar el checklist.';
        if (this.selectedCardDetail) {
          this.refreshCardDetail(this.selectedCardDetail.id, false);
        }
      }
    });
  }

  deleteChecklistItem(itemId: number): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('eliminar items del checklist');
      return;
    }

    if (!this.selectedCardDetail || this.checklistSaving) {
      return;
    }

    if (!confirm('Vas a eliminar este item del checklist. Quieres continuar?')) {
      return;
    }

    this.checklistSaving = true;
    this.authService.initCsrf().pipe(
      switchMap(() => this.cardService.deleteChecklistItem(itemId))
    ).subscribe({
      next: () => {
        if (this.selectedCardDetail) {
          this.selectedCardDetail = {
            ...this.selectedCardDetail,
            checklistItems: this.selectedCardDetail.checklistItems.filter(item => item.id !== itemId)
          };
        }
        this.checklistSaving = false;
        this.uiMessage = 'Item del checklist eliminado correctamente.';
      },
      error: err => {
        this.checklistSaving = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos eliminar el item del checklist.';
      }
    });
  }

  deleteCard(boardList: BoardListResponse, card: CardResponse): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage(`eliminar la tarea "${card.title}"`);
      return;
    }

    if (this.deletingCardId) {
      return;
    }

    if (!confirm(`Vas a eliminar la tarea "${card.title}". Quieres continuar?`)) {
      return;
    }

    this.deletingCardId = card.id;
    this.authService.initCsrf().pipe(
      switchMap(() => this.cardService.delete(card.id))
    ).subscribe({
      next: () => {
        this.cardsByListId = {
          ...this.cardsByListId,
          [boardList.id]: this.cardsForList(boardList.id).filter(existingCard => existingCard.id !== card.id)
        };
        if (this.editingCard?.id === card.id) {
          this.closeCardModal();
        }
        if (this.selectedCardDetail?.id === card.id) {
          this.closeCardDetail();
        }
        this.uiMessage = `Tarea "${card.title}" eliminada de ${boardList.name}.`;
        this.deletingCardId = null;
      },
      error: err => {
        this.deletingCardId = null;
        this.uiMessage = err?.error?.message ?? 'No pudimos eliminar la tarea. Intenta otra vez.';
      }
    });
  }

  dropCard(event: CdkDragDrop<CardResponse[]>, targetList: BoardListResponse): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('mover tareas');
      return;
    }

    const movedCard = event.item.data;
    if (!movedCard || this.movingCardId) {
      return;
    }

    const sourceListId = movedCard.boardListId;
    const isSameList = sourceListId === targetList.id;
    if (isSameList && event.previousIndex === event.currentIndex) {
      return;
    }

    const originalSourceCards = [...this.cardsForList(sourceListId)];
    const originalTargetCards = isSameList ? null : [...this.cardsForList(targetList.id)];
    const nextSourceCards = [...originalSourceCards];
    const nextTargetCards = isSameList ? nextSourceCards : [...(originalTargetCards ?? [])];

    if (isSameList) {
      moveItemInArray(nextSourceCards, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(nextSourceCards, nextTargetCards, event.previousIndex, event.currentIndex);
      const droppedCard = nextTargetCards[event.currentIndex];
      if (droppedCard) {
        nextTargetCards[event.currentIndex] = {
          ...droppedCard,
          boardListId: targetList.id
        };
      }
    }

    this.cardsByListId = isSameList
      ? {
          ...this.cardsByListId,
          [sourceListId]: nextSourceCards
        }
      : {
          ...this.cardsByListId,
          [sourceListId]: nextSourceCards,
          [targetList.id]: nextTargetCards
        };

    this.movingCardId = movedCard.id;
    this.uiMessage = isSameList
      ? `Reordenando "${movedCard.title}" dentro de ${this.getBoardListName(targetList.id)}.`
      : `Moviendo "${movedCard.title}" de ${this.getBoardListName(sourceListId)} a ${this.getBoardListName(targetList.id)}.`;

    this.authService.initCsrf().pipe(
      switchMap(() => this.cardService.move(movedCard.id, {
        targetListId: targetList.id,
        targetIndex: event.currentIndex
      }))
    ).subscribe({
      next: response => {
        this.cardsByListId = {
          ...this.cardsByListId,
          [response.sourceListId]: this.sortCards(response.sourceCards),
          [response.targetListId]: this.sortCards(response.targetCards)
        };
        const selectedCardDetail = this.selectedCardDetail;
        if (selectedCardDetail && selectedCardDetail.id === movedCard.id) {
          this.selectedCardDetail = {
            ...selectedCardDetail,
            boardListId: response.targetListId
          };
        }
        this.movingCardId = null;
        this.uiMessage = response.sourceListId === response.targetListId
          ? `Card "${movedCard.title}" reordenada correctamente dentro de ${this.getBoardListName(response.targetListId)}.`
          : `Card "${movedCard.title}" movida correctamente a ${this.getBoardListName(response.targetListId)}.`;
      },
      error: err => {
        this.cardsByListId = isSameList
          ? {
              ...this.cardsByListId,
              [sourceListId]: originalSourceCards
            }
          : {
              ...this.cardsByListId,
              [sourceListId]: originalSourceCards,
              [targetList.id]: originalTargetCards ?? []
            };
        this.movingCardId = null;
        this.uiMessage = err?.error?.message ?? 'No pudimos mover la tarea. Intenta otra vez.';
      }
    });
  }

  dropList(event: CdkDragDrop<BoardListResponse[]>): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('reordenar columnas');
      return;
    }

    if (event.previousIndex === event.currentIndex || this.movingListId) {
      return;
    }

    const originalLists = [...this.boardLists];
    const nextLists = [...originalLists];
    moveItemInArray(nextLists, event.previousIndex, event.currentIndex);

    // Optimistic update
    this.boardLists = nextLists;
    const movedList = nextLists[event.currentIndex];
    this.movingListId = movedList.id;

    this.uiMessage = `Reordenando columna "${movedList.name}"...`;

    this.authService.initCsrf().pipe(
      switchMap(() => this.boardListService.move(movedList.id, {
        targetIndex: event.currentIndex
      }))
    ).subscribe({
      next: updatedLists => {
        this.boardLists = this.sortLists(updatedLists);
        this.movingListId = null;
        this.uiMessage = `Columna "${movedList.name}" reordenada con éxito.`;
      },
      error: err => {
        this.boardLists = originalLists;
        this.movingListId = null;
        this.uiMessage = err?.error?.message ?? 'No pudimos reordenar las columnas. Intenta otra vez.';
      }
    });
  }

  trackList(_: number, boardList: BoardListResponse): number {
    return boardList.id;
  }

  trackCard(_: number, card: CardResponse): number {
    return card.id;
  }

  priorityLabel(priority: CardResponse['priority']): string {
    return this.priorityOptions.find(option => option.value === priority)?.label ?? priority;
  }

  priorityTone(priority: CardResponse['priority']): string {
    return priority.toLowerCase();
  }

  statusLabel(status: CardResponse['status'] | CardDetailResponse['status']): string {
    return this.statusOptions.find(option => option.value === status)?.label ?? status;
  }

  statusTone(status: CardResponse['status'] | CardDetailResponse['status']): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  dropListId(listId: number): string {
    return `board-list-${listId}`;
  }

  private loadBoardPreview(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        const boardId = Number(params.get('id'));

        if (!Number.isInteger(boardId) || boardId <= 0) {
          this.notFound = true;
          this.loading = false;
          return EMPTY;
        }

        return forkJoin({
          user: this.authService.me(),
          board: this.boardService.getById(boardId),
          lists: this.boardListService.listByBoard(boardId),
          labels: this.labelService.listByBoard(boardId)
        }).pipe(
          switchMap(result => {
            const lists = this.sortLists(result.lists);
            this.allBoardLabels = this.sortBoardLabels(result.labels);

            return this.userGroupService.listByWorkspace(result.board.workspaceId).pipe(
              catchError(() => of([] as UserGroup[])),
              switchMap(groups => {
                if (!lists.length) {
                  return of({
                    user: result.user,
                    board: result.board,
                    lists,
                    cardsByListId: {} as Record<number, CardResponse[]>,
                    groups
                  });
                }

                const cardRequests: Record<number, Observable<CardResponse[]>> = {};

                for (const boardList of lists) {
                  cardRequests[boardList.id] = this.cardService.listByList(boardList.id);
                }

                return forkJoin(cardRequests).pipe(
                  map(cardsByListId => ({
                    user: result.user,
                    board: result.board,
                    lists,
                    cardsByListId: this.sortCardsByList(cardsByListId),
                    groups
                  }))
                );
              })
            );
          })
        );
      })
    ).subscribe({
      next: result => {
        this.user = result.user;
        this.board = result.board;
        this.boardLists = result.lists;
        this.cardsByListId = result.cardsByListId;
        this.userGroups = result.groups ?? [];
        this.loading = false;
      },
      error: err => {
        if (err?.status === 404) {
          this.notFound = true;
          this.loading = false;
          return;
        }

        this.loading = false;
        void this.router.navigate(['/dashboard/madter/dashboard']);
      }
    });
  }

  private sortLists(boardLists: BoardListResponse[]): BoardListResponse[] {
    return [...boardLists].sort((left, right) => left.position - right.position);
  }

  private sortCards(cards: CardResponse[]): CardResponse[] {
    return [...cards].sort((left, right) => left.position - right.position);
  }

  private sortChecklistItems(items: ChecklistItemResponse[]): ChecklistItemResponse[] {
    return [...items].sort((left, right) => left.position - right.position);
  }

  private sortComments(comments: CardCommentResponse[]): CardCommentResponse[] {
    return [...comments].sort((left, right) => (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    ));
  }

  private sortCardsByList(cardsByListId: Record<number, CardResponse[]>): Record<number, CardResponse[]> {
    return Object.entries(cardsByListId).reduce((accumulator, [listId, cards]) => ({
      ...accumulator,
      [Number(listId)]: this.sortCards(cards)
    }), {} as Record<number, CardResponse[]>);
  }

  private bindAssigneeSearch(): void {
    this.assigneeControl.valueChanges.pipe(
      debounceTime(220),
      distinctUntilChanged(),
      switchMap(value => {
        if (typeof value !== 'string') {
          return of([] as UserLookupResponse[]);
        }

        if (typeof value !== 'string') {
          return of([] as UserLookupResponse[]);
        }

        const query = value.trim();
        if (this.selectedAssignee && query !== this.selectedAssignee.email) {
          this.selectedAssignee = null;
        }

        if (!this.board?.workspaceId || !this.canManageContent) {
          this.assigneeOptions = [];
          this.assigneeLoading = false;
          return of([] as UserLookupResponse[]);
        }

        this.assigneeLoading = true;
        return this.userService.searchAssignableUsers(this.board.workspaceId, query).pipe(
          finalize(() => {
            this.assigneeLoading = false;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(options => {
      this.assigneeOptions = options;
    });
  }

  private syncSelectedLabelsForCard(card: CardResponse): Observable<LabelResponse[]> {
    if (!this.board) {
      return of([]);
    }

    const pendingLabels = this.selectedCardLabels.filter(label => label.id === null);
    const createRequests = pendingLabels.map(label => this.labelService.create(this.board!.id, {
      name: this.formatLabelName(label.name),
      color: label.color
    }));

    return (createRequests.length ? forkJoin(createRequests) : of([] as LabelResponse[])).pipe(
      switchMap(createdLabels => {
        if (createdLabels.length) {
          this.allBoardLabels = this.sortBoardLabels([...this.allBoardLabels, ...createdLabels]);
        }

        const resolvedLabels = this.resolveSelectedLabels(createdLabels);
        this.selectedCardLabels = resolvedLabels.map(label => this.toBoardLabelChoice(label));
        const desiredLabelIds = resolvedLabels.map(label => label.id);
        const existingLabelIds = new Set((this.editingCard?.labels ?? []).map(label => label.id));
        const desiredLabelSet = new Set(desiredLabelIds);

        const operations = [
          ...desiredLabelIds
            .filter(labelId => !existingLabelIds.has(labelId))
            .map(labelId => this.labelService.assignToCard(card.id, labelId)),
          ...[...existingLabelIds]
            .filter(labelId => !desiredLabelSet.has(labelId))
            .map(labelId => this.labelService.unassignFromCard(card.id, labelId))
        ];

        return (operations.length ? forkJoin(operations) : of([])).pipe(
          map(() => resolvedLabels)
        );
      })
    );
  }

  private resolveSelectedLabels(createdLabels: LabelResponse[]): LabelResponse[] {
    const labelCatalog = this.sortBoardLabels([...this.allBoardLabels, ...createdLabels]);
    const selectedLabels: LabelResponse[] = [];

    for (const selectedLabel of this.selectedCardLabels) {
      const existingLabel = labelCatalog.find(label => (
        this.normalizeLabelName(label.name) === this.normalizeLabelName(selectedLabel.name)
      ));

      if (existingLabel) {
        selectedLabels.push(existingLabel);
      }
    }

    return this.sortBoardLabels(selectedLabels);
  }

  private sortBoardLabels(labels: LabelResponse[]): LabelResponse[] {
    return [...labels]
      .sort((left, right) => left.name.localeCompare(right.name, 'es'))
      .filter((label, index, source) => {
        const normalizedName = this.normalizeLabelName(label.name);
        return source.findIndex(item => this.normalizeLabelName(item.name) === normalizedName) === index;
      });
  }

  private toBoardLabelChoice(label: LabelResponse): BoardLabelChoice {
    return {
      id: label.id,
      name: this.formatLabelName(label.name),
      color: label.color,
      source: 'board'
    };
  }

  private findBoardLabelByName(name: string): LabelResponse | null {
    const normalizedName = this.normalizeLabelName(name);
    return this.allBoardLabels.find(label => this.normalizeLabelName(label.name) === normalizedName) ?? null;
  }

  private formatLabelName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  private normalizeLabelName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private buildDueAtPayload(dueDate: Date | null | undefined, dueTime: string | null | undefined): string | null {
    if (!dueDate) {
      return null;
    }

    const normalizedDate = new Date(dueDate);
    const [hours, minutes] = (dueTime ?? '09:00').split(':').map(part => Number(part));
    normalizedDate.setHours(hours || 0, minutes || 0, 0, 0);

    const year = normalizedDate.getFullYear();
    const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
    const day = String(normalizedDate.getDate()).padStart(2, '0');
    const normalizedHours = String(normalizedDate.getHours()).padStart(2, '0');
    const normalizedMinutes = String(normalizedDate.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${normalizedHours}:${normalizedMinutes}:00`;
  }

  private toDueDateValue(value: string | null): Date | null {
    if (!value) {
      return null;
    }

    const normalized = value.length === 16 ? `${value}:00` : value;
    return new Date(normalized);
  }

  private toDueTimeValue(value: string | null): string {
    if (!value) {
      return '09:00';
    }

    return value.slice(11, 16);
  }

  private getBoardListName(listId: number): string {
    return this.boardLists.find(boardList => boardList.id === listId)?.name ?? 'esta lista';
  }

  private syncCardSummary(cardUpdate: Pick<CardResponse, 'id' | 'boardListId'> & Partial<CardResponse>): void {
    const currentCards = this.cardsByListId[cardUpdate.boardListId];
    if (!currentCards) {
      return;
    }

    this.cardsByListId = {
      ...this.cardsByListId,
      [cardUpdate.boardListId]: currentCards.map(card => (
        card.id === cardUpdate.id ? { ...card, ...cardUpdate } : card
      ))
    };
  }

  assigneeLabel(assignee: CardResponse['assignee'] | CardDetailResponse['assignee']): string {
    return assignee?.fullName || assignee?.username || 'Sin responsable';
  }

  assigneeInitials(assignee: CardResponse['assignee'] | CardDetailResponse['assignee']): string {
    const baseLabel = this.assigneeLabel(assignee);
    return baseLabel
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(chunk => chunk[0]?.toUpperCase() ?? '')
      .join('') || 'SR';
  }

  handleLabelAssigned(labelId: number): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('asignar etiquetas');
      return;
    }

    if (!this.selectedCardDetail || this.labelsSaving) return;
    this.labelsSaving = true;
    this.authService.initCsrf().pipe(
      switchMap(() => this.labelService.assignToCard(this.selectedCardDetail!.id, labelId))
    ).subscribe({
      next: () => {
        this.refreshCardDetail(this.selectedCardDetail!.id, false);
        this.labelsSaving = false;
        this.uiMessage = 'Etiqueta asignada con éxito.';
      },
      error: err => {
        this.labelsSaving = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos asignar la etiqueta.';
      }
    });
  }

  handleLabelUnassigned(labelId: number): void {
    if (!this.canManageContent) {
      this.showReadOnlyMessage('quitar etiquetas');
      return;
    }

    if (!this.selectedCardDetail || this.labelsSaving) return;
    this.labelsSaving = true;
    this.authService.initCsrf().pipe(
      switchMap(() => this.labelService.unassignFromCard(this.selectedCardDetail!.id, labelId))
    ).subscribe({
      next: () => {
        this.refreshCardDetail(this.selectedCardDetail!.id, false);
        this.labelsSaving = false;
        this.uiMessage = 'Etiqueta removida con éxito.';
      },
      error: err => {
        this.labelsSaving = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos remover la etiqueta.';
      }
    });
  }

  private refreshCardDetail(cardId: number, showLoading = true): void {
    if (showLoading) this.cardDetailLoading = true;
    this.cardService.getDetail(cardId).subscribe({
      next: detail => {
        this.selectedCardDetail = {
          ...detail,
          comments: this.sortComments(detail.comments),
          checklistItems: this.sortChecklistItems(detail.checklistItems)
        };

        this.syncCardSummary({
          id: detail.id,
          boardListId: detail.boardListId,
          assignee: detail.assignee,
          status: detail.status,
          labels: detail.labels
        });

        this.cardDetailLoading = false;
      },
      error: err => {
        this.cardDetailLoading = false;
        this.cardDetailError = err?.error?.message ?? 'No pudimos cargar el detalle de la tarea.';
      }
    });
  }

  private showReadOnlyMessage(action: string): void {
    const role = this.board?.workspaceRole ?? 'VIEWER';
    this.uiMessage = `Tu rol actual es ${role}. Tienes acceso de solo lectura y no puedes ${action}.`;
  }
}
