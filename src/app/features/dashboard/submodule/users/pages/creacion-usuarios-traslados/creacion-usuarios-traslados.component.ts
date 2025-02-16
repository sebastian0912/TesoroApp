import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import Swal from 'sweetalert2';
import { debounceTime } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { Router } from '@angular/router';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { LoginService } from '../../../../../auth/service/login.service';
import { SharedModule } from '../../../../../../shared/shared.module';


@Component({
  selector: 'app-creacion-usuarios-traslados',
  imports: [
    SharedModule
  ],
  templateUrl: './creacion-usuarios-traslados.component.html',
  styleUrls: ['./creacion-usuarios-traslados.component.css']
})
export class CreacionUsuariosTrasladosComponent implements OnInit {
  myForm!: FormGroup;
  users: any[] = [];
  userTraslados: any[] = [];
  filteredUsers: any[][] = [];

  constructor(
    private fb: FormBuilder,
    private utilityServiceService: UtilityServiceService,
    private loginService: LoginService,
    private router: Router
  ) { }

  ngOnInit() {
    try {
      // Mostrar el Swal de carga
      Swal.fire({
        title: 'Cargando...',
        icon: 'info',
        text: 'Por favor, espere mientras se cargan los datos',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      this.myForm = this.fb.group({
        numUsuarios: [0, [Validators.required, Validators.min(0)]],
        usuarios: this.fb.array([this.createUserGroup()])
      });

      // Aplica el filtro al primer elemento del array
      this.filteredUsers.push(this.users.slice());
      this.addUserFilter(0);

      this.utilityServiceService.traerUsuarios().subscribe({
        next: (usuarios: any) => {
          try {
            if (!usuarios) {
              return;
            }

            this.userTraslados = usuarios.filter((usuario: { rol: string }) => usuario.rol === 'TRASLADOS');

            const trasladosDocumentNumbers = this.userTraslados.map((usuario: { numero_de_documento: string }) =>
              usuario.numero_de_documento.substring(1)
            );

            this.users = usuarios.filter((usuario: { rol: string }) =>
              usuario.rol !== 'TRASLADOS' && usuario.rol !== 'EMPRESA' && usuario.rol !== 'TICKTOKER'
            );

            this.users = this.users.filter((usuario: { numero_de_documento: string }) =>
              !trasladosDocumentNumbers.includes(usuario.numero_de_documento)
            );

            this.onNumUsuariosChange();
          } catch (error) {
            Swal.fire('Error', 'Ocurrió un error al procesar los datos.', 'error');
          } finally {
            // Cerrar el Swal de carga cuando se complete el proceso
            Swal.close();
          }
        },
        error: (err) => {
          Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
          Swal.close();
        }
      });
    } catch (error) {
      Swal.fire('Error', 'Ocurrió un problema al inicializar la aplicación.', 'error');
      Swal.close();
    }
  }


  get usuarios() {
    return this.myForm.get('usuarios') as FormArray;
  }

  createUserGroup(): FormGroup {
    return this.fb.group({
      usuario: ['']
    });
  }

  isSidebarHidden = false;

  toggleSidebar() {
    this.isSidebarHidden = !this.isSidebarHidden;
  }

  onNumUsuariosChange() {
    let numUsuarios = this.myForm.get('numUsuarios')?.value || 0;
    numUsuarios++;
    if (numUsuarios < 1) {
      this.myForm.get('numUsuarios')?.setValue(1);
      return;
    }
    while (this.usuarios.length < numUsuarios) {
      this.usuarios.push(this.createUserGroup());
      this.filteredUsers.push(this.users.slice());
      this.addUserFilter(this.usuarios.length - 1);  // Agrega el filtro para cada nuevo elemento
    }
    while (this.usuarios.length > numUsuarios) {
      this.usuarios.removeAt(this.usuarios.length - 1);
      this.filteredUsers.pop();
    }
  }

  addUserFilter(index: number) {
    this.usuarios.at(index).get('usuario')!.valueChanges
      .pipe(debounceTime(300))
      .subscribe(value => {
        if (typeof value === 'string') {
          this.filteredUsers[index] = this._filterUsers(value);
        } else {
          this.filteredUsers[index] = this.users.slice();
        }
      });
  }

  private _filterUsers(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.users.filter(user =>
      `${user.primer_nombre} ${user.primer_apellido}`.toLowerCase().includes(filterValue));
  }

  displayUser(user: any): string {
    return user ? `${user.primer_nombre} ${user.primer_apellido}` : '';
  }

  allUsersValid(): boolean {
    for (let i = 0; i < this.usuarios.length - 1; i++) {
      if (this.usuarios.at(i).invalid) {
        return false;
      }
    }
    return true;
  }

  async onSubmit() {
    if (this.myForm.invalid || !this.allUsersValid()) {
      this.myForm.markAllAsTouched();
      return;
    }

    // Mostrar el Swal de carga
    Swal.fire({
      title: 'Creando usuarios...',
      icon: 'info',
      text: 'Por favor, espere mientras se crean los usuarios y se genera el archivo Excel',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    let nombresResponsables: any[] = [];
    let datosUsuarios = [];
    let totalUsuarios = this.myForm.get('numUsuarios')!.value;

    const maxNumero = this.userTraslados.length;

    for (let i = 0; i < totalUsuarios; i++) {
      const userIndex = i + maxNumero;
      const user = this.myForm.get(`usuarios.${i}.usuario`)!.value;

      const usuario = {
        correo_electronico: `traslados${userIndex + 1}@gmail.com`,
        password: 'Ll4v42024#$',
        primer_nombre: user.primer_nombre || '-',
        segundo_nombre: user.segundo_nombre || '',
        primer_apellido: user.primer_apellido || '-',
        segundo_apellido: (user.segundo_apellido || '') + ' TRASLADOS',
        numero_de_documento: 'T' + user.numero_de_documento,
        avatar: user.avatar || '',
        rol: "TRASLADOS",
        username: `traslados${userIndex + 1}@gmail.com`,
      };

      const usuarioCorreo = {
        nombre: `${user.primer_nombre} ${user.segundo_nombre} ${user.primer_apellido} ${user.segundo_apellido}`,
        correo_electronico: `traslados${userIndex + 1}@gmail.com`,
        password: 'Ll4v42024#$',
        error: ''
      };

      try {
        const response = await this.loginService.register(usuario);
        if (response.error) {
          usuarioCorreo.error = response.error;
        }
        datosUsuarios.push(usuarioCorreo);
        nombresResponsables.push({
          nombre: `${usuario.primer_nombre} ${usuario.primer_apellido}`,
          correo_electronico: usuario.correo_electronico,
          password: usuario.password
        });

      } catch (error) {
        usuarioCorreo.error = 'Error al crear usuario';
        datosUsuarios.push(usuarioCorreo);
      }

      await this.sleep(1000); // Esperar 1 segundo
    }

    // Cerrar el Swal de carga y mostrar el de éxito
    Swal.close();

    Swal.fire(
      'Usuarios creados',
      'Los usuarios han sido creados correctamente',
      'success'
    ).then(() => {
      this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
        this.router.navigate(["/dashboard/users/create-transfer-user"]);
      });
    });

    this.exportToExcel(nombresResponsables);
  }


  exportToExcel(nombresResponsables: any[]) {
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(nombresResponsables);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    XLSX.writeFile(workbook, 'UsuariosResponsables.xlsx');
  }



  sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }




}



