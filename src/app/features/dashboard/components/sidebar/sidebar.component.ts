import {  Component, Inject, PLATFORM_ID , ChangeDetectionStrategy } from '@angular/core';
import { SharedModule } from '../../../../shared/shared.module';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { UtilityServiceService } from '../../../../shared/services/utilityService/utility-service.service';
import { firstValueFrom } from 'rxjs';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-sidebar',
  imports: [
    SharedModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
} )
export class SidebarComponent {
  role: string = '';
  username: string = '';
  documento: string = '';
  appVersion: string = '';

  // Nombre visible de la sede actual del usuario
  sede: string = '';
  // Listado de sedes para el selector
  sedes: any[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private adminService: UtilityServiceService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const user: any = this.adminService.getUser?.()  || 'null';
    if (!user) return;

    this.sede = user?.sede?.nombre ?? '';
    this.role = user?.rol?.nombre ?? '';
    this.documento = user?.numero_de_documento ?? '';
    this.username = [user?.datos_basicos?.nombres, user?.datos_basicos?.apellidos].filter(Boolean).join(' ');
    this.getAppVersion();
    await this.cargarSedes();
  }

  getAppVersion(): void {
    if (isPlatformBrowser(this.platformId)) {
      const w = window as any;
      if (w.electron?.version?.get) {
        w.electron.version.get().then((response: any) => (this.appVersion = response));
      }
    }
  }

  async cargarSedes(): Promise<void> {
    try {
      const data: any = await firstValueFrom(this.adminService.traerSucursales());
      // Soporta distintos formatos de respuesta
      const lista = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : Array.isArray(data?.sucursal)
            ? data.sucursal
            : [];

      this.sedes = [...lista].sort((a: any, b: any) => (a?.nombre ?? '').localeCompare(b?.nombre ?? ''));
    } catch (err) {
      Swal.fire('Error', 'No fue posible cargar las sedes.', 'error');
    }
  }

  /**
   * Cambia la sede del usuario actual.
   * Espera un UUID de sede (string). Si tu template envía el objeto, pasa su .id.
   */
  onSedeSeleccionada(sedeId: string): void {
    const user: any = this.adminService.getUser?.() || 'null';

    // Llamamos el servicio que cambia la sede por cédula (envía UUID)
    this.adminService.cambiarSedePorUsuarioId(user.id, sedeId).subscribe({
      next: (res: any) => {
        // Respuesta esperada: { ok: boolean, changed: boolean, sede_id, sede }
        if (!res?.ok) {
          Swal.fire('Error', 'Hubo un problema al asignar la sede.', 'error');
          return;
        }

        // Buscar el nombre desde el catálogo local si viene solo el id
        const sedeEncontrada = this.sedes.find(s => String(s.id) === String(res.sede_id || sedeId));
        const nombreSede = res?.sede ?? sedeEncontrada?.nombre ?? this.sede;

        // Actualizar user en memoria/localStorage
        user.sede = {
          id: res?.sede_id ?? sedeEncontrada?.id ?? sedeId,
          nombre: nombreSede,
          activa: sedeEncontrada?.activa ?? true
        };
        this.sede = nombreSede;

        // Persistir
        try {
          localStorage.setItem('user', JSON.stringify(user));
        } catch {}

        Swal.fire('Editado', 'La sede ha sido asignada.', 'success').then(() => {
          const currentUrl = this.router.url;
          this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
            this.router.navigateByUrl(currentUrl);
          });
        });
      },
      error: (err) => {
        Swal.fire('Error', 'Hubo un problema al asignar la sede.', 'error');
      }
    });
  }

  prueba(): void {
    this.router.navigate(['/dashboard/users/change-password']);
  }
}
