import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '@/app/shared/shared.module';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ModuloDialogData {
    title: string;
    nombre?: string;
    descripcion?: string;
    ruta?: string;
    icono?: string;
    orden?: number;
}

@Component({
    selector: 'app-modulo-dialog',
    imports: [SharedModule, MatDialogModule, ReactiveFormsModule, MatButtonModule, MatIconModule],
    templateUrl: './modulo-dialog.component.html',
    styleUrl: './modulo-dialog.component.css'
})
export class ModuloDialogComponent {
    form: FormGroup;

    constructor(
        public dialogRef: MatDialogRef<ModuloDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ModuloDialogData,
        private fb: FormBuilder
    ) {
        this.form = this.fb.group({
            nombre: [data.nombre || '', [Validators.required, Validators.maxLength(50)]],
            descripcion: [data.descripcion || '', [Validators.maxLength(150)]],
            ruta: [data.ruta || '', [Validators.maxLength(255)]],
            icono: [data.icono || 'widgets', [Validators.maxLength(50)]],
            orden: [data.orden || 0]
        });
    }

    save(): void {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        } else {
            this.form.markAllAsTouched();
        }
    }

    close(): void {
        this.dialogRef.close();
    }
}
