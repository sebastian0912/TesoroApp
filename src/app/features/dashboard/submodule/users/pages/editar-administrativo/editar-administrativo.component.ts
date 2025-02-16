import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { Router } from '@angular/router';
import { SharedModule } from '../../../../../../shared/shared.module';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-editar-administrativo',
  imports: [SharedModule],
  templateUrl: './editar-administrativo.component.html',
  styleUrls: ['./editar-administrativo.component.css'],
})
export class EditarAdministrativoComponent implements OnInit {
  users: any[] = [];
  roles: any[] = [];
  editAdministrativoForm: FormGroup;
  hidePassword = true;
  cedula: string = '';

  constructor(
    private fb: FormBuilder,
    private utilityServiceService: UtilityServiceService,
    private adminService: AdminService,
    private router: Router
  ) {
    this.editAdministrativoForm = this.fb.group({
      correo_electronico: ['', Validators.required],
      primer_nombre: ['', Validators.required],
      segundo_nombre: [''],
      primer_apellido: ['', Validators.required],
      segundo_apellido: [''],
      nueva_contraseña: [''],
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      // Mostrar swal de carga
      Swal.fire({
        title: 'Cargando datos...',
        text: 'Por favor, espera un momento.',
        allowOutsideClick: false,
        icon: 'info',
        didOpen: () => {
          Swal.showLoading();
        },
      });
      // Traer usuarios y roles en paralelo
      const [usuarios, roles] = await Promise.all([
        this.utilityServiceService.traerUsuarios().toPromise(),
        this.adminService.traerRoles().toPromise(),
      ]);

      // Procesar usuarios si existen
      if (usuarios) {
        this.users = usuarios
          .filter(
            (user: any) =>
              user.rol !== 'EMPRESA' &&
              user.rol !== 'TICKTOKER' &&
              // user.rol !== 'SIN-ASIGNAR' &&
              user.rol !== 'TRASLADOS'
          )
          .sort((a: any, b: any) =>
            a.primer_nombre.localeCompare(b.primer_nombre)
          );
      }
      // Procesar roles si existen
      if (roles) {
        this.roles = roles.sort((a: any, b: any) => a.Rol.localeCompare(b.Rol));
      }
      // Cerrar swal de carga al finalizar exitosamente
      Swal.close();
    } catch (error) {
      // Mostrar error con Swal
      Swal.fire({
        title: 'Error',
        text: 'No se pudieron cargar los datos. Inténtalo de nuevo.',
        icon: 'error',
      });
    }
  }

  onEmailChange(email: string): void {
    const selectedUser = this.users.find(
      (user) => user.correo_electronico === email
    );
    this.cedula = selectedUser.numero_de_documento;
    if (selectedUser) {
      this.editAdministrativoForm.patchValue({
        primer_nombre: selectedUser.primer_nombre,
        segundo_nombre: selectedUser.segundo_nombre,
        primer_apellido: selectedUser.primer_apellido,
        segundo_apellido: selectedUser.segundo_apellido,
      });
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  onSubmit(): void {
    if (this.editAdministrativoForm.valid) {
      const formData = this.editAdministrativoForm.value;

      Swal.fire({
        title: 'Confirmación',
        text: `¿Desea editar los datos de ${formData.primer_nombre} ${formData.primer_apellido}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No',
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            const response =
              await this.adminService.reAsignarCorreoAdministrativo(
                formData.primer_nombre,
                formData.segundo_nombre,
                formData.primer_apellido,
                formData.segundo_apellido,
                formData.nueva_contraseña,
                formData.correo_electronico,
                this.cedula
              );

            if (response.message === 'error') {
              Swal.fire(
                'Error!',
                'Hubo un problema al editar los datos, vuelva a intentarlo.',
                'error'
              );
            } else if (response.message === 'success') {
              Swal.fire(
                'Editado!',
                'Los datos han sido actualizados.',
                'success'
              ).then(() => {
                this.router
                  .navigateByUrl('/home', { skipLocationChange: true })
                  .then(() => {
                    this.router.navigate(['/editar-administrativo']);
                  });
              });
            }
          } catch (error) {
            Swal.fire(
              'Error!',
              'Hubo un problema al editar los datos.',
              'error'
            );
          }
        }
      });
    }
  }
}
