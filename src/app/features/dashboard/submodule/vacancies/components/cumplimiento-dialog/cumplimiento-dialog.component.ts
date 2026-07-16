import {
  Component, Inject, OnInit, signal, computed, inject, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, take } from 'rxjs';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

import {
  CandidatoPorVacanteItem,
  ProcesoUpdateByDocumentRequest,
  RegistroProcesoContratacion,
} from '../../../hiring/service/registro-proceso-contratacion/registro-proceso-contratacion';
import { HomeService } from '../../../home/service/home.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

export interface CumplimientoDialogData {
  publicacionId: number;
  cargo?: string | null;
  finca?: string | null;
  empresa?: string | null;
  req?: number;
  firm?: number;
  cumpl?: number;
}

@Component({
  selector: 'app-cumplimiento-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  templateUrl: './cumplimiento-dialog.component.html',
  styleUrl: './cumplimiento-dialog.component.css',
})
export class CumplimientoDialogComponent implements OnInit {
  private readonly gc = inject(RegistroProcesoContratacion);
  private readonly homeService = inject(HomeService);
  private readonly util = inject(UtilityServiceService);

  /** Empresa fija para el formato BMC. */
  private readonly BMC_COMPANY = 'TU ALIANZA SAS';
  /** NIT del proveedor del contratista, fijo para BMC. */
  private readonly BMC_PROVEEDOR = '900864596';

  loading = signal<boolean>(true);
  working = signal<boolean>(false);
  candidatos = signal<CandidatoPorVacanteItem[]>([]);
  /** Cédulas seleccionadas (clave = numero_documento). */
  private readonly seleccion = signal<Set<string>>(new Set<string>());

  seleccionCount = computed(() => this.seleccion().size);
  total = computed(() => this.candidatos().length);
  allSelected = computed(() => this.total() > 0 && this.seleccionCount() === this.total());
  someSelected = computed(() => this.seleccionCount() > 0 && !this.allSelected());

  constructor(
    public dialogRef: MatDialogRef<CumplimientoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CumplimientoDialogData,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * Carga la lista de candidatos de la vacante.
   * @param silent si es true no muestra el estado "Cargando…" (refresco en
   *   segundo plano tras una acción optimista, para no parpadear la tabla).
   */
  private cargar(silent = false): void {
    if (!silent) this.loading.set(true);
    this.gc.getCandidatosPorVacante(this.data.publicacionId)
      .pipe(take(1))
      .subscribe({
        next: (rows) => {
          this.candidatos.set(Array.isArray(rows) ? rows : []);
          // Mantener sólo selecciones que sigan presentes.
          const vivas = new Set(this.candidatos().map((c) => String(c.numero_documento)));
          const sel = new Set([...this.seleccion()].filter((c) => vivas.has(c)));
          this.seleccion.set(sel);
          this.loading.set(false);
        },
        error: () => {
          if (!silent) this.candidatos.set([]);
          this.loading.set(false);
          if (!silent) Swal.fire('Error', 'No se pudieron cargar los candidatos de la vacante.', 'error');
        },
      });
  }

  // ───────── Selección ─────────
  isSelected(c: CandidatoPorVacanteItem): boolean {
    return this.seleccion().has(String(c.numero_documento));
  }

  toggle(c: CandidatoPorVacanteItem, checked: boolean): void {
    const sel = new Set(this.seleccion());
    const key = String(c.numero_documento);
    if (checked) sel.add(key); else sel.delete(key);
    this.seleccion.set(sel);
  }

  toggleAll(checked: boolean): void {
    this.seleccion.set(checked ? new Set(this.candidatos().map((c) => String(c.numero_documento))) : new Set());
  }

  /** Candidatos sobre los que actúan los botones: seleccionados, o todos si no hay selección. */
  private objetivo(): CandidatoPorVacanteItem[] {
    const sel = this.seleccion();
    if (!sel.size) return this.candidatos();
    return this.candidatos().filter((c) => sel.has(String(c.numero_documento)));
  }

  nombreMostrar(c: CandidatoPorVacanteItem): string {
    if (c.apellidos_nombres) return c.apellidos_nombres;
    const ap = [c.primer_apellido, c.segundo_apellido].filter(Boolean).join(' ').trim();
    const no = [c.primer_nombre, c.segundo_nombre].filter(Boolean).join(' ').trim();
    return [ap, no].filter(Boolean).join(', ') || '—';
  }

  /** Nombre legible en orden natural y capitalizado: "Elizabeth Sotelo Sarmiento". */
  nombreBonito(c: CandidatoPorVacanteItem): string {
    const parts = [c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido]
      .map((p) => this.titleCase(p))
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
    return this.titleCase(this.nombreMostrar(c)) || '—';
  }

  /** Iniciales para el avatar (primer nombre + primer apellido). */
  iniciales(c: CandidatoPorVacanteItem): string {
    const a = (c.primer_nombre || c.primer_apellido || '').trim();
    const b = (c.primer_apellido || c.segundo_nombre || '').trim();
    const f = a ? a[0] : '';
    const s = b && b !== a ? b[0] : '';
    return (f + s).toUpperCase() || '?';
  }

  /** Clase de color del chip de etapa. */
  etapaClass(etapa: string | null | undefined): string {
    const e = (etapa || '').toLowerCase();
    if (e.includes('no pas')) return 'etapa-nopaso';
    if (e.includes('ingres')) return 'etapa-ingreso';
    if (e.includes('contrat')) return 'etapa-contratado';
    if (e.includes('exam')) return 'etapa-examenes';
    if (e.includes('autoriz')) return 'etapa-autorizado';
    if (e.includes('prueba')) return 'etapa-prueba';
    if (e.includes('entrevist')) return 'etapa-entrevistado';
    if (e.includes('pre')) return 'etapa-prereg';
    return 'etapa-asignado';
  }

  /** Tooltip con fecha + motivo de "no pasó la prueba técnica". */
  noPasoTooltip(c: CandidatoPorVacanteItem): string {
    const partes: string[] = [];
    if (c.no_paso_prueba_tecnica_at) partes.push(`Fecha: ${this.fmtFecha(c.no_paso_prueba_tecnica_at)}`);
    if (c.motivo_no_paso_prueba_tecnica) partes.push(`Motivo: ${c.motivo_no_paso_prueba_tecnica}`);
    return partes.join('\n') || 'No pasó la prueba técnica';
  }

  /** Cuántas personas faltan para completar la vacante. */
  faltan(): number {
    return Math.max(0, (Number(this.data.req) || 0) - (Number(this.data.firm) || 0));
  }

  /** Clase de color de la barra/píldora de cumplimiento según el porcentaje. */
  cumplTono(): string {
    const pct = Number(this.data.cumpl) || 0;
    if (pct >= 100) return 'tono-ok';
    if (pct >= 70) return 'tono-warn';
    return 'tono-low';
  }

  private titleCase(s: string | null | undefined): string {
    if (!s) return '';
    return String(s).toLowerCase().replace(/\b\p{L}/gu, (ch) => ch.toUpperCase()).trim();
  }

  /** Sólo las filas seleccionadas (acción destructiva: nunca asume "todas"). */
  private seleccionados(): CandidatoPorVacanteItem[] {
    const sel = this.seleccion();
    return this.candidatos().filter((c) => sel.has(String(c.numero_documento)));
  }

  // ───────── Quitar vacante ─────────
  async quitarVacante(): Promise<void> {
    // A diferencia de las descargas, esta acción NO asume "todas": exige
    // selección explícita para evitar desasignaciones masivas accidentales.
    const objetivo = this.seleccionados();
    if (!objetivo.length) {
      Swal.fire(
        'Selecciona personas',
        'Marca las casillas de las personas a las que quieres quitar la vacante.',
        'info',
      );
      return;
    }

    const total = objetivo.length;
    const confirm = await Swal.fire({
      title: `¿Quitar la vacante a ${total} persona(s)?`,
      html: 'La vacante y los datos de remisión quedarán sin asignar para esas personas. Esta acción no borra al candidato.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#c62828',
    });
    if (!confirm.isConfirmed) return;

    this.working.set(true);

    let done = 0;
    let ok = 0;
    const fallidas: string[] = [];

    const pintarProgreso = () => {
      const el = Swal.getHtmlContainer();
      if (el) el.innerHTML = `<b>${done}</b> / ${total}`;
    };

    Swal.fire({
      title: 'Quitando vacante…',
      html: `0 / ${total}`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    // Concurrencia limitada: rápido sin saturar el backend con 400 PATCH a la vez.
    const CONCURRENCIA = 6;
    let idx = 0;
    const worker = async (): Promise<void> => {
      while (idx < objetivo.length) {
        const c = objetivo[idx++];
        const payload: ProcesoUpdateByDocumentRequest = {
          numero_documento: String(c.numero_documento),
          publicacion: null,
          vacante_tipo: null,
          vacante_salario: null,
          vacante_fecha_prueba: null,
          prueba_tecnica: false,
          autorizado: false,
        };
        try {
          await firstValueFrom(this.gc.updateProcesoByDocumento(payload, 'PATCH'));
          ok++;
        } catch {
          fallidas.push(String(c.numero_documento));
        } finally {
          done++;
          pintarProgreso();
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCIA, objetivo.length) }, () => worker()),
    );

    this.working.set(false);
    Swal.close();

    // Actualización OPTIMISTA: quitamos ya mismo de la tabla a quienes sí se
    // removieron, sin esperar al backend ni a que el usuario cierre un modal.
    const fallidasSet = new Set(fallidas);
    const removidas = new Set(
      objetivo
        .map((c) => String(c.numero_documento))
        .filter((ced) => !fallidasSet.has(ced)),
    );
    if (removidas.size) {
      // Bajar los KPIs del encabezado (Firmados / Cumplimiento %) en el acto:
      // quitar a un contratado reduce los firmados de la vacante.
      const firmRemovidos = objetivo.filter((c) => {
        if (fallidasSet.has(String(c.numero_documento))) return false;
        const e = (c.etapa || '').toLowerCase();
        return e.includes('contrat') || e.includes('ingres');
      }).length;
      if (firmRemovidos && this.data.firm != null) {
        this.data.firm = Math.max(0, (Number(this.data.firm) || 0) - firmRemovidos);
        const req = Number(this.data.req) || 0;
        this.data.cumpl = req ? Math.min(100, Math.round((this.data.firm / req) * 100)) : 0;
      }

      this.candidatos.set(this.candidatos().filter((c) => !removidas.has(String(c.numero_documento))));
      this.seleccion.set(new Set([...this.seleccion()].filter((ced) => !removidas.has(ced))));
      this.cambios = true;
    }

    // Feedback NO bloqueante (toast): no frena el refresco ni tapa la tabla.
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: fallidas.length ? 'warning' : 'success',
      title: fallidas.length
        ? `Quitada a ${ok} de ${total}. Fallaron ${fallidas.length}.`
        : `Vacante quitada a ${ok} persona(s).`,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });

    // Reconciliación autoritativa en segundo plano (sin parpadeo de "Cargando…").
    this.cargar(true);
  }

  /** Marca que hubo cambios para que el componente padre refresque al cerrar. */
  cambios = false;

  cerrar(): void {
    this.dialogRef.close(this.cambios);
  }

  // ───────── Descargar base (igual que home: candidatos-excel) ─────────
  async descargarBase(): Promise<void> {
    const objetivo = this.objetivo();
    const cedulas = objetivo.map((c) => String(c.numero_documento)).filter(Boolean);
    if (!cedulas.length) {
      Swal.fire('Sin candidatos', 'No hay cédulas para descargar.', 'info');
      return;
    }

    this.working.set(true);
    Swal.fire({ title: 'Generando base...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const persona = this.nombreUsuario();
      const res = await firstValueFrom(this.homeService.descargarCandidatosExcel(cedulas, persona));
      if (!res.body) throw new Error('Respuesta vacía');
      const filename = `base_vacante_${this.data.publicacionId}.xlsx`;
      this.homeService.saveBlob(res.body, filename);
      Swal.close();
    } catch (err: any) {
      Swal.close();
      Swal.fire(
        'Error',
        err?.status === 0 ? 'No se pudo contactar el servidor.' : 'Falló la descarga de la base.',
        'error',
      );
    } finally {
      this.working.set(false);
    }
  }

  // ───────── Descargar BMC (cliente, formato fijo) ─────────
  descargarBmc(): void {
    const objetivo = this.objetivo();
    if (!objetivo.length) {
      Swal.fire('Sin candidatos', 'No hay candidatos para exportar.', 'info');
      return;
    }

    const headers = [
      'Company', 'Proveedor del contratista', 'Número de personal',
      'Primer nombre', 'Segundo nombre', 'Primer apellido', 'Segundo apellido',
      'Fecha inicial del empleo', 'Fecha final del empleo', 'Direccion',
      'Descripción de teléfono principal', 'Teléfono principal',
      'GENERO', 'Fecha de nacimiento', 'Estado civil', 'Formación',
    ];

    const rows = objetivo.map((c) => ({
      'Company': this.BMC_COMPANY,
      'Proveedor del contratista': this.BMC_PROVEEDOR,
      'Número de personal': String(c.numero_documento ?? ''),
      'Primer nombre': c.primer_nombre ?? '',
      'Segundo nombre': c.segundo_nombre ?? '',
      'Primer apellido': c.primer_apellido ?? '',
      'Segundo apellido': c.segundo_apellido ?? '',
      'Fecha inicial del empleo': this.fmtFecha(c.fecha_ingreso),
      'Fecha final del empleo': '',
      'Direccion': c.direccion ?? '',
      'Descripción de teléfono principal': (c.celular || c.whatsapp) ? 'CELULAR' : '',
      'Teléfono principal': c.celular || c.whatsapp || '',
      'GENERO': c.sexo ?? '',
      'Fecha de nacimiento': this.fmtFecha(c.fecha_nacimiento),
      'Estado civil': c.estado_civil ?? '',
      'Formación': c.formacion ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BMC');
    XLSX.writeFile(wb, `BMC_vacante_${this.data.publicacionId}.xlsx`);
  }

  // ───────── Descargar formatos por finca (cliente, generados desde 0) ─────────
  //
  // Los encabezados replican los formatos que envía cada finca, PERO el Excel se
  // arma desde cero con XLSX; NO se leen los archivos de ejemplo. Solo se llenan
  // las columnas para las que el sistema tiene dato (cédula, nombres, sexo, fechas,
  // dirección, barrio, teléfono, escolaridad, y cargo/finca/empresa de la vacante);
  // el resto queda en blanco para diligenciar a mano.

  /** FLORES DEL RIO — encabezado simple (hoja "base rio"). */
  descargarFlores(): void {
    const objetivo = this.objetivo();
    if (!objetivo.length) { Swal.fire('Sin candidatos', 'No hay candidatos para exportar.', 'info'); return; }

    const headers = [
      'u', 'CONTRATO', 'UNIDAD', 'AREA', 'CEDULA', 'EXP', 'NOMBRE', 'AUXILIO', 'RUTA',
      'PARADERO', 'GENERO', 'CARGO', 'NIVEL DE CARGO', 'JEFE INMEDIATO', 'CENTRO DE COSTO',
      'FECHA INGRESO', 'ANTIGÜEDAD (dias)', 'AFP', 'EPS', 'FECHA NACIMIENTO', 'EDAD',
      'CIUDAD DE NACIMIENTO', 'NUMERO TELEFONICO', 'DIRECCIÓN CASA ', 'CORREO ELECTRONICO',
      'CONTACTO DE EMERGENCIA',
    ];
    const filas = objetivo.map((c) => [
      'TU ALIANZA', '', '', '', String(c.numero_documento ?? ''), '', this.nombreCompleto(c),
      '', '', '', c.sexo ?? '', this.data.cargo ?? '', '', '', '',
      this.fmtFecha(c.fecha_ingreso), '', '', '', this.fmtFecha(c.fecha_nacimiento),
      this.edad(c.fecha_nacimiento), '', this.telefono(c), c.direccion ?? '', '', '',
    ]);
    this.escribirLibro([headers, ...filas], [], 'base rio', this.nombreArchivo('FLORES_DEL_RIO'));
  }

  /** SAGARO — encabezado simple (hoja "formato de ingresos"). */
  descargarSagaro(): void {
    const objetivo = this.objetivo();
    if (!objetivo.length) { Swal.fire('Sin candidatos', 'No hay candidatos para exportar.', 'info'); return; }

    const headers = [
      'CEDULA', 'FECHA EXPEDICION DE DOCUMENTO', 'LUGAR DE EXPEDICION', 'PRIMER NOMBRE',
      'SEGUNDO NOMBRE', 'PRIMER APELLIDO', 'SEGUNDO APELLIDO', 'LUGAR DE NACIMIENTO',
      'FECHA DE NACIMIENTO', 'NACIONALIDAD', 'DIRECCIÓN', 'CIUDAD', 'LOCALIDAD', 'BARRIO',
      'N° HIJOS', 'GRUPO SANGUINEO', 'EPS', 'PENSION', 'CESANTIAS', 'ARL', 'CELULAR', 'EMAIL',
      'FECHA DE INGRESO', 'SALARIO', 'TALLA BOTAS', 'TALLA OVEROL',
    ];
    const filas = objetivo.map((c) => [
      String(c.numero_documento ?? ''), '', '', c.primer_nombre ?? '', c.segundo_nombre ?? '',
      c.primer_apellido ?? '', c.segundo_apellido ?? '', '', this.fmtFecha(c.fecha_nacimiento),
      'COLOMBIANO', c.direccion ?? '', '', '', c.barrio ?? '', '', '', '', '', '', '',
      this.telefono(c), '', this.fmtFecha(c.fecha_ingreso), '', '', '',
    ]);
    this.escribirLibro([headers, ...filas], [], 'formato de ingresos', this.nombreArchivo('SAGARO'));
  }

  /** HATO — doble encabezado (grupos de fecha con celdas combinadas). Fecha: DIA/MES/AÑO. */
  descargarHato(): void {
    const objetivo = this.objetivo();
    if (!objetivo.length) { Swal.fire('Sin candidatos', 'No hay candidatos para exportar.', 'info'); return; }

    const columnas = [
      'NO', 'TIPO DOCUMENTO', 'NUMERO DE DOCUEMNTO', 'NOMBRE COMPLETO',
      'DIA', 'MES', 'AÑO', 'EXPEDIDA EN', 'DIA', 'MES', 'AÑO', 'RH+', 'LUGAR NACIMIENTO',
      'EDAD', 'GENERO', 'ESCOLARIDAD', 'TELEFONO', 'CORREO ELECTRONICO', 'DIRECCION', 'BARRIO',
      'PARADERO', 'LUGAR DE RESIDENCIA', 'SI', 'NO', 'EPS', 'ARL', 'PENSIÓN ', 'CESANTIAS',
      'CALZADO', 'TALLA OVEROL', 'EMPRESA', 'FINCA', 'AREA', 'SUPERVISOR', 'GERENTE',
      'CENTRO DE COSTO', 'CARGO', 'TRAB SOCIAL',
    ];
    const grupos = [
      { label: 'FECHA DE EXPEDICION', desde: 4, hasta: 6 },
      { label: 'FECHA DE NACIMIENTO', desde: 8, hasta: 10 },
      { label: 'SUBSIDIO DE TRANSPORTE', desde: 22, hasta: 23 },
    ];
    const filas = objetivo.map((c, i) => {
      const nac = this.partesFecha(c.fecha_nacimiento);
      return [
        i + 1, c.tipo_doc ?? '', String(c.numero_documento ?? ''), this.nombreCompleto(c),
        '', '', '', '', nac.dia, nac.mes, nac.anio, '', '', this.edad(c.fecha_nacimiento),
        c.sexo ?? '', c.formacion ?? '', this.telefono(c), '', c.direccion ?? '', c.barrio ?? '',
        '', '', '', '', '', '', '', '', '', '', this.data.empresa ?? '', this.data.finca ?? '',
        '', '', '', '', this.data.cargo ?? '', '',
      ];
    });
    const { aoa, merges } = this.construirDobleEncabezado(columnas, grupos, filas);
    this.escribirLibro(aoa, merges, 'INGRESOS', this.nombreArchivo('HATO'));
  }

  /** SAN CARLOS — doble encabezado. Fecha: AÑO/MES/DIA; nombre en APELLIDO 1/2 + NOMBRES. */
  descargarSanCarlos(): void {
    const objetivo = this.objetivo();
    if (!objetivo.length) { Swal.fire('Sin candidatos', 'No hay candidatos para exportar.', 'info'); return; }

    const columnas = [
      'No', 'TIPO DOCUMENTO', 'CEDULA', 'APELLIDO 1', 'APELLIDO 2', 'NOMBRES ',
      'AÑO', 'MES', 'DIA', 'EXPEDIDA EN', 'AÑO', 'MES', 'DIA', 'RH+', 'LUGAR NACIMIENTO',
      'EDAD', 'GENERO', 'ESCOLARIDAD', 'TELEFONO', 'CORREO ELECTRONICO', 'DIRECCION', 'BARRIO',
      'PARADERO', 'LUGAR DE RESIDENCIA', 'SI', 'NO', 'EPS', 'ARL', 'PENSIÓN ', 'CESANTIAS',
      'CALZADO', 'TALLA OVEROL', 'EMPRESA', 'FINCA', 'AREA', 'SUPERVISOR', 'GERENTE',
      'CENTRO DE COSTO', 'CARGO', 'TRAB SOCIAL',
    ];
    const grupos = [
      { label: 'FECHA DE EXPEDICION', desde: 6, hasta: 8 },
      { label: 'FECHA DE NACIMIENTO', desde: 10, hasta: 12 },
      { label: 'SUBSIDIO DE TRANSPORTE', desde: 24, hasta: 25 },
    ];
    const filas = objetivo.map((c, i) => {
      const nac = this.partesFecha(c.fecha_nacimiento);
      const nombres = [c.primer_nombre, c.segundo_nombre].filter(Boolean).join(' ').trim();
      return [
        i + 1, c.tipo_doc ?? '', String(c.numero_documento ?? ''), c.primer_apellido ?? '',
        c.segundo_apellido ?? '', nombres, '', '', '', '', nac.anio, nac.mes, nac.dia, '', '',
        this.edad(c.fecha_nacimiento), c.sexo ?? '', c.formacion ?? '', this.telefono(c), '',
        c.direccion ?? '', c.barrio ?? '', '', '', '', '', '', '', '', '', '', '',
        this.data.empresa ?? '', this.data.finca ?? '', '', '', '', '', this.data.cargo ?? '', '',
      ];
    });
    const { aoa, merges } = this.construirDobleEncabezado(columnas, grupos, filas);
    this.escribirLibro(aoa, merges, 'FORMATO INGRESOS', this.nombreArchivo('SAN_CARLOS'));
  }

  // ───────── Helpers de formato ─────────

  /**
   * Arma un encabezado de DOS filas: una de grupos (fechas / subsidio) por encima y
   * la de columnas debajo. Genera los merges: horizontales para cada grupo y
   * verticales (fila 0-1) para las columnas sueltas, para que su nombre quede
   * centrado en las dos filas como en los formatos originales.
   */
  private construirDobleEncabezado(
    columnas: string[],
    grupos: Array<{ label: string; desde: number; hasta: number }>,
    filas: any[][],
  ): { aoa: any[][]; merges: any[] } {
    const seccion = new Array(columnas.length).fill('');
    for (const g of grupos) seccion[g.desde] = g.label;

    const merges: any[] = [];
    const enGrupo = new Set<number>();
    for (const g of grupos) {
      merges.push({ s: { r: 0, c: g.desde }, e: { r: 0, c: g.hasta } });
      for (let c = g.desde; c <= g.hasta; c++) enGrupo.add(c);
    }
    for (let c = 0; c < columnas.length; c++) {
      if (!enGrupo.has(c)) merges.push({ s: { r: 0, c }, e: { r: 1, c } });
    }
    return { aoa: [seccion, columnas, ...filas], merges };
  }

  private escribirLibro(aoa: any[][], merges: any[], hoja: string, filename: string): void {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (merges.length) ws['!merges'] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, hoja);
    XLSX.writeFile(wb, filename);
  }

  private nombreArchivo(prefijo: string): string {
    return `${prefijo}_vacante_${this.data.publicacionId}.xlsx`;
  }

  /** YYYY-MM-DD → { dia, mes, anio } (sin ceros a la izquierda). Vacío si no hay fecha. */
  private partesFecha(iso: string | null | undefined): { dia: string; mes: string; anio: string } {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
    if (!m) return { dia: '', mes: '', anio: '' };
    return { dia: String(+m[3]), mes: String(+m[2]), anio: m[1] };
  }

  /** Edad en años a partir de la fecha de nacimiento ISO. Vacío si no es válida. */
  private edad(iso: string | null | undefined): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
    if (!m) return '';
    const hoy = new Date();
    let e = hoy.getFullYear() - +m[1];
    const dm = hoy.getMonth() + 1 - +m[2];
    if (dm < 0 || (dm === 0 && hoy.getDate() < +m[3])) e--;
    return e >= 0 && e < 120 ? String(e) : '';
  }

  private telefono(c: CandidatoPorVacanteItem): string {
    return c.celular || c.whatsapp || '';
  }

  private nombreCompleto(c: CandidatoPorVacanteItem): string {
    return [c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido]
      .filter(Boolean).join(' ').trim();
  }

  // ───────── Helpers ─────────
  /** YYYY-MM-DD → DD/MM/YYYY (deja vacío si no hay fecha válida). */
  private fmtFecha(iso: string | null | undefined): string {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!m) return String(iso);
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  private nombreUsuario(): string {
    try {
      const u: any = this.util.getUser();
      const n = `${u?.datos_basicos?.nombres ?? ''} ${u?.datos_basicos?.apellidos ?? ''}`.trim();
      return n || (u?.correo_electronico ?? '');
    } catch {
      return '';
    }
  }
}
