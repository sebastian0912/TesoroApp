import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { trigger, style, transition, animate } from '@angular/animations';
import { HttpClient } from '@angular/common/http';

export interface ViewerDocument {
  id: number;
  title: string;
  type_name?: string;
  file_url: string;
}

export interface VerPdfsData {
  title: string;
  documents: ViewerDocument[];
}

@Component({
  selector: 'app-ver-pdfs',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './ver-pdfs.component.html',
  styleUrls: ['./ver-pdfs.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('dialogFade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate(
          '180ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '150ms ease-in',
          style({ opacity: 0, transform: 'translateY(6px)' }),
        ),
      ]),
    ]),
  ],
})
export class VerPdfsComponent implements OnInit, OnDestroy {
  selectedIndex = 0;

  /** URL blob actual para poder hacer revokeObjectURL */
  private currentObjectUrl: string | null = null;

  /** URL segura que se bindea al iframe */
  currentSafeUrl: SafeResourceUrl | null = null;

  // Inyección con función `inject` (evita el problema de this.http undefined)
  private readonly http = inject(HttpClient);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: VerPdfsData,
    private readonly dialogRef: MatDialogRef<VerPdfsComponent>,
    private readonly sanitizer: DomSanitizer,
  ) {}

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  ngOnInit(): void {
    // Si hay documentos y el primero es PDF, cargamos preview
    if (this.hasDocuments && this.isPdf(this.selectedDoc)) {
      this.loadPdfPreview(this.selectedDoc);
    }
  }

  ngOnDestroy(): void {
    this.clearPreview();
  }

  // ---------------------------------------------------------------------------
  // GETTERS
  // ---------------------------------------------------------------------------

  get hasDocuments(): boolean {
    return Array.isArray(this.data?.documents) && this.data.documents.length > 0;
  }

  get selectedDoc(): ViewerDocument | null {
    if (!this.hasDocuments) return null;
    return this.data.documents[this.selectedIndex] ?? null;
  }

  // ---------------------------------------------------------------------------
  // SELECCIÓN / CIERRE
  // ---------------------------------------------------------------------------

  selectDoc(index: number): void {
    this.selectedIndex = index;
    // Solo intentamos cargar preview si es PDF
    if (this.isPdf(this.selectedDoc)) {
      this.loadPdfPreview(this.selectedDoc);
    } else {
      this.clearPreview();
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  // ---------------------------------------------------------------------------
  // HELPERS DE TIPO
  // ---------------------------------------------------------------------------

  isPdf(doc: ViewerDocument | null): boolean {
    if (!doc?.file_url) return false;
    const url = doc.file_url.toLowerCase();
    return url.endsWith('.pdf');
  }

  isExcel(doc: ViewerDocument | null): boolean {
    if (!doc?.file_url) return false;
    const url = doc.file_url.toLowerCase();
    return url.endsWith('.xlsx') || url.endsWith('.xls');
  }

  isImage(doc: ViewerDocument | null): boolean {
    if (!doc?.file_url) return false;
    const url = doc.file_url.toLowerCase();
    return (
      url.endsWith('.png') ||
      url.endsWith('.jpg') ||
      url.endsWith('.jpeg') ||
      url.endsWith('.gif') ||
      url.endsWith('.webp')
    );
  }

  getChipLabel(doc: ViewerDocument): string {
    if (this.isPdf(doc)) return 'PDF';
    if (this.isExcel(doc)) return 'Excel';
    if (this.isImage(doc)) return 'Imagen';
    return doc.type_name || 'Documento';
  }

  getIcon(doc: ViewerDocument): string {
    if (this.isPdf(doc)) return 'picture_as_pdf';
    if (this.isExcel(doc)) return 'table_chart';
    if (this.isImage(doc)) return 'image';
    return 'description';
  }

  // ---------------------------------------------------------------------------
  // PREVIEW PDF CON BLOB (RESPETA CSP frame-src 'self' blob: data:)
  // ---------------------------------------------------------------------------

  /** Limpia el preview actual, revocando el ObjectURL para evitar fugas de memoria. */
  private clearPreview(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.currentSafeUrl = null;
  }

  /**
   * Carga el PDF como blob y genera un blob: URL que sí cumple la CSP.
   * Si no es PDF, se limpia el iframe.
   */
  private loadPdfPreview(doc: ViewerDocument | null): void {
    this.clearPreview();

    if (!doc || !this.isPdf(doc)) return;

    this.http.get(doc.file_url, { responseType: 'blob' }).subscribe({
      next: (blob: Blob) => {
        const objectUrl = URL.createObjectURL(blob);
        this.currentObjectUrl = objectUrl;
        this.currentSafeUrl =
          this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
      },
      error: (err) => {
        // eslint-disable-next-line no-console
        console.error('[VerPdfsComponent] Error cargando PDF:', err);
        this.currentSafeUrl = null;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // ACCIONES (ABRIR / DESCARGAR)
  // ---------------------------------------------------------------------------

  openInNewTab(doc: ViewerDocument | null): void {
    if (!doc?.file_url) return;
    window.open(doc.file_url, '_blank', 'noreferrer');
  }

  download(doc: ViewerDocument | null): void {
    if (!doc?.file_url) return;
    window.open(doc.file_url, '_blank', 'noreferrer');
  }
}
