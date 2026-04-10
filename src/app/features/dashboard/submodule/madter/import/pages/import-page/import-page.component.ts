import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ImportService, ImportResult } from '../../../core/services/import/import.service';

@Component({
  standalone: true,
  selector: 'app-import-page',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './import-page.component.html',
  styleUrl: './import-page.component.css'
})
export class ImportPageComponent {
  private authService = inject(AuthService);
  private importService = inject(ImportService);
  protected router = inject(Router);

  loading = false;
  result: ImportResult | null = null;
  errorMsg = '';
  selectedFile: File | null = null;
  dragOver = false;

  constructor() {
    this.authService.me().subscribe({
      error: () => void this.router.navigate(['/dashboard/madter/dashboard'])
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.setFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  private setFile(file: File): void {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.errorMsg = 'Solo se aceptan archivos Excel (.xlsx o .xls)';
      return;
    }
    this.selectedFile = file;
    this.errorMsg = '';
    this.result = null;
  }

  downloadTemplate(): void {
    this.importService.downloadTemplate();
  }

  import(): void {
    if (!this.selectedFile) return;
    this.loading = true;
    this.result = null;
    this.errorMsg = '';

    this.importService.importFile(this.selectedFile).subscribe({
      next: res => {
        this.result = res;
        this.loading = false;
        this.selectedFile = null;
      },
      error: err => {
        this.errorMsg = err?.error?.message ?? 'Error al procesar el archivo.';
        this.loading = false;
      }
    });
  }

  clearFile(): void {
    this.selectedFile = null;
    this.result = null;
    this.errorMsg = '';
  }
}
