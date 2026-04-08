import {  Component , ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import Swal from 'sweetalert2';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: any[]) => void) => void;
        send: (channel: string, ...args: any[]) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      };
      version: {
        get: () => Promise<{ success: boolean; data?: string; error?: string }>;
      };
      env: {
        get: () => Promise<string>;
      };
      fingerprint: {
        get: () => Promise<{ success: boolean; data?: string; error?: string }>;
      };
      __dirname: string;
    };
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
} )
export class AppComponent {
  title = 'Tesoreria';
  updateAvailable: boolean = false;
  updateDownloaded: boolean = false;
  swalProgressInstance: any = null;

  ngOnInit() {
    if (typeof window !== 'undefined' && window.electron) {
      this.setupUpdateListeners();
    }
  }

  private setupUpdateListeners(): void {
    window.electron.ipcRenderer.on('update-available', () => {
      this.updateAvailable = true;
      Swal.fire({
        title: 'Actualización obligatoria',
        text: 'Se descargará en segundo plano.',
        icon: 'info',
        allowOutsideClick: false,  // 🔒 Bloquea el cierre con clics fuera
        allowEscapeKey: false,      // 🔒 Bloquea cerrar con ESC
        showConfirmButton: false    // 🔒 No hay botón de confirmación
      });
    });

    window.electron.ipcRenderer.on('update-progress', (progressObj) => {
      this.showOrUpdateProgress(progressObj.percent);
    });

    window.electron.ipcRenderer.on('update-downloaded', () => {
      this.updateDownloaded = true;
      Swal.fire({
        title: 'Actualización completada',
        text: 'La aplicación se actualizará automáticamente.',
        icon: 'success',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        timer: 3000
      }).then(() => {
        window.electron.ipcRenderer.send('restart-app');
      });
    });

    window.electron.ipcRenderer.on('update-error', (error) => {
      Swal.fire({
        title: 'Error en la actualización',
        text: `Error: ${error}`,
        icon: 'error',
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: 'OK'
      });
    });
  }

  private showOrUpdateProgress(percent: number): void {
    const roundedPercent = Math.floor(percent);

    if (!this.swalProgressInstance) {
      this.swalProgressInstance = Swal.fire({
        title: 'Descargando actualización...',
        html: `<strong id="progress-text">${roundedPercent}%</strong> completado`,
        icon: 'info',
        allowOutsideClick: false,  // 🔒 Evita que el usuario cierre la alerta
        allowEscapeKey: false,      // 🔒 Bloquea cierre con ESC
        showConfirmButton: false    // 🔒 No hay botón de cerrar
      });
    } else {
      const progressText = Swal.getHtmlContainer()?.querySelector('#progress-text');
      if (progressText && progressText instanceof HTMLElement) {
        progressText.innerText = `${roundedPercent}%`;
      }
    }
  }
}
