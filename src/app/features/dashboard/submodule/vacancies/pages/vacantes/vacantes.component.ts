import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { NgFor, NgForOf, NgIf } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { CrearEditarVacanteComponent } from '../../components/crear-editar-vacante/crear-editar-vacante.component';
import { MatMenuModule } from '@angular/material/menu';
import { catchError, of } from 'rxjs';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { SharedModule } from '@/app/shared/shared.module';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { NativeDateModule } from '@angular/material/core';
import { S } from 'node_modules/@angular/cdk/scrolling-module.d-ud2XrbF8';

@Component({
  selector: 'app-vacantes',
  standalone: true,
  imports: [
    SharedModule,
    MatTableModule,
    FormsModule,
    NgFor,
    NgForOf,
    MatMenuModule,
    MatPaginatorModule,
    MatSortModule,
    MatDatepickerModule,
    NativeDateModule,
  ],
  templateUrl: './vacantes.component.html',
  styleUrl: './vacantes.component.css'
})
export class VacantesComponent implements OnInit {
  vacantes: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'fechaPublicado',
    'cargo',
    'salario',
    'auxilioTransporte',
    'municipio',
    'tipoContratacion',
    'pruebaOContratacion',
    'observacionVacante',
    'finca',
    'temporal',
    'experiencia',
    'oficinas',
    'ruta',
    'fechadeIngreso',
    'acciones'
  ];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private dialog: MatDialog,
    private vacantesService: VacantesService,
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadData();


  }

  async loadData(): Promise<void> {
    this.vacantesService.listarVacantes().pipe(
      catchError((error) => {
        Swal.fire('Error', 'Ocurrió un error al cargar las vacantes', 'error');
        return of([]);
      })
    ).subscribe((response: any) => {
      console.log('Vacantes cargadas:', response);
      this.dataSource.data = response;

      // Asigna paginator y sort si están disponibles
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }


  openModalEdit(vacante?: any): void {

    const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
      minWidth: '80vw',
      data: vacante || null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {

        // Armar payload con los campos que espera Django
        const payload = {
          cargo: result.cargo,
          temporal: result.temporal,
          empresaUsuariaSolicita: result.empresaUsuariaSolicita,
          finca: result.finca,
          experiencia: result.experiencia,
          descripcion: result.descripcion,
          salario: Number(result.salario),
          codigoElite: result.codigoElite,
          observacionVacante: result.observacionVacante,
          fechadePruebatecnica: this.formatDate(result.fechadePruebatecnica) || null,
          horadePruebatecnica: result.presentaPruebaTecnica === 'Si' ? result.horadePruebatecnica : null,
          fechadeIngreso: this.formatDate(result.fechadeIngreso) || null,
          fechaPublicado: result.fechaPublicado || new Date().toISOString(),
          quienpublicolavacante: result.quienpublicolavacante || 'Sistema',
          estadovacante: result.estadovacante || 'Activa',
          oficinasQueContratan: result.oficinasQueContratan.map((o: any) => ({
            nombre: o.nombre,
            numeroDeGenteRequerida: o.numeroDeGenteRequerida,
            ruta: o.ruta
          }))
        };

        this.vacantesService.actualizarVacante(vacante?.id, payload).subscribe({
          next: async (response: any) => {
            await this.loadData();
            Swal.fire({
              title: '¡Vacante actualizada!',
              text: 'Los datos han sido guardados correctamente',
              icon: 'success',
              confirmButtonText: 'Aceptar'
            });
          },
          error: (error: any) => {
            Swal.fire({
              title: 'Error al guardar',
              text: error.message || 'Error desconocido al actualizar la vacante',
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }



  openModal(vacante?: any): void {
    const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
      minWidth: '80vw',
      data: vacante ? vacante : null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Formatear y limpiar campos
        const oficinas = Array.isArray(result.oficinasQueContratan) ? result.oficinasQueContratan : [];

        const payload = {
          cargo: result.cargo?.trim() || null,
          empresaUsuariaSolicita: result.empresaUsuariaSolicita?.trim() || null,
          finca: result.finca?.trim() || null,
          ubicacionPruebaTecnica: result.ubicacionPruebaTecnica?.trim() || null,
          experiencia: result.experiencia?.trim() || null,
          fechadePruebatecnica: result.fechadePruebatecnica ? this.formatDate(result.fechadePruebatecnica) : null,
          horadePruebatecnica: result.horadePruebatecnica?.trim() || null,
          observacionVacante: result.observacionVacante?.trim() || null,
          fechadeIngreso: result.fechadeIngreso ? this.formatDate(result.fechadeIngreso) : null,
          temporal: result.temporal?.trim() || null,
          descripcion: result.descripcion?.trim() || null,
          fechaPublicado: this.formatDate(new Date()),
          quienpublicolavacante: result.quienpublicolavacante?.trim() || "Usuario Logueado",
          estadovacante: result.estadovacante?.trim() || "Activa",
          salario: Number(result.salario) || 0,
          codigoElite: result.codigoElite?.trim() || null,
          oficinasQueContratan: oficinas.map((oficina: any) => ({
            nombre: oficina.nombre?.trim() || '',
            numeroDeGenteRequerida: Number(oficina.numeroDeGenteRequerida) || 1,
            ruta: !!oficina.ruta // true/false
          })),
          pruebaOContratacion: result.pruebaOContratacion?.trim() || null,
          tipoContratacion: result.tipoContratacion?.trim() || null,
          municipio: Array.isArray(result.municipio) ? result.municipio : [],
          auxilioTransporte: Number(result.auxilioTransporte) || 0,
        };

        // Enviar a API
        this.vacantesService.enviarVacante(payload).subscribe({
          next: async (response) => {
            await this.loadData();
            Swal.fire({
              title: '¡Éxito!',
              text: 'La vacante ha sido enviada correctamente',
              icon: 'success',
              confirmButtonText: 'Aceptar'
            });
          },
          error: (error) => {
            Swal.fire({
              title: 'Error',
              text: `Hubo un problema al enviar la vacante: ${error.message || 'Error desconocido'}`,
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }



  formatDate(date: Date | string | null): string | null {
    if (!date) return null; // Si la fecha es nula, devolver null
    const d = new Date(date);

    // Extraer día, mes y año
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0'); // getMonth() empieza en 0
    const year = d.getFullYear();

    return `${year}-${month}-${day}`; // Formato YYYY-MM-DD
  }




  // Método para eliminar una vacante
  eliminarVacante(vacante: any): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "No podrás revertir esto",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar'
    }).then(result => {
      if (result.isConfirmed) {
        this.vacantesService.eliminarVacante(vacante.id).subscribe(() => {
          this.vacantes = this.vacantes.filter(v => v.id !== vacante.id);
          Swal.fire('Eliminado!', 'La vacante ha sido eliminada.', 'success');
        });
      }
    });
  }


  // Función para escoger una vacante y almacenarla en LocalStorage
  escogerVacante(vacante: any): void {
    // Almacenar la vacante seleccionada en LocalStorage
    localStorage.setItem('vacanteSeleccionada', JSON.stringify(vacante));
    Swal.fire('Vacante seleccionada', 'La vacante ha sido almacenada para ejecutarla en su proceso de seleccion', 'success');
  }




  // ------------------ Métodos para exportar a Excel ------------------

  // Función para manejar la subida del archivo Excel
  subirArchivoExcel(event: any): void {
    // Dispara el input oculto para seleccionar archivo
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.click();
  }

  // Función para manejar la selección del archivo Excel
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Suponemos que el primer sheet contiene los datos
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convertir el Excel a JSON
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Excluir la primera fila (encabezados) y procesar el resto
        const datosProcesados = this.procesarDatosExcel(jsonData);
        // Llamar al servicio para subir los datos
        this.enviarDatosExcel(datosProcesados);
      };

      reader.readAsArrayBuffer(file);
    }

    // Reiniciar el input para permitir la selección de un nuevo archivo
    event.target.value = '';
  }

  // Función para procesar los datos del Excel
  procesarDatosExcel(jsonData: any[]): any[] {
    const datosProcesados = [];

    // Iterar sobre las filas, comenzando en la segunda (índice 1) para omitir los encabezados
    for (let i = 1; i < jsonData.length; i++) {
      const fila = jsonData[i];

      if (fila && fila.length > 0) {
        const vacante = {
          empresa_temporal: fila[0] || '',
          empresa_usuaria: fila[1] || '',
          centro_costo_carnet: fila[2] || '',
          empresa_usuaria_centro_costo: fila[3] || '',
          ciudad: fila[4] || '',
          telefono_encargado: fila[5] || '',
          sublabor: fila[6] || '',
          categoria: fila[7] || '',
          ccostos: fila[8] || '',
          subcentro: fila[9] || '',
          grupo: fila[10] || '',
          operacion: fila[11] || '',
          salario: fila[12] || 0,
          auxilio_transporte: fila[13] || '',
          ruta: fila[14] || '',
          valor_transporte: fila[15] || 0,
          horas_extras: fila[16] || 0,
          porcentaje_arl: fila[17] || 0
        };

        datosProcesados.push(vacante);
      }
    }
    return datosProcesados;
  }


  // Función para enviar los datos procesados al backend
  enviarDatosExcel(datos: any[]): void {
    this.vacantesService.crearDetalleLaboral(datos).subscribe(
      (response: any) => {
        Swal.fire('Éxito', 'Datos subidos correctamente', 'success');
        this.loadData();
      },
      (error: any) => {
        Swal.fire('Error', 'Ocurrió un error al subir los datos', 'error');
      }
    );
  }

  getSiglaTemporal(temporal: string): string {
    switch (temporal) {
      case 'TU ALIANZA SAS':
        return 'TA';
      case 'APOYO LABORAL SAS':
        return 'AL';
      default:
        return temporal;
    }
  }


}
