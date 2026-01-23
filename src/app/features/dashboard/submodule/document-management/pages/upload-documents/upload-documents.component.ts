
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { Title } from '@angular/platform-browser';
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
import { MatDividerModule } from '@angular/material/divider';
import { DomSanitizer } from '@angular/platform-browser';
import { SharedModule } from '@/app/shared/shared.module';
import { Subject, firstValueFrom } from 'rxjs';
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
    MatTooltipModule,
    MatDividerModule
  ],
  templateUrl: './upload-documents.component.html',
  styleUrls: ['./upload-documents.component.css']
})
export class UploadDocumentsComponent implements OnInit, OnDestroy {
  // Data
  gruposHojas: { padre: string; hijos: any[] }[] = [];
  hojasPorId: Record<number, any> = {};

  // File Queue
  fileQueue: FileQueueItem[] = [];
  allSelected = false;

  // Forms
  bulkEditForm: FormGroup;
  numeroDocumentoControl = new FormControl('', Validators.required);

  // UI State
  dragOver = false;
  isUploading = false;

  // Element Refs
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('zipInput') zipInput!: ElementRef<HTMLInputElement>;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private docSrv: DocumentacionService,
    private gestionDocSrv: GestionDocumentalService,
    private sanitizer: DomSanitizer,
    private titleService: Title,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.bulkEditForm = this.fb.group({
      tipoId: [null],
      contractCode: ['']
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.titleService.setTitle('Carga de Documentos | Gestión Documental');
      this.loadHierarchy();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadHierarchy() {
    this.docSrv.mostrar_jerarquia_gestion_documental().subscribe({
      next: (data) => {
        this.gruposHojas = this.agruparHojas(data);
        this.gruposHojas.forEach((g) => g.hijos.forEach((h) => (this.hojasPorId[h.id] = h)));
      },
      error: () => Swal.fire('Error', 'No se pudo cargar la jerarquía de documentos.', 'error')
    });
  }

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

  // --- Drag & Drop ---
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
      input.value = '';
    }
  }

  handleFiles(fileList: FileList) {
    const maxBytes = 10 * 1024 * 1024; // 10MB
    let addedCount = 0;

    Array.from(fileList).forEach(file => {
      if (!file.name.toLowerCase().endsWith('.pdf')) return;
      if (file.size > maxBytes) {
        // Optional: Notify user about skip? For now, we just skip silent or use toast
        return;
      }

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
      addedCount++;
    });

    if (addedCount > 0) {
      // Little toast feedback could be nice here
    }
  }

  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // --- Queue Actions ---
  removeFromQueue(item: FileQueueItem) {
    const idx = this.fileQueue.indexOf(item);
    if (idx > -1) this.fileQueue.splice(idx, 1);
  }

  toggleSelectAll() {
    this.allSelected = !this.allSelected;
    this.fileQueue.forEach(f => f.selected = this.allSelected);
  }

  applyBulkMetadata() {
    const { tipoId, contractCode } = this.bulkEditForm.value;
    const selected = this.fileQueue.filter(f => f.selected);

    if (selected.length === 0) {
      Swal.fire('Atención', 'Selecciona archivos de la lista para aplicar cambios.', 'info');
      return;
    }

    selected.forEach(f => {
      if (tipoId) f.typeId = tipoId;
      if (contractCode !== '' && contractCode !== null) f.contractCode = contractCode;
    });

    // Unselect after apply? User preference usually is keep selected.
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Datos aplicados',
      showConfirmButton: false,
      timer: 1500
    });
  }

  // --- Validation ---
  get canUpload(): boolean {
    if (this.isUploading) return false;
    if (this.fileQueue.length === 0) return false;
    // Check global requirement
    if (this.numeroDocumentoControl.invalid) return false;
    // Check if at least one pending file exists
    const hasPending = this.fileQueue.some(f => f.status === 'pending' || f.status === 'error');
    if (!hasPending) return false;

    // Check mandatory types for pending files
    const pendingAreValid = this.fileQueue
      .filter(f => f.status === 'pending' || f.status === 'error')
      .every(f => !!f.typeId);

    return pendingAreValid;
  }

  async startUpload() {
    // Double check just in case
    if (!this.canUpload) {
      if (this.numeroDocumentoControl.invalid) {
        this.numeroDocumentoControl.markAsTouched();
        return;
      }
      return;
    }

    const pending = this.fileQueue.filter(f => f.status === 'pending' || f.status === 'error');
    const numeroDoc = this.numeroDocumentoControl.value!;

    // 1. Show Loading Swal
    Swal.fire({
      title: 'Subiendo documentos',
      text: 'Por favor espere...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    this.isUploading = true;

    // 2. Process Uploads
    const CONCURRENCY = 3;
    const pool: Promise<void>[] = [];

    for (const item of pending) {
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

    // 3. Final Result Analysis
    const errors = this.fileQueue.filter(f => f.status === 'error');
    const success = this.fileQueue.filter(f => f.status === 'success');

    // 4. Show Result Swal
    if (errors.length > 0) {
      Swal.fire({
        title: 'Carga finalizada con errores',
        text: `Subidos: ${success.length}. Fallidos: ${errors.length}. Revisa la lista.`,
        icon: 'warning'
      });
      // Do NOT reset queue so user can retry errors
    } else {
      Swal.fire({
        title: '¡Operación Exitosa!',
        text: 'Todos los documentos se cargaron correctamente.',
        icon: 'success'
      }).then(() => {
        this.resetAll();
      });
    }
  }

  // Logic to upload a single file
  private async uploadSingleFile(item: FileQueueItem, numeroDoc: string) {
    if (!item.typeId) return;

    item.status = 'uploading';
    // Simulate some granular progress if we could, but here mostly binary

    const hoja = this.hojasPorId[item.typeId];
    const contract = hoja?.codigo_contrato ? (item.contractCode || '') : undefined;

    try {
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
    } catch (err: any) {
      console.error(err);
      item.status = 'error';
      item.errorMessage = 'Error en servidor';
    }
  }

  resetAll() {
    this.fileQueue = [];
    this.numeroDocumentoControl.reset();
    this.bulkEditForm.reset();
    this.allSelected = false;
  }

  // --- Legacy ZIP functionality ---
  onClickSubidaMasiva() {
    this.zipInput.nativeElement.value = '';
    this.zipInput.nativeElement.click();
  }

  onZipSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      Swal.fire('Archivo inválido', 'Solo se permiten archivos .zip', 'error');
      return;
    }

    Swal.fire({
      title: 'Configuración ZIP',
      html: `
        <div style="text-align: left; font-size: 14px;">
           <p>¿Deseas intentar extraer el contrato del nombre del archivo?</p>
        </div>
      `,
      input: 'text',
      inputPlaceholder: 'Contrato por defecto (Opcional)',
      showCancelButton: true,
      confirmButtonText: 'Subir ZIP',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.processZip(file, res.value);
      }
    });
  }

  processZip(file: File, defaultContract: string) {
    Swal.fire({ title: 'Subiendo ZIP...', didOpen: () => Swal.showLoading() });

    this.docSrv.bulkZipUpload(file, { default_contract: defaultContract, contract_from_filename: true })
      .subscribe({
        next: (res) => {
          Swal.close();
          const msg = `Procesados: ${res.processed} | Errores: ${res.errors}`;
          Swal.fire(res.errors > 0 ? 'Completado con Alertas' : 'Éxito', msg, res.errors > 0 ? 'warning' : 'success');
        },
        error: () => Swal.fire('Error', 'Fallo en la subida del ZIP', 'error')
      });
  }
}
