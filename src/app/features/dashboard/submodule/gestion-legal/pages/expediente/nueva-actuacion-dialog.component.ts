import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'app-nueva-actuacion-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule
  ],
  template: `
    <h2 mat-dialog-title>Registrar Actuación</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-actuacion">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tipo de actuación</mat-label>
          <mat-select formControlName="tipo">
            <mat-option value="AUDIENCIA">Audiencia</mat-option>
            <mat-option value="NOTIFICACION">Notificación</mat-option>
            <mat-option value="DOCUMENTO">Documento</mat-option>
            <mat-option value="RECURSO">Recurso</mat-option>
            <mat-option value="FALLO">Fallo</mat-option>
            <mat-option value="OTRO">Otro</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Título</mat-label>
          <input matInput formControlName="titulo" placeholder="Ej. Audiencia de conciliación">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Fecha de la actuación</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="fechaActuacion">
          <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Realizado por</mat-label>
          <input matInput formControlName="realizadoPor" placeholder="Nombre del responsable">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="descripcion" rows="4"
            placeholder="Detalle de la actuación..."></textarea>
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
    .form-actuacion { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .full-width { width: 100%; }
  `]
})
export class NuevaActuacionDialogComponent {
  data: { procesoId: number } = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<NuevaActuacionDialogComponent>);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    tipo: ['AUDIENCIA', Validators.required],
    titulo: ['', Validators.required],
    fechaActuacion: [new Date().toISOString().split('T')[0], Validators.required],
    realizadoPor: ['', Validators.required],
    descripcion: ['']
  });

  cancelar(): void { this.ref.close(null); }

  private toDateStr(v: unknown): string {
    if (!v) return '';
    if (typeof v === 'string') return v.split('T')[0];
    const d = v as { toISOString?: () => string };
    return d.toISOString ? d.toISOString().split('T')[0] : String(v);
  }

  confirmar(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    const fecha = this.toDateStr(val.fechaActuacion);
    this.ref.close({
      tipo: val.tipo,
      titulo: val.titulo,
      fechaActuacion: fecha,
      realizadoPor: val.realizadoPor,
      descripcion: val.descripcion || null
    });
  }
}
