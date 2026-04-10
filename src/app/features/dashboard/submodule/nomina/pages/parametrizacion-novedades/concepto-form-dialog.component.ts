import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { NominaService, ConceptoNomina } from '../../service/nomina/nomina.service';

@Component({
  selector: 'app-concepto-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <mat-icon class="dialog-icon">{{ isEditing ? 'edit_note' : 'add_circle' }}</mat-icon>
      <div>
        <h2 mat-dialog-title>{{ isEditing ? 'Editar Novedad' : 'Nueva Novedad' }}</h2>
        <p class="dialog-subtitle">Parametrización de concepto de nómina (días / horas)</p>
      </div>
    </div>

    <mat-divider></mat-divider>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">

        <mat-form-field appearance="outline" class="field-codigo">
          <mat-label>Código</mat-label>
          <input matInput formControlName="codigo" placeholder="Ej: AUS_INJ_H" maxlength="20">
          <mat-hint>Máx. 20 caracteres, sin espacios</mat-hint>
          <mat-error *ngIf="form.get('codigo')?.hasError('required')">El código es obligatorio</mat-error>
          <mat-error *ngIf="form.get('codigo')?.hasError('pattern')">Solo letras, números y guiones bajos</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="field-abrev">
          <mat-label>Abreviatura</mat-label>
          <input matInput formControlName="abreviatura" placeholder="Ej: AUS.INJ" maxlength="30">
          <mat-hint>Etiqueta corta para reportes</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="field-descripcion">
          <mat-label>Descripción</mat-label>
          <input matInput formControlName="descripcion" placeholder="Ej: Ausencia Injustificada en Horas" maxlength="200">
          <mat-error *ngIf="form.get('descripcion')?.hasError('required')">La descripción es obligatoria</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="field-naturaleza">
          <mat-label>Naturaleza</mat-label>
          <mat-select formControlName="naturaleza">
            <mat-option value="DEVENGO">Devengo</mat-option>
            <mat-option value="DEDUCCION">Deducción</mat-option>
            <mat-option value="APORTE_EMPLEADO">Aporte Empleado</mat-option>
            <mat-option value="APORTE_EMPLEADOR">Aporte Empleador</mat-option>
            <mat-option value="PROVISION">Provisión</mat-option>
            <mat-option value="OTRO">Otro</mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('naturaleza')?.hasError('required')">Seleccione la naturaleza</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="field-unidad">
          <mat-label>Unidad de medida</mat-label>
          <mat-select formControlName="unidad">
            <mat-option value="DIA">
              <mat-icon>today</mat-icon> Día
            </mat-option>
            <mat-option value="HORA">
              <mat-icon>schedule</mat-icon> Hora
            </mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('unidad')?.hasError('required')">Seleccione la unidad</mat-error>
        </mat-form-field>

        <div class="toggle-row">
          <mat-slide-toggle formControlName="afecta_ibc" color="primary">
            Afecta IBC (Base de Seguridad Social)
          </mat-slide-toggle>
          <mat-slide-toggle formControlName="activo" color="accent">
            Activo
          </mat-slide-toggle>
        </div>

      </form>
    </mat-dialog-content>

    <mat-divider></mat-divider>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="cancelar()" [disabled]="saving">Cancelar</button>
      <button mat-flat-button color="primary" (click)="guardar()" [disabled]="form.invalid || saving">
        <mat-spinner *ngIf="saving" diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner>
        {{ isEditing ? 'Guardar cambios' : 'Crear Novedad' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px 12px;
    }
    .dialog-icon { font-size: 36px; width: 36px; height: 36px; color: #3f51b5; }
    h2[mat-dialog-title] { margin: 0; font-size: 18px; }
    .dialog-subtitle { margin: 2px 0 0; font-size: 13px; color: #666; }
    mat-dialog-content { padding: 16px 24px !important; }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
    }
    .field-descripcion, .toggle-row { grid-column: 1 / -1; }
    .toggle-row {
      display: flex;
      gap: 32px;
      align-items: center;
      padding: 8px 0;
    }
    mat-dialog-actions { padding: 12px 24px 16px !important; }
  `],
})
export class ConceptoFormDialogComponent implements OnInit {
  form!: FormGroup;
  isEditing = false;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ConceptoFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { concepto: ConceptoNomina | null },
    private nominaService: NominaService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.isEditing = !!this.data.concepto;
    const c = this.data.concepto;
    this.form = this.fb.group({
      codigo:      [c?.codigo ?? '', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/i)]],
      descripcion: [c?.descripcion ?? '', Validators.required],
      abreviatura: [c?.abreviatura ?? ''],
      naturaleza:  [c?.naturaleza ?? '', Validators.required],
      unidad:      [c?.unidad ?? 'DIA', Validators.required],
      afecta_ibc:  [c?.afecta_ibc ?? false],
      activo:      [c?.activo ?? true],
    });
  }

  guardar(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const payload: ConceptoNomina = this.form.value;

    const op$ = this.isEditing
      ? this.nominaService.actualizarConcepto(this.data.concepto!.id_concepto!, payload)
      : this.nominaService.crearConcepto(payload);

    op$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditing ? 'Novedad actualizada' : 'Novedad creada',
          'Cerrar',
          { duration: 2500 }
        );
        this.dialogRef.close(true);
      },
      error: (err) => {
        const msg = err?.error?.codigo?.[0] ?? err?.error?.detail ?? 'Error al guardar';
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
        this.saving = false;
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
