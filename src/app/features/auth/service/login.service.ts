import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment.development';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoginService {
  private apiUrl = `${environment.apiUrl}/gestion_admin/auth`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // Register
  async register(user: any): Promise<any> {
    return firstValueFrom(this.http.post(`${this.apiUrl}/register/`, user));
  }

  // Login (correo o documento)
  async login(login: string, password: string): Promise<{ token: string; user: any }> {
    return firstValueFrom(
      this.http.post<{ token: string; user: any }>(`${this.apiUrl}/login/`, { login, password })
    );
  }
}
