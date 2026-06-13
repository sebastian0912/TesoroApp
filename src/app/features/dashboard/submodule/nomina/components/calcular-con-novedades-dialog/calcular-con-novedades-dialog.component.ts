import {
  Component, ChangeDetectionStrategy, signal, inject, ViewChild, ElementRef, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  NominaService, CalculoConNovedadesResponse, ConceptoSinHomologar,
} from '../../service/nomina/nomina.service';

type Step = 'select' | 'calculando' | 'done' | 'error';

type DialogData = {
  periodo_id: number;
  periodo_descripcion?: string;
  cliente_id: number;
  cliente_nombre?: string;
  contrato_ids?: number[];
  cecos?: number[];
  forzar_dias_completos?: boolean;
};

@Component({
  selector: 'app-calcular-con-novedades-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule,
    MatChipsModule, MatDividerModule, MatTableModule, MatTooltipModule,
  ],
  template: `
    <div class="cn-dialog">
      <div class="cn-header">
        <mat-icon>receipt_long</mat-icon>
        <div>
          <h2>Calcular con plantilla de novedades</h2>
          <p class="cn-sub" *ngIf="data.periodo_descripcion || data.cliente_nombre">
            {{ data.periodo_descripcion }} · {{ data.cliente_nombre }}
          </p>
        </div>
      </div>

      <mat-divider></mat-divider>

      <ng-container [ngSwitch]="step()">
        <!-- SELECT -->
        <div *ngSwitchCase="'select'" class="cn-body">
          <p class="cn-desc">
            Sube la plantilla en formato LONG (una fila por movimiento, con
            <code>Cedula</code>, <code>Codigo Novedad</code>, <code>Total Novedad</code>,
            <code>Nombre de Concepto</code>). El cálculo se hace en memoria — no se
            persisten novedades en la base de datos.
          </p>

          <div class="cn-drop"
               (click)="openPicker()"
               (drop)="onDrop($event)"
               (dragover)="onDragOver($event)">
            <mat-icon>cloud_upload</mat-icon>
            <p class="cn-drop__title">Arrastra el archivo o haz clic para seleccionar</p>
            <p class="cn-drop__hint">.xlsx / .xls</p>
            <input #fileInput type="file" accept=".xlsx,.xls" hidden (change)="onFile($event)" />
          </div>

          <div *ngIf="!data.contrato_ids?.length" class="cn-info">
            <mat-icon>info</mat-icon>
            Solo se liquidarán los empleados con novedades en el Excel cuyo
            contrato esté vigente con este cliente en el periodo.
          </div>
          <div *ngIf="(data.contrato_ids?.length || 0) > 0" class="cn-info">
            <mat-icon>check_circle</mat-icon>
            Solo se liquidarán los empleados que aparezcan tanto en el Excel
            como entre los {{ data.contrato_ids!.length }} ya cargados.
          </div>
        </div>

        <!-- CALCULANDO -->
        <div *ngSwitchCase="'calculando'" class="cn-body cn-center">
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          <p>Procesando plantilla y calculando nómina...</p>
          <small>{{ fileName() }}</small>
        </div>

        <!-- DONE -->
        <div *ngSwitchCase="'done'" class="cn-body">
          <div *ngIf="warnings().length" class="cn-warnings">
            <div *ngFor="let w of warnings()" class="cn-warn">
              <mat-icon>warning</mat-icon><span>{{ w }}</span>
            </div>
          </div>

          <div class="cn-summary">
            <div class="cn-stat">
              <strong>{{ result()?.contratos_calculados || 0 }}</strong>
              <span>empleados liquidados</span>
            </div>
            <div class="cn-stat cn-stat-accent">
              <strong>{{ result()?.contratos_con_novedad || 0 }}</strong>
              <span>con novedades del Excel</span>
            </div>
            <div class="cn-stat">
              <strong>{{ result()?.totales?.neto | number:'1.0-0' }}</strong>
              <span>neto total</span>
            </div>
          </div>
          <p class="cn-hint cn-explainer">
            Se liquidaron <strong>{{ result()?.contratos_calculados || 0 }}</strong>
            empleados del cliente con contrato vigente en este periodo.
            Las novedades del Excel se aplicaron únicamente a los
            <strong>{{ result()?.contratos_con_novedad || 0 }}</strong>
            empleados que aparecen en él; el resto recibió nómina base
            (sueldo + auxilio + aportes).
          </p>

          <!-- Embudo de cédulas: Excel → en sistema → con contrato del cliente → resueltas -->
          <div class="cn-funnel">
            <div class="cn-funnel-step">
              <span class="cn-funnel-num">{{ result()?.cedulas_excel || 0 }}</span>
              <span class="cn-funnel-lbl">en Excel</span>
            </div>
            <mat-icon>arrow_forward</mat-icon>
            <div class="cn-funnel-step">
              <span class="cn-funnel-num">{{ result()?.cedulas_en_sistema || 0 }}</span>
              <span class="cn-funnel-lbl">en sistema</span>
            </div>
            <mat-icon>arrow_forward</mat-icon>
            <div class="cn-funnel-step">
              <span class="cn-funnel-num">{{ result()?.cedulas_resueltas || 0 }}</span>
              <span class="cn-funnel-lbl">con contrato del cliente</span>
            </div>
          </div>

          <ng-container *ngIf="conceptosSinHomologar().length">
            <h4>Conceptos sin homologar ({{ conceptosSinHomologar().length }})</h4>
            <p class="cn-hint">Estos códigos no tienen destino en el modelo (HE,
              dominicales, recargos…) y no entran al cálculo. Homológalos en el
              Homologador para incluirlos.</p>
            <table mat-table [dataSource]="conceptosSinHomologar()" class="cn-table">
              <ng-container matColumnDef="codigo">
                <th mat-header-cell *matHeaderCellDef>Código</th>
                <td mat-cell *matCellDef="let c">{{ c.codigo }}</td>
              </ng-container>
              <ng-container matColumnDef="concepto">
                <th mat-header-cell *matHeaderCellDef>Concepto</th>
                <td mat-cell *matCellDef="let c">{{ c.concepto }}</td>
              </ng-container>
              <ng-container matColumnDef="filas">
                <th mat-header-cell *matHeaderCellDef>Filas</th>
                <td mat-cell *matCellDef="let c">{{ c.filas }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['codigo','concepto','filas']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['codigo','concepto','filas']"></tr>
            </table>
          </ng-container>

          <ng-container *ngIf="cedulasNoEncontradas().length">
            <h4>Cédulas no encontradas ({{ cedulasNoEncontradas().length }})</h4>
            <mat-chip-set>
              <mat-chip *ngFor="let c of cedulasNoEncontradas().slice(0, 30)">{{ c }}</mat-chip>
              <mat-chip *ngIf="cedulasNoEncontradas().length > 30" disabled>
                +{{ cedulasNoEncontradas().length - 30 }} más
              </mat-chip>
            </mat-chip-set>
          </ng-container>

          <ng-container *ngIf="cedulasFuera().length">
            <h4>Cédulas fuera del alcance cargado ({{ cedulasFuera().length }})</h4>
            <p class="cn-hint">Tienen contrato pero no estaban entre los empleados
              que cargaste en pantalla, así que no se incluyeron.</p>
          </ng-container>
        </div>

        <!-- ERROR -->
        <div *ngSwitchCase="'error'" class="cn-body cn-error">
          <mat-icon>error_outline</mat-icon>
          <p>{{ errorMsg() }}</p>
          <ul *ngIf="hojasDisponibles().length">
            <li *ngFor="let h of hojasDisponibles()">{{ h }}</li>
          </ul>
        </div>
      </ng-container>

      <div class="cn-actions">
        <button mat-button (click)="cerrar()">
          {{ step() === 'done' ? 'Cerrar' : 'Cancelar' }}
        </button>
        <button mat-raised-button color="primary"
                *ngIf="step() === 'done'"
                (click)="aplicar()">
          Aplicar resultado al cálculo
        </button>
        <button mat-stroked-button
                *ngIf="step() === 'error'"
                (click)="reintentar()">
          Volver
        </button>
      </div>
    </div>
  `,
  styles: [`
    .cn-dialog { display: flex; flex-direction: column; min-width: 720px; max-width: 1100px; }
    .cn-header { display: flex; gap: 12px; padding: 16px 20px; align-items: center; }
    .cn-header mat-icon { font-size: 32px; width: 32px; height: 32px; color: #1976d2; }
    .cn-header h2 { margin: 0; font-size: 18px; }
    .cn-sub { margin: 0; color: #666; font-size: 12px; }
    .cn-body { padding: 20px; max-height: 60vh; overflow: auto; }
    .cn-center { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 60px 20px; }
    .cn-desc { color: #555; font-size: 13px; }
    .cn-desc code { background: #f5f5f5; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
    .cn-drop { border: 2px dashed #c0c4cc; border-radius: 8px; padding: 40px; text-align: center;
               cursor: pointer; transition: all .15s; }
    .cn-drop:hover { border-color: #1976d2; background: #f5faff; }
    .cn-drop mat-icon { font-size: 48px; width: 48px; height: 48px; color: #999; }
    .cn-drop__title { margin: 8px 0 4px; font-weight: 500; }
    .cn-drop__hint { margin: 0; color: #888; font-size: 12px; }
    .cn-warn, .cn-info { display: flex; gap: 8px; align-items: center;
                          padding: 10px 12px; border-radius: 6px; margin-top: 16px; font-size: 13px; }
    .cn-warn { background: #fff8e1; color: #6d4c00; }
    .cn-info { background: #e8f5e9; color: #1b5e20; }
    .cn-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .cn-stat { background: #f5f7fa; padding: 14px; border-radius: 8px; text-align: center; }
    .cn-stat strong { display: block; font-size: 22px; color: #1976d2; }
    .cn-stat span { font-size: 11px; color: #666; text-transform: uppercase; }
    .cn-stat-accent { background: #e8f5e9; }
    .cn-stat-accent strong { color: #2e7d32; }
    .cn-explainer { background: #f5f9ff; padding: 10px 14px; border-radius: 6px;
                     border-left: 4px solid #1976d2; margin-bottom: 16px; font-size: 13px; line-height: 1.5; }
    .cn-warnings { margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
    .cn-warn { background: #fff8e1; color: #6d4c00; padding: 10px 12px;
                border-radius: 6px; display: flex; gap: 8px; align-items: flex-start;
                font-size: 13px; border-left: 4px solid #f9a825; }
    .cn-warn mat-icon { color: #f9a825; flex-shrink: 0; }
    .cn-funnel { display: flex; align-items: center; justify-content: center;
                  gap: 8px; padding: 14px; background: #f5f9ff;
                  border-radius: 8px; margin-bottom: 18px; flex-wrap: wrap; }
    .cn-funnel-step { display: flex; flex-direction: column; align-items: center;
                       padding: 6px 14px; background: #fff; border-radius: 6px;
                       min-width: 100px; }
    .cn-funnel-num { font-size: 20px; font-weight: 700; color: #1976d2; }
    .cn-funnel-lbl { font-size: 11px; color: #666; text-align: center; }
    .cn-funnel mat-icon { color: #999; }
    .cn-table { width: 100%; margin-bottom: 16px; }
    .cn-hint { font-size: 12px; color: #777; margin: 4px 0 12px; }
    .cn-error { display: flex; flex-direction: column; gap: 10px; align-items: center; }
    .cn-error mat-icon { font-size: 40px; width: 40px; height: 40px; color: #c62828; }
    .cn-actions { padding: 12px 20px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #eee; }
    h4 { margin: 16px 0 6px; font-size: 14px; }
  `],
})
export class CalcularConNovedadesDialogComponent {
  private svc = inject(NominaService);
  private ref = inject(MatDialogRef<CalcularConNovedadesDialogComponent>);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  step = signal<Step>('select');
  fileName = signal('');
  errorMsg = signal('');
  hojasDisponibles = signal<string[]>([]);
  result = signal<CalculoConNovedadesResponse | null>(null);

  conceptosSinHomologar = computed<ConceptoSinHomologar[]>(
    () => this.result()?.conceptos_sin_homologar || [],
  );
  cedulasNoEncontradas = computed<string[]>(
    () => this.result()?.cedulas_no_encontradas || [],
  );
  cedulasFuera = computed<string[]>(
    () => this.result()?.cedulas_fuera_de_alcance || [],
  );
  warnings = computed<string[]>(
    () => this.result()?.warnings || [],
  );

  openPicker(): void { this.fileInput.nativeElement.click(); }

  onFile(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) this.calcular(f);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.calcular(f);
  }
  onDragOver(ev: DragEvent): void { ev.preventDefault(); }

  private calcular(f: File): void {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      this.errorMsg.set('Solo se permiten archivos Excel (.xlsx / .xls).');
      this.step.set('error');
      return;
    }
    this.fileName.set(f.name);
    this.step.set('calculando');

    this.svc.calcularConNovedadesExcel(f, this.data.periodo_id, this.data.cliente_id, {
      contratoIds: this.data.contrato_ids,
      cecos: this.data.cecos,
      forzarDiasCompletos: this.data.forzar_dias_completos,
    }).subscribe({
      next: (resp) => {
        this.result.set(resp);
        this.step.set('done');
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error || {};
        this.hojasDisponibles.set(body.hojas_disponibles || []);
        this.errorMsg.set(body.error || err.message || 'Error en el cálculo.');
        this.step.set('error');
      },
    });
  }

  aplicar(): void {
    const r = this.result();
    this.ref.close({
      empleados: r?.empleados || [],
      contratos_data: r?.contratos_data || [],
      // Incremento 2.6: se propaga el snapshot server-side. El cierre usará SOLO
      // el calculationId; los detalles económicos no son fuente de verdad.
      calculation_id: r?.calculation_id ?? null,
      puede_cerrar: r?.puede_cerrar ?? false,
      conciliacion: r?.conciliacion ?? null,
      diagnostico_novedades: r?.diagnostico_novedades ?? [],
      bloqueantes: r?.bloqueantes ?? [],
      fecha_expiracion: r?.fecha_expiracion ?? null,
    });
  }

  reintentar(): void {
    this.step.set('select');
    this.errorMsg.set('');
    this.hojasDisponibles.set([]);
  }

  cerrar(): void { this.ref.close(); }
}
