import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { isPlatformBrowser } from '@angular/common';
import { LoginService } from '../service/login.service';
import { SharedModule } from '../../../shared/shared.module';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  imports: [SharedModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  rightPanelActive: boolean = false;
  loginForm: FormGroup;
  registerForm: FormGroup;
  showPassword: boolean = false;
  showLoginPassword: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: LoginService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.registerForm = this.fb.group({
      numero_de_documento: ['', Validators.required],
      primer_nombre: ['', Validators.required],
      segundo_nombre: [''],
      primer_apellido: ['', Validators.required],
      segundo_apellido: [''],
      correo_electronico: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Borrar todo del local storage
      localStorage.clear();
    }
  }

  togglePanel(isSignUp: boolean): void {
    this.rightPanelActive = isSignUp;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleLoginPasswordVisibility(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }

  async register(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const newUser = { ...this.registerForm.value };

    // Validar y normalizar correo
    const email = (newUser.correo_electronico || '').trim().toLowerCase();
    if (!email) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Debes ingresar un correo electrónico válido',
      });
      return;
    }

    // Usar el correo como username
    newUser.correo_electronico = email;
    newUser.username = email;

    try {
      const response = await this.authService.register(newUser);

      if (response) {
        Swal.fire({
          icon: 'success',
          title: 'Registro Exitoso',
          text: 'Tu cuenta ha sido creada correctamente',
        });
        // Opcional: this.registerForm.reset();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error en el Registro',
          text:
            (response as any)?.message ||
            'No se pudo crear la cuenta, por favor intente de nuevo',
        });
      }
    } catch (err: any) {
      const error = err as HttpErrorResponse;
      let message =
        (error?.error && (error.error.message || error.error.detail)) ||
        '';

      // Manejo explícito de 409 (conflicto por correo ya registrado)
      if (error?.status === 409) {
        message =
          message ||
          'Ya existe una cuenta registrada con este correo electrónico.';
      }
      // Manejo de 400 (validaciones del backend)
      else if (error?.status === 400) {
        message =
          this.processErrors?.(error.error) ||
          message ||
          'Solicitud inválida. Revisa los campos.';
      }
      // Error de red / CORS
      else if (error?.status === 0) {
        message =
          'No se pudo conectar con el servidor. Verifica tu conexión o inténtalo más tarde.';
      }
      // Fallback para error crudo de MySQL (por si llega)
      else if (
        error?.error?.message?.includes?.('Duplicate entry') &&
        error?.error?.message?.includes?.('correo_electronico')
      ) {
        message = 'Ya existe una cuenta registrada con este correo electrónico.';
      }
      // Fallback genérico
      else {
        message = message || 'Hubo un problema al intentar crear la cuenta.';
      }

      Swal.fire({
        icon: 'error',
        title: 'Error en el Registro',
        text: message,
      });
    }
  }


  /**
   * Función para procesar los errores y excluir el del username.
   * También traduce los mensajes de error al español.
   */
  processErrors(errors: any): string {
    const errorMessages = [];

    if (errors.correo_electronico) {
      errorMessages.push('Ya existe un usuario con este correo electrónico.');
    }

    if (errors.numero_de_documento) {
      errorMessages.push('Ya existe un usuario con este número de documento.');
    }

    // Ignorar el error del username
    // Puedes agregar más campos según tus necesidades

    // Unir todos los mensajes de error en una sola cadena
    return errorMessages.join('\n');
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const loginData = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
    };

    // Verificación directa para la cuenta de prueba
    if (
      loginData.email === 'thisisatestaccount@test.com' &&
      loginData.password === 'thisisatestaccount23#'
    ) {
      // Guardar un token de prueba en el localStorage (puedes cambiarlo según tu necesidad)
      localStorage.setItem('token', 'testToken');
      // Simular la obtención del usuario de prueba
      const testUser = {
        avatar: '',
        celular: '',
        correo_electronico: loginData.email,
        empleadode: null,
        estadoSolicitudes: true,
        estadoquincena: true,
        numero_de_documento: '1005851505',
        primer_apellido: 'GOOGLE',
        primer_nombre: 'PRUEBA',
        rol: 'ADMIN',
        segundo_apellido: 'Campos',
        segundo_nombre: '5',
        sucursalde: 'SOACHA',
        tipos: '',
        username: loginData.email,
        usernameInstagram: '',
        usernameTicktok: '',
      };
      localStorage.setItem('user', JSON.stringify(testUser));
      this.router.navigate(['/dashboard']);
      return;
    }

    try {
      this.authService
        .login(loginData.email, loginData.password)
        .then((response) => {
          if (response) {
            if (response.jwt === 'Contraseña incorrecta') {
              Swal.fire({
                icon: 'error',
                title: 'Contraseña incorrecta',
                text: 'Por favor, verifique su contraseña e intente de nuevo',
              });
              return;
            } else if (response.jwt === 'Usuario no encontrado') {
              Swal.fire({
                icon: 'error',
                title: 'Usuario no encontrado',
                text: 'Por favor, verifique su correo electrónico e intente de nuevo',
              });
              return;
            } else {
              localStorage.setItem('token', response.jwt);
              this.authService.getUser().then(async (user) => {
                await this.authService
                  .getPermissions(user.username)
                  .then((permissions) => {
                    user.permissions = permissions;
                  });
                localStorage.setItem('user', JSON.stringify(user));
                // Si estadoquincena es false y no es rol ADMIN O TESORERIA
                if (!user.estadoquincena && user.rol !== 'ADMIN' && user.rol !== 'TESORERIA' && user.rol !== 'TRASLADOS') {
                  Swal.fire({
                    icon: 'warning',
                    title: 'Cierre de quincena',
                    text: 'Tesoreria esta realizando los cierres de quincena, por favor intente más tarde, para mas información comuniquese con el área de tesoreria (Deiby)',
                  });
                  return;
                }
                this.router.navigate(['/dashboard']);
              });
            }
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Hubo un problema al iniciar sesión, por favor intente de nuevo, revise que la VPN esté activa',
            });
          }
        })
        .catch((error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo establecer conexión con el servidor, por favor verifique su conexión a internet e intente de nuevo',
          });
        });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error inesperado',
        text: 'Ocurrió un error inesperado, por favor intente de nuevo más tarde',
      });
    }
  }
}
