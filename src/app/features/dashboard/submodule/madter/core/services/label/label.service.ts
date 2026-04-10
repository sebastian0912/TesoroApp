import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@/environments/environment';

export interface LabelResponse {
  id: number;
  uuid: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class LabelService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl + '/api/matder';

  listByBoard(boardId: number) {
    return this.http.get<LabelResponse[]>(`${this.baseUrl}/boards/${boardId}/labels`);
  }

  create(boardId: number, payload: { name: string; color: string }) {
    return this.http.post<LabelResponse>(`${this.baseUrl}/boards/${boardId}/labels`, payload);
  }

  update(labelId: number, payload: { name: string; color: string }) {
    return this.http.patch<LabelResponse>(`${this.baseUrl}/labels/${labelId}`, payload);
  }

  delete(labelId: number) {
    return this.http.delete<void>(`${this.baseUrl}/labels/${labelId}`);
  }

  assignToCard(cardId: number, labelId: number) {
    return this.http.post<void>(`${this.baseUrl}/cards/${cardId}/labels/${labelId}`, {});
  }

  unassignFromCard(cardId: number, labelId: number) {
    return this.http.delete<void>(`${this.baseUrl}/cards/${cardId}/labels/${labelId}`);
  }
}
