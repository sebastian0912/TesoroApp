import { Component, OnInit, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { SharedModule } from '../../../../../../shared/shared.module';
import { SearchForCandidateComponent } from '../../components/search-for-candidate/search-for-candidate.component';
import { SelectionQuestionsComponent } from '../../components/selection-questions/selection-questions.component';
import { FormsModule } from '@angular/forms';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { catchError, of } from 'rxjs';
import Swal from 'sweetalert2';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { HelpInformationComponent } from '../../components/help-information/help-information.component';
import { MatTableDataSource } from '@angular/material/table';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-recruitment-pipeline',
  imports: [
    MatIconModule,
    MatTabsModule,
    SharedModule,
    FormsModule,
    SearchForCandidateComponent,
    SelectionQuestionsComponent,
    HelpInformationComponent
  ],
  templateUrl: './recruitment-pipeline.component.html',
  styleUrl: './recruitment-pipeline.component.css'
})

export class RecruitmentPipelineComponent implements OnInit {
  cedulaActual = '';
  codigoContrato = '';
  filtro = '';
  vacantes: any[] = [];
  idvacante = '';
  // Añadir dentro de la clase RecruitmentPipelineComponent
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'cargo',
    'finca',
    'empresaUsuariaSolicita',
    'experiencia',
    'fechaPublicado',
    'acciones'
  ];

  @ViewChild(SelectionQuestionsComponent)
  selectionQuestionsComponent!: SelectionQuestionsComponent;

  @ViewChild(HelpInformationComponent)
  helpInformationComponent!: HelpInformationComponent;

  constructor(
    private vacantesService: VacantesService,
    private utilityService: UtilityServiceService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.vacantesService.listarVacantes().pipe(
      catchError((error) => {
        Swal.fire('Error', 'Ocurrió un error al cargar las vacantes', 'error');
        return of([]);
      })
    ).subscribe((response: any[]) => {
      if (!response || response.length === 0) {
        Swal.fire('Error', 'No se encontraron vacantes', 'error');
        return;
      }

      const user = this.utilityService.getUser();
      if (!user) {
        Swal.fire('Error', 'No se encontró información del usuario', 'error');
        return;
      }

      const sedeLoginLower = user.sucursalde?.toLowerCase?.() || '';

      this.vacantes = response.filter(vacante =>
        Array.isArray(vacante.oficinasQueContratan) &&
        vacante.oficinasQueContratan.some((oficina: { nombre: string; }) =>
          oficina.nombre?.toLowerCase() === sedeLoginLower
        )
      );
      this.dataSource.data = this.vacantes;
    });
  }

  filtrarVacantes(): any[] {
    if (!this.filtro) return this.vacantes;
    const filtroLower = this.filtro.toLowerCase();

    return this.vacantes.filter(vacante =>
      [
        vacante.cargo,
        vacante.finca,
        vacante.empresaUsuariaSolicita,
        vacante.temporal
      ]
        .some(field => field?.toLowerCase?.().includes(filtroLower))
    );
  }

  escogerVacante(vacante: any): void {
    Swal.fire(
      'Vacante seleccionada',
      'La vacante ha sido almacenada para ejecutarla en su proceso de selección',
      'success'
    );

    if (vacante) {
      this.idvacante = vacante.id;

      this.selectionQuestionsComponent?.recibirVacante(vacante);
      this.helpInformationComponent?.recibirVacante(vacante);
    }
  }

  onCedulaSeleccionada(cedula: string): void {
    this.cedulaActual = cedula;
    console.log('📩 Cédula recibida del hijo:', this.cedulaActual);
  }

  onCodigoContrato(codigo: string): void {
    this.codigoContrato = codigo;
    console.log('📩 Código de contrato recibido del hijo:', this.codigoContrato);
  }

  // Este método se llama desde el input en la plantilla HTML
  applyFilterManual(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }
}
