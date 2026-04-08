import { Component, Inject, OnInit, ChangeDetectionStrategy, signal, computed } from '@angular/core';

import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { AdminService, ActualizarUsuarioPayload, UsuarioDetail, AuthResponse } from '../../services/admin.service';
import { forkJoin, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import Swal from 'sweetalert2';

export interface UserUpsertData {
  mode: 'create' | 'edit';
  user?: {
    id: string;
    numero_de_documento: string;
    tipo_documento: string;
    correo_electronico: string;
    estado_solicitudes: boolean;
    empresa?: { id: string; nombre: string } | null;
    sede?: { id: string; nombre: string; activa: boolean } | null;
    rol?: { nombre: string; id?: string } | null;
    datos_basicos?: { nombres: string; apellidos: string; celular?: string | null } | null;
  } | null;
}



@Component({
  selector: 'app-user-upsert-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule
],
  templateUrl: './user-upsert-dialog.component.html',
  styleUrl: './user-upsert-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserUpsertDialogComponent implements OnInit {
  // Catálogos (signals)
  roles = signal<{ id: string; nombre: string }[]>([]);
  sedes = signal<{ id: string; nombre: string; activa: boolean }[]>([]);
  empresas = signal<{ id: string; nombre: string }[]>([]);

  loading = signal(false);
  saving = signal(false);
  hidePw = signal(true);
  hidePw2 = signal(true);
  changePw = signal(false); // <- toggle para cambiar contraseña en edición

  title = computed(() => (this.data.mode === 'create' ? 'Crear usuario' : 'Editar usuario'));
  isCreate = computed(() => this.data.mode === 'create');

  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private utils: UtilityServiceService,
    private dialogRef: MatDialogRef<UserUpsertDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: UserUpsertData
  ) {}

  ngOnInit(): void {
    // 1) Form base
    this.form = this.fb.group({
      numero_de_documento: ['', [Validators.required, Validators.minLength(4)]],
      tipo_documento: ['CC', Validators.required],
      correo_electronico: ['', [Validators.required, Validators.email]],
      estado_solicitudes: [true],
      empresa_id: [null as string | null],
      sede_id: [null as string | null],
      rol_id: [null as string | null, Validators.required],
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      celular: [null as string | null],

      // Password: obligatorio solo en create. En edición se activa con toggle.
      password: [''],
      password2: [''],
    });

    if (this.isCreate()) {
      this.form.get('password')?.addValidators([Validators.required, Validators.minLength(8)]);
      this.form.get('password2')?.addValidators([Validators.required]);
      this.form.get('password')?.updateValueAndValidity();
      this.form.get('password2')?.updateValueAndValidity();
    }

    // 2) Cargar catálogos en paralelo (con fallback por si no existe traerEmpresas en UtilityService)
    this.loading.set(true);

    const roles$ = this.utils.traerRoles() as Observable<any[]>;
    const sedes$ = this.utils.traerSucursales2() as Observable<any[]>;
    const empresas$ = (typeof (this.utils as any).traerEmpresas === 'function'
      ? (this.utils as any).traerEmpresas()
      : of([])) as Observable<any[]>;

    forkJoin({ roles: roles$, sedes: sedes$, empresas: empresas$ }).subscribe({
      next: ({ roles, sedes, empresas }) => {
        const norm = (x: any): any[] => (Array.isArray(x) ? x : x?.results ?? x?.data ?? []);
        this.roles.set(norm(roles).map((r: any) => ({ id: r.id, nombre: r.nombre })));
        this.sedes.set(norm(sedes).map((s: any) => ({ id: s.id, nombre: s.nombre, activa: !!s.activa })));
        this.empresas.set(norm(empresas).map((e: any) => ({ id: e.id, nombre: e.nombre })));

        if (this.data.mode === 'edit' && this.data.user) {
          this.patchFormWithUser(this.data.user);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private patchFormWithUser(u: NonNullable<UserUpsertData['user']>) {
    this.form.patchValue({
      numero_de_documento: u.numero_de_documento ?? '',
      tipo_documento: u.tipo_documento ?? 'CC',
      correo_electronico: u.correo_electronico ?? '',
      estado_solicitudes: !!u.estado_solicitudes,
      empresa_id: u.empresa?.id ?? null,
      sede_id: u.sede?.id ?? null,
      rol_id: (u.rol as any)?.id ?? null,
      nombres: u.datos_basicos?.nombres ?? '',
      apellidos: u.datos_basicos?.apellidos ?? '',
      celular: u.datos_basicos?.celular ?? null,
    });

    // En edición: por defecto no cambiar contraseña
    if (!this.isCreate()) {
      this.onToggleChangePw(false);
    }
  }

  // Toggle para activar/desactivar cambio de contraseña en edición
  onToggleChangePw(checked: boolean): void {
    this.changePw.set(checked);
    const pw = this.form.get('password')!;
    const pw2 = this.form.get('password2')!;
    if (checked) {
      pw.setValidators([Validators.required, Validators.minLength(8)]);
      pw2.setValidators([Validators.required]);
    } else {
      pw.clearValidators(); pw.reset('');
      pw2.clearValidators(); pw2.reset('');
      // Limpia error de mismatch si quedó colgado
      pw2.setErrors(null);
    }
    pw.updateValueAndValidity();
    pw2.updateValueAndValidity();
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }

  guardar(): void {
    // Validación de match de password en create o si activaste el toggle en edición
    if (this.isCreate() || this.changePw()) {
      const p1 = (this.form.get('password')?.value ?? '').toString();
      const p2 = (this.form.get('password2')?.value ?? '').toString();
      if (p1 !== p2) {
        this.form.get('password2')?.setErrors({ mismatch: true });
      }
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);

    // Saneo simple: trim strings
    const raw = this.form.getRawValue();
    const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

    const payload: ActualizarUsuarioPayload = {
      numero_de_documento: trim(raw.numero_de_documento) || undefined,
      tipo_documento: trim(raw.tipo_documento) || undefined,
      correo_electronico: trim(raw.correo_electronico) || undefined,
      estado_solicitudes: raw.estado_solicitudes ?? true,
      // Puedes mandar empresa/sede/rol o *_id; el backend acepta ambos
      empresa: raw.empresa_id ?? null,
      sede: raw.sede_id ?? null,
      rol: raw.rol_id ?? null,
      nombres: trim(raw.nombres) ?? '',
      apellidos: trim(raw.apellidos) ?? '',
      celular: trim(raw.celular) ?? null,
      // password sólo si aplica (create o toggle activo en edición)
      ...(this.isCreate() || this.changePw() ? { password: trim(raw.password) } : {}),
    };

    // Unificamos a Observable<UsuarioDetail>
    const req$: Observable<UsuarioDetail> =
      this.data.mode === 'create'
        ? this.adminService
            .crear({
              numero_de_documento: payload.numero_de_documento!,
              tipo_documento: payload.tipo_documento!,
              correo_electronico: payload.correo_electronico!,
              password: (payload as any).password!, // garantizado en create
              estado_solicitudes: payload.estado_solicitudes,
              empresa: payload.empresa ?? null,
              sede: payload.sede ?? null,
              rol: payload.rol ?? null,
              nombres: payload.nombres,
              apellidos: payload.apellidos,
              celular: payload.celular ?? null,
            } as any)
            .pipe(map((r: AuthResponse) => r.user))
        : this.adminService.actualizar(this.data.user!.id, payload, true);

    req$.subscribe({
      next: (detail: UsuarioDetail) => {
        this.saving.set(false);
        this.dialogRef.close({ ok: true, data: detail });
      },
      error: (err: unknown) => {
        Swal.fire('Error', 'No fue posible guardar el usuario.', 'error');
        this.saving.set(false);
      },
    });
  }
}
