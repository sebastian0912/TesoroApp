import { SharedModule } from '@/app/shared/shared.module';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl, Title, Meta } from '@angular/platform-browser';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import Swal from 'sweetalert2';
import { MatDialog } from '@angular/material/dialog';
import { DocumentacionService } from '../../service/documentacion/documentacion.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { PdfEditorDialogComponent } from '../../components/pdf-editor-dialog/pdf-editor-dialog.component';

interface Documento {
  id: number;
  title: string;
  file_url: string;
  type: number;
  owner_id?: string;
  contract_number?: string;
}

interface Categoria {
  categoria: string;
  documentos: Documento[];
}

export interface TipoDocumental {
  id: number;
  name: string;
  estado: boolean;
  tags: string[];
  subtypes: TipoDocumental[]; // subtipos anidados
}


@Component({
  selector: 'app-search-documents',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './search-documents.component.html',
  styleUrl: './search-documents.component.css'
})
export class SearchDocumentsComponent {
  tiposDocumentales: any[] = [];
  codigosContrato: string[] = [];
  pdfSeleccionado: SafeResourceUrl | null = null;
  form: FormGroup;
  documentosPorCategoria: Array<{ categoria: string; documentos: any[] }> = [];
  @ViewChild('pdfPreview') pdfPreview!: ElementRef<HTMLIFrameElement>;


  constructor(
    private fb: FormBuilder,
    private documentacionService: DocumentacionService,
    private utilityService: UtilityServiceService,
    private sanitizer: DomSanitizer,
    private titleService: Title,
    private metaService: Meta,
    private dialog: MatDialog
  ) {
    // SEO Init
    this.titleService.setTitle('Buscar Documentos | Gestión Documental');
    this.metaService.updateTag({ name: 'description', content: 'Consulta tipos documentales y verifica si existen archivos asociados.' });

    this.form = this.fb.group({
      cedula: ['', Validators.required],
      codigoContrato: [''],
      tipoDocumental: [''],
      textoBuscar: ['']
    });
  }


  ngOnInit(): void {
    this.documentacionService.mostrar_jerarquia_gestion_documental().subscribe(
      (data) => {
        this.tiposDocumentales = data;
      },
      (error) => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo obtener la jerarquía de tipos documentales.' });
      }
    );

    // Escuchar cambios en el campo de cédula
    this.form.get('cedula')?.valueChanges
      .pipe(
        debounceTime(3000), // Espera 3 segundos después del último cambio
        distinctUntilChanged(), // Evita consultas repetidas con el mismo valor
        switchMap((cedula) => {
          if (cedula) {
            // Mostrar modal de carga
            Swal.fire({
              title: 'Cargando',
              icon: 'info',
              text: 'Obteniendo códigos de contrato...',
              allowOutsideClick: false,
              didOpen: () => {
                Swal.showLoading(); // Inicia el indicador de carga
              }
            });
            return this.utilityService.obtenerCodigosContrato(cedula); // Llama al servicio
          }
          return []; // Si la cédula está vacía, retorna un arreglo vacío
        })
      )
      .subscribe(
        (codigos: any) => {
          Swal.close(); // Cierra el modal de carga
          this.codigosContrato = codigos.data;
        },
        (error) => {
          Swal.close(); // Cierra el modal de carga
          // Mostrar error con SweetAlert
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron obtener los códigos de contrato.'
          });
        }
      );
  }


  onSubmit(): void {
    if (this.form.valid) {
      this.documentacionService.buscar_documentos(this.form.value).subscribe(
        (data) => {
          // Convertir el objeto en un array de objetos para el uso en @for
          this.documentosPorCategoria = Object.entries(data).map(([categoria, documentos]) => ({
            categoria,
            documentos: documentos as any[], // Asegurar que "documentos" es un array
          }));
        },
        (error) => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron obtener los documentos.' });
        }
      );
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Formulario inválido.' });
    }
  }

  trackByCategoria(index: number, item: Categoria): string {
    return item.categoria;
  }

  trackByDocumento(index: number, doc: Documento): number {
    return doc.id;
  }


  verPDF(docUrl: string): void {
    // Ahora usas el ElementRef inyectado por Angular, no document.getElementById
    if (docUrl && this.pdfPreview) {
      this.pdfPreview.nativeElement.src = docUrl;
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró el iframe o la URL del documento.' });
    }
  }

  /**
   * Devuelve el nombre del tipo documental, dada su ID.
   * @param typeId ID del tipo documental.
   */
  public obtenerNombreDelTipo(typeId: number): string {
    const tipo = this.buscarTipoPorId(this.tiposDocumentales, typeId);
    return tipo ? tipo.name : 'Tipo documental desconocido';
  }

  /**
   * Busca recursivamente un tipo documental por su `id`.
   * @param listaTipos Lista de tipos (nivel actual).
   * @param idBuscado  ID del tipo documental que se quiere ubicar.
   * @returns          El tipo documental (si existe), o undefined.
   */
  private buscarTipoPorId(listaTipos: TipoDocumental[], idBuscado: number): TipoDocumental | undefined {
    for (const tipo of listaTipos) {
      if (tipo.id === idBuscado) {
        return tipo;
      }
      if (tipo.subtypes && tipo.subtypes.length > 0) {
        const resultado = this.buscarTipoPorId(tipo.subtypes, idBuscado);
        if (resultado) {
          return resultado;
        }
      }
    }
    return undefined;
  }

  obtenerTipoDocumental(doc: Documento): string {
    // Usa la función recursiva para buscar en TODA la estructura anidada
    const tipoEncontrado = this.buscarTipoPorId(this.tiposDocumentales, doc.type);

    // Ajusta a "tipoEncontrado?.name" porque la propiedad es "name"
    return tipoEncontrado ? tipoEncontrado.name : 'Tipo documental desconocido';
  }

  editarPDF(doc: Documento): void {
    if (!doc.file_url) return;

    // Use Electron IPC to open in external PDF editor (Adobe Acrobat)
    const electronApi = (window as any).electron;
    if (!electronApi?.pdf?.editExternal) {
      // Fallback for non-Electron environment: open dialog viewer
      const dialogRef = this.dialog.open(PdfEditorDialogComponent, {
        maxWidth: '100vw',
        maxHeight: '100vh',
        width: '100vw',
        height: '100vh',
        panelClass: 'pdf-editor-fullscreen-dialog',
        disableClose: true,
        data: {
          fileUrl: doc.file_url,
          docId: doc.id,
          title: doc.title,
          ownerId: this.form.get('cedula')?.value || doc.owner_id || '',
          type: doc.type,
          contractNumber: this.form.get('codigoContrato')?.value || doc.contract_number || ''
        }
      });
      dialogRef.afterClosed().subscribe(result => {
        if (result?.saved) {
          this.onSubmit();
        }
      });
      return;
    }

    // ── Electron path: open in Adobe Acrobat ──
    Swal.fire({
      title: 'Abriendo en editor externo…',
      html: 'Descargando el documento y abriendo Adobe Acrobat.<br><small>Guarda el archivo en Acrobat cuando termines de editar.</small>',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    electronApi.pdf.editExternal(doc.file_url).then((result: any) => {
      if (!result.success) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.error || 'No se pudo abrir el editor de PDF.'
        });
        return;
      }

      Swal.fire({
        icon: 'info',
        title: 'Editando en Adobe Acrobat',
        html: `
          <p style="margin-bottom:8px;">El documento se abrió en tu editor de PDF.</p>
          <p style="font-weight:700;">Cuando termines de editar:</p>
          <ol style="text-align:left;font-size:14px;">
            <li>Guarda el archivo en Adobe (Ctrl+S)</li>
            <li>Haz clic en <b>"Subir Cambios"</b> abajo</li>
          </ol>
        `,
        showCancelButton: true,
        confirmButtonText: '📤 Subir Cambios',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4CAF50',
        allowOutsideClick: false
      }).then(async (swalResult) => {
        if (swalResult.isConfirmed) {
          // Read the modified file and upload
          Swal.fire({
            title: 'Subiendo documento editado…',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
          });

          try {
            // Read the modified file via IPC (main process reads it)
            const readResult = await electronApi.pdf.readFile();
            if (!readResult.success) {
              throw new Error(readResult.error || 'No se pudo leer el archivo');
            }

            // Convert base64 to Blob
            const byteCharacters = atob(readResult.bytes);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            const cedula = this.form.get('cedula')?.value || doc.owner_id || '';
            const contrato = this.form.get('codigoContrato')?.value || doc.contract_number || '';

            this.documentacionService.actualizarDocumento(
              doc.title,
              cedula,
              doc.type,
              blob,
              'documento_editado.pdf',
              contrato
            )
              .subscribe({
                next: () => {
                  electronApi.pdf.finishEdit();
                  Swal.fire({
                    icon: 'success',
                    title: '¡Guardado!',
                    text: 'El documento editado fue subido exitosamente.',
                    timer: 2500,
                    showConfirmButton: false
                  });
                  this.onSubmit();
                },
                error: (err: any) => {
                  console.error('Upload error:', err);
                  Swal.fire({
                    icon: 'error',
                    title: 'Error al Subir',
                    text: 'No se pudo subir el documento editado.'
                  });
                }
              });
          } catch (err) {
            console.error('Error reading modified file:', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo leer el archivo modificado.'
            });
            electronApi.pdf.finishEdit();
          }
        } else {
          // User cancelled
          electronApi.pdf.finishEdit();
        }
      });
    }).catch((err: any) => {
      console.error('Error opening external editor:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo abrir el editor externo.'
      });
    });
  }
}
