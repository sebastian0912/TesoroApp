import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

interface ElectronApi {
  pdf: {
    openInWindow: (payload: { base64: string; title?: string; width?: number; height?: number }) =>
      Promise<{ success: boolean; error?: string }>;
  };
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  };
}

interface OpenPdfOptions {
  title?: string;
  width?: number;
  height?: number;
}

/**
 * Fachada única para aperturas de ventanas/URLs. Unifica el comportamiento
 * entre Electron y navegador: en Electron los PDFs en memoria se abren en
 * una BrowserWindow hija segura; los enlaces externos pasan por
 * shell.openExternal para evitar nuevas BrowserWindows no controladas.
 */
@Injectable({ providedIn: 'root' })
export class ElectronWindowService {
  private get api(): ElectronApi | null {
    const w = typeof window !== 'undefined' ? (window as any) : null;
    return w?.electron?.pdf?.openInWindow && w?.electron?.shell?.openExternal ? w.electron : null;
  }

  get isElectron(): boolean {
    return !!this.api;
  }

  async openPdfFromBase64(base64: string, options: OpenPdfOptions = {}): Promise<void> {
    const clean = this.stripPdfDataUrl(base64);
    if (!clean) {
      Swal.fire('Error', 'El documento PDF está vacío o no es válido.', 'error');
      return;
    }

    if (this.api) {
      const res = await this.api.pdf.openInWindow({
        base64: clean,
        title: options.title,
        width: options.width,
        height: options.height,
      });
      if (!res?.success) {
        Swal.fire('Error', res?.error || 'No se pudo abrir el documento.', 'error');
      }
      return;
    }

    // Fallback navegador (no-Electron): blob + window.open.
    try {
      const blob = this.base64ToBlob(clean, 'application/pdf');
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, '_blank');
      if (!opened) {
        Swal.fire('Bloqueado', 'El navegador bloqueó la apertura del PDF.', 'warning');
      }
    } catch {
      Swal.fire('Error', 'Error al abrir el archivo PDF.', 'error');
    }
  }

  async openPdfFromBlob(blob: Blob, options: OpenPdfOptions = {}): Promise<void> {
    if (this.api) {
      const base64 = await this.blobToBase64(blob);
      await this.openPdfFromBase64(base64, options);
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  /** URLs externas (http/https): en Electron van al navegador del SO. */
  openExternal(url: string): void {
    if (!url) return;
    if (this.api && /^https?:\/\//i.test(url)) {
      this.api.shell.openExternal(url).catch(() => { /* noop */ });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Abre un documento que puede ser URL externa o PDF base64. Reemplaza el
   * patrón if(isUrl) window.open else openBase64PDF disperso por la app.
   */
  async openDocument(value: string, options: OpenPdfOptions = {}): Promise<void> {
    if (!value) return;
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      this.openExternal(trimmed);
      return;
    }
    if (this.isPdfBase64(trimmed)) {
      await this.openPdfFromBase64(trimmed, options);
      return;
    }
    Swal.fire('No disponible', 'El documento no está en un formato reconocido.', 'info');
  }

  /**
   * Acepta tanto data URL `data:application/pdf;base64,...` como base64
   * "crudo" cuyo contenido binario inicia con `%PDF` (prefijo base64 `JVBERi`).
   */
  isPdfBase64(value: string | null | undefined): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^data:application\/pdf;base64,/i.test(trimmed)) return true;
    return /^JVBERi/.test(trimmed);
  }

  private stripPdfDataUrl(raw: string): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^data:application\/pdf;base64,/i, '').trim();
  }

  private base64ToBlob(base64: string, mime: string): Blob {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onloadend = () => {
        const result = String(fr.result || '');
        resolve(result.replace(/^data:[^;]+;base64,/, ''));
      };
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
}
