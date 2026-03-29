import {
    Component,
    ElementRef,
    ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import {
    NominaService,
    PreviewRegistro,
    PreviewResponse,
    ImportResult,
} from '../../service/nomina/nomina.service';

import { ValidationPreviewDialogComponent } from '@/app/shared/components/validation-preview-dialog/validation-preview-dialog.component';
import {
    PreviewSchema,
    PreviewIssue,
} from 'src/app/shared/model/validation-preview';

// ── Schema factory para PreviewRegistro ────────────────────────
function buildNominaSchema(): PreviewSchema<PreviewRegistro, PreviewRegistro[]> {
    return {
        title: 'Previsualización de Empleados',
        subtitle: 'Revisa y corrige los datos antes de importar.',

        itemId: (item) => String(item.fila_excel),

        // Columnas visibles en la tabla
        columns: [
            { key: 'fila_excel', header: 'Fila', width: '56px', cell: (i) => i.fila_excel },
            { key: 'tipo_documento', header: 'Tipo Doc', width: '90px', cell: (i) => i.tipo_documento ?? '—' },
            { key: 'numero_documento', header: 'Documento', width: '140px', cell: (i) => i.numero_documento ?? '—' },
            { key: 'nombre_completo', header: 'Nombre', width: '220px', cell: (i) => i.nombre_completo ?? '—' },
            { key: 'codigo_contrato', header: 'Contrato', width: '110px', cell: (i) => i.codigo_contrato ?? '—' },
            { key: 'fecha_ingreso', header: 'Ingreso', width: '110px', cell: (i) => i.fecha_ingreso ?? '—' },
            { key: 'estado', header: 'Estado', width: '90px', cell: (i) => i.estado ?? '—' },
            { key: 'cliente', header: 'Cliente', width: '160px', cell: (i) => i.cliente ?? '—' },
            { key: 'salario', header: 'Salario', width: '110px', cell: (i) => i.salario ?? '—' },
        ],

        // Campos editables en el panel derecho
        editFields: [
            {
                key: 'tipo_documento', label: 'Tipo de Documento', type: 'select',
                required: true,
                options: [
                    { value: 'CC', label: 'CC - Cédula de Ciudadanía' },
                    { value: 'CE', label: 'CE - Cédula Extranjería' },
                    { value: 'P.P.T', label: 'P.P.T - Permiso Protección Temporal' },
                    { value: 'TI', label: 'TI - Tarjeta de Identidad' },
                    { value: 'PEP', label: 'PEP' },
                ],
                validate: (v) => !v ? 'El tipo de documento es obligatorio.' : null,
            },
            {
                key: 'numero_documento', label: 'Número de Documento', type: 'text',
                required: true,
                hint: 'Solo números (o X... para PPT)',
                validate: (v) => !v ? 'El documento es obligatorio.' : null,
            },
            {
                key: 'nombre_completo', label: 'Nombre Completo', type: 'text',
                required: true,
                validate: (v) => {
                    if (!v) return 'El nombre es obligatorio.';
                    if (/\d/.test(v)) return 'El nombre no debe contener números.';
                    return null;
                },
            },
            {
                key: 'codigo_contrato', label: 'Código de Contrato', type: 'text',
                hint: 'Ej: 123456',
            },
            {
                key: 'fecha_ingreso', label: 'Fecha de Ingreso', type: 'text',
                hint: 'YYYY-MM-DD',
                validate: (v) => {
                    if (!v) return null; // opcional
                    const ok = /^\d{4}-\d{2}-\d{2}$/.test(v);
                    return ok ? null : 'Formato inválido. Use YYYY-MM-DD.';
                },
            },
            {
                key: 'fecha_retiro', label: 'Fecha de Retiro', type: 'text',
                hint: 'YYYY-MM-DD',
                validate: (v) => {
                    if (!v) return null;
                    const ok = /^\d{4}-\d{2}-\d{2}$/.test(v);
                    return ok ? null : 'Formato inválido. Use YYYY-MM-DD.';
                },
            },
            {
                key: 'estado', label: 'Estado', type: 'select',
                options: [
                    { value: 'ACTIVO', label: 'ACTIVO' },
                    { value: 'INACTIVO', label: 'INACTIVO' },
                ],
            },
            { key: 'cliente', label: 'Cliente', type: 'text' },
            { key: 'ceco', label: 'CECO', type: 'text' },
            {
                key: 'salario', label: 'Salario', type: 'number',
                validate: (v) => {
                    if (v === null || v === undefined || v === '') return null;
                    const n = Number(v);
                    if (isNaN(n) || n < 0) return 'El salario debe ser un número positivo.';
                    return null;
                },
            },
            { key: 'forma_pago', label: 'Forma de Pago', type: 'text' },
            { key: 'numero_cuenta', label: 'Número de Cuenta', type: 'text' },
            { key: 'banco', label: 'Banco', type: 'text' },
            { key: 'eps', label: 'EPS', type: 'text' },
            { key: 'afp', label: 'AFP / Pensión', type: 'text' },
            { key: 'ccf', label: 'CCF / Caja', type: 'text' },
            {
                key: 'email', label: 'Correo', type: 'text',
                validate: (v) => {
                    if (!v) return null;
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Formato de correo inválido.';
                }
            },
            { key: 'telefono', label: 'Teléfono', type: 'text' },
        ],

        // Validación por fila
        validateItem: (item): PreviewIssue[] => {
            const issues: PreviewIssue[] = [];
            const id = String(item.fila_excel);

            if (!item.numero_documento) {
                issues.push({ id: `${id}-doc`, itemId: id, severity: 'error', field: 'numero_documento', message: 'Número de documento vacío.' });
            }
            if (!item.tipo_documento) {
                issues.push({ id: `${id}-tipo`, itemId: id, severity: 'error', field: 'tipo_documento', message: 'Tipo de documento vacío.' });
            }
            if (!item.nombre_completo) {
                issues.push({ id: `${id}-nom`, itemId: id, severity: 'error', field: 'nombre_completo', message: 'Nombre completo vacío.' });
            } else if (/\d/.test(item.nombre_completo)) {
                issues.push({ id: `${id}-nom-d`, itemId: id, severity: 'error', field: 'nombre_completo', message: 'El nombre contiene dígitos.' });
            }
            if (item.fecha_ingreso && !/^\d{4}-\d{2}-\d{2}$/.test(item.fecha_ingreso)) {
                issues.push({ id: `${id}-fi`, itemId: id, severity: 'error', field: 'fecha_ingreso', message: 'Fecha Ingreso: formato inválido. Use YYYY-MM-DD.' });
            }
            if (item.fecha_retiro && !/^\d{4}-\d{2}-\d{2}$/.test(item.fecha_retiro)) {
                issues.push({ id: `${id}-fr`, itemId: id, severity: 'error', field: 'fecha_retiro', message: 'Fecha Retiro: formato inválido. Use YYYY-MM-DD.' });
            }
            if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
                issues.push({ id: `${id}-email`, itemId: id, severity: 'warn', field: 'email', message: 'Correo electrónico con formato inválido.' });
            }
            if (item.salario !== null && item.salario !== undefined && Number(item.salario) < 0) {
                issues.push({ id: `${id}-sal`, itemId: id, severity: 'error', field: 'salario', message: 'Salario no puede ser negativo.' });
            }

            return issues;
        },

        // Validaciones cruzadas (duplicados)
        validateAll: (items): PreviewIssue[] => {
            const issues: PreviewIssue[] = [];

            // Clave: mismo documento + mismo contrato → eso SÍ es un duplicado real
            // Mismo documento con contratos distintos → es válido (empleado con varios contratos)
            const docContratoMap = new Map<string, string[]>(); // "DOC|CONTRATO" -> itemIds[]
            const contratoMap = new Map<string, string[]>(); // "CONTRATO"     -> itemIds[]

            items.forEach(it => {
                const id = String(it.fila_excel);

                // Par doc+contrato
                if (it.numero_documento && it.codigo_contrato) {
                    const kDC = `${it.numero_documento.trim().toUpperCase()}|${it.codigo_contrato.trim().toUpperCase()}`;
                    if (!docContratoMap.has(kDC)) docContratoMap.set(kDC, []);
                    docContratoMap.get(kDC)!.push(id);
                }

                // Contrato solo (independiente del documento)
                if (it.codigo_contrato) {
                    const kC = it.codigo_contrato.trim().toUpperCase();
                    if (!contratoMap.has(kC)) contratoMap.set(kC, []);
                    contratoMap.get(kC)!.push(id);
                }
            });

            // Duplicado real: misma cédula Y mismo contrato
            docContratoMap.forEach((ids, key) => {
                if (ids.length > 1) {
                    const [doc, contrato] = key.split('|');
                    ids.forEach(id => issues.push({
                        id: `dup-doc-cont-${id}`, itemId: id, severity: 'error',
                        field: 'numero_documento',
                        message: `Fila duplicada: el documento ${doc} ya tiene el contrato ${contrato} en otro registro.`
                    }));
                }
            });

            // Contrato repetido (independiente del documento)
            contratoMap.forEach((ids, contrato) => {
                if (ids.length > 1) {
                    ids.forEach(id => issues.push({
                        id: `dup-cont-${id}`, itemId: id, severity: 'error',
                        field: 'codigo_contrato',
                        message: `Código de contrato duplicado en el archivo: ${contrato}.`
                    }));
                }
            });

            return issues;
        },


        buildResult: (items) => items,
        allowRemove: true,
        removeLabel: 'Quitar fila',
        allowCancel: true,
    };
}

type WizardStep = 'select' | 'importing' | 'done' | 'error';

@Component({
    selector: 'app-import-excel',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatIconModule,
        MatButtonModule,
        MatProgressBarModule,
        MatTooltipModule,
        MatDialogModule,
    ],
    templateUrl: './import-excel.component.html',
    styleUrl: './import-excel.component.css',
})
export class ImportExcelComponent {

    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    // ── State ────────────────────────────────────────────────────
    step: WizardStep = 'select';
    progress: number = 0;
    errorMsg: string = '';
    isDragging: boolean = false;
    isParsing: boolean = false;

    // ── Data ─────────────────────────────────────────────────────
    selectedFile: File | null = null;
    previewResp: PreviewResponse | null = null;
    allRows: PreviewRegistro[] = [];
    importResult: ImportResult | null = null;

    // ── Options ──────────────────────────────────────────────────
    sheetName = 'BASE GENERAL';
    headerRow = 1;

    // ── Label helper ──────────────────────────────────────────────
    get fileSizeLabel(): string {
        if (!this.selectedFile) return '';
        const kb = this.selectedFile.size / 1024;
        return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
    }

    constructor(
        private nominaService: NominaService,
        private dialog: MatDialog,
    ) { }

    // ── Step 1: File selection ────────────────────────────────────
    openFilePicker(): void { this.fileInput.nativeElement.click(); }

    onFileSelected(e: Event): void {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) this.setFile(f);
    }

    onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragging = true; }
    onDragLeave(e: DragEvent): void { e.preventDefault(); this.isDragging = false; }
    onDrop(e: DragEvent): void {
        e.preventDefault();
        this.isDragging = false;
        const f = e.dataTransfer?.files?.[0];
        if (f) this.setFile(f);
    }

    private setFile(file: File): void {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            this.errorMsg = 'Solo se permiten archivos Excel (.xlsx / .xls)';
            this.step = 'error';
            return;
        }
        this.selectedFile = file;
        this.errorMsg = '';
        this.step = 'select';
    }

    // ── Step 2: ETL Preview ───────────────────────────────────────
    runPreview(): void {
        if (!this.selectedFile) return;
        this.isParsing = true;
        this.errorMsg = '';

        this.nominaService.previewExcel(this.selectedFile, this.sheetName, this.headerRow).subscribe({
            next: async (resp: PreviewResponse) => {
                this.previewResp = resp;
                this.isParsing = false;

                const rows = resp.registros.map((r: PreviewRegistro) => ({ ...r, _editado: false }));
                const schema = buildNominaSchema();

                const ref = this.dialog.open(ValidationPreviewDialogComponent, {
                    width: '95vw',
                    maxWidth: '95vw',
                    height: '90vh',
                    disableClose: true,
                    data: {
                        schema,
                        items: rows,
                        phase: 'pre',
                        title: 'Previsualización de Empleados',
                        subtitle: `${rows.length} registros cargados. Corrige los errores antes de importar.`,
                    },
                });

                const result = await firstValueFrom(ref.afterClosed());

                if (!result?.accepted) {
                    // Usuario canceló → volver a selección
                    return;
                }

                // Guardar los registros (ya corregidos) y lanzar importación
                this.allRows = result.items as PreviewRegistro[];
                this.importar();
            },
            error: (err: HttpErrorResponse) => {
                this.isParsing = false;
                this.errorMsg = err.error?.error || err.error?.detail || err.message || 'Error al procesar el Excel';
                this.step = 'error';
            }
        });
    }

    // ── Step 3: Import ────────────────────────────────────────────
    importar(): void {
        if (!this.allRows.length) return;
        this.step = 'importing';
        this.progress = 0;

        this.nominaService.importarRegistros(this.allRows).subscribe({
            next: (result) => {
                this.importResult = result;
                this.progress = 100;
                this.step = 'done';
            },
            error: (err: HttpErrorResponse) => {
                this.errorMsg = err.error?.error || err.error?.detail || err.message || 'Error al importar';
                this.step = 'error';
            }
        });
    }



    // ── Reset ─────────────────────────────────────────────────────
    reset(): void {
        this.step = 'select';
        this.selectedFile = null;
        this.previewResp = null;
        this.allRows = [];
        this.importResult = null;
        this.errorMsg = '';
        this.progress = 0;
        if (this.fileInput) this.fileInput.nativeElement.value = '';
    }

    backToSelect(): void { this.step = 'select'; }

    // ── Helpers ───────────────────────────────────────────────────
    isStep(s: WizardStep): boolean { return this.step === s; }
}
