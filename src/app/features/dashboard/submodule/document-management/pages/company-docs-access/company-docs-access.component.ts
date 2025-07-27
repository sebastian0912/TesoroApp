import { SharedModule } from '@/app/shared/shared.module';
import { Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { DocumentacionService } from '../../service/documentacion/documentacion.service';
import { MatDialog } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import { CrearPermisoUsuarioComponent } from '../../components/crear-permiso-usuario/crear-permiso-usuario.component';

@Component({
  selector: 'app-company-docs-access',
  imports: [
    SharedModule,
    MatExpansionModule
  ],
  templateUrl: './company-docs-access.component.html',
  styleUrl: './company-docs-access.component.css'
})

export class CompanyDocsAccessComponent {
  usuariosPermisos: any;
  mostrarJerarquiaGestionDocumental: any;

  constructor(
    private documentacionService: DocumentacionService,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    this.documentacionService.mostrar_permisos().subscribe((res: any) => {
      this.usuariosPermisos = res;
      // si es vacio mostrar mensaje
      if (this.usuariosPermisos.length == 0) {
        Swal.fire({
          icon: 'info',
          title: 'Cuidado',
          text: 'No hay usuarios con permisos asignados',
        });
      }
    });

    this.documentacionService
      .mostrar_jerarquia_gestion_documental()
      .subscribe((res: any) => {
        this.mostrarJerarquiaGestionDocumental = res;
      });
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(CrearPermisoUsuarioComponent, {
      minWidth: '70vw', // Opcional: ajusta el ancho del diálogo
      data: {
        /* puedes pasar datos opcionales aquí */
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.documentacionService
        .crear_permiso({
          cedula: result?.usuario.numero_de_documento,
          tipo_documental_id: result?.tipoDocumental.id,
        })
        .subscribe({
          next: (res: any) => {
            Swal.fire({
              icon: 'success',
              title: 'Permiso creado',
              text: 'El permiso fue creado correctamente',
            });
            this.ngOnInit(); // Actualiza la vista
          },
          error: (err: any) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo crear el permiso. Por favor, intenta de nuevo.',
            });
          },
        });
    });
  }

  editPermission(permission: string): void {
          // Lógica adicional para editar el permiso
  }

  addPermission(data: any) {
    const dialogRef = this.dialog.open(CrearPermisoUsuarioComponent, {
      minWidth: '70vw',
      data: {
        email: data.usuario, // Correo del usuario
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.documentacionService
        .crear_permiso({
          cedula: result.usuario.numero_de_documento,
          tipo_documental_id: result.tipoDocumental.id,
        })
        .subscribe({
          next: (res: any) => {
            Swal.fire({
              icon: 'success',
              title: 'Permiso creado',
              text: 'El permiso fue creado correctamente',
            });
            this.ngOnInit(); // Actualiza la vista
          },
          error: (err: any) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo crear el permiso. Por favor, intenta de nuevo.',
            });
          },
        });
    });
  }
}
