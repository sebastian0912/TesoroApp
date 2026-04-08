import {  Component, Inject, OnInit , ChangeDetectionStrategy } from '@angular/core';

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

import { PersonaTesoreriaItem } from '../../../../service/teroreria/tesoreria.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-edit-worker-dialog',
    standalone: true,
    imports: [
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
} )
export class EditWorkerDialogComponent implements OnInit {
    form: FormGroup;

    // List of all keys that are strictly "money/numbers"
    private numberFields = [
        'salario', 'saldo_pendiente', 'saldos', 'fondos',
        'mercados', 'cuotas_mercados', 'prestamo_para_descontar',
        'cuotas_prestamos_para_descontar', 'casino', 'valor_anchetas',
        'cuotas_anchetas', 'fondo', 'carnet', 'seguro_funerario',
        'prestamo_para_hacer', 'cuotas_prestamo_para_hacer',
        'anticipo_liquidacion', 'cuentas'
    ];

    constructor(
        private fb: FormBuilder,
        private dialogRef: MatDialogRef<EditWorkerDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { worker: PersonaTesoreriaItem }
    ) {
        this.form = this.buildForm();
    }

    ngOnInit(): void {
        if (this.data && this.data.worker) {
            this.patchForm(this.data.worker);
        }

        const bloqueadoCtrl = this.form.get('bloqueado');
        const obsCtrl = this.form.get('observacion_bloqueo');

        if (bloqueadoCtrl && obsCtrl) {
            this.toggleObservacionValidator(bloqueadoCtrl.value);
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
            numero_documento: [{ value: '', disabled: true }, Validators.required],
            codigo: [''],
            nombre: ['', Validators.required],
            ingreso: [''],
            temporal: [''],
            finca: [''],

            // -- Valores Financieros (Strings) --
            salario: ['0'],
            saldo_pendiente: ['0'],
            saldos: ['0'],
            fondos: ['0'],
            mercados: ['0'],
            cuotas_mercados: ['0'],
            prestamo_para_descontar: ['0'],
            cuotas_prestamos_para_descontar: ['0'],
            casino: ['0'],
            valor_anchetas: ['0'],
            cuotas_anchetas: ['0'],
            fondo: ['0'],
            carnet: ['0'],
            seguro_funerario: ['0'],
            prestamo_para_hacer: ['0'],
            cuotas_prestamo_para_hacer: ['0'],
            anticipo_liquidacion: ['0'],
            cuentas: ['0'],

            // -- Estados / Booleans / Dates --
            bloqueado: [false],
            fecha_bloqueo: [null],
            observacion_bloqueo: [''],
            observacion_desbloqueo: [''],
            fecha_desbloqueo: [null],
            activo: [true],
        });
    }

    private patchForm(w: PersonaTesoreriaItem) {
        const patch: any = { ...w };

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

    getPayload(): PersonaTesoreriaItem {
        const raw = this.form.getRawValue();

        const payload: any = { ...raw };

        this.numberFields.forEach(key => {
            let val = payload[key];
            if (!val || val === '') {
                payload[key] = '0';
            } else {
                payload[key] = String(val);
            }
        });

        payload.codigo = payload.codigo || '';
        payload.nombre = payload.nombre || '';
        payload.ingreso = payload.ingreso || '';
        payload.temporal = payload.temporal || '';
        payload.finca = payload.finca || '';

        payload.observacion_bloqueo = payload.observacion_bloqueo || '';
        payload.observacion_desbloqueo = payload.observacion_desbloqueo || '';

        if (payload.fecha_bloqueo instanceof Date) {
            payload.fecha_bloqueo = payload.fecha_bloqueo.toISOString();
        }
        if (payload.fecha_desbloqueo instanceof Date) {
            payload.fecha_desbloqueo = payload.fecha_desbloqueo.toISOString();
        }

        return payload as PersonaTesoreriaItem;
    }

    save() {
        if (this.form.invalid) return;
        this.dialogRef.close(this.getPayload());
    }

    close() {
        this.dialogRef.close();
    }
}
