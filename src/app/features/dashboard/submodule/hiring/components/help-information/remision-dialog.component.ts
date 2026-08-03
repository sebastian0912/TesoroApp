/**
 * Genera la REMISIÓN PARA ENTREVISTA Y/O PRUEBA TÉCNICA (Apoyo / Tu Alianza).
 *
 * Llega con todo prellenado desde la vacante y el candidato; lo que el sistema
 * no sabe (a quién preguntar en la empresa, el consecutivo del formato) queda
 * como campo editable, y todo lo demás se puede corregir antes de imprimir sin
 * tener que volver al formulario.
 *
 * La temporal se deduce de la vacante (empresa usuaria / temporal) porque es lo
 * que decide el logo y el código del formato; igual se puede cambiar a mano.
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import QRCode from 'qrcode';

import { DatosRemision, TemporalRemision, buildRemisionPdf } from './remision-fill';

/**
 * A dónde apunta el QR del formato: el formulario público de contratación.
 * Se muestra en el diálogo para poder verificarlo/cambiarlo antes de imprimir.
 */
const URL_REGISTRO_DEFAULT = 'https://formulario.tsservicios.co/dashboard/formulario';

const LOGOS: Record<TemporalRemision, string> = {
  apoyo: 'logos/Logo_AL.png',
  alianza: 'logos/Logo_TA.png',
};

export type RemisionDialogData = Partial<Omit<DatosRemision, 'logoDataUrl' | 'qrDataUrl'>>;

@Component({
  selector: 'app-remision-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatButtonToggleModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTooltipModule,
  ],
  template: `
    <div class="rm-wrap">
      <header class="rm-head">
        <span class="rm-head-ic"><mat-icon>assignment</mat-icon></span>
        <div class="rm-head-txt">
          <h2>Remisión para entrevista y/o prueba técnica</h2>
          <p>Revisa los datos y genera el formato para imprimir.</p>
        </div>
        <button mat-icon-button class="rm-cerrar" (click)="cerrar()" aria-label="Cerrar">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <mat-dialog-content class="rm-body">
        <p class="rm-label">Temporal</p>
        <mat-button-toggle-group class="rm-temporal" [value]="d().temporal"
          (change)="set('temporal', $event.value)">
          <mat-button-toggle value="apoyo">Apoyo Laboral TS · AL SE-RE-4</mat-button-toggle>
          <mat-button-toggle value="alianza">Tu Alianza SAS · TA SE-RE-4</mat-button-toggle>
        </mat-button-toggle-group>

        <div class="rm-grid">
          <mat-form-field appearance="outline">
            <mat-label>Fecha</mat-label>
            <input matInput [ngModel]="d().fecha" (ngModelChange)="set('fecha', $event)" placeholder="dd/mm/aaaa">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Consecutivo</mat-label>
            <input matInput [ngModel]="d().consecutivo" (ngModelChange)="set('consecutivo', $event)">
            <mat-hint>Opcional: si va vacío queda el recuadro en blanco.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="rm-ancho">
            <mat-label>Empresa usuaria</mat-label>
            <input matInput [ngModel]="d().empresaUsuaria" (ngModelChange)="set('empresaUsuaria', $event)">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Cargo</mat-label>
            <input matInput [ngModel]="d().cargo" (ngModelChange)="set('cargo', $event)">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Experiencia en el sector</mat-label>
            <mat-select [ngModel]="d().experienciaSector" (ngModelChange)="set('experienciaSector', $event)">
              <mat-option value="SI">SI</mat-option>
              <mat-option value="NO">NO</mat-option>
              <mat-option value="">Sin dato</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>¿Cuánto tiempo?</mat-label>
            <input matInput [ngModel]="d().tiempoExperiencia" (ngModelChange)="set('tiempoExperiencia', $event)">
          </mat-form-field>

          <mat-form-field appearance="outline" class="rm-ancho">
            <mat-label>Nombre del candidato</mat-label>
            <input matInput [ngModel]="d().nombreCandidato" (ngModelChange)="set('nombreCandidato', $event)">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Cédula</mat-label>
            <input matInput [ngModel]="d().cedula" (ngModelChange)="set('cedula', $event)">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Área</mat-label>
            <input matInput [ngModel]="d().area" (ngModelChange)="set('area', $event)">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Día</mat-label>
            <input matInput [ngModel]="d().dia" (ngModelChange)="set('dia', $event)" placeholder="dd/mm/aaaa">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Hora</mat-label>
            <input matInput [ngModel]="d().hora" (ngModelChange)="set('hora', $event)" placeholder="HH:mm">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Preguntar por</mat-label>
            <input matInput [ngModel]="d().preguntarPor" (ngModelChange)="set('preguntarPor', $event)">
          </mat-form-field>
          <mat-form-field appearance="outline" class="rm-ancho2">
            <mat-label>Dirección de la empresa</mat-label>
            <input matInput [ngModel]="d().direccionEmpresa" (ngModelChange)="set('direccionEmpresa', $event)">
          </mat-form-field>

          <mat-form-field appearance="outline" class="rm-ancho2">
            <mat-label>Gestión humana (firma)</mat-label>
            <input matInput [ngModel]="d().gestionHumana" (ngModelChange)="set('gestionHumana', $event)">
          </mat-form-field>

          <mat-form-field appearance="outline" class="rm-completo">
            <mat-label>URL del código QR</mat-label>
            <input matInput [ngModel]="urlQR()" (ngModelChange)="urlQR.set($event)">
            <mat-hint>Es la página de registro que abre el QR. Verifícala antes de imprimir.</mat-hint>
          </mat-form-field>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="rm-actions">
        <button mat-button (click)="cerrar()">Cancelar</button>
        <span class="rm-spacer"></span>
        <button mat-flat-button class="rm-generar" [disabled]="generando()" (click)="generar()">
          <mat-icon>picture_as_pdf</mat-icon>
          {{ generando() ? 'Generando…' : 'Generar remisión' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host { --azul: #21263c; --linea: #e8edf3; --muted: #64748b; display: block; }

    .rm-wrap { width: min(760px, 94vw); }

    .rm-head {
      position: relative; display: flex; align-items: center; gap: 14px;
      padding: 18px 52px 16px 20px; color: #fff;
      background: linear-gradient(135deg, #21263c 0%, #343c5c 100%);
    }
    .rm-head-ic {
      display: grid; place-items: center; width: 42px; height: 42px;
      border-radius: 12px; background: rgba(255,255,255,.16);
      border: 1px solid rgba(255,255,255,.22); flex: 0 0 auto;
    }
    .rm-head-txt h2 { margin: 0; font-size: 1.02rem; font-weight: 700; }
    .rm-head-txt p { margin: 3px 0 0; font-size: .78rem; color: rgba(255,255,255,.8); }
    .rm-cerrar { position: absolute; top: 8px; right: 8px; color: rgba(255,255,255,.75); }

    .rm-body { padding: 16px 20px 4px !important; max-height: 66vh; }

    .rm-label {
      margin: 0 0 8px; font-size: .72rem; font-weight: 700; letter-spacing: .6px;
      text-transform: uppercase; color: var(--muted);
    }

    .rm-temporal { width: 100%; margin-bottom: 16px; }
    .rm-temporal .mat-button-toggle { flex: 1; }

    .rm-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px 12px;
    }
    .rm-ancho { grid-column: span 2; }
    .rm-ancho2 { grid-column: span 2; }
    .rm-completo { grid-column: 1 / -1; }

    .rm-actions {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 20px 16px !important; border-top: 1px solid var(--linea); background: #fcfdfe;
    }
    .rm-spacer { flex: 1; }
    .rm-generar {
      --mdc-filled-button-container-color: var(--azul);
      background: var(--azul); color: #fff; font-weight: 600;
      border-radius: 999px; padding: 0 22px; height: 42px;
    }
    .rm-generar[disabled] { opacity: .45; }

    @media (max-width: 700px) {
      .rm-grid { grid-template-columns: 1fr 1fr; }
      .rm-ancho, .rm-ancho2 { grid-column: span 2; }
    }
  `],
})
export class RemisionDialogComponent {
  readonly d = signal<DatosRemision>({
    temporal: 'apoyo',
    fecha: '', empresaUsuaria: '', cargo: '', experienciaSector: '', tiempoExperiencia: '',
    nombreCandidato: '', cedula: '', area: '', dia: '', hora: '', preguntarPor: '',
    direccionEmpresa: '', gestionHumana: '', consecutivo: '',
  });

  readonly urlQR = signal(URL_REGISTRO_DEFAULT);
  readonly generando = signal(false);

  constructor(
    private readonly ref: MatDialogRef<RemisionDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) data: RemisionDialogData,
  ) {
    this.d.set({ ...this.d(), ...(data ?? {}) } as DatosRemision);
  }

  set<K extends keyof DatosRemision>(campo: K, valor: DatosRemision[K]): void {
    this.d.set({ ...this.d(), [campo]: valor });
  }

  async generar(): Promise<void> {
    this.generando.set(true);
    try {
      const [logoDataUrl, qrDataUrl] = await Promise.all([
        this.aDataUrl(LOGOS[this.d().temporal]),
        this.qr(this.urlQR()),
      ]);

      const blob = buildRemisionPdf({ ...this.d(), logoDataUrl, qrDataUrl });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      this.ref.close(true);
    } finally {
      this.generando.set(false);
    }
  }

  /** El PDF se genera igual si el logo o el QR fallan: no se bloquea la impresión. */
  private async aDataUrl(url: string): Promise<string | null> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const buf = await resp.arrayBuffer();
      let bin = '';
      const u8 = new Uint8Array(buf);
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      return `data:image/png;base64,${btoa(bin)}`;
    } catch {
      return null;
    }
  }

  private async qr(texto: string): Promise<string | null> {
    const t = String(texto ?? '').trim();
    if (!t) return null;
    try {
      return await QRCode.toDataURL(t, { margin: 1, width: 420, errorCorrectionLevel: 'M' });
    } catch {
      return null;
    }
  }

  cerrar(): void {
    this.ref.close(false);
  }
}
