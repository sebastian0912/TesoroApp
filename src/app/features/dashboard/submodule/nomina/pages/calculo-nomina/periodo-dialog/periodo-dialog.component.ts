import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { NominaService } from '../../../service/nomina/nomina.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-periodo-dialog',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Editar' : 'Crear Nuevo' }} Periodo de Nómina</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="periodo-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descripción / Nombre</mat-label>
          <input matInput formControlName="descripcion" placeholder="Ej: Marzo 2026 - 1ra Quincena">
          <mat-error *ngIf="form.get('descripcion')?.hasError('required')">Requerido</mat-error>
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Tipo de Periodo</mat-label>
            <mat-select formControlName="tipo_periodo">
              <mat-option value="QUINCENAL">QUINCENAL</mat-option>
              <mat-option value="MENSUAL">MENSUAL</mat-option>
              <mat-option value="EXTRAORDINARIO">EXTRAORDINARIO</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Días Teóricos</mat-label>
            <input matInput type="number" formControlName="dias_teoricos">
          </mat-form-field>
        </div>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Fecha Inicio</mat-label>
            <input matInput [matDatepicker]="startPicker" formControlName="fecha_inicio">
            <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
            <mat-datepicker #startPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha Fin</mat-label>
            <input matInput [matDatepicker]="endPicker" formControlName="fecha_fin">
            <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
            <mat-datepicker #endPicker></mat-datepicker>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" *ngIf="isEdit">
          <mat-label>Estado</mat-label>
          <mat-select formControlName="estado">
            <mat-option value="ABIERTO">ABIERTO</mat-option>
            <mat-option value="CALCULADO">CALCULADO</mat-option>
            <mat-option value="CERRADO">CERRADO</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancelar</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || loading" (click)="onSubmit()">
        {{ loading ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Periodo') }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .periodo-form { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; }
    .full-width { width: 100%; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  `]
})
export class PeriodoDialogComponent implements OnInit {
  form: FormGroup;
  loading = false;
  isEdit = false;

  constructor(
    private fb: FormBuilder,
    private nominaService: NominaService,
    private dialogRef: MatDialogRef<PeriodoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.form = this.fb.group({
      descripcion: ['', Validators.required],
      tipo_periodo: ['QUINCENAL', Validators.required],
      fecha_inicio: [null, Validators.required],
      fecha_fin: [null, Validators.required],
      dias_teoricos: [15, [Validators.required, Validators.min(1)]],
      estado: ['ABIERTO']
    });

    if (data && data.periodo) {
      this.isEdit = true;
      const p = data.periodo;
      this.form.patchValue({
        ...p,
        fecha_inicio: p.fecha_inicio ? new Date(p.fecha_inicio + 'T00:00:00') : null,
        fecha_fin: p.fecha_fin ? new Date(p.fecha_fin + 'T00:00:00') : null
      });
    }
  }

  ngOnInit(): void {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;

    const raw = this.form.value;
    const body = {
      ...raw,
      fecha_inicio: this.formatDate(raw.fecha_inicio),
      fecha_fin: this.formatDate(raw.fecha_fin)
    };

    const action = this.isEdit 
      ? this.nominaService.actualizarPeriodo(this.data.periodo.id_periodo, body) 
      : this.nominaService.crearPeriodo(body);

    action.subscribe({
      next: (res) => {
        this.loading = false;
        Swal.fire('Éxito', this.isEdit ? 'Periodo actualizado' : 'Periodo creado correctamente', 'success');
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        Swal.fire('Error', 'No se pudo procesar la solicitud', 'error');
      }
    });
  }

  private formatDate(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
  }
}
