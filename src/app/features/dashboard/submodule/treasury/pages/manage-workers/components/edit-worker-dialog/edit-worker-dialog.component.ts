import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { DatosbaseItem } from '../../../../service/teroreria/tesoreria.service';

@Component({
    selector: 'app-edit-worker-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSlideToggleModule,
        MatIconModule,
        MatDividerModule,
        MatDatepickerModule,
        MatNativeDateModule
    ],
    templateUrl: './edit-worker-dialog.component.html',
    styleUrls: ['./edit-worker-dialog.component.css']
})
export class EditWorkerDialogComponent implements OnInit {
    form: FormGroup;

    // List of all keys that are strictly "money/numbers" in text format
    // to ensure we initialize them nicely
    private numberFields = [
        'salario', 'saldoPendiente', 'saldos', 'fondos',
        'mercados', 'cuotasMercados', 'prestamoParaDescontar',
        'cuotasPrestamosParaDescontar', 'casino', 'valoranchetas',
        'cuotasAnchetas', 'fondo', 'carnet', 'seguroFunerario',
        'prestamoParaHacer', 'cuotasPrestamoParahacer',
        'anticipoLiquidacion', 'cuentas'
    ];

    constructor(
        private fb: FormBuilder,
        private dialogRef: MatDialogRef<EditWorkerDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { worker: DatosbaseItem }
    ) {
        this.form = this.buildForm();
    }

    ngOnInit(): void {
        if (this.data && this.data.worker) {
            this.patchForm(this.data.worker);
        }

        // Dynamic validation: 'observacion_bloqueo' is required if 'bloqueado' is true
        const bloqueadoCtrl = this.form.get('bloqueado');
        const obsCtrl = this.form.get('observacion_bloqueo');

        if (bloqueadoCtrl && obsCtrl) {
            // Initial check
            this.toggleObservacionValidator(bloqueadoCtrl.value);

            // Listen for changes
            bloqueadoCtrl.valueChanges.subscribe((checked: boolean) => {
                this.toggleObservacionValidator(checked);
            });
        }
    }

    private toggleObservacionValidator(isBlocked: boolean) {
        const obsCtrl = this.form.get('observacion_bloqueo');
        if (!obsCtrl) return;

        if (isBlocked) {
            obsCtrl.setValidators([Validators.required]);
        } else {
            obsCtrl.clearValidators();
        }
        obsCtrl.updateValueAndValidity();
    }

    private buildForm(): FormGroup {
        return this.fb.group({
            // -- Identificación --
            numero_de_documento: [{ value: '', disabled: true }, Validators.required], // PK uneditable via PUT usually
            codigo: [''],
            nombre: ['', Validators.required],
            ingreso: [''],
            temporal: [''],
            finca: [''],

            // -- Valores Financieros (Strings) --
            salario: ['0'],
            saldoPendiente: ['0'],
            saldos: ['0'],
            fondos: ['0'],
            mercados: ['0'],
            cuotasMercados: ['0'],
            prestamoParaDescontar: ['0'],
            cuotasPrestamosParaDescontar: ['0'],
            casino: ['0'],
            valoranchetas: ['0'],
            cuotasAnchetas: ['0'],
            fondo: ['0'],
            carnet: ['0'],
            seguroFunerario: ['0'],
            prestamoParaHacer: ['0'],
            cuotasPrestamoParahacer: ['0'],
            anticipoLiquidacion: ['0'],
            cuentas: ['0'],

            // -- Estados / Booleans / Dates --
            bloqueado: [false],
            fechaBloqueo: [null],
            observacion_bloqueo: [''],
            observacion_desbloqueo: [''],
            fechaDesbloqueo: [null],
            activo: [true],
        });
    }

    private patchForm(w: DatosbaseItem) {
        const patch: any = { ...w };

        // Ensure nulls become "0" or "" for form display
        this.numberFields.forEach(key => {
            const val = (w as any)[key];
            if (val === null || val === undefined || val === '') {
                patch[key] = '0';
            }
        });

        if (!patch.codigo) patch.codigo = '';
        if (!patch.ingreso) patch.ingreso = '';
        if (!patch.temporal) patch.temporal = '';
        if (!patch.finca) patch.finca = '';
        if (!patch.observacion_bloqueo) patch.observacion_bloqueo = '';
        if (!patch.observacion_desbloqueo) patch.observacion_desbloqueo = '';

        this.form.patchValue(patch);
    }

    getPayload(): DatosbaseItem {
        const raw = this.form.getRawValue(); // include disabled fields like numero_de_documento

        // Construct full payload compliant with backend strictness
        // Backend expects all keys.
        // Ensure "0" for numbers if empty/null

        const payload: any = { ...raw };

        // Sanitize number fields
        this.numberFields.forEach(key => {
            let val = payload[key];
            if (!val || val === '') {
                payload[key] = '0';
            } else {
                payload[key] = String(val); // ensure string type
            }
        });

        // Sanitize text fields
        payload.codigo = payload.codigo || '';
        payload.nombre = payload.nombre || '';
        payload.ingreso = payload.ingreso || '';
        payload.temporal = payload.temporal || '';
        payload.finca = payload.finca || '';

        // Dates & Obs
        payload.observacion_bloqueo = payload.observacion_bloqueo || '';
        payload.observacion_desbloqueo = payload.observacion_desbloqueo || '';

        // Dates: if null send null? or backend expects string?
        // Usually Django DRF handles null if field is nullable. 
        // If invalid date object, make it null.
        // The datepicker returns Date object? 
        // We should convert to ISO string if needed, or null.
        // Assuming backend takes YYYY-MM-DD or ISO.

        if (payload.fechaBloqueo instanceof Date) {
            payload.fechaBloqueo = payload.fechaBloqueo.toISOString();
        }
        if (payload.fechaDesbloqueo instanceof Date) {
            payload.fechaDesbloqueo = payload.fechaDesbloqueo.toISOString();
        }

        return payload as DatosbaseItem;
    }

    save() {
        if (this.form.invalid) return;
        this.dialogRef.close(this.getPayload());
    }

    close() {
        this.dialogRef.close();
    }
}
