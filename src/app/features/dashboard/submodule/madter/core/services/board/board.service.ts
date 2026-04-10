import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@/environments/environment';

export interface BoardResponse {
  id: number;
  uuid: string;
  workspaceId: number;
  workspaceName: string;
  workspaceRole: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';
  name: string;
  description: string | null;
  accent: string;
  canManageContent: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class BoardService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl + '/api/matder/boards';

  listMine() {
    return this.http.get<BoardResponse[]>(this.baseUrl);
  }

  getById(boardId: number) {
    return this.http.get<BoardResponse>(`${this.baseUrl}/${boardId}`);
  }

  create(payload: { workspaceId: number; name: string; description: string; accent: string }) {
    return this.http.post<BoardResponse>(this.baseUrl, payload);
  }

  update(boardId: number, payload: { name: string; description: string; accent: string }) {
    return this.http.patch<BoardResponse>(`${this.baseUrl}/${boardId}`, payload);
  }

  delete(boardId: number) {
    return this.http.delete<void>(`${this.baseUrl}/${boardId}`);
  }
}
