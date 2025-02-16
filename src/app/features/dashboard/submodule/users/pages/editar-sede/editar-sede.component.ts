import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { AdminService } from '../../services/admin.service';
import { Router } from '@angular/router';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { SharedModule } from '../../../../../../shared/shared.module';

@Component({
  selector: 'app-editar-sede',
  imports: [SharedModule],
  templateUrl: './editar-sede.component.html',
  styleUrls: ['./editar-sede.component.css'],
})
export class EditarSedeComponent implements OnInit {
  editSedeForm: FormGroup;
  users: any[] = [];
  sedes: any[] = [];

  constructor(
    private fb: FormBuilder,
    private utilityServiceService: UtilityServiceService,
    private adminService: AdminService,
    private router: Router
  ) {
    this.editSedeForm = this.fb.group({
      selectedUser: ['', Validators.required],
      selectedSede: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      // Mostrar swal de carga
      Swal.fire({
        title: 'Cargando datos...',
        text: 'Por favor, espera un momento.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Traer usuarios y roles en paralelo
      const [usuarios, sedes] = await Promise.all([
        this.utilityServiceService.traerUsuarios().toPromise(),
        this.adminService.traerSucursales().toPromise(),
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
      if (sedes) {
        sedes.sucursal.sort((a: any, b: any) =>
          a.nombre.localeCompare(b.nombre)
        );
        this.sedes = sedes.sucursal;
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

  onSubmit(): void {
    if (this.editSedeForm.valid) {
      const selectedUser = this.editSedeForm.value.selectedUser;
      const selectedSede = this.editSedeForm.value.selectedSede;

      Swal.fire({
        title: 'Confirmación',
        text: `¿Desea asignar la sede ${selectedSede.nombre} a ${selectedUser.primer_nombre} ${selectedUser.primer_apellido}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No',
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            const response = await this.adminService.editarSede(
              selectedUser.numero_de_documento,
              selectedSede.nombre
            );

            if (response.message === 'error') {
              Swal.fire(
                'Error!',
                'Hubo un problema al asignar la sede, vuelva a intentarlo.',
                'error'
              );
              return;
            } else if (response.message === 'success') {
              Swal.fire(
                'Editado!',
                'La sede ha sido asignada.',
                'success'
              ).then(() => {
                this.router
                  .navigateByUrl('/home', { skipLocationChange: true })
                  .then(() => {
                    this.router.navigate(['/editar-sede']);
                  });
              });
            }
          } catch (error) {
            Swal.fire(
              'Error!',
              'Hubo un problema al asignar la sede.',
              'error'
            );
          }
        }
      });
    }
  }

  onUserChange(selectedUser: any): void {
    const userSede = selectedUser.sucursalde; // Assuming sucursalde is the name or id

    if (!userSede) {
      this.editSedeForm.patchValue({ selectedSede: null });
      return;
    }

    const selectedSede = this.sedes.find(
      (sede) => sede.nombre === userSede || sede.id === userSede
    );
    this.editSedeForm.patchValue({ selectedSede: selectedSede || null });
  }
}
