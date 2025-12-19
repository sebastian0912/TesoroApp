import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';
import { finalize } from 'rxjs/operators';

import { SharedModule } from '@/app/shared/shared.module';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { ColumnCellTemplateDirective } from '@/app/shared/directives/column-cell-template.directive';

type FlatRow = Record<string, any>;
type ExportCol = { header: string; key: string; width?: number };

@Component({
  selector: 'app-view-reception-interviews',
  standalone: true,
  imports: [SharedModule, StandardFilterTable, MatDialogModule, ColumnCellTemplateDirective],
  templateUrl: './view-reception-interviews.component.html',
  styleUrls: ['./view-reception-interviews.component.css'],
})
export class ViewReceptionInterviewsComponent implements OnInit {
  private readonly isBrowser: boolean;

  title = 'Entrevistas (HOY)';
  isLoading = false;

  rows: FlatRow[] = [];
  columns: ColumnDefinition[] = [];

  oficina = '';

  private readonly EXPORT_COLS: ExportCol[] = [
    { header: 'Entrevista - Fecha/Hora (última)', key: 'entrevista_fecha_ultima', width: 26 },
    { header: 'Entrevista - Oficina', key: 'entrevista_oficina', width: 18 },
    { header: 'Entrevista - ¿Cómo se enteró?', key: 'entrevista_como_entero', width: 30 },
    { header: 'Entrevista - ¿Cómo se proyecta a un año?', key: 'entrevista_como_proyecta', width: 34 },

    { header: 'Candidato - Tipo doc', key: 'cand_tipo_doc', width: 16 },
    { header: 'Candidato - Nº documento', key: 'cand_num_doc', width: 18 },

    { header: 'Proceso - Entrevistado', key: 'proc_entrevistado', width: 16 },
    { header: 'Proceso - Prueba técnica', key: 'proc_prueba_tecnica', width: 18 },
    { header: 'Proceso - Autorizado', key: 'proc_autorizado', width: 14 },
    { header: 'Proceso - Exámenes médicos', key: 'proc_examenes_medicos', width: 20 },
    { header: 'Proceso - Contratado', key: 'proc_contratado', width: 14 },

    { header: 'Candidato - Primer apellido', key: 'cand_primer_apellido', width: 18 },
    { header: 'Candidato - Segundo apellido', key: 'cand_segundo_apellido', width: 18 },
    { header: 'Candidato - Primer nombre', key: 'cand_primer_nombre', width: 18 },
    { header: 'Candidato - Segundo nombre', key: 'cand_segundo_nombre', width: 18 },

    { header: 'Candidato - Fecha de nacimiento', key: 'cand_fecha_nac', width: 18 },
    { header: 'Candidato - Edad', key: 'cand_edad', width: 10 },
    { header: 'Candidato - Estado civil', key: 'cand_estado_civil', width: 14 },

    { header: 'Info CC - Fecha de expedición', key: 'infocc_fecha_expedicion', width: 18 },

    { header: 'Residencia - Barrio', key: 'res_barrio', width: 22 },
    { header: 'Residencia - ¿Hace cuánto vive en la zona?', key: 'res_hace_cuanto', width: 28 },

    { header: 'Contacto - WhatsApp', key: 'cont_whatsapp', width: 16 },
    { header: 'Contacto - Teléfono', key: 'cont_telefono', width: 16 },

    { header: 'Candidato - Sexo', key: 'cand_sexo', width: 10 },

    { header: 'Experiencia - ¿Tiene?', key: 'exp_tiene', width: 14 },
    { header: 'Contacto - Email', key: 'cont_email', width: 26 },

    { header: 'Experiencias - Empresas (todas)', key: 'exps_empresas', width: 32 },
    { header: 'Experiencia - Labores realizadas', key: 'exps_labores', width: 40 },

    { header: 'Formación - Nivel', key: 'form_nivel', width: 18 },

    { header: 'Hijos - ¿Tiene?', key: 'hijos_tiene', width: 12 },
    { header: 'Hijos - ¿Cuántos?', key: 'hijos_cuantos', width: 14 },
    { header: 'Hijos - Edades (coma)', key: 'hijos_edades', width: 18 },

    { header: 'Vivienda - Responsable hijos', key: 'viv_responsable_hijos', width: 22 },
    { header: 'Vivienda - Personas con quien convive', key: 'viv_convive', width: 28 },
    { header: 'Vivienda - ¿Estudia actualmente?', key: 'viv_estudia', width: 20 },

    { header: 'Proceso - Aplica / No aplica', key: 'proc_aplica', width: 18 },
    { header: 'Proceso - Motivo no aplica', key: 'proc_motivo_no_aplica', width: 26 },
    { header: 'Proceso - Motivo en espera', key: 'proc_motivo_espera', width: 26 },

    { header: 'Publicación - Finca', key: 'pub_finca', width: 22 },
    { header: 'Publicación - Cargo', key: 'pub_cargo', width: 22 },
    { header: 'Publicación - Fecha de prueba', key: 'pub_fecha_prueba', width: 18 },

    { header: 'Proceso - Detalle', key: 'proc_detalle', width: 40 },
  ];

  constructor(
    private readonly infoVacantesService: InfoVacantesService,
    private readonly utilityService: UtilityServiceService,
    private readonly dialog: MatDialog,
    private readonly destroyRef: DestroyRef,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.columns = this.EXPORT_COLS.map((c) => {
      const type: ColumnDefinition['type'] =
        c.key === 'entrevista_fecha_ultima'
          ? 'date'
          : c.key === 'cand_edad' || c.key === 'hijos_cuantos'
            ? 'number'
            : 'text';

      const widthPx = c.width ? Math.min(520, Math.max(120, c.width * 7)) : undefined;

      return {
        name: c.key,
        header: c.header,
        type,
        width: widthPx ? `${widthPx}px` : undefined,
        filterable: true,
        sortable: true,
      } as ColumnDefinition;
    });
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      const sedeNombre = this.utilityService.getUser?.()?.sede?.nombre;
      this.oficina = String(sedeNombre ?? '').trim();
    }
    this.loadInterviewsToday();
  }

  loadInterviewsToday(): void {
    this.isLoading = true;

    const oficina = this.normalizeOffice(this.oficina);

    this.infoVacantesService
      .getCandidatosEntrevistasHoy({ full: true, oficina })
      .pipe(
        finalize(() => (this.isLoading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => (this.rows = this.flattenCandidates(data || [])),
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'No se pudo cargar la información de hoy.', 'error');
          this.rows = [];
        },
      });
  }

  openRangeDialogAndExport(): void {
    if (!this.isBrowser) return;

    const ref = this.dialog.open(DateRangeDialogComponent, {
      width: '420px',
      data: { title: 'Descargar Excel por rango' },
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((raw: any) => {
        const meta = this.extractRangeMeta(raw);

        if (!meta) {
          // ✅ ya no “se queda callado” (así te das cuenta si el diálogo no devuelve nada)
          Swal.fire('Atención', 'Debes seleccionar un rango de fechas válido.', 'info');
          return;
        }

        this.exportRangeExcel(meta);
      });
  }

  // =========================================================
  // ✅ Aquí arreglamos el problema: soporta múltiples llaves/formats
  // =========================================================
  private extractRangeMeta(raw: any): { from: string; to: string; oficina?: string } | null {
    if (!raw) return null;

    // soporta: from/to, start/end, startDate/endDate, desde/hasta, fechaInicio/fechaFin
    const fromRaw =
      raw.from ?? raw.start ?? raw.startDate ?? raw.dateFrom ?? raw.desde ?? raw.fechaInicio ?? raw.fecha_inicio;
    const toRaw =
      raw.to ?? raw.end ?? raw.endDate ?? raw.dateTo ?? raw.hasta ?? raw.fechaFin ?? raw.fecha_fin;

    const fromDate = this.coerceToDate(fromRaw);
    if (!fromDate) return null;

    const toDate = this.coerceToDate(toRaw) ?? fromDate;

    const from = this.formatDateYYYYMMDD(fromDate);
    const to = this.formatDateYYYYMMDD(toDate);

    const oficina = this.normalizeOffice(raw.oficina ?? raw.office ?? raw.sede ?? raw.oficinaSeleccionada ?? this.oficina);

    return { from, to, oficina };
  }

  private coerceToDate(value: any): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    const s = String(value).trim();
    if (!s) return null;

    // yyyy-mm-dd -> crear Date LOCAL (evita corrimientos por UTC)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mm = Number(m[2]);
      const d = Number(m[3]);
      const dt = new Date(y, mm - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    }

    // fallback
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  }

  private exportRangeExcel(meta: { from: string; to: string; oficina?: string }): void {
    if (!this.isBrowser) return;

    const labelOffice = meta.oficina ? ` | Oficina: ${meta.oficina}` : '';

    Swal.fire({
      title: 'Generando Excel...',
      text: `Rango ${meta.from} → ${meta.to}${labelOffice}`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    // ✅ AQUÍ es donde debe verse el GET en Network sí o sí
    this.infoVacantesService
      .getCandidatosEntrevistasRango({ from: meta.from, to: meta.to, full: true, oficina: meta.oficina })
      .pipe(
        finalize(() => Swal.close()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: async (data) => {
          const rows = this.flattenCandidates(data || []);
          await this.buildAndDownloadExcel(rows, meta);
          Swal.fire('Listo', 'Excel generado correctamente.', 'success');
        },
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'No se pudo generar el Excel del rango.', 'error');
        },
      });
  }

  private normalizeOffice(value: unknown): string | undefined {
    const s = String(value ?? '').trim();
    return s.length ? s : undefined;
  }

  private formatDateYYYYMMDD(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // =========================================================
  // 👇 Tu lógica existente (sin cambios funcionales)
  // =========================================================
  private flattenCandidates(candidatos: any[]): FlatRow[] {
    return (candidatos || []).map((c) => {
      const contacto = c?.contacto || {};
      const residencia = c?.residencia || {};
      const infoCc = c?.info_cc || {};
      const vivienda = c?.vivienda || {};
      const formaciones: any[] = Array.isArray(c?.formaciones) ? c.formaciones : [];
      const experiencias: any[] = Array.isArray(c?.experiencias) ? c.experiencias : [];
      const hijos: any[] = Array.isArray(c?.hijos) ? c.hijos : [];
      const entrevistas: any[] = Array.isArray(c?.entrevistas) ? c.entrevistas : [];

      const lastEnt = this.pickLastInterview(entrevistas);
      const proceso = lastEnt?.proceso || {};
      const publicacion = proceso?.publicacion || {};

      const edadCand = this.calcAge(c?.fecha_nacimiento);

      const empresas = this.uniqueJoin(experiencias.map((x) => x?.empresa).filter(Boolean));
      const labores = this.uniqueJoin(
        experiencias
          .map((x) => x?.labores_realizadas || x?.labores_principales || x?.labores_especificas)
          .filter(Boolean),
      );

      const formNivel = this.uniqueJoin(
        formaciones
          .map((x) => x?.nivel || x?.nivel_educativo || x?.titulo || x?.formacion || x?.grado)
          .filter(Boolean),
      );

      const hijosTiene = hijos.length > 0;
      const hijosEdades = hijos
        .map((h) => this.calcAge(h?.fecha_nac) ?? h?.edad)
        .filter((v) => v !== null && v !== undefined && v !== '')
        .join(', ');

      return {
        entrevista_fecha_ultima: this.toDate(lastEnt?.updated_at || lastEnt?.created_at),
        entrevista_oficina: lastEnt?.oficina ?? '',
        entrevista_como_entero: lastEnt?.como_se_entero ?? '',
        entrevista_como_proyecta: lastEnt?.como_se_proyecta ?? '',

        cand_tipo_doc: c?.tipo_doc ?? '',
        cand_num_doc: c?.numero_documento ?? '',

        proc_entrevistado: this.yesNo(proceso?.entrevistado),
        proc_prueba_tecnica: this.yesNo(proceso?.prueba_tecnica),
        proc_autorizado: this.yesNo(proceso?.autorizado),
        proc_examenes_medicos: this.yesNo(proceso?.examenes_medicos ?? proceso?.examen_medico),
        proc_contratado: this.yesNo(proceso?.contratado),

        cand_primer_apellido: c?.primer_apellido ?? '',
        cand_segundo_apellido: c?.segundo_apellido ?? '',
        cand_primer_nombre: c?.primer_nombre ?? '',
        cand_segundo_nombre: c?.segundo_nombre ?? '',

        cand_fecha_nac: c?.fecha_nacimiento ?? '',
        cand_edad: edadCand ?? '',
        cand_estado_civil: c?.estado_civil ?? '',

        infocc_fecha_expedicion: infoCc?.fecha_expedicion ?? '',

        res_barrio: residencia?.barrio ?? '',
        res_hace_cuanto: residencia?.hace_cuanto_vive ?? '',

        cont_whatsapp: contacto?.whatsapp ?? '',
        cont_telefono: contacto?.celular ?? contacto?.telefono ?? '',
        cont_email: contacto?.email ?? '',

        cand_sexo: c?.sexo ?? '',
        exp_tiene: experiencias.length > 0 ? 'SI' : 'NO',

        exps_empresas: empresas,
        exps_labores: labores,

        form_nivel: formNivel,

        hijos_tiene: hijosTiene ? 'SI' : 'NO',
        hijos_cuantos: hijos.length,
        hijos_edades: hijosEdades,

        viv_responsable_hijos: vivienda?.responsable_hijos ?? '',
        viv_convive: vivienda?.personas_con_quien_convive ?? vivienda?.convive_con ?? '',
        viv_estudia: this.yesNo(vivienda?.estudia_actualmente ?? vivienda?.estudia),

        proc_aplica: proceso?.aplica ?? proceso?.aplica_no_aplica ?? '',
        proc_motivo_no_aplica: proceso?.motivo_no_aplica ?? '',
        proc_motivo_espera: proceso?.motivo_espera ?? proceso?.motivo_en_espera ?? '',

        pub_finca: publicacion?.finca ?? publicacion?.nombre_finca ?? '',
        pub_cargo: publicacion?.cargo ?? publicacion?.nombre_cargo ?? '',
        pub_fecha_prueba: publicacion?.fecha_prueba ?? '',

        proc_detalle: proceso?.detalle ?? proceso?.observaciones ?? '',
      };
    });
  }

  private pickLastInterview(entrevistas: any[]): any | null {
    if (!entrevistas?.length) return null;
    return entrevistas.reduce((best, cur) => {
      const bd = new Date(best?.updated_at || best?.created_at || 0).getTime();
      const cd = new Date(cur?.updated_at || cur?.created_at || 0).getTime();
      return cd >= bd ? cur : best;
    }, entrevistas[0]);
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  private calcAge(dateStr?: string): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  }

  private yesNo(v: any): string {
    if (v === true) return 'SI';
    if (v === false) return 'NO';
    if (typeof v === 'string') {
      const s = v.trim().toUpperCase();
      if (['SI', 'SÍ', 'YES', 'TRUE', '1'].includes(s)) return 'SI';
      if (['NO', 'FALSE', '0'].includes(s)) return 'NO';
      return v;
    }
    if (v === 1) return 'SI';
    if (v === 0) return 'NO';
    return '';
  }

  private uniqueJoin(values: any[]): string {
    const set = new Set<string>();
    (values || []).forEach((v) => {
      const s = String(v ?? '').trim();
      if (s) set.add(s);
    });
    return Array.from(set).join(', ');
  }

  private async buildAndDownloadExcel(
    rows: FlatRow[],
    meta: { from: string; to: string; oficina?: string },
  ): Promise<void> {
    if (!this.isBrowser) return;

    // ✅ Lazy load (evita SSR + reduce bundle)
    const excelJSImport: any = await import('exceljs');
    const WorkbookCtor = excelJSImport?.Workbook ?? excelJSImport?.default?.Workbook;
    if (!WorkbookCtor) throw new Error('No se pudo cargar ExcelJS.Workbook');

    const fileSaver: any = await import('file-saver');
    const saveAs: (blob: Blob, filename: string) => void = fileSaver?.saveAs ?? fileSaver?.default?.saveAs;
    if (!saveAs) throw new Error('No se pudo cargar file-saver.saveAs');

    const workbook = new WorkbookCtor();
    workbook.creator = 'Sistema';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Entrevistas', {
      views: [{ state: 'frozen', ySplit: 3 }],
      properties: { defaultRowHeight: 18 },
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    // ======= Paleta =======
    const BRAND = 'FF0C2771';
    const BRAND_2 = 'FF1B46C2';
    const SOFT = 'FFF4F7FF';
    const HEADER = BRAND_2;
    const HEADER_TXT = 'FFFFFFFF';
    const BORDER = 'FFE5E7EB';
    const ZEBRA = 'FFF8FAFF';
    const OK = 'FFD1FAE5';
    const NO = 'FFFEE2E2';

    const colCount = this.EXPORT_COLS.length;

    // ======= Título / Subtítulo =======
    const title = 'REPORTE DE ENTREVISTAS';
    const subtitleParts = [
      `Rango: ${meta.from} a ${meta.to}`,
      meta.oficina ? `Oficina: ${meta.oficina}` : null,
      `Generado: ${new Date().toLocaleString()}`,
    ].filter(Boolean) as string[];

    sheet.mergeCells(1, 1, 1, colCount);
    const t = sheet.getCell(1, 1);
    t.value = title;
    t.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    t.alignment = { vertical: 'middle', horizontal: 'center' };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    sheet.getRow(1).height = 28;

    sheet.mergeCells(2, 1, 2, colCount);
    const st = sheet.getCell(2, 1);
    st.value = subtitleParts.join('   |   ');
    st.font = { italic: true, size: 11, color: { argb: BRAND } };
    st.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    st.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
    sheet.getRow(2).height = 20;

    // ======= Columnas =======
    sheet.columns = this.EXPORT_COLS.map((c) => ({
      key: c.key,
      width: c.width ?? 18,
      style: { alignment: { vertical: 'top', wrapText: true } },
    }));

    // ======= Header (fila 3) =======
    const headerRow = sheet.getRow(3);
    headerRow.values = [null, ...this.EXPORT_COLS.map((c) => c.header)];
    headerRow.height = 34;
    headerRow.font = { bold: true, size: 11, color: { argb: HEADER_TXT } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    for (let c = 1; c <= colCount; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER } };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER } },
        left: { style: 'thin', color: { argb: BORDER } },
        bottom: { style: 'thin', color: { argb: BORDER } },
        right: { style: 'thin', color: { argb: BORDER } },
      };
    }

    sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: colCount } };

    // ======= Datos =======
    const safeRows = (rows || []).map((r) => {
      const out: any = {};
      this.EXPORT_COLS.forEach((c) => (out[c.key] = r?.[c.key] ?? ''));
      return out;
    });

    safeRows.forEach((obj) => sheet.addRow(obj));

    // ======= Estilos por celda: zebra, bordes, formatos, SI/NO =======
    const lastRow = sheet.lastRow?.number ?? 3;

    const dateKeys = new Set<string>(['entrevista_fecha_ultima']);
    const numKeys = new Set<string>(['cand_edad', 'hijos_cuantos']);

    const keyByIndex = (idx: number) => this.EXPORT_COLS[idx - 1]?.key;

    // Ajuste: filas muy largas se ven mejor top-aligned, pero SI/NO centrado
    for (let r = 4; r <= lastRow; r++) {
      const row = sheet.getRow(r);
      row.height = 18;

      const zebraFill = r % 2 === 0 ? ZEBRA : 'FFFFFFFF';

      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        const key = keyByIndex(c);

        // base
        cell.border = {
          top: { style: 'thin', color: { argb: BORDER } },
          left: { style: 'thin', color: { argb: BORDER } },
          bottom: { style: 'thin', color: { argb: BORDER } },
          right: { style: 'thin', color: { argb: BORDER } },
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraFill } };
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

        // fecha
        if (key && dateKeys.has(key)) {
          const v = cell.value as any;
          const d = v instanceof Date ? v : v ? new Date(v) : null;
          if (d && !isNaN(d.getTime())) {
            cell.value = d;
            cell.numFmt = 'yyyy-mm-dd hh:mm';
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          }
        }

        // número
        if (key && numKeys.has(key)) {
          const v = cell.value as any;
          const n = typeof v === 'number' ? v : String(v).trim() ? Number(v) : NaN;
          if (!Number.isNaN(n)) {
            cell.value = n;
            cell.numFmt = '0';
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          }
        }

        // SI / NO
        const s = String(cell.value ?? '').trim().toUpperCase();
        if (s === 'SI' || s === 'SÍ') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OK } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.font = { bold: true };
        } else if (s === 'NO') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NO } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.font = { bold: true };
        }
      }

      row.commit();
    }

    // ======= Ajustes finales =======
    // Mejor lectura: imprimir en una página de ancho, y márgenes suaves
    sheet.pageSetup.margins = {
      left: 0.25,
      right: 0.25,
      top: 0.35,
      bottom: 0.35,
      header: 0.2,
      footer: 0.2,
    };

    // ======= Filename =======
    const baseName =
      meta.from === meta.to ? `entrevistas_${meta.from}` : `entrevistas_${meta.from}_a_${meta.to}`;

    const safeOffice = meta.oficina ? String(meta.oficina).trim().replace(/\s+/g, '_') : '';
    const filename = safeOffice ? `${baseName}_${safeOffice}.xlsx` : `${baseName}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    saveAs(blob, filename);
  }

}
