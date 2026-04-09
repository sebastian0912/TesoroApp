import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConsoleLoggerService } from '../console-logger/console-logger.service';
import html2canvas from 'html2canvas';

export interface BugReportPayload {
  titulo: string;
  descripcion: string;
  categoria: string;
  prioridad: string;
  screenshot_base64: string | null;
  console_logs: string;
  url_actual: string;
  navegador: string;
  resolucion: string;
  usuario: string;
  documento: string;
  rol: string;
  sede: string;
  version_app: string;
  fecha_reporte: string;
  datos_adicionales: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class BugReportService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private consoleLogger: ConsoleLoggerService
  ) {}

  async captureScreenshot(): Promise<string | null> {
    try {
      const canvas = await html2canvas(document.body, {
        scale: 0.7,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return null;
    }
  }

  getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return ua.substring(0, 80);
  }

  getResolution(): string {
    return `${window.innerWidth}x${window.innerHeight}`;
  }

  getUserData(): { usuario: string; documento: string; rol: string; sede: string } {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return {
        usuario: [user?.datos_basicos?.nombres, user?.datos_basicos?.apellidos].filter(Boolean).join(' ') || 'N/A',
        documento: user?.numero_de_documento || 'N/A',
        rol: user?.rol?.nombre || 'N/A',
        sede: user?.sede?.nombre || 'N/A',
      };
    } catch {
      return { usuario: 'N/A', documento: 'N/A', rol: 'N/A', sede: 'N/A' };
    }
  }

  getAppVersion(): string {
    try {
      const w = window as any;
      return w._appVersion || environment.production ? 'web' : 'dev';
    } catch {
      return 'desconocida';
    }
  }

  getConsoleLogs(): string {
    return this.consoleLogger.getLogsAsText();
  }

  async buildReportPayload(): Promise<Partial<BugReportPayload>> {
    const screenshot = await this.captureScreenshot();
    const userData = this.getUserData();

    return {
      screenshot_base64: screenshot,
      console_logs: this.getConsoleLogs(),
      url_actual: window.location.href,
      navegador: this.getBrowserInfo(),
      resolucion: this.getResolution(),
      ...userData,
      version_app: this.getAppVersion(),
      fecha_reporte: new Date().toISOString(),
    };
  }

  getFallbackData(): Partial<BugReportPayload> {
    const userData = this.getUserData();
    return {
      screenshot_base64: null,
      console_logs: this.getConsoleLogs(),
      url_actual: window.location.href,
      navegador: this.getBrowserInfo(),
      resolucion: this.getResolution(),
      ...userData,
      version_app: this.getAppVersion(),
      fecha_reporte: new Date().toISOString(),
    };
  }

  enviarReporte(payload: BugReportPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/bug_tickets/reportar/`, payload);
  }
}
