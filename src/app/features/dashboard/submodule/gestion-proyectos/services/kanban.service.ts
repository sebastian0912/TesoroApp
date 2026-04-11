import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';
import {
  KanbanProyecto,
  KanbanBoard, KanbanBoardList, KanbanCard, KanbanCardSummary,
  KanbanLabel, KanbanCardLabel, KanbanChecklistItem,
  KanbanCardComment, KanbanUpload, KanbanCardAssignee,
  KanbanDashboardStats,
  KanbanUserGroup, KanbanGroupMembership, KanbanGroupProject,
  KanbanCardGroupAssignee, KanbanNotification,
  KanbanAuditLog, KanbanImportResult, KanbanImportLog,
  KanbanAnalytics,
} from '../models/kanban.models';

@Injectable({ providedIn: 'root' })
export class KanbanService {
  private base = `${environment.apiUrl}/gestion_proyectos/kanban`;
  private proyectosBase = `${environment.apiUrl}/gestion_proyectos/proyectos`;

  constructor(private http: HttpClient) {}

  // ── Proyectos ─────────────────────────────────────────��

  getProyectos(): Promise<KanbanProyecto[]> {
    return firstValueFrom(
      this.http.get<KanbanProyecto[]>(`${this.proyectosBase}/`, ).pipe(catchError(this.handleError))
    );
  }

  createProyecto(data: { nombre: string; descripcion?: string }): Promise<KanbanProyecto> {
    return firstValueFrom(
      this.http.post<KanbanProyecto>(`${this.proyectosBase}/`, data).pipe(catchError(this.handleError))
    );
  }

  private handleError(error: any) {
    return throwError(() => error);
  }

  // ── Boards ──────────────────────────────────────────────

  getBoards(proyectoId?: number): Promise<KanbanBoard[]> {
    let params = new HttpParams();
    if (proyectoId) params = params.set('proyecto', String(proyectoId));
    return firstValueFrom(
      this.http.get<KanbanBoard[]>(`${this.base}/boards/`, { params }).pipe(catchError(this.handleError))
    );
  }

  getBoard(id: number): Promise<KanbanBoard> {
    return firstValueFrom(
      this.http.get<KanbanBoard>(`${this.base}/boards/${id}/`).pipe(catchError(this.handleError))
    );
  }

  createBoard(data: Partial<KanbanBoard>): Promise<KanbanBoard> {
    return firstValueFrom(
      this.http.post<KanbanBoard>(`${this.base}/boards/`, data).pipe(catchError(this.handleError))
    );
  }

  updateBoard(id: number, data: Partial<KanbanBoard>): Promise<KanbanBoard> {
    return firstValueFrom(
      this.http.patch<KanbanBoard>(`${this.base}/boards/${id}/`, data).pipe(catchError(this.handleError))
    );
  }

  deleteBoard(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/boards/${id}/`).pipe(catchError(this.handleError))
    );
  }

  // ── Board Lists ─────────────────────────────────────────

  getLists(boardId: number): Promise<KanbanBoardList[]> {
    const params = new HttpParams().set('board', String(boardId));
    return firstValueFrom(
      this.http.get<KanbanBoardList[]>(`${this.base}/listas/`, { params }).pipe(catchError(this.handleError))
    );
  }

  createList(data: Partial<KanbanBoardList>): Promise<KanbanBoardList> {
    return firstValueFrom(
      this.http.post<KanbanBoardList>(`${this.base}/listas/`, data).pipe(catchError(this.handleError))
    );
  }

  updateList(id: number, data: Partial<KanbanBoardList>): Promise<KanbanBoardList> {
    return firstValueFrom(
      this.http.patch<KanbanBoardList>(`${this.base}/listas/${id}/`, data).pipe(catchError(this.handleError))
    );
  }

  deleteList(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/listas/${id}/`).pipe(catchError(this.handleError))
    );
  }

  moveList(id: number, posicion: number): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.base}/listas/${id}/mover/`, { posicion }).pipe(catchError(this.handleError))
    );
  }

  // ── Cards ───────────────────────────────────────────────

  getCards(listaId?: number): Promise<KanbanCardSummary[]> {
    let params = new HttpParams();
    if (listaId) params = params.set('lista', String(listaId));
    return firstValueFrom(
      this.http.get<KanbanCardSummary[]>(`${this.base}/cards/`, { params }).pipe(catchError(this.handleError))
    );
  }

  getCard(id: number): Promise<KanbanCard> {
    return firstValueFrom(
      this.http.get<KanbanCard>(`${this.base}/cards/${id}/`).pipe(catchError(this.handleError))
    );
  }

  createCard(data: Partial<KanbanCard>): Promise<KanbanCard> {
    return firstValueFrom(
      this.http.post<KanbanCard>(`${this.base}/cards/`, data).pipe(catchError(this.handleError))
    );
  }

  updateCard(id: number, data: Partial<KanbanCard>): Promise<KanbanCard> {
    return firstValueFrom(
      this.http.patch<KanbanCard>(`${this.base}/cards/${id}/`, data).pipe(catchError(this.handleError))
    );
  }

  deleteCard(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/cards/${id}/`).pipe(catchError(this.handleError))
    );
  }

  moveCard(id: number, lista: number, posicion: number): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.base}/cards/${id}/mover/`, { lista, posicion }).pipe(catchError(this.handleError))
    );
  }

  getCalendarCards(desde?: string, hasta?: string): Promise<KanbanCardSummary[]> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return firstValueFrom(
      this.http.get<KanbanCardSummary[]>(`${this.base}/cards/calendario/`, { params }).pipe(catchError(this.handleError))
    );
  }

  getFavoriteCards(): Promise<KanbanCardSummary[]> {
    return firstValueFrom(
      this.http.get<KanbanCardSummary[]>(`${this.base}/cards/favoritas/`).pipe(catchError(this.handleError))
    );
  }

  // ── Labels ──────────────────────────────────────────────

  getLabels(boardId: number): Promise<KanbanLabel[]> {
    const params = new HttpParams().set('board', String(boardId));
    return firstValueFrom(
      this.http.get<KanbanLabel[]>(`${this.base}/labels/`, { params }).pipe(catchError(this.handleError))
    );
  }

  createLabel(data: Partial<KanbanLabel>): Promise<KanbanLabel> {
    return firstValueFrom(
      this.http.post<KanbanLabel>(`${this.base}/labels/`, data).pipe(catchError(this.handleError))
    );
  }

  updateLabel(id: number, data: Partial<KanbanLabel>): Promise<KanbanLabel> {
    return firstValueFrom(
      this.http.patch<KanbanLabel>(`${this.base}/labels/${id}/`, data).pipe(catchError(this.handleError))
    );
  }

  deleteLabel(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/labels/${id}/`).pipe(catchError(this.handleError))
    );
  }

  // ── Card Labels ─────────────────────────────────────────

  addCardLabel(cardId: number, labelId: number): Promise<KanbanCardLabel> {
    return firstValueFrom(
      this.http.post<KanbanCardLabel>(`${this.base}/card-labels/`, { card: cardId, label: labelId }).pipe(catchError(this.handleError))
    );
  }

  removeCardLabel(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/card-labels/${id}/`).pipe(catchError(this.handleError))
    );
  }

  // ── Checklist ───────────────────────────────────────────

  getChecklistItems(cardId: number): Promise<KanbanChecklistItem[]> {
    const params = new HttpParams().set('card', String(cardId));
    return firstValueFrom(
      this.http.get<KanbanChecklistItem[]>(`${this.base}/checklist/`, { params }).pipe(catchError(this.handleError))
    );
  }

  createChecklistItem(data: Partial<KanbanChecklistItem>): Promise<KanbanChecklistItem> {
    return firstValueFrom(
      this.http.post<KanbanChecklistItem>(`${this.base}/checklist/`, data).pipe(catchError(this.handleError))
    );
  }

  updateChecklistItem(id: number, data: Partial<KanbanChecklistItem>): Promise<KanbanChecklistItem> {
    return firstValueFrom(
      this.http.patch<KanbanChecklistItem>(`${this.base}/checklist/${id}/`, data).pipe(catchError(this.handleError))
    );
  }

  toggleChecklistItem(id: number): Promise<{ completado: boolean }> {
    return firstValueFrom(
      this.http.post<{ completado: boolean }>(`${this.base}/checklist/${id}/toggle/`, {}).pipe(catchError(this.handleError))
    );
  }

  deleteChecklistItem(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/checklist/${id}/`).pipe(catchError(this.handleError))
    );
  }

  // ── Comments ────────────────────────────────────────────

  getComments(cardId: number): Promise<KanbanCardComment[]> {
    const params = new HttpParams().set('card', String(cardId));
    return firstValueFrom(
      this.http.get<KanbanCardComment[]>(`${this.base}/comentarios/`, { params }).pipe(catchError(this.handleError))
    );
  }

  createComment(data: Partial<KanbanCardComment>): Promise<KanbanCardComment> {
    return firstValueFrom(
      this.http.post<KanbanCardComment>(`${this.base}/comentarios/`, data).pipe(catchError(this.handleError))
    );
  }

  deleteComment(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/comentarios/${id}/`).pipe(catchError(this.handleError))
    );
  }

  // ── Uploads ─────────────────────────────────────────────

  getUploads(cardId: number): Promise<KanbanUpload[]> {
    const params = new HttpParams().set('card', String(cardId));
    return firstValueFrom(
      this.http.get<KanbanUpload[]>(`${this.base}/uploads/`, { params }).pipe(catchError(this.handleError))
    );
  }

  uploadFile(cardId: number, file: File): Promise<KanbanUpload> {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('card', String(cardId));
    return firstValueFrom(
      this.http.post<KanbanUpload>(`${this.base}/uploads/`, formData).pipe(catchError(this.handleError))
    );
  }

  deleteUpload(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/uploads/${id}/`).pipe(catchError(this.handleError))
    );
  }

  // ── Assignees ───────────────────────────────────────────

  addAssignee(cardId: number, usuarioId: string): Promise<KanbanCardAssignee> {
    return firstValueFrom(
      this.http.post<KanbanCardAssignee>(`${this.base}/asignados/`, { card: cardId, usuario: usuarioId }).pipe(catchError(this.handleError))
    );
  }

  removeAssignee(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/asignados/${id}/`).pipe(catchError(this.handleError))
    );
  }

  // ── Dashboard ───────────────────────────────────────────

  getDashboardStats(proyectoId?: number): Promise<KanbanDashboardStats> {
    let params = new HttpParams();
    if (proyectoId) params = params.set('proyecto', String(proyectoId));
    return firstValueFrom(
      this.http.get<KanbanDashboardStats>(`${this.base}/dashboard/`, { params }).pipe(catchError(this.handleError))
    );
  }

  // ── Grupos ─────────────────────────────────────────────

  getGroups(): Promise<KanbanUserGroup[]> {
    return firstValueFrom(
      this.http.get<KanbanUserGroup[]>(`${this.base}/grupos/`).pipe(catchError(this.handleError))
    );
  }

  getGroup(id: number): Promise<KanbanUserGroup> {
    return firstValueFrom(
      this.http.get<KanbanUserGroup>(`${this.base}/grupos/${id}/`).pipe(catchError(this.handleError))
    );
  }

  createGroup(data: { nombre: string; descripcion?: string }): Promise<KanbanUserGroup> {
    return firstValueFrom(
      this.http.post<KanbanUserGroup>(`${this.base}/grupos/`, data).pipe(catchError(this.handleError))
    );
  }

  updateGroup(id: number, data: Partial<KanbanUserGroup>): Promise<KanbanUserGroup> {
    return firstValueFrom(
      this.http.patch<KanbanUserGroup>(`${this.base}/grupos/${id}/`, data).pipe(catchError(this.handleError))
    );
  }

  deleteGroup(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/grupos/${id}/`).pipe(catchError(this.handleError))
    );
  }

  addGroupMember(grupoId: number, usuarioId: string): Promise<KanbanGroupMembership> {
    return firstValueFrom(
      this.http.post<KanbanGroupMembership>(`${this.base}/grupo-miembros/`, { grupo: grupoId, usuario: usuarioId }).pipe(catchError(this.handleError))
    );
  }

  removeGroupMember(membershipId: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/grupo-miembros/${membershipId}/`).pipe(catchError(this.handleError))
    );
  }

  getGroupProjects(grupoId?: number): Promise<KanbanGroupProject[]> {
    let params = new HttpParams();
    if (grupoId) params = params.set('grupo', String(grupoId));
    return firstValueFrom(
      this.http.get<KanbanGroupProject[]>(`${this.base}/grupo-proyectos/`, { params }).pipe(catchError(this.handleError))
    );
  }

  assignGroupToProject(grupoId: number, proyectoId: number): Promise<KanbanGroupProject> {
    return firstValueFrom(
      this.http.post<KanbanGroupProject>(`${this.base}/grupo-proyectos/`, { grupo: grupoId, proyecto: proyectoId }).pipe(catchError(this.handleError))
    );
  }

  unassignGroupFromProject(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/grupo-proyectos/${id}/`).pipe(catchError(this.handleError))
    );
  }

  addCardGroupAssignee(cardId: number, grupoId: number): Promise<KanbanCardGroupAssignee> {
    return firstValueFrom(
      this.http.post<KanbanCardGroupAssignee>(`${this.base}/card-grupos/`, { card: cardId, grupo: grupoId }).pipe(catchError(this.handleError))
    );
  }

  removeCardGroupAssignee(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/card-grupos/${id}/`).pipe(catchError(this.handleError))
    );
  }

  // ── Notificaciones ─────────────────────────────────────

  getNotifications(): Promise<KanbanNotification[]> {
    return firstValueFrom(
      this.http.get<KanbanNotification[]>(`${this.base}/notificaciones/`).pipe(catchError(this.handleError))
    );
  }

  getUnreadCount(): Promise<{ count: number }> {
    return firstValueFrom(
      this.http.get<{ count: number }>(`${this.base}/notificaciones/no_leidas/`).pipe(catchError(this.handleError))
    );
  }

  markNotificationRead(id: number): Promise<{ leida: boolean }> {
    return firstValueFrom(
      this.http.post<{ leida: boolean }>(`${this.base}/notificaciones/${id}/leer/`, {}).pipe(catchError(this.handleError))
    );
  }

  markAllNotificationsRead(): Promise<{ marcadas: number }> {
    return firstValueFrom(
      this.http.post<{ marcadas: number }>(`${this.base}/notificaciones/leer_todas/`, {}).pipe(catchError(this.handleError))
    );
  }

  // ── Auditoría ──────────────────────────────────────────

  getAuditLogs(filters?: { accion?: string; tipo_entidad?: string }): Promise<KanbanAuditLog[]> {
    let params = new HttpParams();
    if (filters?.accion) params = params.set('accion', filters.accion);
    if (filters?.tipo_entidad) params = params.set('tipo_entidad', filters.tipo_entidad);
    return firstValueFrom(
      this.http.get<KanbanAuditLog[]>(`${this.base}/auditoria/`, { params }).pipe(catchError(this.handleError))
    );
  }

  // ── Import ─────────────────────────────────────────────

  getImportLogs(proyectoId?: number): Promise<KanbanImportLog[]> {
    let params = new HttpParams();
    if (proyectoId) params = params.set('proyecto', String(proyectoId));
    return firstValueFrom(
      this.http.get<KanbanImportLog[]>(`${this.base}/import/`, { params }).pipe(catchError(this.handleError))
    );
  }

  importFile(proyectoId: number, file: File): Promise<KanbanImportResult> {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('proyecto', String(proyectoId));
    return firstValueFrom(
      this.http.post<KanbanImportResult>(`${this.base}/import/importar/`, formData).pipe(catchError(this.handleError))
    );
  }

  downloadImportTemplate(): void {
    window.open(`${this.base}/import/plantilla/`, '_blank');
  }

  // ── Analytics ──────────────────────────────────────────

  getAnalytics(proyectoId?: number): Promise<KanbanAnalytics> {
    let params = new HttpParams();
    if (proyectoId) params = params.set('proyecto', String(proyectoId));
    return firstValueFrom(
      this.http.get<KanbanAnalytics>(`${this.base}/analytics/`, { params }).pipe(catchError(this.handleError))
    );
  }
}
