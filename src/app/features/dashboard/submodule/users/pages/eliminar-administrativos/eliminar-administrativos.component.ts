import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { AdminService } from '../../services/admin.service';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-eliminar-administrativos',
  imports: [
    SharedModule
  ],
  templateUrl: './eliminar-administrativos.component.html',
  styleUrl: './eliminar-administrativos.component.css'
})
export class EliminarAdministrativosComponent implements OnInit {
  deleteForm: FormGroup;
  users: any[] = [];

  constructor(
    private fb: FormBuilder,
    private utilityServiceService: UtilityServiceService,
    private adminService: AdminService,
    private router: Router
  ) {
    this.deleteForm = this.fb.group({
      selectedUser: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      // Mostrar swal de carga
      Swal.fire({
        title: 'Cargando usuarios...',
        text: 'Por favor, espera un momento.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Obtener los usuarios como promesa
      const usuarios = await this.utilityServiceService.traerUsuarios().toPromise();

      // Procesar usuarios si existen
      if (usuarios) {
        this.users = usuarios
          .filter((user: any) =>
            user.rol !== 'EMPRESA' &&
            user.rol !== 'TICKTOKER' &&
            user.rol !== 'SIN-ASIGNAR' &&
            user.rol !== 'TRASLADOS'
          )
          .sort((a: any, b: any) => a.primer_nombre.localeCompare(b.primer_nombre));
      }

      // Cerrar swal de carga al finalizar exitosamente
      Swal.close();
    } catch (error) {
      // Mostrar error con Swal
      Swal.fire({
        title: 'Error',
        text: 'No se pudieron cargar los usuarios. Inténtalo de nuevo.',
        icon: 'error'
      });
    }
  }

  onSubmit(): void {
    if (this.deleteForm.valid) {
      const selectedUser = this.deleteForm.value.selectedUser;

      Swal.fire({
        title: 'Confirmación',
        text: `¿Desea eliminar el usuario de ${selectedUser.primer_nombre} ${selectedUser.primer_apellido}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No'
      }).then(async (result) => {
        if (result.isConfirmed) {

          try {
            const response = await this.adminService.eliminarUsuario(selectedUser.numero_de_documento);

            if (response.message === 'error') {
              Swal.fire('Error!', 'Hubo un problema al asignar el rol, vuelva a intentarlo.', 'error');
              return;
            }
            else if (response.message === 'success') {
              (await Swal.fire('Eliminado!', 'Usuario ha sido eliminado.', 'success')
              .then(() => {
                this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
                  this.router.navigate(["/dashboard/users/remove-admin"]);
                });
              }));
            }

          } catch (error) {
            Swal.fire('Error!', 'Hubo un problema al asignar el rol.', 'error');
          }
        }
      });
    }
  }


}
