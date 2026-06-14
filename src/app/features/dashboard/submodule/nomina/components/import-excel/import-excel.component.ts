import {
    Component,
    ElementRef,
    ViewChild,
    signal,
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
    PreviewResolucion,
    PreviewResponse,
    ImportResult,
    ImportarRegistrosPayload,
} from '../../service/nomina/nomina.service';

import { ValidationPreviewDialogComponent } from '@/app/shared/components/validation-preview-dialog/validation-preview-dialog.component';
import {
    PreviewSchema,
    PreviewIssue,
} from 'src/app/shared/model/validation-preview';

// ── Schema factory para PreviewRegistro ────────────────────────
function buildNominaSchema(): PreviewSchema<PreviewRegistro, PreviewRegistro[]> {
    // Render de una celda de resolución FK con estado (✓, ✗, —).
    // Devuelve string que el dialog renderiza tal cual.
    const fkCell = (
        excel: string | undefined | null,
        fk: { detectada: string | null; id_detectado: number | null; estado: string } | undefined,
    ): string => {
        const xl = excel ?? '';
        if (!fk) return xl ? `${xl} ⚠` : '—';
        switch (fk.estado) {
            case 'OK': return `${fk.detectada} ✓`;
            case 'INACTIVO': return `${fk.detectada} ⚠ inactivo`;
            case 'NO_ENCONTRADO': return `${xl} ✗ no existe`;
            case 'VACIO': return '—';
            default: return xl || '—';
        }
    };

    // Tras "Aplicar (Local)", el dialog escribe el nuevo valor en item[fieldKey]
    // pero deja item.resolucion intacto, así que validateItem seguiría viendo
    // NO_ENCONTRADO. Marcamos el FK como OK localmente para desbloquear el flujo;
    // el backend re-resuelve nombre→id contra el catálogo en importar-registros
    // y rechaza con un error específico si el nuevo nombre tampoco existe.
    const markFkOptimistic = (
        it: PreviewRegistro,
        resKey: keyof PreviewResolucion,
        fieldKey: keyof PreviewRegistro,
    ): void => {
        if (!it.resolucion) return;
        const raw = ((it as any)[fieldKey] ?? '').toString().trim();
        it.resolucion[resKey] = raw
            ? { excel: raw, detectada: raw, id_detectado: null, estado: 'OK' }
            : { excel: null, detectada: null, id_detectado: null, estado: 'VACIO' };
    };

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
            { key: 'estado', header: 'Estado contrato', width: '110px', cell: (i) => i.estado ?? '—' },
            // Estado del registro en el Excel (INGRESO / SIN CONFIRMAR / NO INGRESO).
            { key: 'estado_registro', header: 'Estado registro', width: '120px',
              cell: (i) => i.estado_registro ?? '—' },
            // ¿La fila se importará? Solo INGRESO (o sin columna Estado) es candidato.
            { key: 'importar', header: 'Importar', width: '90px',
              cell: (i) => i.importar === false ? '✗ Omitido' : '✓ Sí' },
            // Valor CRUDO de la celda de empresa usuaria (texto compuesto empresa+CC
            // cuando aplica). `cliente` (columna siguiente) es el nombre ya extraído.
            { key: 'cliente_original', header: 'Empresa+CC (Excel)', width: '240px',
              cell: (i) => i.cliente_original ?? '—' },
            // Empresa usuaria EXTRAÍDA + estado de resolución contra nomina_entidades_externas (CLIENTE/EMPRESA_USUARIA).
            { key: 'empresa_resuelta', header: 'Empresa (extraída)', width: '200px',
              cell: (i) => fkCell(i.cliente, i.resolucion?.empresa) },
            // CECO (de "Centro de costo Para el Carné" en IPANEMA) resuelto dentro del cliente en nomina_centros_costo.
            { key: 'ceco_resuelto', header: 'CECO', width: '180px',
              cell: (i) => fkCell(i.ceco, i.resolucion?.ceco) },
            { key: 'eps_resuelta', header: 'EPS', width: '160px',
              cell: (i) => fkCell(i.eps, i.resolucion?.eps) },
            { key: 'afp_resuelta', header: 'AFP', width: '160px',
              cell: (i) => fkCell(i.afp, i.resolucion?.afp) },
            { key: 'banco_resuelto', header: 'Banco', width: '160px',
              cell: (i) => fkCell(i.banco, i.resolucion?.banco) },
            { key: 'ccf_resuelta', header: 'CCF', width: '160px',
              cell: (i) => fkCell(i.ccf, i.resolucion?.ccf) },
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
            {
                key: 'cliente', label: 'Cliente', type: 'text',
                onChange: (it: any) => markFkOptimistic(it, 'empresa', 'cliente'),
            },
            {
                key: 'ceco', label: 'CECO', type: 'text',
                onChange: (it: any) => markFkOptimistic(it, 'ceco', 'ceco'),
            },
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
            {
                key: 'banco', label: 'Banco', type: 'text',
                onChange: (it: any) => markFkOptimistic(it, 'banco', 'banco'),
            },
            {
                key: 'eps', label: 'EPS', type: 'text',
                onChange: (it: any) => markFkOptimistic(it, 'eps', 'eps'),
            },
            {
                key: 'afp', label: 'AFP / Pensión', type: 'text',
                onChange: (it: any) => markFkOptimistic(it, 'afp', 'afp'),
            },
            {
                key: 'ccf', label: 'CCF / Caja', type: 'text',
                onChange: (it: any) => markFkOptimistic(it, 'ccf', 'ccf'),
            },
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
            // Regla: documentos que empiezan con 'X' son PPT por convención.
            if (item.numero_documento?.trim().toUpperCase().startsWith('X') && item.tipo_documento !== 'PPT') {
                issues.push({
                    id: `${id}-ppt`, itemId: id, severity: 'warn', field: 'tipo_documento',
                    message: 'Documento inicia con X: al guardar se forzará tipo PPT.',
                });
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

            // Validación FK contra catálogos (resuelta por el backend en el preview).
            // Empresa usuaria es OBLIGATORIA. EPS/AFP/Banco/CCF/CECO son opcionales
            // pero si el Excel trae nombre y no matchea, error → bloquea importar.
            const res = item.resolucion;
            if (!res) {
                // Backend antiguo (sin resolución): no bloqueamos pero advertimos.
                issues.push({ id: `${id}-no-res`, itemId: id, severity: 'warn',
                    message: 'Resolución de FKs no calculada por el backend.' });
            } else {
                const fkMsg = (entidad: string, fk: { excel: string | null; estado: string }): string =>
                    fk.estado === 'NO_ENCONTRADO'
                        ? `${entidad} "${fk.excel ?? ''}" no existe en el catálogo. Créala antes de importar.`
                        : `${entidad} "${fk.excel ?? ''}" está marcada como inactiva.`;

                if (res.empresa.estado !== 'OK') {
                    issues.push({ id: `${id}-empresa`, itemId: id, severity: 'error', field: 'cliente',
                        message: res.empresa.estado === 'VACIO'
                            ? 'Empresa usuaria es obligatoria.'
                            : fkMsg('Empresa usuaria', res.empresa) });
                }
                const opt: Array<[string, keyof PreviewResolucion, keyof PreviewRegistro]> = [
                    ['EPS',   'eps',   'eps'],
                    ['AFP',   'afp',   'afp'],
                    ['Banco', 'banco', 'banco'],
                    ['CCF',   'ccf',   'ccf'],
                    ['CECO',  'ceco',  'ceco'],
                ];
                for (const [label, key, field] of opt) {
                    const fk = res[key];
                    // CCF NO bloquea (rule 12): datos no confiables → solo aviso.
                    if (fk.estado === 'NO_ENCONTRADO' || fk.estado === 'INACTIVO') {
                        issues.push({ id: `${id}-${key}`, itemId: id,
                            severity: key === 'ccf' ? 'warn' : 'error', field,
                            message: fkMsg(label, fk) });
                    }
                }
            }

            // Advertencias por fila ya calculadas por el backend (estado del registro,
            // tipo de documento no reconocido, email inválido, fecha de retiro de
            // experiencia laboral, marcador de centro de costo, CECO de otro cliente…).
            if (item.warnings?.length) {
                item.warnings.forEach((w, idx) => issues.push({
                    id: `${id}-bw-${idx}`, itemId: id, severity: 'warn', message: w,
                }));
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

    // ── State (signals — requerido con provideZonelessChangeDetection) ─────
    // Propiedades mutadas desde callbacks async (subscribe/await) deben ser
    // signals; de lo contrario Angular zoneless no dispara change detection
    // y la UI queda "pegada" hasta que un evento DOM la despierta.
    step = signal<WizardStep>('select');
    progress = signal(0);
    errorMsg = signal('');
    isParsing = signal(false);
    importResult = signal<ImportResult | null>(null);

    // Estas sí cambian desde eventos DOM (click, drag, ngModel), no requieren signal
    isDragging: boolean = false;
    selectedFile: File | null = null;
    previewResp: PreviewResponse | null = null;
    allRows: PreviewRegistro[] = [];

    // Snapshot original (por fila_excel) para calcular deltas y enviar solo edits
    private originalRowsById: Map<string, PreviewRegistro> = new Map();
    private importToken: string | null = null;

    // Campos que el usuario realmente puede editar en el diálogo de preview.
    // Solo comparamos estos para detectar cambios.
    private static EDITABLE_FIELDS: (keyof PreviewRegistro)[] = [
        'tipo_documento', 'numero_documento', 'nombre_completo',
        'codigo_contrato', 'fecha_ingreso', 'fecha_retiro', 'estado',
        'cliente', 'salario', 'email',
    ];

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
            this.errorMsg.set('Solo se permiten archivos Excel (.xlsx / .xls)');
            this.step.set('error');
            return;
        }
        this.selectedFile = file;
        this.errorMsg.set('');
        this.step.set('select');
    }

    // ── Step 2: ETL Preview ───────────────────────────────────────
    runPreview(): void {
        if (!this.selectedFile) return;
        // Carga masiva GENERAL: el Excel es un formato parametrizado estándar y la
        // extracción es la misma para todos; la empresa usuaria de cada empleado se
        // extrae de la propia columna del archivo, sin discriminar por empresa.
        this.isParsing.set(true);
        this.errorMsg.set('');

        this.nominaService.previewExcel(this.selectedFile, this.sheetName, this.headerRow).subscribe({
            next: async (resp: PreviewResponse) => {
                this.previewResp = resp;
                this.importToken = resp.import_token ?? null;
                this.isParsing.set(false);

                // Guardamos snapshot original (deep-copy superficial por fila) para
                // luego calcular solo los deltas editados y no reenviar todo.
                this.originalRowsById = new Map(
                    resp.registros.map((r: PreviewRegistro) => [String(r.fila_excel), { ...r }])
                );

                const rows = resp.registros.map((r: PreviewRegistro) => ({ ...r }));
                const schema = buildNominaSchema();

                // serverValidate: cada "Confirmar Todo" envía las filas pendientes al
                // backend; las que persisten se retiran de la lista, las que fallan
                // vuelven con el motivo del servidor para que el operador corrija.
                const serverValidate = async (items: PreviewRegistro[]) => {
                    const result = await firstValueFrom(
                        this.nominaService.importarRegistros({
                            registros: items,
                        }),
                    );
                    const noAplicables = result.no_aplicables ?? [];
                    const rejectedIds = new Set(noAplicables.map((na) => String(na.fila_excel)));
                    const acceptedItemIds = items
                        .map((it) => String(it.fila_excel))
                        .filter((id) => !rejectedIds.has(id));
                    const errors: PreviewIssue[] = noAplicables.map((na) => ({
                        id: `srv:${na.fila_excel}`,
                        itemId: String(na.fila_excel),
                        severity: 'error' as const,
                        message: `Servidor rechazó la fila: ${na.motivo}`,
                    }));
                    return { acceptedItemIds, errors, serverResult: result };
                };

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
                        serverValidate,
                    },
                });

                const result = await firstValueFrom(ref.afterClosed());

                if (!result?.accepted) {
                    // Usuario canceló → volver a selección
                    return;
                }

                // El dialog ya persistió todo vía serverValidate. result.result trae
                // el último ImportResult acumulado del servidor para mostrar en done.
                this.importToken = null;
                this.originalRowsById.clear();
                if (result.result) this.importResult.set(result.result as ImportResult);
                this.progress.set(100);
                this.step.set('done');
            },
            error: (err: HttpErrorResponse) => {
                this.isParsing.set(false);
                this.errorMsg.set(err.error?.error || err.error?.detail || err.message || 'Error al procesar el Excel');
                this.step.set('error');
            }
        });
    }

    // ── Step 3: Import ────────────────────────────────────────────
    importar(): void {
        if (!this.allRows.length) return;
        this.step.set('importing');
        this.progress.set(0);

        // Si el backend devolvió un import_token usamos la vía rápida:
        // solo mandamos los deltas editados por el usuario en vez de todo el JSON.
        const payload: ImportarRegistrosPayload = this.importToken
            ? { import_token: this.importToken, edits: this.computeEdits() }
            : { registros: this.allRows };

        this.nominaService.importarRegistros(payload).subscribe({
            next: (result) => {
                this.importResult.set(result);
                this.progress.set(100);
                this.step.set('done');
                this.importToken = null;
                this.originalRowsById.clear();
            },
            error: (err: HttpErrorResponse) => {
                this.errorMsg.set(err.error?.error || err.error?.detail || err.message || 'Error al importar');
                this.step.set('error');
            }
        });
    }

    /** Compara cada fila corregida contra el snapshot original y devuelve
     *  solo los campos que cambiaron, indexados por fila_excel. */
    private computeEdits(): Record<string, Partial<PreviewRegistro>> {
        const edits: Record<string, Partial<PreviewRegistro>> = {};
        for (const row of this.allRows) {
            const id = String(row.fila_excel);
            const original = this.originalRowsById.get(id);
            if (!original) {
                // Fila nueva (el dialog raramente permite agregar, pero por si acaso)
                edits[id] = { ...row };
                continue;
            }
            const delta: Partial<PreviewRegistro> = {};
            for (const field of ImportExcelComponent.EDITABLE_FIELDS) {
                const a = (row as any)[field];
                const b = (original as any)[field];
                // Normalizamos null/undefined/'' como equivalentes
                const aNorm = a === undefined || a === '' ? null : a;
                const bNorm = b === undefined || b === '' ? null : b;
                if (aNorm !== bNorm) {
                    (delta as any)[field] = a;
                }
            }
            if (Object.keys(delta).length > 0) {
                edits[id] = delta;
            }
        }
        return edits;
    }



    // ── Reset ─────────────────────────────────────────────────────
    reset(): void {
        this.step.set('select');
        this.selectedFile = null;
        this.previewResp = null;
        this.allRows = [];
        this.importResult.set(null);
        this.errorMsg.set('');
        this.progress.set(0);
        this.importToken = null;
        this.originalRowsById.clear();
        if (this.fileInput) this.fileInput.nativeElement.value = '';
    }

    backToSelect(): void { this.step.set('select'); }

    // ── Helpers ───────────────────────────────────────────────────
    isStep(s: WizardStep): boolean { return this.step() === s; }
}
