
import {  Component, ElementRef, OnDestroy, OnInit, ViewChild, inject , ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

export type CameraDialogResult = { file: File; previewUrl: string };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-camera-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule
],
  templateUrl: './camera-dialog.component.html',
  styleUrl: './camera-dialog.component.css'
} )
export class CameraDialogComponent implements OnInit, OnDestroy {
  private dialogRef = inject(MatDialogRef<CameraDialogComponent>);
  private dialogData = inject(MAT_DIALOG_DATA, { optional: true }) as { initialPreviewUrl?: string | null } | null;

  @ViewChild('videoEl', { static: false }) videoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl', { static: false }) canvasEl?: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;

  stream?: MediaStream;
  loadingCamera = false;
  cameraError = '';
  facingMode: 'user' | 'environment' = 'user'; // Default 'user' para selfies
  isMirror = true; // Espejo activado por defecto
  isUploadMode = false; // Modo "Adjuntar" recuperado como estado

  previewUrl: string | null = null; // Para mostrar antes de confirmar
  capturedFile: File | null = null;

  async ngOnInit(): Promise<void> {
    // Precargar foto existente si llega (dataURL o http(s))
    await this.loadInitialPreview(this.dialogData?.initialPreviewUrl || null);

    const supportsCamera =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      (typeof window === 'undefined' || (window as any).isSecureContext !== false);

    if (supportsCamera) {
      try {
        await this.startCamera();
      } catch {
        this.cameraError = 'No fue posible acceder a la cámara. Puedes adjuntar una imagen.';
      }
    } else {
      this.cameraError = 'La cámara no está disponible (permiso/HTTPS). Puedes adjuntar una imagen.';
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.revokePreview();
  }

  private async loadInitialPreview(initial: string | null): Promise<void> {
    if (!initial) return;

    // 1) Si es dataURL, úsalo tal cual y crea File para permitir "Usar esta imagen"
    if (initial.startsWith('data:')) {
      this.previewUrl = initial;
      this.capturedFile = this.dataURLToFile(initial, 'foto-actual.png');
      return;
    }

    // 2) Si es http/https: intenta descargarla como blob -> File -> objectURL
    if (/^https?:\/\//i.test(initial)) {
      try {
        const resp = await fetch(initial, { mode: 'cors' });
        if (!resp.ok) throw new Error(String(resp.status));
        const blob = await resp.blob();
        const ext = blob.type === 'image/jpeg' ? 'jpg'
          : blob.type === 'image/png' ? 'png'
            : 'bin';
        const file = new File([blob], `foto-actual.${ext}`, { type: blob.type || 'application/octet-stream' });
        this.capturedFile = file;
        this.previewUrl = URL.createObjectURL(file);
      } catch {
        // Si CORS falla, al menos mostrar la URL directamente (no habrá File)
        this.capturedFile = null;
        this.previewUrl = initial;
      }
    }
  }

  async startCamera(): Promise<void> {
    this.loadingCamera = true;
    this.cameraError = '';
    this.stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoEl?.nativeElement) {
        const v = this.videoEl.nativeElement;
        v.srcObject = this.stream;
        await v.play().catch(() => { /* algunos navegadores requieren interacción */ });
      }
    } catch {
      this.cameraError = 'No fue posible acceder a la cámara. Puedes adjuntar una imagen.';
    } finally {
      this.loadingCamera = false;
    }
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = undefined;
    }
    if (this.videoEl?.nativeElement) {
      this.videoEl.nativeElement.srcObject = null;
    }
  }

  async toggleFacing(): Promise<void> {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.isMirror = this.facingMode === 'user'; // Espejo solo en modo selfie
    await this.startCamera();
  }

  toggleMirror(): void {
    this.isMirror = !this.isMirror;
  }

  toggleUploadMode(): void {
    this.isUploadMode = !this.isUploadMode;
    if (this.isUploadMode) {
      this.stopCamera();
    } else {
      this.clearSelection(); // Limpia foto anterior
      this.startCamera();
    }
  }

  capture(): void {
    if (!this.videoEl?.nativeElement || !this.canvasEl?.nativeElement) return;
    const video = this.videoEl.nativeElement;
    const canvas = this.canvasEl.nativeElement;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Si está en espejo, invertir el canvas horizontalmente antes de dibujar
    if (this.isMirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const ts = new Date().toISOString().replace(/[:.]/g, '');
      const file = new File([blob], `foto-${ts}.png`, { type: blob.type || 'image/png' });
      this.setPreviewFile(file);
    }, 'image/png', 0.92);
  }

  onFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.setPreviewFile(file);
  }

  clearSelection(): void {
    this.capturedFile = null;
    this.revokePreview();
    this.previewUrl = null;
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
    // Si no es modo subida, reactivar cámara
    if (!this.isUploadMode) {
      this.startCamera();
    }
  }

  confirm(): void {
    if (!this.capturedFile || !this.previewUrl) return; // exige archivo para “Usar esta imagen”
    this.stopCamera();
    this.dialogRef.close({ file: this.capturedFile, previewUrl: this.previewUrl } satisfies CameraDialogResult);
  }

  cancel(): void {
    this.stopCamera();
    this.dialogRef.close(undefined);
  }

  private setPreviewFile(file: File): void {
    this.revokePreview();
    this.capturedFile = file;
    this.previewUrl = URL.createObjectURL(file);
  }

  private revokePreview(): void {
    if (this.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }

  private dataURLToFile(dataUrl: string, filename: string): File {
    const [meta, base64] = dataUrl.split(',');
    const mimeMatch = meta.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binStr = atob(base64 || '');
    const len = binStr.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = binStr.charCodeAt(i);
    return new File([u8], filename, { type: mime });
  }
}
