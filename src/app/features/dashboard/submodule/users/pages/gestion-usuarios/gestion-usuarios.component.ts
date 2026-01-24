import { Component, computed, inject, Input, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
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
  standalone: true, // Explicitly standalone
  imports: [
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatButtonModule,
    MatDialogModule,
    StandardFilterTable,
    MatProgressSpinnerModule,
    // CommonModule implicit in standalone but explicitly good for directives
  ],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush // Optimization: OnPush
})
export class GestionUsuariosComponent implements OnInit {
  // --- INYECCIÓN DE DEPENDENCIAS ---
  private readonly adminService = inject(AdminService);
  private readonly utilityService = inject(UtilityServiceService);
  private readonly dialog = inject(MatDialog);

  // --- ESTADO REACTIVO CON SIGNALS ---
  // Typed signal for better safety
  private users = signal<UsuarioDetail[]>([]);

  // Loading state for UI feedback (replaces tableVisible logic)
  public readonly loading = signal(true);

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
    }));
  });

  // --- DEFINICIÓN DE COLUMNAS ---
  public readonly columns: ColumnDefinition[] = [
    { name: 'correo', header: 'Correo', type: 'text', width: '260px' },
    { name: 'cedula', header: 'Cédula', type: 'text', width: '140px' },
    { name: 'nombres', header: 'Nombres', type: 'text' },
    { name: 'apellidos', header: 'Apellidos', type: 'text' },
    { name: 'sede', header: 'Sede', type: 'text', width: '140px' },
    { name: 'rol', header: 'Rol', type: 'text', width: '150px' },
    { name: 'actions', header: 'Acciones', type: 'custom', width: '142px', stickyEnd: true },
  ];

  ngOnInit(): void {
    this.reloadUsers(true); // Initial load
  }

  /** 
   * Carga/recarga usuarios.
   * @param silent Si es true, usa loading local. Si es false (por ej. refresh manual), podría usar feedback más notorio.
   */
  async reloadUsers(isInitial = false): Promise<void> {
    this.loading.set(true);

    // Optional: Show Swal only if likely to take long or purely manual refresh?
    // For "Managerial Premium", local skeleton/spinner is better than invasive alerts for data fetching.
    // We'll stick to local loading for UX optimization.

    try {
      const usersData = await firstValueFrom(this.utilityService.getAllUsers());
      this.users.set(usersData ?? []);
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudieron cargar los usuarios. Verifique su conexión.',
        confirmButtonColor: '#21263c'
      });
    } finally {
      this.loading.set(false);
    }
  }

  /** Abre el diálogo de creación */
  async openCreateDialog(): Promise<void> {
    const dialogRef = this.dialog.open(UserUpsertDialogComponent, {
      minWidth: '60vw',
      maxWidth: '96vw',
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
    const result = await Swal.fire({
      title: '¿Confirmar eliminación?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444', // Tailwind red
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      // Optimistic UI could be applied here, but safety first: wait for API
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