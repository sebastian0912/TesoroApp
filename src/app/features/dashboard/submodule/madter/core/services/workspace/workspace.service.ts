import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@/environments/environment';

export interface WorkspaceResponse {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  ownerUsername: string;
  currentUserRole: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';
  canManageMembers: boolean;
  canCreateBoards: boolean;
  canDeleteWorkspace: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberResponse {
  membershipId: number;
  userId: number;
  username: string;
  email: string;
  fullName: string;
  documentNumber?: string | null;
  status: string;
  emailVerified: boolean;
  assignable: boolean;
  role: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';
  active: boolean;
  owner: boolean;
  joinedAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl + '/api/matder/workspaces';

  listMine() {
    return this.http.get<WorkspaceResponse[]>(this.baseUrl);
  }

  getById(workspaceId: number) {
    return this.http.get<WorkspaceResponse>(`${this.baseUrl}/${workspaceId}`);
  }

  create(payload: { name: string; description: string }) {
    return this.http.post<WorkspaceResponse>(this.baseUrl, payload);
  }

  delete(workspaceId: number) {
    return this.http.delete<void>(`${this.baseUrl}/${workspaceId}`);
  }

  listMembers(workspaceId: number) {
    return this.http.get<WorkspaceMemberResponse[]>(`${this.baseUrl}/${workspaceId}/members`);
  }

  searchMemberCandidates(workspaceId: number, query: string) {
    return this.http.get<Array<{
      id: number;
      username: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      fullName?: string | null;
      documentNumber?: string | null;
    }>>(`${this.baseUrl}/${workspaceId}/member-candidates`, {
      params: { query },
    });
  }

  addMember(workspaceId: number, payload: { userId: number; role: string }) {
    return this.http.post<WorkspaceMemberResponse>(`${this.baseUrl}/${workspaceId}/members`, payload);
  }

  updateMember(workspaceId: number, membershipId: number, payload: { role: string; active: boolean }) {
    return this.http.patch<WorkspaceMemberResponse>(`${this.baseUrl}/${workspaceId}/members/${membershipId}`, payload);
  }
}
