import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserGroup {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberResponse {
  id: number;
  uuid: string;
  username: string;
  email: string;
  fullName: string;
  status: string;
  emailVerified: boolean;
  roles: string[];
  tags: string[];
  lastLoginAt: string | null;
}

export interface GroupWorkspaceResponse {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  ownerUsername: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class UserGroupService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8080/api';

  listByWorkspace(workspaceId: number): Observable<UserGroup[]> {
    return this.http.get<UserGroup[]>(`${this.baseUrl}/workspaces/${workspaceId}/groups`, { withCredentials: true });
  }

  // Admin methods
  listAll(): Observable<UserGroup[]> {
    return this.http.get<UserGroup[]>(`${this.baseUrl}/admin/user-groups`, { withCredentials: true });
  }

  create(group: { name: string; description: string }): Observable<UserGroup> {
    return this.http.post<UserGroup>(`${this.baseUrl}/admin/user-groups`, group, { withCredentials: true });
  }

  update(id: number, group: { name: string; description: string }): Observable<UserGroup> {
    return this.http.patch<UserGroup>(`${this.baseUrl}/admin/user-groups/${id}`, group, { withCredentials: true });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/user-groups/${id}`, { withCredentials: true });
  }

  addMember(groupId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/user-groups/${groupId}/members/${userId}`, {}, { withCredentials: true });
  }

  removeMember(groupId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/user-groups/${groupId}/members/${userId}`, { withCredentials: true });
  }

  listMembers(groupId: number): Observable<GroupMemberResponse[]> {
    return this.http.get<GroupMemberResponse[]>(`${this.baseUrl}/admin/user-groups/${groupId}/members`, { withCredentials: true });
  }

  listWorkspaces(groupId: number): Observable<GroupWorkspaceResponse[]> {
    return this.http.get<GroupWorkspaceResponse[]>(`${this.baseUrl}/admin/user-groups/${groupId}/workspaces`, { withCredentials: true });
  }

  assignToWorkspace(workspaceId: number, groupId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/admin/user-groups/${groupId}/workspaces/${workspaceId}`, {}, { withCredentials: true });
  }

  unassignFromWorkspace(workspaceId: number, groupId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/admin/user-groups/${groupId}/workspaces/${workspaceId}`, { withCredentials: true });
  }
}
