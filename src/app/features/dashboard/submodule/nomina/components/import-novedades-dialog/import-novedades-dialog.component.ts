import {
  Component, ChangeDetectionStrategy, signal, computed, inject, ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
  NominaService, NovedadRegistro, NovedadesPreviewResponse, ColumnaMapeada,
} from '../../service/nomina/nomina.service';

type Step = 'select' | 'preview' | 'importing' | 'done' | 'error';
type DialogData = {
  periodo_id: number;
  periodo_descripcion?: string;
  cliente_id: number;
  cliente_nombre?: string;
};

@Component({
  selector: 'app-import-novedades-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule,
    MatTableModule, MatCheckboxModule, MatTooltipModule, MatChipsModule,
    MatDividerModule, MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  templateUrl: './import-novedades-dialog.component.html',
  styleUrl: './import-novedades-dialog.component.css',
})
export class ImportNovedadesDialogComponent {
  private svc = inject(NominaService);
  private ref = inject(MatDialogRef<ImportNovedadesDialogComponent>);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  step = signal<Step>('select');
  errorMsg = signal('');
  errorDiag = signal<any>(null);
  fileName = signal('');
  loading = signal(false);

  // Archivo actual (para permitir re-preview con otra hoja sin re-subir)
  private currentFile: File | null = null;

  preview = signal<NovedadesPreviewResponse | null>(null);
  registros = signal<NovedadRegistro[]>([]);
  excluidas = signal<Set<number>>(new Set());
  reemplazar = signal(true);

  // Permitir cambiar hoja desde el UI cuando lo detectado no sirve
  hojasDisponibles = signal<string[]>([]);
  hojaSeleccionada = signal<string>('');

  importResult = signal<{
    contratos_afectados: number;
    total_insertadas: number;
    total_borradas: number;
    mensaje: string;
    no_resueltos: any[];
  } | null>(null);

  displayedColumns = ['incluir', 'fila', 'documento', 'nombre', 'codigo', 'estado', 'conteo'];

  readonly tablasLabel: Record<string, string> = {
    nomina_novedades_variables:        'Novedades',
    nomina_ausentismos_horas:          'Aus. Horas',
    nomina_ausentismos_dias:           'Aus. Días',
    nomina_incapacidades_detalle:      'Incapac.',
    nomina_bonificaciones_auxilios:    'Bonif.',
    nomina_descuentos_factura_detalle: 'Desc. Fac.',
    nomina_ajustes_nomina_detalle:     'Ajustes',
  };

  totalIncluidas = computed(() => {
    const ex = this.excluidas();
    return this.registros().filter(r => !ex.has(r.fila_excel) && r._resuelto?.id_contrato).length;
  });

  noResueltos = computed(() =>
    this.registros().filter(r => !r._resuelto?.id_contrato).length
  );

  // Agrupa columnas mapeadas por tabla destino (info útil en el preview)
  columnasMapeadasPorTabla = computed<Array<{ tabla: string; label: string; cols: ColumnaMapeada[] }>>(() => {
    const pv = this.preview();
    if (!pv?.columnas_mapeadas?.length) return [];
    const byTable: Record<string, ColumnaMapeada[]> = {};
    for (const c of pv.columnas_mapeadas) {
      (byTable[c.tabla] ??= []).push(c);
    }
    return Object.keys(byTable).map(t => ({
      tabla: t,
      label: this.tablasLabel[t] || t,
      cols: byTable[t],
    }));
  });

  openPicker(): void { this.fileInput.nativeElement.click(); }

  onFile(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    this.procesarArchivo(f);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.procesarArchivo(f);
  }
  onDragOver(ev: DragEvent): void { ev.preventDefault(); }

  private procesarArchivo(f: File, opts?: { sheetName?: string }): void {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      this.errorMsg.set('Solo se permiten archivos Excel (.xlsx / .xls).');
      this.step.set('error');
      return;
    }
    this.currentFile = f;
    this.fileName.set(f.name);
    this.errorMsg.set('');
    this.loading.set(true);

    this.svc.previewNovedadesExcel(
      f, this.data.periodo_id, this.data.cliente_id,
      opts?.sheetName ? { sheetName: opts.sheetName } : undefined,
    ).subscribe({
      next: (resp) => {
        this.preview.set(resp);
        this.hojasDisponibles.set(resp.hojas_disponibles || []);
        this.hojaSeleccionada.set(resp.hoja_usada || '');
        this.registros.set(resp.registros || []);

        const set = new Set<number>();
        for (const r of resp.registros || []) {
          if (!r._resuelto?.id_contrato) set.add(r.fila_excel);
        }
        this.excluidas.set(set);
        this.loading.set(false);
        this.step.set('preview');
      },
      error: (err: HttpErrorResponse) => {
        // Si el backend devolvió hojas disponibles a pesar del error,
        // mostrarlas para que el user elija manualmente.
        const body = err.error || {};
        this.hojasDisponibles.set(body.hojas_disponibles || []);
        this.errorDiag.set(body.diagnostico || null);
        this.errorMsg.set(body.error || err.message || 'Error procesando el Excel.');
        this.loading.set(false);
        this.step.set('error');
      },
    });
  }

  cambiarHoja(nueva: string): void {
    if (!nueva || !this.currentFile) return;
    this.hojaSeleccionada.set(nueva);
    this.procesarArchivo(this.currentFile, { sheetName: nueva });
  }

  toggleIncluir(r: NovedadRegistro): void {
    const set = new Set(this.excluidas());
    if (set.has(r.fila_excel)) set.delete(r.fila_excel);
    else set.add(r.fila_excel);
    this.excluidas.set(set);
  }

  isIncluida(r: NovedadRegistro): boolean {
    return !this.excluidas().has(r.fila_excel) && !!r._resuelto?.id_contrato;
  }

  cantidadNovedades(r: NovedadRegistro): number {
    let n = 0;
    for (const tabla in (r.novedades || {})) {
      n += Object.keys(r.novedades[tabla] || {}).length;
    }
    return n;
  }

  tablasConDatos(r: NovedadRegistro): string[] {
    return Object.keys(r.novedades || {})
      .filter(t => Object.keys(r.novedades[t] || {}).length > 0)
      .map(t => this.tablasLabel[t] || t);
  }

  importar(): void {
    const pv = this.preview();
    if (!pv) return;

    const ex = this.excluidas();
    const payloadRegistros = this.registros().filter(r => !ex.has(r.fila_excel));

    if (!payloadRegistros.length) {
      this.errorMsg.set('No hay filas seleccionadas para importar.');
      return;
    }

    this.step.set('importing');
    this.svc.importarNovedades({
      import_token: pv.import_token,
      registros: payloadRegistros,
      periodo_id: this.data.periodo_id,
      reemplazar: this.reemplazar(),
    }).subscribe({
      next: (res) => {
        this.importResult.set(res);
        this.step.set('done');
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error || {};
        let msg = body.error || err.message || 'Error importando novedades.';
        // Enriquecer con detalles granulares si el backend los devolvió
        if (body.errores_bulk?.length) {
          const b0 = body.errores_bulk[0];
          msg += `\n[${b0.tabla}] ${b0.error_inicial}`;
          if (b0.culpable_ejemplo) {
            msg += `\nFila culpable (contrato_id=${b0.culpable_ejemplo.contrato_id}): ${b0.culpable_ejemplo.error}`;
          }
        } else if (body.errores_construccion?.length) {
          const e0 = body.errores_construccion[0];
          msg += `\n[Fila ${e0.fila_excel} → ${e0.tabla}] ${e0.error}`;
        } else if (body.traceback?.length) {
          msg += '\n' + body.traceback.slice(-3).join('\n');
        }
        this.errorMsg.set(msg);
        this.errorDiag.set(body.diagnostico || null);
        this.step.set('error');
      },
    });
  }

  cerrar(result?: { recalcular?: boolean }): void {
    this.ref.close(result ?? { recalcular: this.step() === 'done' });
  }

  volverASelect(): void {
    this.step.set('select');
    this.preview.set(null);
    this.registros.set([]);
    this.excluidas.set(new Set());
    this.errorMsg.set('');
    this.errorDiag.set(null);
    this.fileName.set('');
    this.currentFile = null;
    this.hojasDisponibles.set([]);
    this.hojaSeleccionada.set('');
  }
}
