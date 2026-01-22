import { SharedModule } from '@/app/shared/shared.module';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SafeResourceUrl } from '@angular/platform-browser';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import Swal from 'sweetalert2';
import { DocumentacionService } from '../../service/documentacion/documentacion.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

interface Documento {
  id: number;
  title: string;
  file_url: string | null;
  type: number; // id del tipo documental
  uploaded_at?: string; // si viene, mejor
}

interface DocumentoVM extends Partial<Documento> {
  _key: string;     // trackBy estable
  type: number;     // siempre
  file_url: string | null;
  missing: boolean; // true si no existe
}

interface CategoriaVM {
  categoria: string;          // contract_key (o SIN_CONTRATO)
  documentos: DocumentoVM[];
}

export interface TipoDocumental {
  id: number;
  name: string;
  estado: boolean;
  tags: string[];
  subtypes: TipoDocumental[];
}

@Component({
  selector: 'app-search-documents',
  imports: [SharedModule],
  templateUrl: './search-documents.component.html',
  styleUrl: './search-documents.component.css',
})
export class SearchDocumentsComponent {
  tiposDocumentales: TipoDocumental[] = [];
  codigosContrato: string[] = [];

  pdfSeleccionado: SafeResourceUrl | null = null;
  form: FormGroup;

  documentosPorCategoria: CategoriaVM[] = [];

  @ViewChild('pdfPreview') pdfPreview!: ElementRef<HTMLIFrameElement>;

  constructor(
    private fb: FormBuilder,
    private documentacionService: DocumentacionService,
    private utilityService: UtilityServiceService
  ) {
    this.form = this.fb.group({
      cedula: ['', Validators.required],
      codigoContrato: [''],
      tipoDocumental: [''],
      textoBuscar: [''],
    });
  }

  ngOnInit(): void {
    this.documentacionService.mostrar_jerarquia_gestion_documental().subscribe(
      (data) => (this.tiposDocumentales = data || []),
      () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo obtener la jerarquía de tipos documentales.' })
    );

    this.form
      .get('cedula')
      ?.valueChanges.pipe(
        debounceTime(3000),
        distinctUntilChanged(),
        switchMap((cedula) => {
          if (!cedula) return of([]); // ✅ ojo: of([]), no []
          Swal.fire({
            title: 'Cargando',
            icon: 'info',
            text: 'Obteniendo códigos de contrato...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
          });
          return this.utilityService.obtenerCodigosContrato(cedula);
        })
      )
      .subscribe(
        (resp: any) => {
          Swal.close();
          this.codigosContrato = Array.isArray(resp?.data) ? resp.data : [];
        },
        () => {
          Swal.close();
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron obtener los códigos de contrato.' });
        }
      );
  }

  onSubmit(): void {
    if (this.form.invalid) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Formulario inválido.' });
      return;
    }

    this.documentacionService.buscar_documentos(this.form.value).subscribe(
      (data: any) => {
        // data esperado: { "12345": [docs], "SIN_CONTRATO": [docs] }
        const byContract: Record<string, Documento[]> = (data && typeof data === 'object') ? data : {};

        this.documentosPorCategoria = this.buildCategoriasVM(byContract);
      },
      () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron obtener los documentos.' })
    );
  }

  // =============================
  // VIEW MODEL (existentes + faltantes)
  // =============================

  private buildCategoriasVM(byContract: Record<string, Documento[]>): CategoriaVM[] {
    const codigoContrato = String(this.form.get('codigoContrato')?.value || '').trim();
    const textoBuscar = String(this.form.get('textoBuscar')?.value || '').trim();

    // 1) contratos a mostrar:
    // - si el usuario eligió contrato => solo ese
    // - si no eligió => usa codigosContrato (si existen), si no, los que vengan del backend
    const backendKeys = Object.keys(byContract || {});
    const fromService = (this.codigosContrato || []).filter(Boolean);
    const uniqueService = Array.from(new Set(fromService));

    let contracts: string[] = [];

    if (codigoContrato) {
      contracts = [codigoContrato];
    } else if (uniqueService.length) {
      contracts = uniqueService.slice();
      // si backend trae SIN_CONTRATO, lo añadimos también
      if (backendKeys.includes('SIN_CONTRATO') && !contracts.includes('SIN_CONTRATO')) {
        contracts.push('SIN_CONTRATO');
      }
    } else {
      contracts = backendKeys.length ? backendKeys : [];
    }

    // 2) tipos esperados:
    // - si seleccionó tipoDocumental => solo ese (y sus “slots”)
    // - si NO seleccionó => todas las hojas (leaf) activas
    const expectedTypeIds = this.getExpectedTypeIds();

    // 3) si hay textoBuscar, normalmente solo tiene sentido listar lo que existe.
    //    (si quieres IGUAL mostrar faltantes con texto, quita este if)
    const includeMissing = !textoBuscar;

    const out: CategoriaVM[] = [];

    for (const contractKey of contracts) {
      const existing = Array.isArray(byContract?.[contractKey]) ? byContract[contractKey] : [];

      const documentos = includeMissing
        ? this.mergeExistingWithMissing(contractKey, existing, expectedTypeIds)
        : this.onlyExistingVM(contractKey, existing);

      out.push({ categoria: contractKey, documentos });
    }

    // si al final no hay nada, devuelve []
    return out.filter((x) => x.documentos?.length);
  }

  private onlyExistingVM(contractKey: string, docs: Documento[]): DocumentoVM[] {
    return (docs || []).map((d, idx) => ({
      ...d,
      _key: `${contractKey}:${d.type}:${d.id ?? idx}`,
      file_url: d.file_url ?? null,
      missing: !d.file_url,
      type: d.type,
    }));
  }

  private mergeExistingWithMissing(contractKey: string, docs: Documento[], expectedTypeIds: number[]): DocumentoVM[] {
    const byType = new Map<number, Documento[]>();

    for (const d of (docs || [])) {
      const t = d.type;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(d);
    }

    // ordena por uploaded_at si viene, si no por id
    for (const [t, arr] of byType.entries()) {
      arr.sort((a, b) => {
        const da = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
        const db = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
        if (da && db) return db - da;
        return (b.id ?? 0) - (a.id ?? 0);
      });
      byType.set(t, arr);
    }

    const vm: DocumentoVM[] = [];

    for (const typeId of expectedTypeIds) {
      const expectedSlots = (typeId === 16 || typeId === 17) ? 2 : 1;
      const existing = byType.get(typeId) || [];

      for (let i = 0; i < expectedSlots; i++) {
        const d = existing[i];

        if (d?.file_url) {
          vm.push({
            ...d,
            _key: `${contractKey}:${typeId}:${d.id ?? i}`,
            file_url: d.file_url,
            missing: false,
            type: typeId,
          });
        } else if (d && !d.file_url) {
          // existe registro pero sin url
          vm.push({
            ...d,
            _key: `${contractKey}:${typeId}:${d.id ?? i}`,
            file_url: null,
            missing: true,
            type: typeId,
          });
        } else {
          // placeholder faltante
          vm.push({
            _key: `${contractKey}:${typeId}:missing:${i}`,
            id: -Number(`${typeId}${i}`), // solo para que tenga número (si lo necesitas)
            title: '',
            type: typeId,
            file_url: null,
            missing: true,
          });
        }
      }
    }

    return vm;
  }

  private getExpectedTypeIds(): number[] {
    const selected = this.form.get('tipoDocumental')?.value;
    const selectedId = selected ? Number(selected) : null;
    if (selectedId && !Number.isNaN(selectedId)) return [selectedId];

    // Hojas (leaf) activas
    const leaves = this.flattenLeafTypes(this.tiposDocumentales || [])
      .filter((t) => t?.estado !== false) // si estado viene
      .map((t) => t.id);

    // fallback: si no hay hojas, al menos los ids que existan (evita lista vacía)
    return leaves.length ? leaves : [];
  }

  private flattenLeafTypes(list: TipoDocumental[]): TipoDocumental[] {
    const out: TipoDocumental[] = [];

    const walk = (arr: TipoDocumental[]) => {
      for (const t of (arr || [])) {
        const kids = Array.isArray(t.subtypes) ? t.subtypes : [];
        if (!kids.length) out.push(t);
        else walk(kids);
      }
    };

    walk(list);
    // orden por nombre (si existe)
    out.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'es'));
    return out;
  }

  // =============================
  // template helpers
  // =============================

  trackByCategoria(index: number, item: CategoriaVM): string {
    return item.categoria;
  }

  trackByDocumento(index: number, doc: DocumentoVM): string {
    return doc._key;
  }

  verPDF(docUrl: string | null): void {
    if (docUrl && this.pdfPreview) {
      this.pdfPreview.nativeElement.src = docUrl;
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró el iframe o la URL del documento.' });
    }
  }

  private buscarTipoPorId(listaTipos: TipoDocumental[], idBuscado: number): TipoDocumental | undefined {
    for (const tipo of (listaTipos || [])) {
      if (tipo.id === idBuscado) return tipo;
      if (tipo.subtypes?.length) {
        const r = this.buscarTipoPorId(tipo.subtypes, idBuscado);
        if (r) return r;
      }
    }
    return undefined;
  }

  obtenerTipoDocumental(doc: { type: number }): string {
    const tipo = this.buscarTipoPorId(this.tiposDocumentales, doc.type);
    return tipo ? tipo.name : 'Tipo documental desconocido';
  }

  // (Opcional) etiqueta amigable
  labelContrato(k: string): string {
    return k === 'SIN_CONTRATO' ? 'SIN CONTRATO' : k;
  }
  
}
