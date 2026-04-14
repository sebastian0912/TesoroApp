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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { BoardService } from '../../services/board.service';
import { WorkspaceService } from '../../services/workspace.service';
import { MatderDashboardService } from '../../services/dashboard.service';
import { BoardResponse, BoardListResponse, CardSummary } from '../../models/board.models';
import { WorkspaceMemberResponse } from '../../models/workspace.models';
import { UserGroupResponse, GroupMemberResponse } from '../../models/dashboard.models';
import { CardDetailDialogComponent } from '../../components/card-detail-dialog/card-detail-dialog.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-board-preview-page',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, DragDropModule, MatButtonModule, MatIconModule,
    MatMenuModule, MatChipsModule, MatDialogModule, MatProgressSpinnerModule,
    MatTooltipModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatDividerModule, MatDatepickerModule, MatNativeDateModule,
  ],
  templateUrl: './board-preview-page.component.html',
  styleUrls: ['./board-preview-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPreviewPageComponent implements OnInit {
  board = signal<BoardResponse | null>(null);
  lists = signal<BoardListResponse[]>([]);
  loading = signal(true);

  // Workspace members & groups
  workspaceMembers = signal<WorkspaceMemberResponse[]>([]);
  workspaceGroups = signal<UserGroupResponse[]>([]);

  // Add card inline
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
  editingCardListName = '';
  editingCardListType: string | null = null;
  cardFormTitle = '';
  cardFormDesc = '';
  cardFormPriority = 'MEDIUM';
  cardFormStatus = 'TODO';
  // Datepicker maneja Date; mantenemos string ISO para enviarlo al backend.
  cardFormDueDate: Date | null = null;
  cardFormAssignee: string | null = null;
  cardFormGroup: number | null = null;
  
  // Draft content for new cards
  cardFormChecklists: { content: string; completed: boolean }[] = [];
  cardFormNewChecklist = '';
  cardFormFiles: File[] = [];
  cardSaving = false;

  // Group management modal
  showGroupModal = false;
  newGroupName = '';
  newGroupDesc = '';
  groupSaving = false;
  managingGroup: UserGroupResponse | null = null;
  groupMembers = signal<GroupMemberResponse[]>([]);
  addMemberToGroupId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private boardService: BoardService,
    private workspaceService: WorkspaceService,
    private dashboardService: MatderDashboardService,
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
      // Asegurar que las cartas siempre sean un array para evitar problemas al hacer drag and drop (kanban)
      const sanitizedLists = ls.map(l => ({ ...l, cards: l.cards || [] })).sort((a, c) => a.position - c.position);
      this.lists.set(sanitizedLists);

      // Load workspace members and groups in parallel
      await this.loadWorkspaceData(b.workspace);
    } catch {
      this.board.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadWorkspaceData(workspaceId: number): Promise<void> {
    try {
      const [members, groups] = await Promise.all([
        this.workspaceService.listMembers(workspaceId),
        this.dashboardService.getGroupsByWorkspace(workspaceId).catch(() =>
          this.dashboardService.getGroups().catch(() => [] as UserGroupResponse[])
        ),
      ]);
      this.workspaceMembers.set(members.filter(m => m.active));
      this.workspaceGroups.set(groups);
    } catch {
      this.workspaceMembers.set([]);
      this.workspaceGroups.set([]);
    }
  }

  get totalCardCount(): number {
    return this.lists().reduce((sum, l) => sum + (l.cards?.length ?? 0), 0);
  }

  get activeMembers(): WorkspaceMemberResponse[] {
    return this.workspaceMembers();
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }

  getListIds(): string[] {
    return this.lists().map(l => 'list-' + l.id);
  }

  // ── Drag & drop ──
  async onCardDrop(event: CdkDragDrop<CardSummary[]>, target: BoardListResponse): Promise<void> {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }
    const card = event.container.data[event.currentIndex];
    if (!card) return;

    // Determinar nuevo status segun el list_type de la lista destino
    const newStatus = this.listTypeToStatus(target.list_type);

    try {
      // Mover la card al nuevo list + posicion
      await this.boardService.moveCard(card.id, target.id, event.currentIndex);

      // Actualizar el status si la lista tiene un tipo mapeado
      if (newStatus && card.status !== newStatus) {
        await this.boardService.updateCard(card.id, { status: newStatus });
        card.status = newStatus as any;
      }
    } catch {
      Swal.fire('Error', 'No se pudo mover la tarea.', 'error');
      await this.loadBoard(this.board()!.id);
    }
  }

  // ── Helpers de status según el tipo de lista ──
  private listTypeToStatus(listType: string | null | undefined): string {
    const m: Record<string, string> = {
      TODO: 'TODO',
      IN_PROGRESS: 'IN_PROGRESS',
      BLOCKED: 'BLOCKED',
      DONE: 'DONE',
    };
    return (listType && m[listType]) || 'TODO';
  }

  /**
   * Abre el modal de creación de tarea sobre una lista específica.
   * El status se preconfigura según el tipo de la lista (TODO, IN_PROGRESS,
   * BLOCKED, DONE) para mantener coherencia con la columna destino.
   */
  startAddCard(listOrId: BoardListResponse | number): void {
    const list = typeof listOrId === 'number'
      ? this.lists().find(l => l.id === listOrId) ?? null
      : listOrId;
    if (!list) return;

    this.editingCardId = null;
    this.editingCardListId = list.id;
    this.editingCardListName = list.name;
    this.editingCardListType = list.list_type ?? null;
    this.cardFormTitle = '';
    this.cardFormDesc = '';
    this.cardFormPriority = 'MEDIUM';
    this.cardFormStatus = this.listTypeToStatus(list.list_type);
    this.cardFormDueDate = null;
    this.cardFormAssignee = null;
    this.cardFormGroup = null;
    this.cardFormChecklists = [];
    this.cardFormFiles = [];
    this.cardFormNewChecklist = '';
    this.showCardModal = true;
  }

  async addCard(list: BoardListResponse): Promise<void> {
    // Mantiene compatibilidad con el atajo inline (Enter sobre el input).
    // Hoy delega al modal completo para que el usuario complete los datos.
    this.startAddCard(list);
  }

  cancelAddCard(): void { this.addingToListId = null; }

  // ── List management ──
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
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar',
    });
    if (c.isConfirmed) {
      try {
        await this.boardService.deleteList(list.id);
        await this.loadBoard(this.board()!.id);
      } catch { Swal.fire('Error', 'No se pudo eliminar.', 'error'); }
    }
  }

  // ── Card detail dialog ──
  openCardDetail(card: CardSummary): void {
    const ref = this.dialog.open(CardDetailDialogComponent, {
      width: '1040px', maxWidth: '96vw', maxHeight: '92vh',
      panelClass: 'matder-card-detail-panel',
      data: { cardId: card.id },
    });
    ref.afterClosed().subscribe(async (changed) => {
      if (changed) await this.loadBoard(this.board()!.id);
    });
  }

  // ── Card modal (create/edit) ──

  openEditCard(card: CardSummary): void {
    const list = this.lists().find(l => l.id === card.board_list) ?? null;
    this.editingCardId = card.id;
    this.editingCardListId = card.board_list;
    this.editingCardListName = list?.name ?? '';
    this.editingCardListType = list?.list_type ?? null;
    this.cardFormTitle = card.title;
    this.cardFormDesc = '';
    this.cardFormPriority = card.priority;
    this.cardFormStatus = card.status ?? this.listTypeToStatus(list?.list_type);
    this.cardFormDueDate = card.due_at ? new Date(card.due_at) : null;
    this.cardFormAssignee = card.assignee;
    this.cardFormGroup = card.assignee_group;
    this.showCardModal = true;
    // Load full detail for description
    this.boardService.getCardDetail(card.id).then(detail => {
      this.cardFormDesc = detail.description ?? '';
    }).catch(() => {});
  }

  closeCardModal(): void {
    this.showCardModal = false;
    this.editingCardId = null;
  }

  /** Convierte la fecha del datepicker a ISO (yyyy-mm-ddT00:00:00) o null. */
  private formatDueDate(d: Date | null): string | null {
    if (!d) return null;
    // Mantenemos hora local 23:59 para que el "vence hoy" no quede como vencido.
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0);
    return local.toISOString();
  }

  async submitCardForm(): Promise<void> {
    if (!this.cardFormTitle.trim() || this.cardSaving) return;
    this.cardSaving = true;
    try {
      const payload: Record<string, any> = {
        title: this.cardFormTitle.trim(),
        description: this.cardFormDesc.trim(),
        priority: this.cardFormPriority,
        status: this.cardFormStatus,
        due_at: this.formatDueDate(this.cardFormDueDate),
        assignee: this.cardFormAssignee || null,
        assignee_group: this.cardFormGroup || null,
      };

      let newCardId: number | null = null;

      if (this.editingCardId) {
        await this.boardService.updateCard(this.editingCardId, payload);
      } else {
        payload['board_list'] = this.editingCardListId;
        payload['position'] = 0;
        const newCard = await this.boardService.createCard(payload as any);
        newCardId = newCard.id;

        if (newCardId) {
          // Send drafted checklists
          for (const item of this.cardFormChecklists) {
            const chk = await this.boardService.createChecklistItem(newCardId, item.content);
            if (item.completed) {
              await this.boardService.updateChecklistItem(chk.id, { completed: true });
            }
          }
          // Send drafted files
          for (const file of this.cardFormFiles) {
            await this.boardService.uploadFile(newCardId, file);
          }
        }
      }
      this.closeCardModal();
      await this.loadBoard(this.board()!.id);
    } catch {
      Swal.fire('Error', 'No se pudo guardar la tarea.', 'error');
    } finally {
      this.cardSaving = false;
    }
  }

  // When a group is selected as assignee, show info
  onGroupSelected(groupId: number | null): void {
    this.cardFormGroup = groupId;
    // Optionally clear individual assignee when group is selected
    if (groupId) {
      this.cardFormAssignee = null;
    }
  }

  onAssigneeSelected(userId: string | null): void {
    this.cardFormAssignee = userId;
  }

  getMemberLabel(m: WorkspaceMemberResponse): string {
    if (m.full_name) return m.full_name;
    if (m.username) return m.username;
    return m.user;
  }

  getMemberInitials(m: WorkspaceMemberResponse): string {
    const name = m.full_name || m.username || m.user;
    return name.slice(0, 2).toUpperCase();
  }

  // ── Group management ──
  openGroupModal(): void {
    this.showGroupModal = true;
    this.managingGroup = null;
    this.newGroupName = '';
    this.newGroupDesc = '';
    this.groupMembers.set([]);
  }

  closeGroupModal(): void {
    this.showGroupModal = false;
    this.managingGroup = null;
  }

  async createGroup(): Promise<void> {
    if (!this.newGroupName.trim() || this.groupSaving) return;
    this.groupSaving = true;
    try {
      const group = await this.dashboardService.createGroup({
        name: this.newGroupName.trim(),
        description: this.newGroupDesc.trim() || undefined,
        workspace: this.board()!.workspace,
      });
      this.newGroupName = '';
      this.newGroupDesc = '';
      await this.loadWorkspaceData(this.board()!.workspace);
      // Auto-select the created group for management
      this.managingGroup = group;
      await this.loadGroupMembers(group.id);
      Swal.fire('Creado', `Grupo "${group.name}" creado. Ahora agrega miembros.`, 'success');
    } catch {
      Swal.fire('Error', 'No se pudo crear el grupo.', 'error');
    } finally {
      this.groupSaving = false;
    }
  }

  async selectGroupToManage(group: UserGroupResponse): Promise<void> {
    this.managingGroup = group;
    await this.loadGroupMembers(group.id);
  }

  async loadGroupMembers(groupId: number): Promise<void> {
    try {
      this.groupMembers.set(await this.dashboardService.getGroupMembers(groupId));
    } catch {
      this.groupMembers.set([]);
    }
  }

  async addMemberToGroup(): Promise<void> {
    if (!this.addMemberToGroupId.trim() || !this.managingGroup) return;
    try {
      await this.dashboardService.addGroupMember(this.managingGroup.id, this.addMemberToGroupId.trim());
      this.addMemberToGroupId = '';
      await this.loadGroupMembers(this.managingGroup.id);
      await this.loadWorkspaceData(this.board()!.workspace);
    } catch {
      Swal.fire('Error', 'No se pudo agregar el miembro al grupo.', 'error');
    }
  }

  async removeMemberFromGroup(memberId: number): Promise<void> {
    if (!this.managingGroup) return;
    try {
      await this.dashboardService.removeGroupMember(this.managingGroup.id, memberId);
      await this.loadGroupMembers(this.managingGroup.id);
      await this.loadWorkspaceData(this.board()!.workspace);
    } catch {
      Swal.fire('Error', 'No se pudo remover el miembro.', 'error');
    }
  }

  async deleteGroup(group: UserGroupResponse): Promise<void> {
    const c = await Swal.fire({
      title: `Eliminar grupo "${group.name}"?`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar',
    });
    if (c.isConfirmed) {
      try {
        await this.dashboardService.deleteGroup(group.id);
        if (this.managingGroup?.id === group.id) this.managingGroup = null;
        if (this.cardFormGroup === group.id) this.cardFormGroup = null;
        await this.loadWorkspaceData(this.board()!.workspace);
      } catch { Swal.fire('Error', 'No se pudo eliminar.', 'error'); }
    }
  }

  // --- Draft Checklists & Uploads ---
  addDraftChecklist(): void {
    if (this.cardFormNewChecklist.trim()) {
      this.cardFormChecklists.push({ content: this.cardFormNewChecklist.trim(), completed: false });
      this.cardFormNewChecklist = '';
    }
  }
  removeDraftChecklist(idx: number): void {
    this.cardFormChecklists.splice(idx, 1);
  }
  toggleDraftChecklist(idx: number): void {
    this.cardFormChecklists[idx].completed = !this.cardFormChecklists[idx].completed;
  }
  addDraftFiles(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        this.cardFormFiles.push(files[i]);
      }
    }
  }
  removeDraftFile(idx: number): void {
    this.cardFormFiles.splice(idx, 1);
  }
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ── Delete card ──
  async deleteCard(_list: BoardListResponse, card: CardSummary): Promise<void> {
    const c = await Swal.fire({
      title: `Eliminar "${card.title}"?`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar',
    });
    if (c.isConfirmed) {
      try {
        await this.boardService.deleteCard(card.id);
        await this.loadBoard(this.board()!.id);
      } catch { Swal.fire('Error', 'No se pudo eliminar.', 'error'); }
    }
  }

  // ── Helpers ──
  priorityLabel(p: string): string {
    return ({ LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' } as Record<string, string>)[p] ?? p;
  }

  statusLabel(s: string): string {
    return ({ TODO: 'Por hacer', IN_PROGRESS: 'En progreso', BLOCKED: 'Bloqueado', DONE: 'Hecho' } as Record<string, string>)[s] ?? s;
  }

  statusTone(s: string): string {
    return s.toLowerCase().replace(/_/g, '-');
  }

  listTypeLabel(lt: string): string {
    return ({ TODO: 'Por hacer', IN_PROGRESS: 'En curso', BLOCKED: 'Bloqueadas', DONE: 'Hechas', UNASSIGNED: 'Sin asignar' } as Record<string, string>)[lt] ?? lt;
  }

  getGroupName(groupId: number | null): string {
    if (!groupId) return '';
    return this.workspaceGroups().find(g => g.id === groupId)?.name ?? '';
  }

  getAssigneeName(userId: string | null): string {
    if (!userId) return '';
    const m = this.workspaceMembers().find(m => m.user === userId);
    return m ? (m.full_name || m.username || m.user) : userId;
  }
}
