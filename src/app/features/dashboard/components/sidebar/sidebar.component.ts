import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { SharedModule } from '../../../../shared/shared.module';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { UtilityServiceService } from '../../../../shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-sidebar',
  imports: [
    SharedModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  role: string = '';
  username: string = '';
  appVersion: string = '';

  sede: string = '';
  sedes: any[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private adminService: UtilityServiceService,
    private router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    const user = await this.getUser();
    this.getAppVersion();

    if (user) {
      this.username = `${user.primer_nombre} ${user.primer_apellido}`;
      this.role = user.rol;
      this.sede = user.sucursalde;
    }
  }

  getAppVersion() {
    // Verificar si estamos en el entorno del navegador
    if (isPlatformBrowser(this.platformId)) {
      // Comprobar si window.electron está disponible
      if (window.electron && window.electron.version) {
        window.electron.version.get().then((response: any) => {
          this.appVersion = response;
        });
      }
    }
  }


  async getUser(): Promise<any> {
    if (isPlatformBrowser(this.platformId)) {
      const user = localStorage.getItem('user');
      if (user) {
        return JSON.parse(user);
      }
    }
    return null;
  }

  async cargarSedes(): Promise<void> {
    (await this.adminService.traerSucursales()).subscribe((data: any) => {
      // ordenar por nombre
      if (data) {
        data.sucursal.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
        this.sedes = data.sucursal;
      }
    });
  }

  onSedeSeleccionada(sede: string): void {
    const user = this.adminService.getUser();
    if (user) {
      this.adminService.editarSede(user.numero_de_documento, sede).subscribe({
        next: (response) => {
          if (response.message === 'error') {
            Swal.fire('Error!', 'Hubo un problema al asignar la sede, vuelva a intentarlo.', 'error');
          } else if (response.message === 'success') {
            user.sucursalde = sede;
            this.sede = sede;
            localStorage.setItem('user', JSON.stringify(user));
            Swal.fire('Editado!', 'La sede ha sido asignada.', 'success').then(() => {
              const currentUrl = this.router.url; // Guarda la URL actual
              this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
                this.router.navigateByUrl(currentUrl); // Usa la URL guardada
              });
            });
          }
        },
        error: () => {
          Swal.fire('Error!', 'Hubo un problema al asignar la sede.', 'error');
        },
      });
    } else {
      Swal.fire('Error!', 'No se encontró información del usuario.', 'error');
    }
  }

}
