import { SharedModule } from '@/app/shared/shared.module';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  Validators
} from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';

import { DocumentacionService } from '../../service/documentacion/documentacion.service';
import { GestionDocumentalService } from '../../../hiring/service/gestion-documental/gestion-documental.service';

interface HojaMapa {
  file: File;
  fileName: string;
  url: SafeResourceUrl;
  objectUrl: string;
}

/** ===== Formularios tipados para los items del array ===== */
type DocGrupo = FormGroup<{
  tipoId: FormControl<number>;
  archivo: FormControl<File | null>;
}>;

@Component({
  selector: 'app-upload-documents',
  imports: [SharedModule, FormsModule, MatMenuModule, MatIconModule, MatButtonModule],
  templateUrl: './upload-documents.component.html',
  styleUrl: './upload-documents.component.css'
})
export class UploadDocumentsComponent implements OnInit, OnDestroy {
  /* ───────── datos de jerarquía ───────── */
  gruposHojas: { padre: string; hijos: any[] }[] = [];
  hojasPorId: Record<number, any> = {};

  /* ───────── archivos subidos ─────────── */
  uploadedFiles: Record<number, HojaMapa> = {};

  /* ───────── reactive form ────────────── */
  formDoc!: FormGroup;
  documentosArray!: FormArray<DocGrupo>;

  @ViewChild('zipInput') zipInput!: ElementRef<HTMLInputElement>;

  /* ───────── previsualizador ──────────── */
  selectedDocId: number | null = null;
  selectedPdfUrl: SafeResourceUrl | null = null;

  /* ───────── control de vida ──────────── */
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private docSrv: DocumentacionService,
    private gestionDocSrv: GestionDocumentalService,
    private sanitizer: DomSanitizer
  ) {}

  /* ══════════════════════════════════════ */
  ngOnInit(): void {
    this.formDoc = this.fb.group({
      tipo_documental: [[], Validators.required],
      numero_documento: ['', Validators.required],
      codigo_contrato: [''],
      documentos: this.fb.array<DocGrupo>([])
    });

    this.documentosArray = this.formDoc.get('documentos') as FormArray<DocGrupo>;

    // Carga de la jerarquía
    this.docSrv.mostrar_jerarquia_gestion_documental().subscribe({
      next: (data) => {
        this.gruposHojas = this.agruparHojas(data);

        // mapa rápido por id (para label / flags como codigo_contrato)
        this.gruposHojas.forEach((g) => g.hijos.forEach((h) => (this.hojasPorId[h.id] = h)));

        // Reacciona a selección de tipos documentales
        this.formDoc
          .get('tipo_documental')!
          .valueChanges.pipe(takeUntil(this.destroy$))
          .subscribe((ids: number[] | null) => {
            const safeIds = Array.isArray(ids) ? ids : [];
            this.syncDocumentosArray(safeIds);
            this.toggleContrato(safeIds);
          });
      },
      error: () =>
        Swal.fire('Error', 'No se pudo obtener la jerarquía de tipos documentales.', 'error')
    });
  }

  /* ───────── agrupa hojas ───────── */
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

  /* ───────── exige / quita código contrato ─ */
  private toggleContrato(ids: number[]): void {
    const requiere = ids.some((id) => !!this.hojasPorId[id]?.codigo_contrato);
    const ctrl = this.formDoc.get('codigo_contrato');

    if (requiere) {
      ctrl?.setValidators([Validators.required]);
    } else {
      ctrl?.clearValidators();
      // opcional: limpia el valor si ya no se requiere
      // ctrl?.setValue('', { emitEvent: false });
    }

    ctrl?.updateValueAndValidity({ emitEvent: false });
  }

  /* ───────── mantiene FormArray en sync ─── */
  private syncDocumentosArray(ids: number[]): void {
    // Eliminar controles no seleccionados
    for (let i = this.documentosArray.length - 1; i >= 0; i--) {
      const id = this.documentosArray.at(i).controls.tipoId.value;

      if (!ids.includes(id)) {
        this.documentosArray.removeAt(i);

        // limpia recursos asociados
        this.revokeUrl(id);
        delete this.uploadedFiles[id];

        if (this.selectedDocId === id) {
          this.selectedDocId = null;
          this.selectedPdfUrl = null;
        }
      }
    }

    // Agregar controles nuevos
    ids.forEach((id) => {
      const existe = this.documentosArray.controls.some((c) => c.controls.tipoId.value === id);

      if (!existe) {
        const grupo = this.fb.group({
          tipoId: this.fb.nonNullable.control(id),
          archivo: this.fb.control<File | null>(null, Validators.required)
        }) as DocGrupo;

        this.documentosArray.push(grupo);
      }
    });
  }

  /* ───────── subir PDF ───────── */
  subirArchivo(evt: Event, tipoId: number): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      Swal.fire('Archivo no válido', 'Solo se permiten PDF.', 'error');
      input.value = '';
      return;
    }

    // Limpia URL anterior (si existía)
    this.revokeUrl(tipoId);

    const objectUrl = URL.createObjectURL(file);
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);

    this.uploadedFiles[tipoId] = {
      file,
      fileName: file.name,
      url: safeUrl,
      objectUrl
    };

    // setea el File al formArray
    const idx = this.documentosArray.controls.findIndex((c) => c.controls.tipoId.value === tipoId);
    if (idx !== -1) {
      const ctrl = this.documentosArray.at(idx).controls.archivo;
      ctrl.setValue(file);
      ctrl.markAsDirty();
      ctrl.markAsTouched();
      ctrl.updateValueAndValidity({ emitEvent: false });
    }

    this.selectPreview(tipoId);

    // Limpia el input para permitir volver a seleccionar el mismo archivo si se desea
    input.value = '';
  }

  /* ───────── preview ───────── */
  selectPreview(tipoId: number): void {
    const data = this.uploadedFiles[tipoId];
    if (!data) return;

    this.selectedDocId = tipoId;
    this.selectedPdfUrl = data.url;
  }

  verArchivo(tipoId: number): void {
    this.selectPreview(tipoId);
  }

  /* ───────── submit ───────── */
  async onSubmit(): Promise<void> {
    if (this.formDoc.invalid) {
      this.formDoc.markAllAsTouched();
      return;
    }

    const numero_documento = (this.formDoc.value.numero_documento || '').toString().trim();
    const codigo_contrato = (this.formDoc.value.codigo_contrato || '').toString().trim();

    const docs = this.documentosArray.controls;
    if (!docs.length) {
      Swal.fire('Error', 'No hay documentos seleccionados para subir.', 'error');
      return;
    }

    Swal.fire({
      title: 'Cargando',
      icon: 'info',
      html: 'Subiendo documentos, por favor espera...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const results = await Promise.all(
        docs.map(async (docCtrl) => {
          const tipoId = docCtrl.controls.tipoId.value;
          const file = docCtrl.controls.archivo.value;
          const hoja = this.hojasPorId[tipoId];

          if (!file) {
            return { ok: false, tipo: hoja?.name || `Tipo ${tipoId}`, err: 'Archivo vacío' };
          }

          // Si la hoja requiere contrato, lo enviamos; de lo contrario undefined
          const enviarContrato = hoja?.codigo_contrato ? codigo_contrato : undefined;

          try {
            await firstValueFrom(
              this.gestionDocSrv.guardarDocumento(
                file.name, // fileName real
                numero_documento, // cédula / número de documento
                tipoId, // tipo documental
                file, // archivo
                enviarContrato // (opcional) contrato
              )
            );
            return { ok: true, tipo: hoja?.name || file.name };
          } catch (err) {
            return { ok: false, tipo: hoja?.name || file.name, err };
          }
        })
      );

      const exitosos = results.filter((r) => r.ok).map((r) => r.tipo);
      const fallidos = results.filter((r) => !r.ok).map((r) => r.tipo);

      let html = '';
      if (exitosos.length) {
        html += `<b>Subidos correctamente:</b><br>${exitosos.join('<br>')}`;
      }
      if (fallidos.length) {
        html += `${html ? '<br>' : ''}<b>No subidos:</b><br>${fallidos.join('<br>')}`;
      }

      Swal.fire({
        icon: fallidos.length ? 'warning' : 'success',
        title: fallidos.length ? 'Algunos documentos fallaron' : '¡Documentos subidos!',
        html,
        timer: 6000
      });

      // Reset completo solo si TODOS subieron
      if (!fallidos.length) {
        this.resetAll();
      }
    } catch {
      Swal.fire('Error', 'Ocurrió un error inesperado al subir los documentos.', 'error');
    }
  }

  /* ───────── reset total ───────── */
  private resetAll(): void {
    this.formDoc.reset(
      {
        tipo_documental: [],
        numero_documento: '',
        codigo_contrato: ''
      },
      { emitEvent: false }
    );

    // limpia array
    while (this.documentosArray.length) this.documentosArray.removeAt(0);

    // limpia urls
    Object.keys(this.uploadedFiles).forEach((id) => this.revokeUrl(+id));
    this.uploadedFiles = {};

    this.selectedDocId = null;
    this.selectedPdfUrl = null;

    // fuerza validators (por si quedó required en contrato)
    this.toggleContrato([]);

    // nota: si quieres disparar el valueChanges de tipo_documental, hazlo manual con emitEvent:true
  }

  /* ───────── limpia object URLs ───────── */
  private revokeUrl(id: number): void {
    const prev = this.uploadedFiles[id]?.objectUrl;
    if (prev) URL.revokeObjectURL(prev);
  }

  /* ───────── onDestroy ───────── */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    Object.keys(this.uploadedFiles).forEach((id) => this.revokeUrl(+id));
  }

  trackByIndex(index: number): number {
    return index;
  }

  onClickSubidaMasiva(): void {
    // limpia selección previa y abre picker
    if (this.zipInput?.nativeElement) {
      this.zipInput.nativeElement.value = '';
      this.zipInput.nativeElement.click();
    }
  }

  async onZipSelected(evt: Event): Promise<void> {
    const file = (evt.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      Swal.fire('Archivo inválido', 'Debe seleccionar un archivo .zip', 'warning');
      return;
    }

    // Opciones de carga (contrato)
    const { value: opts, isConfirmed } = await Swal.fire({
      title: 'Opciones de carga',
      html: `
        <div style="text-align:left">
          <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">
            <input type="checkbox" id="optContract" checked />
            Leer número de contrato desde el nombre del PDF
          </label>
          <input id="optDefault" class="swal2-input" placeholder="Contrato por defecto (opcional)">
          <small>Si no se detecta en el nombre y escribes aquí, se usará este valor.</small>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Subir',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const contract_from_filename =
          (document.getElementById('optContract') as HTMLInputElement)?.checked ?? true;

        const default_contract =
          (document.getElementById('optDefault') as HTMLInputElement)?.value?.trim() || '';

        return { contract_from_filename, default_contract };
      }
    });

    if (!isConfirmed) return;

    Swal.fire({
      title: 'Subiendo...',
      text: 'Procesando archivos del ZIP',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.docSrv
      .bulkZipUpload(file, {
        contract_from_filename: !!opts?.contract_from_filename,
        default_contract: opts?.default_contract || undefined
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          Swal.close();
          this.mostrarResumenCarga(res);
          // si quieres refrescar una tabla/listado después, hazlo aquí
        },
        error: (err) => {
          Swal.close();
          console.error(err);
          Swal.fire('Error', 'No se pudo subir el ZIP. Revisa la consola para más detalles.', 'error');
        }
      });
  }

  private mostrarResumenCarga(res: any): void {
    const processed = res?.processed ?? 0;
    const created = res?.created ?? 0;
    const skipped = res?.skipped ?? 0;
    const errors = res?.errors ?? 0;

    const primerosErrores = (res?.items ?? [])
      .filter((x: any) => x.status === 'error')
      .slice(0, 5)
      .map((x: any) => `• ${x.path || x.type_name || '—'} → ${x.reason || 'Error'}`)
      .join('<br>');

    Swal.fire({
      icon: errors ? 'warning' : 'success',
      title: 'Resultado de la carga',
      html: `
        <div style="text-align:left">
          <b>Procesados:</b> ${processed}<br>
          <b>Creados:</b> ${created}<br>
          <b>Omitidos:</b> ${skipped}<br>
          <b>Errores:</b> ${errors}<br>
          ${primerosErrores ? `<hr><b>Primeros errores:</b><br>${primerosErrores}` : ''}
        </div>
      `
    });
  }
}
