import { ActualizarUsuarioPayload } from './../../services/admin.service';
import { Component, Inject, OnInit, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { AdminService } from '../../services/admin.service';
import { forkJoin, Observable, of } from 'rxjs';

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
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
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
  title = computed(() => this.data.mode === 'create' ? 'Crear usuario' : 'Editar usuario');

  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private utils: UtilityServiceService,
    private dialogRef: MatDialogRef<UserUpsertDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: UserUpsertData
  ) {}

  ngOnInit(): void {
    // 1) Inicializar form aquí (con constructor)
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
    });

    // 2) Cargar catálogos en paralelo (sin genéricos mal puestos)
    this.loading.set(true);

    const roles$    = this.utils.traerRoles() as Observable<any[]>;
    const sedes$    = this.utils.traerSucursales2() as Observable<any[]>;
    const empresas$ = ((this.utils as any).traerEmpresas
      ? (this.utils as any).traerEmpresas()
      : of([] as any[])
    ) as Observable<any[]>;

    forkJoin({
      roles: roles$,
      sedes: sedes$,
      empresas: empresas$,
    }).subscribe({
      next: ({ roles, sedes, empresas }) => {
        // Normaliza por si la API retorna {results:[]} o {data:[]}
        const norm = (x: any): any[] => Array.isArray(x) ? x : (x?.results ?? x?.data ?? []);

        const rolesArr    = norm(roles);
        const sedesArr    = norm(sedes);
        const empresasArr = norm(empresas);

        this.roles.set(rolesArr.map((r: any) => ({ id: r.id, nombre: r.nombre })));
        this.sedes.set(sedesArr.map((s: any) => ({ id: s.id, nombre: s.nombre, activa: !!s.activa })));
        this.empresas.set(empresasArr.map((e: any) => ({ id: e.id, nombre: e.nombre })));

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
      rol_id: (u as any).rol?.id ?? null,
      nombres: u.datos_basicos?.nombres ?? '',
      apellidos: u.datos_basicos?.apellidos ?? '',
      celular: u.datos_basicos?.celular ?? null,
    });
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const payload: ActualizarUsuarioPayload = {
      numero_de_documento: raw.numero_de_documento || undefined,
      tipo_documento: raw.tipo_documento || undefined,
      correo_electronico: raw.correo_electronico || undefined,
      estado_solicitudes: raw.estado_solicitudes ?? true,
      empresa_id: raw.empresa_id ?? null,
      sede_id: raw.sede_id ?? null,
      rol_id: raw.rol_id ?? null,
      nombres: raw.nombres ?? '',
      apellidos: raw.apellidos ?? '',
      celular: (raw.celular ?? null) as any,
    };

    const req$ = this.data.mode === 'create'
      ? this.adminService.crear({
          numero_de_documento: payload.numero_de_documento!,
          tipo_documento: payload.tipo_documento!,
          correo_electronico: payload.correo_electronico!,
          estado_solicitudes: payload.estado_solicitudes,
          empresa_id: payload.empresa_id,
          sede_id: payload.sede_id,
          rol_id: payload.rol_id,
          nombres: payload.nombres,
          apellidos: payload.apellidos,
          celular: payload.celular ?? null,
        })
      : this.adminService.actualizar(this.data.user!.id, payload, true);

    req$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.dialogRef.close({ ok: true, data: res });
      },
      error: (err) => {
        console.error('Error guardando usuario:', err);
        this.saving.set(false);
      }
    });
  }
}
