import { Component, Inject, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GestionRolesSService, Rol, UpsertRolPayload } from '../../services/gestion-roles/gestion-roles-s.service';
import { SharedModule } from '../../../../../../shared/shared.module';



export interface RolUpsertData {
  mode: 'create' | 'edit';
  rol: Rol | null;
}


@Component({
  selector: 'app-rol-upsert-dialog',
  imports: [
    SharedModule
  ],
  templateUrl: './rol-upsert-dialog.component.html',
  styleUrl: './rol-upsert-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class RolUpsertDialogComponent {
  // Inyecciones con API `inject()` (evita el "used before initialization")
  private fb = inject(FormBuilder);
  private svc = inject(GestionRolesSService);
  private dialogRef = inject<MatDialogRef<RolUpsertDialogComponent, { ok: boolean } | null>>(MatDialogRef);
  data = inject<RolUpsertData>(MAT_DIALOG_DATA);

  saving = signal(false);
  title = computed(() => (this.data.mode === 'create' ? 'Crear rol' : 'Editar rol'));

  // Inicializa el form usando los datos (si es edición)
  form = this.fb.group({
    nombre: [this.data.rol?.nombre ?? '', [Validators.required, Validators.minLength(2)]],
  });

  cancelar(): void {
    this.dialogRef.close(null);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const payload: UpsertRolPayload = { nombre: (this.form.value.nombre ?? '').trim() };

    const req$ =
      this.data.mode === 'create'
        ? this.svc.create(payload)
        : this.svc.update(this.data.rol!.id, payload);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close({ ok: true });
      },
      error: (err) => {
        // Por ejemplo: nombre duplicado => 400
        if (err?.status === 400) {
          this.form.get('nombre')?.setErrors({ server: true });
        }
        this.saving.set(false);
      },
    });
  }
}
