import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';
import {
  DashboardOverviewResponse, NotificationResponse,
  UserGroupResponse, GroupMemberResponse, AuditLogResponse, ImportLogResponse,
} from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class MatderDashboardService {
  private base = `${environment.apiUrl}/matder`;

  constructor(private http: HttpClient) {}

  private err(e: any) { return throwError(() => e); }

  getOverview(): Promise<DashboardOverviewResponse> {
    return firstValueFrom(this.http.get<DashboardOverviewResponse>(`${this.base}/dashboard/overview/`).pipe(catchError(this.err)));
  }

  // ── Notifications ──
  getNotifications(): Promise<NotificationResponse[]> {
    return firstValueFrom(this.http.get<NotificationResponse[]>(`${this.base}/notifications/`).pipe(catchError(this.err)));
  }

  getUnreadCount(): Promise<{ count: number }> {
    return firstValueFrom(this.http.get<{ count: number }>(`${this.base}/notifications/unread-count/`).pipe(catchError(this.err)));
  }

  markRead(id: number): Promise<any> {
    return firstValueFrom(this.http.patch<any>(`${this.base}/notifications/${id}/read/`, {}).pipe(catchError(this.err)));
  }

  markAllRead(): Promise<any> {
    return firstValueFrom(this.http.patch<any>(`${this.base}/notifications/read-all/`, {}).pipe(catchError(this.err)));
  }

  // ── Groups ──
  getGroups(): Promise<UserGroupResponse[]> {
    return firstValueFrom(this.http.get<UserGroupResponse[]>(`${this.base}/groups/`).pipe(catchError(this.err)));
  }

  getGroupsByWorkspace(workspaceId: number): Promise<UserGroupResponse[]> {
    return firstValueFrom(this.http.get<UserGroupResponse[]>(`${this.base}/groups/`, {
      params: { workspace: String(workspaceId) }
    }).pipe(catchError(this.err)));
  }

  createGroup(data: { name: string; description?: string; workspace?: number }): Promise<UserGroupResponse> {
    return firstValueFrom(this.http.post<UserGroupResponse>(`${this.base}/groups/`, data).pipe(catchError(this.err)));
  }

  updateGroup(id: number, data: Partial<UserGroupResponse>): Promise<UserGroupResponse> {
    return firstValueFrom(this.http.patch<UserGroupResponse>(`${this.base}/groups/${id}/`, data).pipe(catchError(this.err)));
  }

  deleteGroup(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/groups/${id}/`).pipe(catchError(this.err)));
  }

  getGroupMembers(groupId: number): Promise<GroupMemberResponse[]> {
    return firstValueFrom(this.http.get<GroupMemberResponse[]>(`${this.base}/groups/${groupId}/members/`).pipe(catchError(this.err)));
  }

  addGroupMember(groupId: number, userId: string): Promise<GroupMemberResponse> {
    return firstValueFrom(this.http.post<GroupMemberResponse>(`${this.base}/groups/${groupId}/members/`, { user: userId }).pipe(catchError(this.err)));
  }

  removeGroupMember(groupId: number, memberId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/groups/${groupId}/members/${memberId}/`).pipe(catchError(this.err)));
  }

  // ── Audit ──
  getAuditLogs(): Promise<AuditLogResponse[]> {
    return firstValueFrom(this.http.get<AuditLogResponse[]>(`${this.base}/audit/`).pipe(catchError(this.err)));
  }

  // ── Import ──
  getImportLogs(): Promise<ImportLogResponse[]> {
    return firstValueFrom(this.http.get<ImportLogResponse[]>(`${this.base}/import/`).pipe(catchError(this.err)));
  }

  importFile(workspaceId: number, file: File): Promise<any> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('workspace', String(workspaceId));
    return firstValueFrom(this.http.post<any>(`${this.base}/import/upload/`, fd).pipe(catchError(this.err)));
  }

  downloadTemplate(): void {
    window.open(`${this.base}/import/template/`, '_blank');
  }
}
