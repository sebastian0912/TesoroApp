import { SharedModule } from '@/app/shared/shared.module';
import { Component, effect, EventEmitter, input, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { HiringService } from '../../service/hiring.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { Observable, firstValueFrom, forkJoin, map, of, startWith } from 'rxjs';
import { arregloDeCentroDeCostos as CENTROS_COSTO } from '@/app/shared/model/models';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';


@Component({
  selector: 'app-hiring-questions',
  imports: [
    SharedModule,
    MatTabsModule
  ],
  templateUrl: './hiring-questions.component.html',
  styleUrl: './hiring-questions.component.css'
})

export class HiringQuestionsComponent implements OnInit {
  // ✅ Inputs como signals
  cedula = input<string>('');
  codigoContrato = input<string>('');
  idInfoEntrevistaAndrea = input<any>(null); // id info entrevista
  idVacantes = input<any>(null);             // id de la vacante (para actualizar estado)

  private _ready = false;
  private _prev = {
    cedula: undefined as string | undefined,
    codigoContrato: undefined as string | undefined,
    idInfoEntrevistaAndrea: undefined as any,
    idVacantes: undefined as any,
  };

  constructor() {
    // Un único effect que observa todos los inputs y loguea cambios individuales
    effect(() => {
      const c = this.cedula();
      const cc = this.codigoContrato();
      const idInfo = this.idInfoEntrevistaAndrea();
      const idVac = this.idVacantes();

      if (this._ready) {
        if (c !== this._prev.cedula) {
          console.log('[HiringQuestions] cedula cambió:', this._prev.cedula, '→', c);
        }
        if (cc !== this._prev.codigoContrato) {
          console.log('[HiringQuestions] codigoContrato cambió:', this._prev.codigoContrato, '→', cc);
        }
        if (idInfo !== this._prev.idInfoEntrevistaAndrea) {
          console.log('[HiringQuestions] idInfoEntrevistaAndrea cambió:', this._prev.idInfoEntrevistaAndrea, '→', idInfo);
        }
        if (idVac !== this._prev.idVacantes) {
          console.log('[HiringQuestions] idVacantes cambió:', this._prev.idVacantes, '→', idVac);
        }
      }

      // Actualiza snapshot y dispara tu handler
      this._prev = {
        cedula: c,
        codigoContrato: cc,
        idInfoEntrevistaAndrea: idInfo,
        idVacantes: idVac,
      };
      this.onInputsChanged(c, cc, idInfo, idVac);
    });
  }

  ngOnInit(): void {
    // Desde aquí, futuros cambios se loguearán
    this._ready = true;
  }

  private onInputsChanged(
    cedula: string,
    codigoContrato: string,
    idInfoEntrevistaAndrea: any,
    idVacantes: any
  ) {
    // Aquí tu lógica de reacción a cambios (llamadas a servicios, resets, etc.)
    // console.log('onInputsChanged', { cedula, codigoContrato, idInfoEntrevistaAndrea, idVacantes });
  }
}
