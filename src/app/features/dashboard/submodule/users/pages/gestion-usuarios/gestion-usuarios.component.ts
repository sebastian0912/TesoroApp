import { Component, computed, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { AdminService, UsuarioDetail } from '../../services/admin.service';
import { UserUpsertDialogComponent } from '../../components/user-upsert-dialog/user-upsert-dialog.component';
import { firstValueFrom } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Swal from 'sweetalert2';
import { UserPermissionsDialogComponent } from '../../components/user-permissions-dialog/user-permissions-dialog.component';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    StandardFilterTable,
    MatProgressSpinnerModule,
  ],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GestionUsuariosComponent implements OnInit {
  // --- INYECCIÓN DE DEPENDENCIAS ---
  private readonly adminService = inject(AdminService);
  private readonly utilityService = inject(UtilityServiceService);
  private readonly dialog = inject(MatDialog);

  // --- ESTADO REACTIVO CON SIGNALS ---
  private users = signal<UsuarioDetail[]>([]);

  /** Hay una carga en curso (inicial o recarga tras crear/editar/eliminar). */
  public readonly loading = signal(true);

  /** La última carga falló: distingue "sin usuarios" de "no se pudo cargar". */
  public readonly loadError = signal(false);

  /** Signal computada que transforma los datos para la tabla */
  public readonly rows = computed(() => {
    return this.users().map(u => ({
      id: u.id,
      correo: u.correo_electronico ?? '—',
      cedula: u.numero_de_documento ?? '—',
      nombres: u.datos_basicos?.nombres ?? '—',
      apellidos: u.datos_basicos?.apellidos ?? '—',
      sede: u.sede?.nombre ?? '—',
      rol: u.rol?.nombre ?? '—',
      fecha_registro: u.fecha_registro
        ? new Date(Number(u.fecha_registro) * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—',
    }));
  });

  // --- DEFINICIÓN DE COLUMNAS ---
  public readonly columns: ColumnDefinition[] = [
    { name: 'fecha_registro', header: 'Fecha registro', type: 'text', width: '160px' },
    { name: 'correo', header: 'Correo', type: 'text', width: '260px' },
    { name: 'cedula', header: 'Cédula', type: 'text', width: '140px' },
    { name: 'nombres', header: 'Nombres', type: 'text' },
    { name: 'apellidos', header: 'Apellidos', type: 'text' },
    { name: 'sede', header: 'Sede', type: 'text', width: '140px' },
    { name: 'rol', header: 'Rol', type: 'text', width: '150px' },
    { name: 'actions', header: 'Acciones', type: 'custom', width: '142px', stickyEnd: true, sortable: false, filterable: false },
  ];

  ngOnInit(): void {
    this.reloadUsers(true); // Initial load
  }

  /**
   * Carga/recarga usuarios.
   * @param isInitial Carga de arranque: muestra el spinner de bloque completo.
   *                  En las recargas la tabla permanece montada con su overlay.
   */
  async reloadUsers(isInitial = false): Promise<void> {
    this.loading.set(true);

    try {
      const usersData = await firstValueFrom(this.utilityService.getAllUsers());
      this.users.set(usersData ?? []);
      this.loadError.set(false);
    } catch (err) {
      console.error(err);
      this.loadError.set(true);
      // En el arranque no hay nada que conservar; en una recarga se mantiene la
      // lista anterior en pantalla en vez de vaciar la tabla por un fallo de red.
      if (isInitial) this.users.set([]);
      // Con datos en pantalla el estado de error no llega a verse: avisar con toast.
      if (this.users().length > 0) {
        this.showErrorToast('No se pudieron recargar los usuarios.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Abre el diálogo de creación */
  async openCreateDialog(): Promise<void> {
    const dialogRef = this.dialog.open(UserUpsertDialogComponent, {
      minWidth: '60vw',
      maxWidth: '96vw',
      height: '90vh',
      data: { mode: 'create' },
      disableClose: true,
      panelClass: 'dialog-responsive'
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result?.ok) {
      this.showSuccessToast('Usuario creado correctamente');
      this.reloadUsers();
    }
  }

  /** Abre el diálogo de edición */
  async openEditDialog(row: { id: string }): Promise<void> {
    const user = this.users().find(u => u.id === row.id);
    if (!user) return;

    const dialogRef = this.dialog.open(UserUpsertDialogComponent, {
      minWidth: '60vw',
      maxWidth: '96vw',
      height: '90vh',
      data: { mode: 'edit', user },
      disableClose: true,
      panelClass: 'dialog-responsive'
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result?.ok) {
      this.showSuccessToast('Usuario actualizado correctamente');
      this.reloadUsers();
    }
  }

  /** Elimina un usuario con confirmación */
  async deleteUser(row: { id: string }): Promise<void> {
    const user = this.users().find(u => u.id === row.id);
    const nombre = user?.correo_electronico ?? 'este usuario';

    const result = await Swal.fire({
      title: '¿Eliminar usuario?',
      html: `Se eliminará <b>${nombre}</b>. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b42318',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true
    });

    if (result.isConfirmed) {
      Swal.fire({
        title: 'Eliminando...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        timerProgressBar: true
      });

      try {
        await firstValueFrom(this.adminService.eliminar(row.id));
        Swal.close(); // Close loading
        this.showSuccessToast('Usuario eliminado');
        this.reloadUsers();
      } catch (err) {
        Swal.fire('Error', 'No se pudo eliminar el usuario.', 'error');
      }
    }
  }

  openPermsDialog(row: { id: string }): void {
    const userfull = this.users().find(u => u.id === row.id);
    if (!userfull) {
      this.showErrorToast('No se encontró información detallada del usuario');
      return;
    }

    this.dialog.open(UserPermissionsDialogComponent, {
      width: 'min(920px, 96vw)',
      maxWidth: '96vw',
      maxHeight: '90vh',
      data: { userfull },
      disableClose: false,
      panelClass: 'dialog-responsive'
    });
  }

  // --- Helpers UI ---
  private showSuccessToast(title: string) {
    Swal.fire({
      icon: 'success',
      title: title,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }

  private showErrorToast(msg: string) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: msg,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 4000
    });
  }
}