import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-ver-pdfs',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    NgClass
  ],
  templateUrl: './ver-pdfs.component.html',
  styleUrls: ['./ver-pdfs.component.css']
})

export class VerPdfsComponent {
  selectedPdf: SafeResourceUrl | null = null;
  selectedCedula: any = null;  // Track selected cédula

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<VerPdfsComponent>,
    private sanitizer: DomSanitizer
  ) { }


  onClose(): void {
    this.dialogRef.close();
  }

  isMobile(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  showPdf(base64: string, cedula: any) {
    this.selectedCedula = cedula;
  
    if (this.isMobile()) {
      // Abrir el PDF en una nueva pestaña
      const pdfWindow = window.open();
      if (pdfWindow) {
        pdfWindow.document.write(
          `<iframe width="100%" height="100%" src="${base64}" frameborder="0"></iframe>`
        );
      }
    } else {
      // Si no es móvil, muestra el PDF en el iframe dentro del modal
      this.selectedPdf = this.sanitizer.bypassSecurityTrustResourceUrl(base64);
    }
  }
  
  

  
}

