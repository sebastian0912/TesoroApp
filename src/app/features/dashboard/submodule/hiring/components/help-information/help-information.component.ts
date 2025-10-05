import { SharedModule } from '@/app/shared/shared.module';
import { Component, EventEmitter, Input, LOCALE_ID, OnInit, OnChanges, Output, SimpleChanges, effect, input } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormArray } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

export const MY_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY'
  }
};

// Interfaces útiles
interface OficinaDTO { nombre: string; numeroDeGenteRequerida: number; ruta: boolean; }

interface PublicacionDTO {
  id: number;
  cargo: string;
  oficinasQueContratan: OficinaDTO[];
  empresaUsuariaSolicita: string;
  finca: string | null;
  ubicacionPruebaTecnica: string | null;
  experiencia: string | null;
  fechadePruebatecnica: string | null;
  horadePruebatecnica: string | null;
  observacionVacante: string | null;
  fechadeIngreso: string | null;
  temporal: string | null;
  descripcion: string | null;
  fechaPublicado: string;
  quienpublicolavacante: string | null;
  estadovacante: string | null;
  salario: string | null;
  codigoElite: string | null;
  area: string | null;
  pruebaOContratacion: string | null;
  tipoContratacion: string | null;
  municipio: string[] | null;
  auxilioTransporte: string | null;
}

@Component({
  selector: 'app-help-information',
  imports: [
    SharedModule,
    MatTabsModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './help-information.component.html',
  styleUrl: './help-information.component.css',
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ]
})
export class HelpInformationComponent implements OnInit {
  // ✅ Inputs como signals
  cedula = input<string>('');
  vacanteSeleccionadaId = input<any>(null);
  idProcesoSeleccion = input<number | null>(null);
  idInfoEntrevistaAndrea = input<number | null>(null);

  // control de logging para evitar loguear en el primer render
  private _ready = false;
  private _prev = {
    cedula: undefined as string | undefined,
    vacanteSeleccionadaId: undefined as any,
    idProcesoSeleccion: undefined as number | null | undefined,
    idInfoEntrevistaAndrea: undefined as number | null | undefined,
  };

  constructor() {
    // Un único effect reacciona a todos los inputs
    effect(() => {
      const c = this.cedula();
      const v = this.vacanteSeleccionadaId();
      const idP = this.idProcesoSeleccion();
      const idInfo = this.idInfoEntrevistaAndrea();

      if (this._ready) {
        if (c !== this._prev.cedula) {
          console.log('[HelpInformation] cedula cambió:', this._prev.cedula, '→', c);
        }
        if (v !== this._prev.vacanteSeleccionadaId) {
          console.log('[HelpInformation] vacanteSeleccionadaId cambió:', this._prev.vacanteSeleccionadaId, '→', v);
        }
        if (idP !== this._prev.idProcesoSeleccion) {
          console.log('[HelpInformation] idProcesoSeleccion cambió:', this._prev.idProcesoSeleccion, '→', idP);
        }
        if (idInfo !== this._prev.idInfoEntrevistaAndrea) {
          console.log('[HelpInformation] idInfoEntrevistaAndrea cambió:', this._prev.idInfoEntrevistaAndrea, '→', idInfo);
        }
      }

      // actualiza snapshot previo y dispara tu manejo
      this._prev = {
        cedula: c,
        vacanteSeleccionadaId: v,
        idProcesoSeleccion: idP,
        idInfoEntrevistaAndrea: idInfo,
      };
      this.onInputsChanged(c, v, idP, idInfo);
    });
  }

  ngOnInit(): void {
    // a partir de aquí sí se loguean futuros cambios
    this._ready = true;
  }

  // Tu handler central cuando cambie cualquier input
  private onInputsChanged(
    cedula: string,
    vacanteSeleccionadaId: any,
    idProcesoSeleccion: number | null,
    idInfoEntrevistaAndrea: number | null
  ) {
    // Aquí puedes refrescar datos, llamar servicios, etc.
    // console.log('onInputsChanged', { cedula, vacanteSeleccionadaId, idProcesoSeleccion, idInfoEntrevistaAndrea });
  }
}
