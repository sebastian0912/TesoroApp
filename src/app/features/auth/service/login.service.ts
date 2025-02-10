import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment.development';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { }

  private getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  // Register
  async register(user: any): Promise<any> {
    return await firstValueFrom(
      this.http.post(`${this.apiUrl}/usuarios/registro`, user)
    );
  }

  // Login
  async login(email: string, password: string): Promise<any> {
    return await firstValueFrom(
      this.http.post(`${this.apiUrl}/usuarios/ingresar`, { email, password })
    );
  }

  // Traer usuario
  async getUser(): Promise<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set(
      'Authorization',
      token ? `${token}` : ''
    );
    return await firstValueFrom(
      this.http.get(`${this.apiUrl}/usuarios/usuario`, { headers })
    );
  }

  // permisos/<str:username>/
  async getPermissions(username: string): Promise<any> {
    return await firstValueFrom(
      this.http.get(`${this.apiUrl}/usuarios/permisos/${username}`)
    );
  }

}
