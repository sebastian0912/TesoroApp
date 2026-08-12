import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ProcesoLegal, ProcesoEstado } from '../../models/legal.models';

export interface CambiarEstadoDialogData {
  proceso: ProcesoLegal;
  estados: ProcesoEstado[];
}

@Component({
  selector: 'app-cambiar-estado-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Cambiar Estado del Proceso</h2>

    <mat-dialog-content>
      <p class="proceso-info">
        <strong>{{ data.proceso.radicado }}</strong> —
        {{ data.proceso.trabajadorNombre }} ({{ data.proceso.trabajadorCedula }})
      </p>
      <p class="estado-actual">
        Estado actual: <span class="chip" [ngClass]="'semaforo-' + data.proceso.colorSemaforo">
          {{ data.proceso.estadoNombre }}
        </span>
      </p>

      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nuevo estado</mat-label>
          <mat-select formControlName="estadoId">
            <mat-option *ngFor="let e of data.estados" [value]="e.id">
              {{ e.nombre }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Motivo del cambio</mat-label>
          <textarea matInput formControlName="motivo" rows="3"
            placeholder="Describe el motivo del cambio de estado..."></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancelar()">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="confirmar()">
        <mat-icon>save</mat-icon> Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .proceso-info { margin: 0 0 8px; font-size: 14px; }
    .estado-actual { margin: 0 0 16px; font-size: 13px; color: #666; }
    .full-width { width: 100%; margin-bottom: 8px; }
    .chip { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .semaforo-verde { background: #e8f5e9; color: #2e7d32; }
    .semaforo-amarillo { background: #fff8e1; color: #f57f17; }
    .semaforo-rojo { background: #ffebee; color: #c62828; }
  `]
})
export class CambiarEstadoDialogComponent {
  data: CambiarEstadoDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<CambiarEstadoDialogComponent>);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    estadoId: [null as number | null, Validators.required],
    motivo: ['', Validators.required]
  });

  cancelar(): void { this.ref.close(null); }

  confirmar(): void {
    if (this.form.invalid) return;
    this.ref.close({ estadoId: this.form.value.estadoId, motivo: this.form.value.motivo });
  }
}
