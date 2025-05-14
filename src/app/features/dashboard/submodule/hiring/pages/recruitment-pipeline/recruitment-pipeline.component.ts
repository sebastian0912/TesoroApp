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
  cedulaActual: string = '';
  codigoContrato: string = '';
  filtro: string = '';
  vacantes: any[] = [];
  idvacante: string = '';
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
    ).subscribe((response: any) => {
      if (!response) {
        Swal.fire('Error', 'No se encontraron vacantes', 'error');
        return;
      }

      const user = this.utilityService.getUser();
      if (!user) {
        Swal.fire('Error', 'No se encontró información del usuario', 'error');
        return;
      }

      const sedeLoginLower = user.sucursalde.toLowerCase();

      this.vacantes = response.filter((vacante: any) => {
        if (!vacante.oficinasQueContratan || !Array.isArray(vacante.oficinasQueContratan)) {
          return false;
        }

        return vacante.oficinasQueContratan.some((oficina: any) =>
          oficina.nombre.toLowerCase() === sedeLoginLower
        );
      });
    });
  }


  filtrarVacantes() {
    if (!this.filtro) return this.vacantes;
    const filtroLower = this.filtro.toLowerCase();
    return this.vacantes.filter(vacante =>
      ['Cargovacante_id', 'localizacionDeLaPersona', 'empresaQueSolicita_id']
        .some(key => vacante[key]?.toLowerCase().includes(filtroLower))
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

      if (this.selectionQuestionsComponent) {
        this.selectionQuestionsComponent.recibirVacante(vacante);
      }

      if (this.helpInformationComponent) {
        this.helpInformationComponent.recibirVacante(vacante);
      }
    }
  }




  onCedulaSeleccionada(cedula: string) {
    this.cedulaActual = cedula;
    console.log('Cédula recibida del hijo:', this.cedulaActual);
  }

  onCodigoContrato(codigo: string): void {
    this.codigoContrato = codigo;
    console.log('Código de contrato recibido del hijo:', codigo);
  }
}
