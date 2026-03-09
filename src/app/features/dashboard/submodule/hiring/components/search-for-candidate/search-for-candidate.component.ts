import { Component, OnDestroy, OnInit } from '@angular/core';
import { firstValueFrom, Subject, take } from 'rxjs';
import Swal from 'sweetalert2';
import { MatButtonModule } from '@angular/material/button';

import { VetadosService } from '../../service/vetados/vetados.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

import { EventEmitter, Output } from '@angular/core';
import { SharedModule } from '@/app/shared/shared.module';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';

@Component({
  selector: 'app-search-for-candidate',
  standalone: true,
  imports: [
    SharedModule,
    MatButtonModule
  ],
  templateUrl: './search-for-candidate.component.html',
  styleUrl: './search-for-candidate.component.css',
})
export class SearchForCandidateComponent implements OnInit, OnDestroy {
  readonly yesNoStatusConfig: Record<string, { color: string; background: string }> = {
    'Sí': { color: '#065f46', background: '#d1fae5' },
    'No': { color: '#991b1b', background: '#fee2e2' },
  };

  /* ──────────  Outputs  ────────── */
  @Output() codigoContratoChange = new EventEmitter<string>();
  @Output() cedulaSeleccionada = new EventEmitter<string>();
  @Output() nombreCompletoChange = new EventEmitter<string>();
  @Output() idInfoEntrevistaAndreaChange = new EventEmitter<number>();
  // objetos completos
  @Output() candidatoSeleccionado = new EventEmitter<any>();

  /* ──────────  Propiedades  ────────── */
  cedula = '';
  observacion = '';
  mostrarObservacion = false;
  procesoValido = false;
  datosSeleccion: any = null;
  sede = '';

  /* Propiedades eliminadas tabla vetados */
  showTable = false;
  filtroCedula: string = '';

  private destroyed$ = new Subject<void>();

  constructor(
    private vetadosService: VetadosService,
    private utilityService: UtilityServiceService,
    private registroProcesoContratacion: RegistroProcesoContratacion
  ) { }

  /* ──────────  Ciclo de vida  ────────── */
  async ngOnInit(): Promise<void> {
    await this.initUsuarioYAbreviacion();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private async initUsuarioYAbreviacion(): Promise<void> {
    try {
      const user: any = await this.utilityService.getUser();
      this.sede = user?.sede?.nombre ?? '';
    } catch {
      this.sede = '';
    }
  }

  buscarCandidato(): void {
    this.cedula = this.cedula.trim();

    this.registroProcesoContratacion.getCandidatoPorDocumento(this.cedula, true).pipe(take(1)).subscribe({
      next: (candidato) => {
        if (!candidato) {
          this.candidatoSeleccionado.emit(null);
          Swal.fire('No encontrado', 'No se encontró un candidato con esa cédula.', 'info');
          return;
        }
        this.candidatoSeleccionado.emit(candidato);
      },
      error: () => Swal.fire('Error', 'Error al buscar el candidato.', 'error')
    });
  }

  async buscarCedula(): Promise<void> {
    if (!this.cedula) return;

    this.cedulaSeleccionada.emit(this.cedula);

    try {
      const vetado = await firstValueFrom(
        this.vetadosService.listarReportesVetadosPorCedula(this.cedula).pipe(take(1))
      );
      this.procesarVetado(vetado);
    } catch {
      Swal.fire('Error', 'Error inesperado al consultar la cédula.', 'error');
    }
  }

  /* vetados */
  private procesarVetado(vetado: any[] | null): void {
    if (!vetado?.length) return;
    this.procesoValido = true;
  }

  /* ──────────  Observación  ────────── */
  mostrarCampoObservacion(): void {
    console.log('mostrarCampoObservacion()');
    this.mostrarObservacion = true;
  }

  enviarObservacion(): void {
    if (!this.observacion.trim()) {
      Swal.fire('Error', 'Debe escribir una observación.', 'error');
      return;
    }

    this.utilityService.getUser().then((u: any) => {
      if (!u) {
        Swal.fire('Error', 'No hay usuario en sesión', 'error');
        return;
      }

      const nombre = `${u?.datos_basicos?.nombres ?? ''} ${u?.datos_basicos?.apellidos ?? ''} - ${u?.rol?.nombre ?? ''}`.trim();
      const sedeNombre = u?.sede?.nombre ?? '';

      const reporte = {
        cedula: this.cedula,
        observacion: this.observacion.trim(),
        centro_costo_carnet: '',
        reportadoPor: nombre
      };

      this.vetadosService.enviarReporte(reporte, sedeNombre).pipe(take(1)).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Observación enviada.', 'success');
          this.mostrarObservacion = false;
          this.observacion = '';
        },
        error: () => Swal.fire('Error', 'No se pudo enviar la observación.', 'error')
      });
    });
  }
}
