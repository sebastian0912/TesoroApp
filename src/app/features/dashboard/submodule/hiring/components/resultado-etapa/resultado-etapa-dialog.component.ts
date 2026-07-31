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
    MatFormFieldModule, MatIconModule, MatInputModule,
  ],
  template: `
    <div class="re-wrap">
      <header class="re-head">
        <span class="re-head-ic"><mat-icon>{{ data.etapa === 'examen' ? 'medical_information' : 'assignment_ind' }}</mat-icon></span>
        <div class="re-head-txt">
          <h2>{{ textos.titulo }}</h2>
          @if (data.nombreCandidato) {
            <p>{{ data.nombreCandidato }}</p>
          }
        </div>
      </header>

      <mat-dialog-content class="re-body">
        <!-- Tarjetas en vez de radios: el color y el icono dicen el resultado
             de un vistazo y el área de click es toda la fila. -->
        <div class="re-opciones" role="radiogroup">
          @for (o of opciones; track o.valor) {
            <button type="button" class="re-op re-op-{{ o.tono }}"
              role="radio" [attr.aria-checked]="resultado() === o.valor"
              [class.activa]="resultado() === o.valor"
              (click)="elegir(o.valor)">
              <span class="re-op-ic"><mat-icon>{{ o.icono }}</mat-icon></span>
              <span class="re-op-txt">
                <span class="re-op-tit">{{ o.titulo }}</span>
                <span class="re-op-sub">{{ o.sub }}</span>
              </span>
              <mat-icon class="re-op-check">{{ resultado() === o.valor ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
            </button>
          }
        </div>

        @if (pideMotivo()) {
          <div class="re-motivo-box">
            <mat-form-field appearance="outline" class="re-motivo">
              <mat-label>{{ etiquetaMotivo() }}</mat-label>
              <textarea matInput rows="3" [ngModel]="motivo()" (ngModelChange)="motivo.set($event)"
                [placeholder]="placeholderMotivo()" maxlength="500"></textarea>
              <mat-hint [class.re-error]="!!errorMotivo()">
                {{ errorMotivo() || 'Queda registrado en el historial del candidato.' }}
              </mat-hint>
            </mat-form-field>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions class="re-actions">
        <button mat-button (click)="cancelar()">Cancelar</button>
        <span class="re-spacer"></span>
        <button mat-flat-button class="re-guardar" [disabled]="!puedeGuardar()" (click)="guardar()">
          <mat-icon>save</mat-icon> Guardar
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      --azul: #21263c;
      --ok: #2e7d32;
      --mal: #c62828;
      --noshow: #ef6c00;
      --linea: #e2e8f0;
      --muted: #64748b;
      display: block;
    }

    .re-wrap { min-width: min(460px, 88vw); }

    .re-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px 14px;
      border-bottom: 1px solid var(--linea);
    }

    .re-head-ic {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 11px;
      background: var(--azul);
      color: #fff;
      flex: 0 0 auto;
    }

    .re-head-txt { min-width: 0; }
    .re-head-txt h2 { margin: 0; font-size: 1.02rem; font-weight: 700; color: var(--azul); line-height: 1.25; }
    .re-head-txt p {
      margin: 2px 0 0;
      font-size: .8rem;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .re-body { padding: 16px 20px 4px !important; }

    .re-opciones { display: flex; flex-direction: column; gap: 8px; }

    .re-op {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 11px 13px;
      border: 1.5px solid var(--linea);
      border-radius: 12px;
      background: #fff;
      cursor: pointer;
      text-align: left;
      font: inherit;
      transition: border-color .15s, background .15s, box-shadow .15s;
    }

    .re-op:hover { border-color: #cbd5e1; background: #f8fafc; }

    .re-op-ic {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 9px;
      background: #f1f5f9;
      color: var(--muted);
      flex: 0 0 auto;
      transition: background .15s, color .15s;
    }

    .re-op-txt { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .re-op-tit { font-size: .92rem; font-weight: 700; color: #0f172a; line-height: 1.2; }
    .re-op-sub { font-size: .74rem; color: var(--muted); margin-top: 2px; }
    .re-op-check { color: #cbd5e1; flex: 0 0 auto; }

    /* Seleccionada: el color de la etapa tiñe borde, icono y check. */
    .re-op.activa { box-shadow: 0 1px 3px rgba(16, 24, 40, .08); }
    .re-op-ok.activa { border-color: var(--ok); background: #f2f9f3; }
    .re-op-ok.activa .re-op-ic { background: var(--ok); color: #fff; }
    .re-op-ok.activa .re-op-check { color: var(--ok); }
    .re-op-mal.activa { border-color: var(--mal); background: #fdf3f3; }
    .re-op-mal.activa .re-op-ic { background: var(--mal); color: #fff; }
    .re-op-mal.activa .re-op-check { color: var(--mal); }
    .re-op-noshow.activa { border-color: var(--noshow); background: #fff8f1; }
    .re-op-noshow.activa .re-op-ic { background: var(--noshow); color: #fff; }
    .re-op-noshow.activa .re-op-check { color: var(--noshow); }

    .re-motivo-box { margin-top: 14px; }
    .re-motivo { width: 100%; }
    .re-error { color: var(--mal); }

    .re-actions {
      display: flex;
      align-items: center;
      padding: 8px 20px 16px !important;
    }

    .re-spacer { flex: 1; }

    .re-guardar {
      --mdc-filled-button-container-color: var(--azul);
      background: var(--azul);
      color: #fff;
      font-weight: 600;
      border-radius: 999px;
      padding: 0 20px;
    }

    .re-guardar[disabled] { opacity: .45; }
  `],
})
export class ResultadoEtapaDialogComponent {
  readonly textos: (typeof TEXTOS)[EtapaConResultado];

  /** Las tres salidas, con el color y el subtítulo que se muestran en la tarjeta. */
  readonly opciones: ReadonlyArray<{
    valor: ResultadoEtapa; titulo: string; sub: string; icono: string; tono: string;
  }> = [
    { valor: 'paso', titulo: 'Pasó', sub: 'Aprobó y sigue en el proceso', icono: 'thumb_up', tono: 'ok' },
    { valor: 'no_paso', titulo: 'No pasó', sub: 'Se presentó pero no aprobó', icono: 'thumb_down', tono: 'mal' },
    { valor: 'no_se_presento', titulo: 'No se presentó', sub: 'No asistió a la cita', icono: 'person_off', tono: 'noshow' },
  ];

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

  elegir(valor: ResultadoEtapa): void {
    if (this.resultado() === valor) return;
    this.resultado.set(valor);
    const previo = this.data.previo ?? {};
    this.motivo.set(
      (valor === 'no_se_presento' ? previo.motivoNoSePresento : valor === 'no_paso' ? previo.motivoNoPaso : '') ?? '',
    );
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
