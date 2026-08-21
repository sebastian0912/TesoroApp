import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, Subscription } from 'rxjs';
import { expand, last, tap } from 'rxjs/operators';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

import {
  CatalogosIncapacidad,
  IncapacidadResumen,
  Page,
} from '../../../../models/incapacidad-v2.model';
import {
  IncapacidadV2Service,
  OrdenListado,
} from '../../../../services/incapacidad-v2/incapacidad-v2.service';
import {
  FiltrosConsultaIncapacidad,
  IncapacidadResumenExtendido,
  etiquetaDeCatalogo,
} from '../../consulta-incapacidades.model';
import {
  CLAVES_EXPORTACION_POR_DEFECTO,
  COLUMNAS_EXPORTABLES,
  ColumnaExportable,
  EtiquetasExportacion,
  anchosColumnas,
  cabecerasExportacion,
  construirCsv,
  construirFilasExportacion,
  nombreArchivoExportacion,
} from '../../exportacion-incapacidades';

/** Lo que recibe el dialogo desde la vista de consulta. */
export interface DatosDialogoExportar {
  /** Filtros que estan aplicados AHORA (los mismos que ve el usuario). */
  filtros: FiltrosConsultaIncapacidad;
  orden?: OrdenListado | string;
  /** Filas de la pagina que se esta viendo. */
  filasPaginaActual: IncapacidadResumenExtendido[];
  /** Total de registros que cumplen el filtro (segun el backend). */
  total: number;
  paginaActual: number;
  tamanoPagina: number;
  /** Columnas visibles en la tabla (para la opcion "las visibles"). */
  columnasEnTabla: string[];
  catalogos: CatalogosIncapacidad;
}

/** Formato del archivo. */
export type FormatoExportacion = 'xlsx' | 'csv';

/** Que se exporta: solo la pagina cargada o TODO el resultado del filtro. */
export type AlcanceExportacion = 'pagina' | 'todos';

/** Tamano de lote al recorrer el backend en el modo "todos". */
export const TAMANO_LOTE_EXPORTACION = 200;

/** Tope de seguridad: 100 lotes = 20.000 filas. */
export const MAXIMO_LOTES_EXPORTACION = 100;

/**
 * Dialogo de exportacion.
 *
 * Tres decisiones del usuario:
 *   1. QUE columnas (todas / ninguna / las visibles / a mano).
 *   2. EN QUE formato (Excel o CSV).
 *   3. CON QUE alcance (la pagina actual o TODOS los resultados del filtro).
 *
 * El alcance "todos" recorre de verdad las paginas del backend (`expand` +
 * barra de progreso + boton de cancelar). El exportador del modulo viejo decia
 * "todo" y mandaba solo lo que tenia en memoria; eso aqui no vuelve a pasar.
 */
@Component({
  selector: 'app-dialogo-exportar-incapacidades',
  standalone: true,
  imports: [
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './dialogo-exportar-incapacidades.component.html',
  styleUrl: './dialogo-exportar-incapacidades.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoExportarIncapacidadesComponent implements OnDestroy {
  readonly datos = inject<DatosDialogoExportar>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<DialogoExportarIncapacidadesComponent>>(MatDialogRef);
  private readonly srv = inject(IncapacidadV2Service);

  private descarga?: Subscription;

  readonly columnas: readonly ColumnaExportable[] = COLUMNAS_EXPORTABLES;

  // ── Estado ────────────────────────────────────────────────────────────

  /** Claves marcadas. Se reemplaza el Set entero (signal inmutable). */
  readonly seleccion = signal<ReadonlySet<string>>(
    new Set(CLAVES_EXPORTACION_POR_DEFECTO),
  );

  readonly formato = signal<FormatoExportacion>('xlsx');
  readonly alcance = signal<AlcanceExportacion>('pagina');

  readonly exportando = signal(false);
  readonly filasDescargadas = signal(0);
  readonly lotesDescargados = signal(0);
  readonly lotesTotales = signal(0);
  readonly error = signal('');

  // ── Derivados ─────────────────────────────────────────────────────────

  /** Claves en el ORDEN CANONICO del archivo, no en el de marcado. */
  readonly clavesSeleccionadas = computed(() =>
    COLUMNAS_EXPORTABLES.filter((c) => this.seleccion().has(c.clave)).map((c) => c.clave),
  );

  readonly totalSeleccionadas = computed(() => this.seleccion().size);
  readonly todasMarcadas = computed(() => this.seleccion().size === COLUMNAS_EXPORTABLES.length);
  readonly ningunaMarcada = computed(() => this.seleccion().size === 0);

  /** Cuantos registros se van a escribir. */
  readonly filasPrevistas = computed(() =>
    this.alcance() === 'pagina' ? this.datos.filasPaginaActual.length : this.datos.total,
  );

  readonly puedeExportar = computed(
    () => !this.ningunaMarcada() && !this.exportando() && this.filasPrevistas() > 0,
  );

  /** Porcentaje de la barra (0-100); 0 mientras no se sabe el total. */
  readonly progreso = computed(() => {
    const total = this.lotesTotales();
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.lotesDescargados() / total) * 100));
  });

  readonly hayAvisoDeVolumen = computed(
    () => this.alcance() === 'todos' && this.datos.total > 5000,
  );

  /** Resolutores de etiqueta para el archivo (usan el catalogo del backend). */
  private readonly etiquetas: EtiquetasExportacion = {
    tipoIncapacidad: (c) => etiquetaDeCatalogo(this.datos.catalogos.tiposIncapacidad, c),
    estado: (c) => etiquetaDeCatalogo(this.datos.catalogos.estados, c),
    estadoDocumento: (c) => etiquetaDeCatalogo(this.datos.catalogos.estadosDocumento, c),
    responsablePago: (c) => etiquetaDeCatalogo(this.datos.catalogos.responsablesPago, c),
  };

  // ── Seleccion de columnas ─────────────────────────────────────────────

  estaMarcada(clave: string): boolean {
    return this.seleccion().has(clave);
  }

  alternar(clave: string, marcada: boolean): void {
    const copia = new Set(this.seleccion());
    if (marcada) copia.add(clave);
    else copia.delete(clave);
    this.seleccion.set(copia);
  }

  marcarTodas(): void {
    this.seleccion.set(new Set(COLUMNAS_EXPORTABLES.map((c) => c.clave)));
  }

  marcarNinguna(): void {
    this.seleccion.set(new Set<string>());
  }

  /** Deja marcadas exactamente las columnas que se ven en la tabla. */
  marcarVisibles(): void {
    const enTabla = new Set(this.datos.columnasEnTabla ?? []);
    const claves = COLUMNAS_EXPORTABLES.filter(
      (c) => enTabla.has(c.clave) || (enTabla.size === 0 && c.enTabla),
    ).map((c) => c.clave);
    this.seleccion.set(new Set(claves.length ? claves : CLAVES_EXPORTACION_POR_DEFECTO));
  }

  cambiarFormato(valor: FormatoExportacion): void {
    this.formato.set(valor);
  }

  cambiarAlcance(valor: AlcanceExportacion): void {
    this.alcance.set(valor);
  }

  // ── Exportacion ───────────────────────────────────────────────────────

  exportar(): void {
    if (!this.puedeExportar()) return;
    this.error.set('');

    if (this.alcance() === 'pagina') {
      this.generarArchivo(this.datos.filasPaginaActual);
      this.ref.close({ exportadas: this.datos.filasPaginaActual.length });
      return;
    }

    this.exportarTodo();
  }

  /** Recorre TODAS las paginas del filtro actual, con progreso y cancelacion. */
  private exportarTodo(): void {
    const acumulado: IncapacidadResumenExtendido[] = [];
    const tamano = TAMANO_LOTE_EXPORTACION;

    this.exportando.set(true);
    this.filasDescargadas.set(0);
    this.lotesDescargados.set(0);
    this.lotesTotales.set(Math.max(1, Math.ceil((this.datos.total || 0) / tamano)));

    this.descarga = this.srv
      .listar(this.datos.filtros, 0, tamano, this.datos.orden)
      .pipe(
        expand((pagina: Page<IncapacidadResumen>) => {
          const siguiente = (pagina.number ?? 0) + 1;
          const totalPaginas =
            pagina.totalPages ?? Math.ceil((pagina.totalElements ?? 0) / tamano);

          if (siguiente >= totalPaginas) return EMPTY;
          if (siguiente >= MAXIMO_LOTES_EXPORTACION) return EMPTY;

          return this.srv.listar(this.datos.filtros, siguiente, tamano, this.datos.orden);
        }),
        tap((pagina) => {
          acumulado.push(...((pagina.content ?? []) as IncapacidadResumenExtendido[]));
          this.filasDescargadas.set(acumulado.length);
          this.lotesDescargados.update((n) => n + 1);
          const totalPaginas =
            pagina.totalPages ?? Math.ceil((pagina.totalElements ?? 0) / tamano);
          if (totalPaginas > 0) this.lotesTotales.set(Math.min(totalPaginas, MAXIMO_LOTES_EXPORTACION));
        }),
        last(),
      )
      .subscribe({
        next: () => {
          this.exportando.set(false);
          this.generarArchivo(acumulado);
          this.ref.close({ exportadas: acumulado.length });
        },
        error: () => {
          this.exportando.set(false);
          this.error.set(
            acumulado.length > 0
              ? `Se descargaron ${acumulado.length} registros y la consulta fallo. ` +
                  'No se genera el archivo para no entregar datos incompletos.'
              : 'No se pudieron descargar los registros. Intentalo de nuevo.',
          );
        },
      });
  }

  cancelar(): void {
    this.descarga?.unsubscribe();
    this.descarga = undefined;
    this.exportando.set(false);
    this.error.set('Exportacion cancelada.');
  }

  cerrar(): void {
    this.descarga?.unsubscribe();
    this.ref.close();
  }

  /** Escribe el archivo con EXACTAMENTE las columnas marcadas y en su orden. */
  private generarArchivo(filas: readonly IncapacidadResumenExtendido[]): void {
    const claves = this.clavesSeleccionadas();
    const cabeceras = cabecerasExportacion(claves);
    const datos = construirFilasExportacion(filas, claves, this.etiquetas);

    if (this.formato() === 'csv') {
      const csv = construirCsv(datos, cabeceras);
      // El BOM hace que Excel abra el CSV en UTF-8 y no rompa las tildes.
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, nombreArchivoExportacion('csv'));
      return;
    }

    const hoja = XLSX.utils.json_to_sheet(datos, { header: cabeceras });
    hoja['!cols'] = anchosColumnas(claves);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Incapacidades');
    XLSX.writeFile(libro, nombreArchivoExportacion('xlsx'));
  }

  ngOnDestroy(): void {
    this.descarga?.unsubscribe();
  }

  trackColumna = (_: number, columna: ColumnaExportable) => columna.clave;
}
