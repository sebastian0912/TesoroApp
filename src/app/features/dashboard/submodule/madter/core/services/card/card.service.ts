import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LabelResponse } from '../label/label.service';
import { environment } from '@/environments/environment';

export type CardStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';

export interface CardResponse {
  id: number;
  uuid: string;
  boardId: number;
  boardListId: number;
  title: string;
  description: string | null;
  status: CardStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  assignee?: CardAssigneeResponse | null;
  assigneeGroup?: CardGroupAssigneeResponse | null;
  labels?: LabelResponse[];
}

export interface MoveCardResponse {
  cardId: number;
  sourceListId: number;
  targetListId: number;
  sourceCards: CardResponse[];
  targetCards: CardResponse[];
}

export interface CardAssigneeResponse {
  id: number;
  username: string;
  email: string;
  fullName?: string | null;
}

export interface CardGroupAssigneeResponse {
  id: number;
  uuid: string;
  name: string;
}

export interface ChecklistItemResponse {
  id: number;
  uuid: string;
  cardId: number;
  content: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadAttachment {
  id: number;
  uuid: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface CardCommentResponse {
  id: number;
  uuid: string;
  cardId: number;
  authorId: number;
  authorUsername: string;
  body: string;
  attachments: UploadAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CardDetailResponse extends CardResponse {
  assignee: CardAssigneeResponse | null;
  assigneeGroup: CardGroupAssigneeResponse | null;
  checklistItems: ChecklistItemResponse[];
  comments: CardCommentResponse[];
}

export interface AssignedCalendarCardResponse {
  id: number;
  boardId: number;
  boardListId: number;
  workspaceId: number;
  title: string;
  description: string | null;
  status: CardStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: string;
  boardName: string;
  boardListName: string;
  workspaceName: string;
  accent: string;
  boardAccessible: boolean;
  assignee?: CardAssigneeResponse | null;
  assigneeGroup?: CardGroupAssigneeResponse | null;
}

@Injectable({ providedIn: 'root' })
export class CardService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl + '/api/matder';

  listByList(listId: number) {
    return this.http.get<CardResponse[]>(`${this.baseUrl}/lists/${listId}/cards`);
  }

  listAssignedCalendarMine() {
    return this.http.get<AssignedCalendarCardResponse[]>(`${this.baseUrl}/cards/assigned/calendar`);
  }

  getDetail(cardId: number) {
    return this.http.get<CardDetailResponse>(`${this.baseUrl}/cards/${cardId}/detail`);
  }

  create(listId: number, payload: {
    title: string;
    description: string;
    status: CardStatus;
    priority: string;
    dueAt: string | null;
    assigneeId: number | null;
    assigneeGroupId: number | null;
  }) {
    return this.http.post<CardResponse>(`${this.baseUrl}/lists/${listId}/cards`, payload);
  }

  update(cardId: number, payload: {
    title: string;
    description: string;
    status: CardStatus;
    priority: string;
    dueAt: string | null;
    assigneeId: number | null;
    assigneeGroupId: number | null;
  }) {
    return this.http.patch<CardResponse>(`${this.baseUrl}/cards/${cardId}`, payload);
  }

  updateAssignment(cardId: number, payload: { assigneeId: number | null; assigneeGroupId: number | null }) {
    return this.http.patch<CardDetailResponse>(`${this.baseUrl}/cards/${cardId}/assignment`, payload);
  }

  move(cardId: number, payload: { targetListId: number; targetIndex: number }) {
    return this.http.patch<MoveCardResponse>(`${this.baseUrl}/cards/${cardId}/move`, payload);
  }

  createComment(cardId: number, payload: { body: string; uploadUuids?: string[] }) {
    return this.http.post<CardCommentResponse>(`${this.baseUrl}/cards/${cardId}/comments`, payload);
  }

  deleteComment(commentId: number) {
    return this.http.delete<void>(`${this.baseUrl}/comments/${commentId}`);
  }

  createChecklistItem(cardId: number, payload: { content: string }) {
    return this.http.post<ChecklistItemResponse>(`${this.baseUrl}/cards/${cardId}/checklist-items`, payload);
  }

  updateChecklistItem(itemId: number, payload: { content: string; completed: boolean }) {
    return this.http.patch<ChecklistItemResponse>(`${this.baseUrl}/checklist-items/${itemId}`, payload);
  }

  deleteChecklistItem(itemId: number) {
    return this.http.delete<void>(`${this.baseUrl}/checklist-items/${itemId}`);
  }

  delete(cardId: number) {
    return this.http.delete<void>(`${this.baseUrl}/cards/${cardId}`);
  }
}
