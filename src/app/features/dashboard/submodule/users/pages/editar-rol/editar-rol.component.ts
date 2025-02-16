import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { AdminService } from '../../services/admin.service';
import { Router } from '@angular/router';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { SharedModule } from '../../../../../../shared/shared.module';

@Component({
  selector: 'app-editar-rol',
  imports: [
    SharedModule
  ],
  templateUrl: './editar-rol.component.html',
  styleUrls: ['./editar-rol.component.css']
})
export class EditarRolComponent implements OnInit {
  editRoleForm: FormGroup;
  users: any[] = [];
  roles: any[] = [];

  constructor(
    private fb: FormBuilder,
    private utilityServiceService: UtilityServiceService,
    private adminService: AdminService,
    private router: Router
  ) {
    this.editRoleForm = this.fb.group({
      selectedUser: ['', Validators.required],
      selectedRole: ['', Validators.required]
    });
  }

  async ngOnInit(): Promise<void> {
    // Mostrar swal de carga
    Swal.fire({
      title: 'Cargando datos...',
      text: 'Por favor, espera un momento.',
      icon: 'info',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      // Traer usuarios
      const usuarios$ = this.utilityServiceService.traerUsuarios().toPromise();
      const roles$ = this.adminService.traerRoles().toPromise();

      // Esperar ambas peticiones
      const [usuarios, roles] = await Promise.all([usuarios$, roles$]);

      if (usuarios) {
        // Filtrar usuarios
        const filteredData = usuarios.filter((user: any) =>
          user.rol !== 'EMPRESA' &&
          user.rol !== 'TICKTOKER' &&
          //user.rol !== 'SIN-ASIGNAR' &&
          user.rol !== 'TRASLADOS'
        );

        // Ordenar por primer nombre
        filteredData.sort((a: any, b: any) => a.primer_nombre.localeCompare(b.primer_nombre));

        this.users = filteredData;
      }

      if (roles) {
        // Ordenar por Rol
        roles.sort((a: any, b: any) => a.Rol.localeCompare(b.Rol));
        this.roles = roles;
      }

      // Cerrar swal de carga al finalizar exitosamente
      Swal.close();
    } catch (error) {
      // Mostrar error con Swal
      Swal.fire({
        title: 'Error',
        text: 'No se pudieron cargar los datos.',
        icon: 'error'
      });
    }
  }

  onSubmit(): void {
    if (this.editRoleForm.valid) {
      const selectedUser = this.editRoleForm.value.selectedUser;
      const selectedRole = this.editRoleForm.value.selectedRole;

      Swal.fire({
        title: 'Confirmación',
        text: `¿Desea asignar el rol ${selectedRole.Rol} a ${selectedUser.primer_nombre} ${selectedUser.primer_apellido}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No'
      }).then(async (result) => {
        if (result.isConfirmed) {

          try {
            const response = await this.adminService.editarRol(selectedUser.numero_de_documento, selectedRole.Rol);

            if (response.message === 'error') {
              Swal.fire('Error!', 'Hubo un problema al asignar el rol, vuelva a intentarlo.', 'error');
              return;
            }
            else if (response.message === 'success') {
              Swal.fire('Editado!', 'El rol ha sido asignado.', 'success')
                .then(() => {
                  this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
                    this.router.navigate(["/dashboard/users/edit-role"]);
                  });
                });
            }

          } catch (error) {
            Swal.fire('Error!', 'Hubo un problema al asignar el rol.', 'error');
          }
        }
      });
    }
  }


  onUserChange(selectedUser: any): void {
    const userRole = selectedUser?.rol?.toLowerCase();
    const selectedRole = this.roles.find(role => role.Rol.toLowerCase() === userRole);
    this.editRoleForm.patchValue({ selectedRole: selectedRole || null });
  }
}
