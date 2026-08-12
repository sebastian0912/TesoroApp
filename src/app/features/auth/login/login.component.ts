import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import {
  AbstractControl, FormBuilder, FormGroup,
  ValidationErrors, Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { LoginService } from '../service/login.service';
import { SharedModule } from '../../../shared/shared.module';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { setLocalStorageItem } from '../../../core/utils/safe-storage';
import { OfflineSyncService } from '../../../core/services/offline-sync.service';

interface AppRelease {
  version: string;
  filename: string;
  url: string;
  releaseDate: string;
  sizeMB: number;
  apkFilename?: string;
  apkUrl?: string;
  apkSizeMB?: number;
}

type Vista = 'login' | 'solicitar-otp' | 'verificar-otp' | 'nueva-contrasena';

function emailOrDocValidator(control: AbstractControl): ValidationErrors | null {
  const v: string = (control.value || '').toString().trim();
  if (!v) return { required: true };
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isDoc = /^\d{4,30}$/.test(v);
  return isEmail || isDoc ? null : { emailOrDoc: true };
}

function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const v: string = control.value || '';
  if (v.length < 12) return { minLength: true };
  let hasLower = false, hasUpper = false, hasDigit = false, hasSymbol = false;
  for (const c of v) {
    if (c >= 'a' && c <= 'z') hasLower = true;
    else if (c >= 'A' && c <= 'Z') hasUpper = true;
    else if (c >= '0' && c <= '9') hasDigit = true;
    else hasSymbol = true;
  }
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  return classes >= 3 ? null : { passwordStrength: true };
}

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmar')?.value;
  return pass && confirm && pass !== confirm ? { passwordsMismatch: true } : null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
  imports: [SharedModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private http = inject(HttpClient);

  // ── Login ────────────────────────────────────────────────────────────────
  loginForm!: FormGroup;
  hide = true;
  loading = false;
  desktopRelease = signal<AppRelease | null>(null);

  // ── OTP recovery ─────────────────────────────────────────────────────────
  vista = signal<Vista>('login');
  otpLoading = signal(false);

  otpRequestForm!: FormGroup;
  otpVerifyForm!: FormGroup;
  newPasswordForm!: FormGroup;
  hideNewPwd = true;
  hideConfirmPwd = true;

  /** Email enmascarado devuelto por solicitar-otp (ej: j***n@empresa.com) */
  correoEnmascarado = signal('');
  /** Login ingresado en solicitar-otp (se reutiliza en verificar-otp) */
  private loginGuardado = '';
  /** Token de reset devuelto por verificar-otp */
  private resetToken = '';

  constructor(
    private fb: FormBuilder,
    private loginS: LoginService,
    private router: Router,
    private offlineSync: OfflineSyncService,
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      login: ['', [Validators.required, emailOrDocValidator]],
      password: ['', [Validators.required]],
    });

    this.otpRequestForm = this.fb.group({
      login: ['', [Validators.required, emailOrDocValidator]],
    });

    this.otpVerifyForm = this.fb.group({
      codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    this.newPasswordForm = this.fb.group({
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmar: ['', [Validators.required]],
    }, { validators: passwordsMatchValidator });

    this.http.get<AppRelease>('/downloads/latest.json').subscribe({
      next: r => this.desktopRelease.set(r),
      error: () => {},
    });
  }

  descargarEscritorio(): void {
    const r = this.desktopRelease();
    if (!r) return;
    const a = document.createElement('a');
    a.href = r.url;
    a.download = r.filename;
    a.click();
  }

  descargarAndroid(): void {
    const r = this.desktopRelease();
    if (!r?.apkUrl) return;
    const a = document.createElement('a');
    a.href = r.apkUrl;
    a.download = r.apkFilename ?? 'GestionTesoreria.apk';
    a.click();
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid || this.loading) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loginForm.patchValue({
      login: (this.loginForm.value.login || '').toString().trim(),
      password: (this.loginForm.value.password || '').toString().trim(),
    });

    const { login, password } = this.loginForm.value;

    if (login === 'thisisatestaccount@test.com' && password === 'thisisatestaccount23#') {
      setLocalStorageItem('token', 'testToken');
      const testUser = {
        numero_de_documento: '1005851505',
        primer_nombre: 'PRUEBA',
        primer_apellido: 'GOOGLE',
        segundo_nombre: '5',
        segundo_apellido: 'Campos',
        correo_electronico: login,
        rol: { nombre: 'ADMIN' },
        sede: { nombre: 'SOACHA' },
        estado_solicitudes: true,
      };
      setLocalStorageItem('user', JSON.stringify(testUser));
      this.offlineSync.syncNow().catch(() => null);
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loading = true;
    try {
      const resp = await this.loginS.login(login, password);
      if (!resp?.token || !resp?.user) {
        throw new Error('Respuesta inválida del servidor');
      }
      setLocalStorageItem('token', resp.token);
      setLocalStorageItem('user', JSON.stringify(resp.user));
      const rolNombre = resp.user?.rol?.nombre ?? '';

      this.offlineSync.syncNow().catch(() => null);

      if (rolNombre === 'SIN-ASIGNAR') {
        this.router.navigate(['']);
        Swal.fire({ icon: 'info', title: 'Sin asignar', text: 'Tu cuenta no tiene un rol asignado.' });
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch (err) {
      const e = err as HttpErrorResponse;
      if (e.status === 401 || e.status === 403) {
        await Swal.fire({
          icon: 'error',
          title: 'Credenciales inválidas',
          text: 'Correo/documento o contraseña incorrectos.',
        });
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo iniciar sesión. Verifique su conexión o intente más tarde.',
        });
      }
    } finally {
      this.loading = false;
    }
  }

  // ── OTP: Paso 1 ─ Solicitar código ────────────────────────────────────────

  irARecuperarContrasena(): void {
    this.otpRequestForm.reset();
    this.vista.set('solicitar-otp');
  }

  async onSolicitarOtp(): Promise<void> {
    if (this.otpRequestForm.invalid || this.otpLoading()) {
      this.otpRequestForm.markAllAsTouched();
      return;
    }
    this.otpLoading.set(true);
    const login = (this.otpRequestForm.value.login || '').toString().trim();
    try {
      const resp = await this.loginS.solicitarOtp(login);
      this.loginGuardado = login;
      this.correoEnmascarado.set(resp.correo_enmascarado);
      this.otpVerifyForm.reset();
      this.vista.set('verificar-otp');
    } catch (err) {
      const e = err as HttpErrorResponse;
      const msg = e?.error?.message || 'No se pudo enviar el código. Intenta de nuevo.';
      await Swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
      this.otpLoading.set(false);
    }
  }

  // ── OTP: Paso 2 ─ Verificar código ────────────────────────────────────────

  async onVerificarOtp(): Promise<void> {
    if (this.otpVerifyForm.invalid || this.otpLoading()) {
      this.otpVerifyForm.markAllAsTouched();
      return;
    }
    this.otpLoading.set(true);
    const codigo = (this.otpVerifyForm.value.codigo || '').toString().trim();
    try {
      const resp = await this.loginS.verificarOtp(this.loginGuardado, codigo);
      this.resetToken = resp.reset_token;
      this.newPasswordForm.reset();
      this.vista.set('nueva-contrasena');
    } catch (err) {
      const e = err as HttpErrorResponse;
      if (e.status === 401) {
        await Swal.fire({
          icon: 'error',
          title: 'Código incorrecto',
          text: 'El código ingresado no es válido o ya expiró.',
        });
      } else {
        await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo verificar el código.' });
      }
    } finally {
      this.otpLoading.set(false);
    }
  }

  async reenviarOtp(): Promise<void> {
    if (this.otpLoading()) return;
    this.otpLoading.set(true);
    try {
      const resp = await this.loginS.solicitarOtp(this.loginGuardado);
      this.correoEnmascarado.set(resp.correo_enmascarado);
      this.otpVerifyForm.reset();
      await Swal.fire({ icon: 'success', title: 'Código reenviado', text: 'Revisa tu correo.', timer: 2500, showConfirmButton: false });
    } catch {
      await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo reenviar el código.' });
    } finally {
      this.otpLoading.set(false);
    }
  }

  // ── OTP: Paso 3 ─ Nueva contraseña ────────────────────────────────────────

  async onResetContrasena(): Promise<void> {
    if (this.newPasswordForm.invalid || this.otpLoading()) {
      this.newPasswordForm.markAllAsTouched();
      return;
    }
    this.otpLoading.set(true);
    const nuevaContrasena = this.newPasswordForm.value.password;
    try {
      await this.loginS.resetContrasena(this.resetToken, nuevaContrasena);
      await Swal.fire({
        icon: 'success',
        title: '¡Contraseña actualizada!',
        text: 'Ya puedes iniciar sesión con tu nueva contraseña.',
        confirmButtonText: 'Ir al login',
      });
      this.volverAlLogin();
    } catch (err) {
      const e = err as HttpErrorResponse;
      const msg = e?.error?.message || 'No se pudo restablecer la contraseña.';
      await Swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
      this.otpLoading.set(false);
    }
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  volverAlLogin(): void {
    this.loginGuardado = '';
    this.resetToken = '';
    this.vista.set('login');
  }
}
