import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@/environments/environment';

export interface UserLookupResponse {
  id: number;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  documentNumber?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl + '/api/matder';

  searchAssignableUsers(workspaceId: number, query: string) {
    return this.http.get<UserLookupResponse[]>(`${this.baseUrl}/users/search`, {
      params: { query, workspaceId },
    });
  }
}
