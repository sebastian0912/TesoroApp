import { SharedModule } from '@/app/shared/shared.module';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { VetadosService } from '../../service/vetados/vetados.service';
import { AutorizarVetadoComponent } from '../../components/autorizar-vetado/autorizar-vetado.component';

@Component({
  selector: 'app-banned-management',
  imports: [
    SharedModule
  ],
  templateUrl: './banned-management.component.html',
  styleUrl: './banned-management.component.css'
})
export class BannedManagementComponent implements OnInit{

  // Columnas para la primera tabla de reportados
  displayedColumns: string[] = ['cedula', 'nombre_completo', 'estado', 'fecha', 'observacion', 'centro_costo_carnet', 'reportado_por', 'sede', 'acciones'];

  // Columnas para la segunda tabla de todos los vetados
  todosDisplayedColumns: string[] = ['cedula', 'nombre_completo', 'categoriaid', 'categoria_clasificacion', 'categoria_descripcion' , 'estado', 'fecha', 'observacion', 'reportado_por', 'sede', 'autorizado_por'];

  // Fuentes de datos para ambas tablas
  reportadosDataSource = new MatTableDataSource<any>([]);
  todosDataSource = new MatTableDataSource<any>([]);

  constructor(
    private vetadosService: VetadosService,
    public dialog: MatDialog
  ) { }

  ngOnInit() {
    this.getVetados();
  }

  isSidebarHidden = false;

  toggleSidebar() {
    this.isSidebarHidden = !this.isSidebarHidden;
  }

  // Obtener los datos de los vetados
  getVetados() {
    this.vetadosService.listarReportesVetados().subscribe((data: any) => {
      // Separar los datos de reportados y todos los vetados
      this.reportadosDataSource.data = data.reportados;  // Solo los reportados
      this.todosDataSource.data = data.revisados;  // Todos los vetados (reportados + revisados)
    });
  }

  // Aplicar filtro a la tabla de reportados
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.reportadosDataSource.filter = filterValue.trim().toLowerCase();
  }

  // Aplicar filtro a la tabla de todos los vetados
  applyFilterTodos(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.todosDataSource.filter = filterValue.trim().toLowerCase();
  }


  // Función para ver los detalles del elemento
  verDetalle(element: any) {
    const dialogRef = this.dialog.open(AutorizarVetadoComponent, {
      minWidth: '850px',
      data: { element }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        (await this.vetadosService.actualizarReporte(element, result)).subscribe((data: any) => {
          this.getVetados();
        });
      }
    });

  }

  // Función para eliminar el registro (por ahora solo imprime)
  eliminar(element: any) {
    this.vetadosService.eliminarReporte(element.id).subscribe((data: any) => {
      this.getVetados();
    });
  }


}
