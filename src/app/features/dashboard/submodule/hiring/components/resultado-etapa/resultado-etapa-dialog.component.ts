/**
 * Prompt de resultado de etapa (pasó / no pasó / no se presentó) como MatDialog.
 *
 * Antes esto era un SweetAlert. Abierto desde una página funcionaba, pero
 * abierto DESDE otro diálogo quedaba por detrás: Swal se cuelga de `body` y el
 * orden de pintado depende de z-index y stacking contexts que el CDK maneja con
 * capas (`@layer cdk-overlay`). Subir el z-index y montarlo dentro del overlay
 * no bastó en la app real.
 *
 * Con MatDialog el problema desaparece por diseño: cada diálogo abre su propio
 * pane en el mismo contenedor del CDK y, al agregarse después, queda encima del
 * que lo abrió. Es el mismo mecanismo que ya usa el resto de la app.
 *
 * Resultado y motivo van en UN solo paso: el motivo aparece cuando hace falta y
 * es obligatorio, así no se puede guardar un "no pasó" sin explicación.
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';

import type { EtapaConResultado, ResultadoEtapa, ResultadoEtapaPrevio } from './resultado-etapa.dialog';

export interface ResultadoEtapaDialogData {
  etapa: EtapaConResultado;
  previo: ResultadoEtapaPrevio;
  nombreCandidato?: string | null;
}

export interface ResultadoEtapaDialogResult {
  resultado: ResultadoEtapa;
  motivo: string;
}

const TEXTOS: Record<EtapaConResultado, {
  titulo: string;
  preguntaNoPaso: string;
  preguntaNoShow: string;
  ejemploNoShow: string;
}> = {
  prueba: {
    titulo: 'Resultado de la prueba técnica',
    preguntaNoPaso: '¿Por qué no pasó la prueba técnica?',
    preguntaNoShow: '¿Por qué no se presentó a la prueba técnica?',
    ejemploNoShow: 'Avisó que no podía, no contestó, se retiró del proceso...',
  },
  examen: {
    titulo: 'Resultado del examen médico',
    preguntaNoPaso: '¿Por qué no pasó el examen médico?',
    preguntaNoShow: '¿Por qué no se presentó al examen médico?',
    ejemploNoShow: 'No asistió a la cita, la reprogramó, se retiró del proceso...',
  },
};

@Component({
  selector: 'app-resultado-etapa-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatRadioModule,
  ],
  template: `
    <h2 mat-dialog-title class="re-titulo">{{ textos.titulo }}</h2>

    <mat-dialog-content class="re-body">
      @if (data.nombreCandidato) {
        <p class="re-candidato"><mat-icon>person</mat-icon>{{ data.nombreCandidato }}</p>
      }

      <mat-radio-group class="re-opciones" [ngModel]="resultado()" (ngModelChange)="resultado.set($event)">
        <mat-radio-button value="paso">Pasó</mat-radio-button>
        <mat-radio-button value="no_paso">No pasó</mat-radio-button>
        <mat-radio-button value="no_se_presento">No se presentó</mat-radio-button>
      </mat-radio-group>

      @if (pideMotivo()) {
        <mat-form-field appearance="outline" class="re-motivo">
          <mat-label>{{ etiquetaMotivo() }}</mat-label>
          <textarea matInput rows="3" [ngModel]="motivo()" (ngModelChange)="motivo.set($event)"
            [placeholder]="placeholderMotivo()"></textarea>
          @if (errorMotivo()) {
            <mat-hint class="re-error">{{ errorMotivo() }}</mat-hint>
          }
        </mat-form-field>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancelar()">Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="!puedeGuardar()" (click)="guardar()">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .re-titulo { font-size: 1.05rem; font-weight: 700; }
    .re-body { min-width: min(420px, 84vw); padding-top: 4px !important; }
    .re-candidato {
      display: flex; align-items: center; gap: 6px;
      margin: 0 0 10px; color: #64748b; font-size: .84rem;
    }
    .re-candidato .mat-icon { width: 17px; height: 17px; font-size: 17px; }
    .re-opciones { display: flex; flex-direction: column; gap: 2px; }
    .re-motivo { width: 100%; margin-top: 12px; }
    .re-error { color: #c62828; }
  `],
})
export class ResultadoEtapaDialogComponent {
  readonly textos: (typeof TEXTOS)[EtapaConResultado];

  readonly resultado = signal<ResultadoEtapa | ''>('');
  readonly motivo = signal('');
  /** Solo se muestra el error cuando ya se intentó guardar. */
  private readonly intentado = signal(false);

  readonly pideMotivo = computed(() => this.resultado() === 'no_paso' || this.resultado() === 'no_se_presento');

  readonly etiquetaMotivo = computed(() =>
    this.resultado() === 'no_se_presento' ? this.textos.preguntaNoShow : this.textos.preguntaNoPaso,
  );

  readonly placeholderMotivo = computed(() =>
    this.resultado() === 'no_se_presento' ? this.textos.ejemploNoShow : '',
  );

  readonly errorMotivo = computed(() => {
    if (!this.intentado() || !this.pideMotivo()) return '';
    const t = this.motivo().trim();
    if (!t) return 'El motivo es obligatorio.';
    if (t.length < 5) return 'Amplía un poco más el motivo (mínimo 5 caracteres).';
    return '';
  });

  readonly puedeGuardar = computed(() => {
    if (!this.resultado()) return false;
    if (!this.pideMotivo()) return true;
    return this.motivo().trim().length >= 5;
  });

  constructor(
    private readonly ref: MatDialogRef<ResultadoEtapaDialogComponent, ResultadoEtapaDialogResult | null>,
    @Inject(MAT_DIALOG_DATA) public readonly data: ResultadoEtapaDialogData,
  ) {
    this.textos = TEXTOS[data.etapa];
    const previo = data.previo ?? {};
    if (previo.resultado && previo.resultado !== 'sin_resultado') {
      this.resultado.set(previo.resultado);
      this.motivo.set(
        (previo.resultado === 'no_se_presento' ? previo.motivoNoSePresento : previo.motivoNoPaso) ?? '',
      );
    }
  }

  guardar(): void {
    this.intentado.set(true);
    if (!this.puedeGuardar()) return;
    this.ref.close({
      resultado: this.resultado() as ResultadoEtapa,
      motivo: this.pideMotivo() ? this.motivo().trim() : '',
    });
  }

  cancelar(): void {
    this.ref.close(null);
  }
}
