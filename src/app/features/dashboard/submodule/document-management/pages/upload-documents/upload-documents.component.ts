import { SharedModule } from '@/app/shared/shared.module';
import { Component, OnInit } from '@angular/core';
import { DocumentacionService } from '../../service/documentacion/documentacion.service';
import Swal from 'sweetalert2';
import { FormArray, FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { GestionDocumentalService } from '../../../hiring/service/gestion-documental/gestion-documental.service';
import { finalize } from 'rxjs/operators';

interface HojaMapa {
  file: File;
  fileName: string;
  url: SafeResourceUrl;
  objectUrl: string;          // para liberar memoria
}

@Component({
  selector: 'app-upload-documents',
  imports: [
    SharedModule,
    FormsModule
  ],
  templateUrl: './upload-documents.component.html',
  styleUrl: './upload-documents.component.css'
})
export class UploadDocumentsComponent implements OnInit {
  /* ───────── datos de jerarquía ───────── */
  gruposHojas: { padre: string; hijos: any[] }[] = [];
  hojasPorId: Record<number, any> = {};

  /* ───────── archivos subidos ─────────── */
  uploadedFiles: Record<number, HojaMapa> = {};

  /* ───────── reactive form ────────────── */
  formDoc!: FormGroup;
  get documentosArray(): FormArray {
    return this.formDoc.get('documentos') as FormArray;
  }

  /* ───────── previsualizador ──────────── */
  selectedDocId: number | null = null;
  selectedPdfUrl: SafeResourceUrl | null = null;

  constructor(
    private fb: FormBuilder,
    private docSrv: DocumentacionService,
    private gestionDocSrv: GestionDocumentalService,
    private sanitizer: DomSanitizer
  ) { }

  /* ══════════════════════════════════════ */
  ngOnInit(): void {
    this.formDoc = this.fb.group({
      tipo_documental: [[], Validators.required],
      numero_documento: [null, Validators.required],
      codigo_contrato: [null],
      documentos: this.fb.array([])
    });

    this.docSrv.mostrar_jerarquia_gestion_documental().subscribe({
      next: data => {
        this.gruposHojas = this.agruparHojas(data);
        this.gruposHojas.forEach(g =>
          g.hijos.forEach(h => (this.hojasPorId[h.id] = h))
        );
        this.formDoc
          .get('tipo_documental')
          ?.valueChanges.subscribe(ids => {
            this.syncDocumentosArray(ids);
            this.toggleContrato(ids);
          });
      },
      error: () =>
        Swal.fire(
          'Error',
          'No se pudo obtener la jerarquía de tipos documentales.',
          'error'
        )
    });
  }

  /* ───────── agrupa hojas por padre ───── */
  private agruparHojas(nodos: any[]): { padre: string; hijos: any[] }[] {
    const res: { padre: string; hijos: any[] }[] = [];
    const walk = (list: any[], padre: string) => {
      list.forEach((n: any) => {
        if (n.subtypes?.length) {
          walk(n.subtypes, n.name);
        } else {
          const g = res.find(r => r.padre === padre);
          g ? g.hijos.push(n) : res.push({ padre, hijos: [n] });
        }
      });
    };
    walk(nodos, 'Raíz');
    return res;
  }

  /* ───────── exige / quita código contrato ─ */
  private toggleContrato(ids: number[]): void {
    const requiere = ids.some(id => this.hojasPorId[id]?.codigo_contrato);
    const ctrl = this.formDoc.get('codigo_contrato');
    requiere ? ctrl?.setValidators(Validators.required) : ctrl?.clearValidators();
    ctrl?.updateValueAndValidity();
  }

  /* ───────── mantiene FormArray en sync ─── */
  private syncDocumentosArray(ids: number[]): void {
    /* quita los eliminados */
    for (let i = this.documentosArray.length - 1; i >= 0; i--) {
      const id = this.documentosArray.at(i).get('tipoId')?.value;
      if (!ids.includes(id)) {
        this.documentosArray.removeAt(i);
        this.revokeUrl(id);
        delete this.uploadedFiles[id];
        if (this.selectedDocId === id) {
          this.selectedDocId = null;
          this.selectedPdfUrl = null;
        }
      }
    }
    /* agrega nuevos */
    ids.forEach(id => {
      const existe = this.documentosArray.controls.some(
        c => c.get('tipoId')?.value === id
      );
      if (!existe) {
        this.documentosArray.push(
          this.fb.group({
            tipoId: [id],
            archivo: [null, Validators.required]
          })
        );
      }
    });
  }

  /* ───────── subir PDF ─────────────────── */
  subirArchivo(evt: Event, tipoId: number): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];

    if (
      !file ||
      file.type !== 'application/pdf' ||
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      Swal.fire('Archivo no válido', 'Solo se permiten PDF.', 'error');
      input.value = '';
      return;
    }

    this.revokeUrl(tipoId);                        // libera anterior

    const objectUrl = URL.createObjectURL(file);
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);

    this.uploadedFiles[tipoId] = {
      file,
      fileName: file.name,
      url: safeUrl,
      objectUrl
    };

    /* marca el control de archivo en el FormArray */
    const idx = this.documentosArray.controls.findIndex(
      c => c.get('tipoId')?.value === tipoId
    );
    if (idx !== -1) {
      this.documentosArray.at(idx).get('archivo')?.setValue(file);
    }

    /* si es primero o el seleccionado, mostrar en preview */
    this.selectPreview(tipoId);

  }

  /* ───────── cambia el PDF mostrado ─────── */
  selectPreview(tipoId: number): void {
    const data = this.uploadedFiles[tipoId];
    if (!data) return;
    this.selectedDocId = tipoId;
    this.selectedPdfUrl = data.url;
  }

  /* “Ver PDF” en menú simplemente hace preview */
  verArchivo(tipoId: number): void {
    this.selectPreview(tipoId);
  }

  /* ───────── submit (placeholder) ───────── */
  onSubmit(): void {
    if (this.formDoc.invalid) {
      this.formDoc.markAllAsTouched();
      return;
    }

    const { numero_documento, codigo_contrato } = this.formDoc.value;
    const documentos = this.documentosArray.controls;
    if (!documentos.length) {
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

    const uploads = documentos.map(docCtrl => {
      const tipoId = docCtrl.get('tipoId')?.value;
      const file = docCtrl.get('archivo')?.value;
      const hoja = this.hojasPorId[tipoId];

      // Solo enviar codigo_contrato si ese tipo lo requiere
      const enviarContrato = hoja?.codigo_contrato ? codigo_contrato : undefined;

      // Puedes usar el nombre del tipo o el nombre del archivo como "title"
      const title = hoja?.name || (file?.name ?? 'Documento');

      return this.gestionDocSrv.guardarDocumento(
        title,
        numero_documento,
        tipoId,
        file,
        enviarContrato
      ).toPromise()
        .then(res => ({ ok: true, res, tipo: hoja?.name }))
        .catch(err => ({ ok: false, err, tipo: hoja?.name }));
    });

    Promise.all(uploads)
      .then(results => {
        const exitosos = results.filter(r => r.ok).map(r => r.tipo);
        const fallidos = results.filter(r => !r.ok).map(r => r.tipo);

        let html = '';
        if (exitosos.length) {
          html += `<b>Subidos correctamente:</b><br>${exitosos.join('<br>')}`;
        }
        if (fallidos.length) {
          html += `<br><b>No subidos:</b><br>${fallidos.join('<br>')}`;
        }
        Swal.fire({
          icon: fallidos.length ? 'warning' : 'success',
          title: fallidos.length ? 'Algunos documentos fallaron' : '¡Documentos subidos!',
          html,
          timer: 6000
        });
        if (!fallidos.length) {
          // Si todos ok, puedes limpiar formulario si quieres:
          this.formDoc.reset();
          this.uploadedFiles = {};
          while (this.documentosArray.length) this.documentosArray.removeAt(0);
          this.selectedDocId = null;
          this.selectedPdfUrl = null;
        }
      })
      .catch(() => {
        Swal.fire('Error', 'Ocurrió un error inesperado al subir los documentos.', 'error');
      });
  }

  /* ───────── limpia object URLs ─────────── */
  private revokeUrl(id: number): void {
    const prev = this.uploadedFiles[id]?.objectUrl;
    if (prev) URL.revokeObjectURL(prev);
  }

  /* ───────── limpiar al destruir comp ───── */
  ngOnDestroy(): void {
    Object.keys(this.uploadedFiles).forEach(id =>
      this.revokeUrl(+id)
    );
  }
}
