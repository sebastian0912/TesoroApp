import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

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
        get: () => Promise<string>;  // Añadimos la propiedad 'env' para obtener el entorno
      };
      __dirname: string;
    }
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Tesoreria';
}
