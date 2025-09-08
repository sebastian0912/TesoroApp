import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StandardFilterTable, ColumnDefinition } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { AdminService, UsuarioDetail } from '../../services/admin.service';
import { UserUpsertDialogComponent } from '../../components/user-upsert-dialog/user-upsert-dialog.component';
import { firstValueFrom } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Swal from 'sweetalert2';
import { UserPermissionsDialogComponent } from '../../components/user-permissions-dialog/user-permissions-dialog.component';

@Component({
  selector: 'app-gestion-usuarios',
  imports: [
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatButtonModule,
    MatDialogModule,
    StandardFilterTable,
    MatProgressSpinnerModule
  ],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.css'
})
export class GestionUsuariosComponent implements OnInit {
  // --- INYECCIÓN DE DEPENDENCIAS ---
  private readonly adminService = inject(AdminService);
  private readonly utilityService = inject(UtilityServiceService);
  private readonly dialog = inject(MatDialog);

  // --- ESTADO REACTIVO CON SIGNALS ---
  private users = signal<any[]>([]);
  public readonly tableVisible = signal(false); // Controla si la tabla se muestra

  /** Signal computada que transforma los datos para la tabla */
  public readonly rows = computed(() => {
    return this.users().map(u => ({
      id: u?.id,
      correo: u?.correo_electronico ?? '—',
      cedula: u?.numero_de_documento ?? '—',
      nombres: u?.datos_basicos?.nombres ?? '—',
      apellidos: u?.datos_basicos?.apellidos ?? '—',
      sede: u?.sede?.nombre ?? '—',
      rol: u?.rol?.nombre ?? '—',
    }));
  });

  // --- DEFINICIÓN DE COLUMNAS ---
  public readonly columns: ColumnDefinition[] = [
    { name: 'correo', header: 'Correo', type: 'text', width: '260px' },
    { name: 'cedula', header: 'Cédula', type: 'text', width: '140px' },
    { name: 'nombres', header: 'Nombres', type: 'text' },
    { name: 'apellidos', header: 'Apellidos', type: 'text' },
    { name: 'sede', header: 'Sede', type: 'text', width: '140px' },
    { name: 'rol', header: 'Rol', type: 'text', width: '120px' },
    { name: 'actions', header: 'Acciones', type: 'custom', width: '112px', stickyEnd: true },
  ];

  ngOnInit(): void {
    this.reloadUsers();
  }

  /** Carga/recarga usuarios mostrando feedback con SweetAlert2 */
  async reloadUsers(): Promise<void> {
    this.tableVisible.set(false);
    Swal.fire({
      title: 'Cargando Usuarios',
      icon: 'info',
      text: 'Por favor, espere un momento...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const usersData = await firstValueFrom(this.utilityService.getAllUsers());
      this.users.set(usersData ?? []);
      this.tableVisible.set(true); // Muestra la tabla después de cargar los datos
      Swal.close();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: '¡Error!',
        text: 'No se pudieron cargar los usuarios. Por favor, inténtelo de nuevo más tarde.',
      });
    }
  }

  /** Abre el diálogo de creación */
  async openCreateDialog(): Promise<void> {
    const dialogRef = this.dialog.open(UserUpsertDialogComponent, {
      minWidth: '60vw',
      data: { mode: 'create' },
      disableClose: true,
    });
    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result?.ok) {
      Swal.fire('¡Éxito!', 'El usuario ha sido creado correctamente.', 'success');
      this.reloadUsers();
    }
  }

  /** Abre el diálogo de edición */
  async openEditDialog(row: { id: string }): Promise<void> {
    const user = this.users().find(u => u.id === row.id);
    const dialogRef = this.dialog.open(UserUpsertDialogComponent, {
      minWidth: '60vw',
      data: { mode: 'edit', user },
      disableClose: true,
    });
    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result?.ok) {
      Swal.fire('¡Éxito!', 'El usuario ha sido actualizado.', 'success');
      this.reloadUsers();
    }
  }

  /** Elimina un usuario con confirmación de SweetAlert2 */
  async deleteUser(row: { id: string }): Promise<void> {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "¡No podrás revertir esta acción!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, ¡eliminar!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await firstValueFrom(this.adminService.eliminar(row.id));
        Swal.fire('¡Eliminado!', 'El usuario ha sido eliminado.', 'success');
        this.reloadUsers();
      } catch (err) {
        Swal.fire('¡Error!', 'No se pudo eliminar el usuario.', 'error');
      }
    }
  }

  openPermsDialog(user: any): void {
    const userfull = this.users().find(u => u.id === user.id);
    console.log('Usuario completo:', userfull);
    if (!userfull) {
      Swal.fire('¡Error!', 'No se encontró el usuario.', 'error');
      return;
    }
    // añadir rol id al user
    this.dialog.open(UserPermissionsDialogComponent, {
      width: '920px',
      maxWidth: '96vw',
      data: { userfull },
      disableClose: false,
    });
  }

}
