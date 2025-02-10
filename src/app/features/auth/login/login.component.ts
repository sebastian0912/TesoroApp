import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { isPlatformBrowser } from '@angular/common';
import { LoginService } from '../service/login.service';
import { SharedModule } from '../../../shared/shared.module';

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

    const newUser = this.registerForm.value;
    // Crear campo username y colocarle el valor de correo_electronico
    newUser.username = newUser.correo_electronico;

    try {
      const response = await this.authService.register(newUser);
      if (response && response) {
        Swal.fire({
          icon: 'success',
          title: 'Registro Exitoso',
          text: 'Tu cuenta ha sido creada correctamente',
        });

      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error en el Registro',
          text:
            response.message ||
            'No se pudo crear la cuenta, por favor intente de nuevo',
        });
      }
    } catch (error: any) {
      // Procesar los errores recibidos del servidor
      const processedErrors = this.processErrors(error.error);

      Swal.fire({
        icon: 'error',
        title: 'Error en el Registro',
        text:
          processedErrors || 'Hubo un problema al intentar crear la cuenta.',
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
