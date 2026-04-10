import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@/environments/environment';

export interface BoardListResponse {
  id: number;
  uuid: string;
  boardId: number;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class BoardListService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl + '/api/matder';

  listByBoard(boardId: number) {
    return this.http.get<BoardListResponse[]>(`${this.baseUrl}/boards/${boardId}/lists`);
  }

  create(boardId: number, payload: { name: string }) {
    return this.http.post<BoardListResponse>(`${this.baseUrl}/boards/${boardId}/lists`, payload);
  }

  update(listId: number, payload: { name: string }) {
    return this.http.patch<BoardListResponse>(`${this.baseUrl}/lists/${listId}`, payload);
  }

  delete(listId: number) {
    return this.http.delete<void>(`${this.baseUrl}/lists/${listId}`);
  }

  move(listId: number, payload: { targetIndex: number }) {
    return this.http.patch<BoardListResponse[]>(`${this.baseUrl}/lists/${listId}/move`, payload);
  }
}
