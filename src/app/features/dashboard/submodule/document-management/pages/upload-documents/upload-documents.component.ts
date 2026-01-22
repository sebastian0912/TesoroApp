
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SharedModule } from '@/app/shared/shared.module';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';

import { GestionDocumentalService } from '../../../hiring/service/gestion-documental/gestion-documental.service';
import { DocumentacionService } from '../../service/documentacion/documentacion.service';

export interface FileQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  typeId: number | null;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
  selected: boolean;
  contractCode?: string;
  uuid?: string; // for tracking
}

@Component({
  selector: 'app-upload-documents',
  standalone: true,
  imports: [
    CommonModule,
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  templateUrl: './upload-documents.component.html',
  styleUrls: ['./upload-documents.component.css']
})
export class UploadDocumentsComponent implements OnInit, OnDestroy {
  // Steps
  currentStep = 1;
  steps = [
    { num: 1, label: 'Cargar Archivos' },
    { num: 2, label: 'Detalles y Revisión' },
    { num: 3, label: 'Finalizar' }
  ];

  // Data
  gruposHojas: { padre: string; hijos: any[] }[] = [];
  hojasPorId: Record<number, any> = {};

  // Queue
  fileQueue: FileQueueItem[] = [];

  // Selection
  allSelected = false;

  // Metadata Form (Bulk)
  bulkEditForm: FormGroup;
  numeroDocumentoControl = new FormControl('', Validators.required);

  // Drag & Drop
  dragOver = false;

  // Upload State
  isUploading = false;
  overallProgress = 0;
  uploadSummary = {
    total: 0,
    success: 0,
    error: 0
  };

  private destroy$ = new Subject<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('zipInput') zipInput!: ElementRef<HTMLInputElement>;

  constructor(
    private fb: FormBuilder,
    private docSrv: DocumentacionService,
    private gestionDocSrv: GestionDocumentalService,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.bulkEditForm = this.fb.group({
      tipoId: [null],
      contractCode: ['']
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Load hierarchy only in browser
      this.docSrv.mostrar_jerarquia_gestion_documental().subscribe({
        next: (data) => {
          this.gruposHojas = this.agruparHojas(data);
          this.gruposHojas.forEach((g) => g.hijos.forEach((h) => (this.hojasPorId[h.id] = h)));
        },
        error: () => Swal.fire('Error', 'No se pudo cargar la jerarquía.', 'error')
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Hierarchy Helper (Legacy) ---
  private agruparHojas(nodos: any[]): { padre: string; hijos: any[] }[] {
    const res: { padre: string; hijos: any[] }[] = [];
    const walk = (list: any[], padre: string) => {
      list.forEach((n: any) => {
        if (Array.isArray(n.subtypes) && n.subtypes.length) {
          walk(n.subtypes, n.name);
        } else {
          const g = res.find((r) => r.padre === padre);
          g ? g.hijos.push(n) : res.push({ padre, hijos: [n] });
        }
      });
    };
    walk(nodos, 'Raíz');
    return res;
  }

  // --- Step Navigation ---
  goToStep(step: number) {
    if (step === 2 && this.fileQueue.length === 0) {
      Swal.fire('Atención', 'Selecciona al menos un archivo.', 'warning');
      return;
    }
    if (step === 3) {
      // Only go to 3 via Upload action
      return;
    }
    this.currentStep = step;
  }

  // --- File Handling ---
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
    const files = event.dataTransfer?.files;
    if (files) this.handleFiles(files);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(input.files);
      input.value = ''; // Reset
    }
  }

  handleFiles(fileList: FileList) {
    const validExts = ['.pdf'];
    const maxBytes = 10 * 1024 * 1024; // 10MB

    Array.from(fileList).forEach(file => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        // Skip non-pdf or warn? Just skip for now to avoid spam
        return;
      }
      if (file.size > maxBytes) {
        Swal.fire('Archivo muy grande', `${file.name} excede 10MB`, 'warning');
        return;
      }

      // Add to queue
      this.fileQueue.push({
        id: this.generateId(),
        file,
        name: file.name,
        size: file.size,
        typeId: null,
        status: 'pending',
        progress: 0,
        selected: false
      });
    });

    if (this.currentStep === 1 && this.fileQueue.length > 0) {
      this.currentStep = 2; // Auto advance
    }
  }

  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // --- Queue Management ---
  removeFromQueue(item: FileQueueItem) {
    const idx = this.fileQueue.indexOf(item);
    if (idx > -1) this.fileQueue.splice(idx, 1);
    if (this.fileQueue.length === 0) this.currentStep = 1;
  }

  toggleSelectAll() {
    this.allSelected = !this.allSelected;
    this.fileQueue.forEach(f => f.selected = this.allSelected);
  }

  applyBulkMetadata() {
    const { tipoId, contractCode } = this.bulkEditForm.value;
    const selected = this.fileQueue.filter(f => f.selected);

    if (selected.length === 0) {
      Swal.fire('Nada seleccionado', 'Selecciona archivos de la lista para editar.', 'info');
      return;
    }

    selected.forEach(f => {
      if (tipoId) f.typeId = tipoId;
      if (contractCode !== '' && contractCode !== null) f.contractCode = contractCode;
    });

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Datos actualizados',
      showConfirmButton: false,
      timer: 1500
    });
  }

  // --- Upload Logic ---
  async startUpload() {
    if (this.numeroDocumentoControl.invalid) {
      this.numeroDocumentoControl.markAsTouched();
      Swal.fire('Falta Número de Documento', 'Por favor ingresa el número de documento del candidato.', 'warning');
      return;
    }

    const pending = this.fileQueue.filter(f => f.status === 'pending' || f.status === 'error');
    if (pending.length === 0) return;

    // Check mandatory metadata
    const missingData = pending.some(f => !f.typeId);
    if (missingData) {
      Swal.fire('Faltan Tipos', 'Asigna el tipo documental a todos los archivos antes de subir.', 'warning');
      return;
    }

    this.isUploading = true;
    this.currentStep = 3; // Show progress
    this.uploadSummary = { total: pending.length, success: 0, error: 0 };
    this.overallProgress = 0;

    // Concurrency limit: 3
    const CONCURRENCY = 3;
    const pool: Promise<void>[] = [];

    const numeroDoc = this.numeroDocumentoControl.value!;

    for (const item of pending) {
      // Wait if pool is full
      while (pool.length >= CONCURRENCY) {
        await Promise.race(pool);
      }

      const p = this.uploadSingleFile(item, numeroDoc).then(() => {
        const idx = pool.indexOf(p);
        if (idx > -1) pool.splice(idx, 1);
      });
      pool.push(p);
    }

    await Promise.all(pool);

    this.isUploading = false;
    this.overallProgress = 100;
  }

  async uploadSingleFile(item: FileQueueItem, numeroDoc: string) {
    if (!item.typeId) return;

    item.status = 'uploading';
    item.progress = 10;

    // Check if contract is required
    const hoja = this.hojasPorId[item.typeId];
    const contract = hoja?.codigo_contrato ? (item.contractCode || '') : undefined;

    try {
      // Simulate progress or just await
      // Since service doesn't give progress stream easily for single call (Promise mostly),
      // we just toggle state.

      await firstValueFrom(
        this.gestionDocSrv.guardarDocumento(
          item.name,
          numeroDoc,
          item.typeId,
          item.file,
          contract
        )
      );

      item.status = 'success';
      item.progress = 100;
      this.uploadSummary.success++;
    } catch (err: any) {
      item.status = 'error';
      item.progress = 0;
      item.errorMessage = err?.message || 'Error al subir';
      this.uploadSummary.error++;
    }

    // Recalculate overall progress roughly
    const completed = this.fileQueue.filter(f => f.status === 'success' || f.status === 'error').length;
    this.overallProgress = (completed / this.fileQueue.length) * 100;
  }

  get canUpload(): boolean {
    // True if at least one file is pending and has type
    return this.fileQueue.some(f => f.status === 'pending') && this.fileQueue.every(f => f.typeId || f.status === 'success');
  }

  // --- ZIP Legacy ---
  onClickSubidaMasiva() {
    this.zipInput.nativeElement.value = '';
    this.zipInput.nativeElement.click();
  }

  onZipSelected(event: Event) {
    // Existing ZIP logic wrapper (simplified for wizard)
    // We can just call the ZIP service.
    // For this refactor, I'll essentially keep the old logic but maybe in a modal or separate flow.
    // But user asked for Overhaul. Let's keep it simple: Just trigger the old ZIP flow logic.
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      Swal.fire('Inválido', 'Solo ZIP', 'error');
      return;
    }

    // Quick swal for params
    Swal.fire({
      title: 'Carga Masiva ZIP',
      input: 'text',
      inputLabel: 'Número de Contrato por defecto (Opcional)',
      showCancelButton: true
    }).then(res => {
      if (res.isConfirmed) {
        this.processZip(file, res.value);
      }
    });
  }

  processZip(file: File, defaultContract: string) {
    Swal.fire({ title: 'Procesando ZIP...', didOpen: () => Swal.showLoading() });
    this.docSrv.bulkZipUpload(file, { default_contract: defaultContract, contract_from_filename: true })
      .subscribe({
        next: (res) => {
          Swal.close();
          // Show summary (reuse logic if possible or simple alert)
          Swal.fire('ZIP Procesado', `Procesados: ${res.processed}, Errores: ${res.errors}`, 'success');
        },
        error: () => Swal.close()
      });
  }
}
