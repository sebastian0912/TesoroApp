import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { DocViewerService } from '@/app/shared/services/doc-viewer/doc-viewer.service';
import { trigger, style, transition, animate } from '@angular/animations';

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

type PreviewType = 'pdf' | 'image' | 'spreadsheet' | 'unknown';

@Component({
  selector: 'app-ver-pdfs',
  standalone: true,
  imports: [
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
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(6px)' })),
      ]),
    ]),
  ],
})
export class VerPdfsComponent implements OnInit, OnDestroy {
  selectedIndex = 0;

  // Estado de carga / errores
  loading = false;
  loadError: string | null = null;

  // Tipo detectado por MIME del blob
  previewType: PreviewType = 'unknown';

  // PDF
  pdfSafeUrl: SafeResourceUrl | null = null;

  // Imagen
  imageSafeUrl: SafeUrl | null = null;

  // Spreadsheet
  excelRows: any[][] = [];
  excelSheets: string[] = [];
  excelActiveSheet = 0;
  readonly maxPreviewRows = 500;

  private wb: any = null;
  private xlsxLib: any = null;
  private currentBlobUrl: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: VerPdfsData,
    private readonly dialogRef: MatDialogRef<VerPdfsComponent>,
    private readonly sanitizer: DomSanitizer,
    private readonly docViewer: DocViewerService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (this.hasDocuments) this.loadPreview(this.selectedDoc);
  }

  ngOnDestroy(): void {
    this.revokeBlobUrl();
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
    if (index === this.selectedIndex) return;
    this.selectedIndex = index;
    this.resetState();
    this.loadPreview(this.selectedDoc);
  }

  close(): void {
    this.dialogRef.close();
  }

  switchSheet(idx: number): void {
    if (idx === this.excelActiveSheet) return;
    this.excelActiveSheet = idx;
    this.renderActiveSheet();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // CARGA UNIFICADA POR MIME
  // ---------------------------------------------------------------------------

  private async loadPreview(doc: ViewerDocument | null): Promise<void> {
    if (!doc?.file_url) return;

    this.loading = true;
    this.cdr.markForCheck();

    const blob = await this.docViewer.fetchBlob(doc.file_url);
    if (!blob) {
      this.loading = false;
      this.previewType = 'unknown';
      this.cdr.markForCheck();
      return;
    }

    const mime = (blob.type || '').toLowerCase();

    // Detectar tipo: primero por MIME, luego por extensión de URL como fallback
    if (mime.includes('pdf') || this.urlEndsWith(doc, '.pdf')) {
      await this.showPdf(blob);
    } else if (mime.startsWith('image/') || this.urlMatchesImage(doc)) {
      this.showImage(blob);
    } else if (
      mime.includes('spreadsheet') ||
      mime.includes('excel') ||
      mime === 'text/csv' ||
      mime === 'text/plain' ||
      this.urlMatchesSpreadsheet(doc)
    ) {
      await this.showSpreadsheet(blob, doc);
    } else {
      // Fallback: si no hay MIME del servidor, intentar por extensión de URL
      // Si tampoco, mostrar "no disponible"
      this.loading = false;
      this.previewType = 'unknown';
      this.cdr.markForCheck();
    }
  }

  private async showPdf(blob: Blob): Promise<void> {
    this.revokeBlobUrl();
    const url = URL.createObjectURL(blob);
    this.currentBlobUrl = url;
    this.pdfSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.previewType = 'pdf';
    // loading se apaga en onIframeLoaded
    this.cdr.markForCheck();
  }

  private showImage(blob: Blob): void {
    this.revokeBlobUrl();
    const url = URL.createObjectURL(blob);
    this.currentBlobUrl = url;
    this.imageSafeUrl = this.sanitizer.bypassSecurityTrustUrl(url);
    this.previewType = 'image';
    this.loading = false;
    this.cdr.markForCheck();
  }

  private async showSpreadsheet(blob: Blob, doc: ViewerDocument): Promise<void> {
    try {
      if (!this.xlsxLib) this.xlsxLib = await import('xlsx');
      const XLSX = this.xlsxLib;

      const mime = (blob.type || '').toLowerCase();
      if (mime === 'text/csv' || mime === 'text/plain' || this.urlEndsWith(doc, '.csv')) {
        const text = await blob.text();
        this.wb = XLSX.read(text, { type: 'string' });
      } else {
        const buf = await blob.arrayBuffer();
        this.wb = XLSX.read(buf, { type: 'array' });
      }

      this.excelSheets = this.wb.SheetNames ?? [];
      this.excelActiveSheet = 0;
      this.renderActiveSheet();
      this.previewType = 'spreadsheet';
    } catch {
      this.previewType = 'unknown';
    }

    this.loading = false;
    this.cdr.markForCheck();
  }

  private renderActiveSheet(): void {
    if (!this.wb || !this.xlsxLib) return;
    const ws = this.wb.Sheets[this.wb.SheetNames[this.excelActiveSheet]];
    this.excelRows = (this.xlsxLib.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      blankrows: false,
    }) as any[][]).slice(0, this.maxPreviewRows);
  }

  private resetState(): void {
    this.revokeBlobUrl();
    this.loading = false;
    this.loadError = null;
    this.previewType = 'unknown';
    this.pdfSafeUrl = null;
    this.imageSafeUrl = null;
    this.excelRows = [];
    this.excelSheets = [];
    this.excelActiveSheet = 0;
    this.wb = null;
  }

  private revokeBlobUrl(): void {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  // ---------------------------------------------------------------------------
  // HELPERS DE URL (solo fallback cuando el servidor no manda Content-Type)
  // ---------------------------------------------------------------------------

  private urlEndsWith(doc: ViewerDocument, ext: string): boolean {
    return (doc?.file_url ?? '').toLowerCase().split('?')[0].endsWith(ext);
  }

  private urlMatchesImage(doc: ViewerDocument): boolean {
    const u = (doc?.file_url ?? '').toLowerCase().split('?')[0];
    return /\.(png|jpg|jpeg|gif|webp|bmp)$/.test(u);
  }

  private urlMatchesSpreadsheet(doc: ViewerDocument): boolean {
    const u = (doc?.file_url ?? '').toLowerCase().split('?')[0];
    return /\.(xlsx|xls|csv)$/.test(u);
  }

  // ---------------------------------------------------------------------------
  // HELPERS DE CHIP/ÍCONO (para la lista lateral — sin acceso al blob)
  // ---------------------------------------------------------------------------

  getChipLabel(doc: ViewerDocument): string {
    const u = (doc?.file_url ?? '').toLowerCase().split('?')[0];
    if (u.endsWith('.pdf')) return 'PDF';
    if (u.endsWith('.xlsx') || u.endsWith('.xls')) return 'Excel';
    if (u.endsWith('.csv')) return 'CSV';
    if (/\.(png|jpg|jpeg|gif|webp)$/.test(u)) return 'Imagen';
    return doc.type_name || 'Documento';
  }

  getIcon(doc: ViewerDocument): string {
    const label = this.getChipLabel(doc).toLowerCase();
    if (label === 'pdf') return 'picture_as_pdf';
    if (label === 'excel') return 'table_chart';
    if (label === 'csv') return 'grid_on';
    if (label === 'imagen') return 'image';
    return 'description';
  }

  // ---------------------------------------------------------------------------
  // EVENTOS DEL IFRAME
  // ---------------------------------------------------------------------------

  onIframeLoaded(): void {
    this.loading = false;
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // ACCIONES
  // ---------------------------------------------------------------------------

  openInNewTab(doc: ViewerDocument | null): void {
    if (!doc?.file_url) return;
    this.docViewer.openInNewTab(doc.file_url);
  }

  download(doc: ViewerDocument | null): void {
    if (!doc?.file_url) return;
    this.docViewer.openInNewTab(doc.file_url);
  }
}
