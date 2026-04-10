import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DashboardOverviewResponse } from '../../../dashboard/models/dashboard.models';
import { environment } from '@/environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl + '/api/matder/dashboard';

  getOverview() {
    return this.http.get<DashboardOverviewResponse>(`${this.baseUrl}/overview`);
  }
}
