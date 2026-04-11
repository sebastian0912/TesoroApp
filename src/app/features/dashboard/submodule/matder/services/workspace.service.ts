import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';
import { WorkspaceResponse, WorkspaceMemberResponse } from '../models/workspace.models';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private base = `${environment.apiUrl}/matder/workspaces`;

  constructor(private http: HttpClient) {}

  private err(e: any) { return throwError(() => e); }

  list(): Promise<WorkspaceResponse[]> {
    return firstValueFrom(this.http.get<WorkspaceResponse[]>(`${this.base}/`).pipe(catchError(this.err)));
  }

  get(id: number): Promise<WorkspaceResponse> {
    return firstValueFrom(this.http.get<WorkspaceResponse>(`${this.base}/${id}/`).pipe(catchError(this.err)));
  }

  create(data: { name: string; description?: string }): Promise<WorkspaceResponse> {
    return firstValueFrom(this.http.post<WorkspaceResponse>(`${this.base}/`, data).pipe(catchError(this.err)));
  }

  delete(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}/`).pipe(catchError(this.err)));
  }

  listMembers(wsId: number): Promise<WorkspaceMemberResponse[]> {
    return firstValueFrom(this.http.get<WorkspaceMemberResponse[]>(`${this.base}/${wsId}/members/`).pipe(catchError(this.err)));
  }

  addMember(wsId: number, userId: string, role: string): Promise<WorkspaceMemberResponse> {
    return firstValueFrom(this.http.post<WorkspaceMemberResponse>(`${this.base}/${wsId}/members/`, { user: userId, role }).pipe(catchError(this.err)));
  }

  updateMember(wsId: number, mid: number, data: { role?: string; active?: boolean }): Promise<WorkspaceMemberResponse> {
    return firstValueFrom(this.http.patch<WorkspaceMemberResponse>(`${this.base}/${wsId}/members/${mid}/`, data).pipe(catchError(this.err)));
  }
}
