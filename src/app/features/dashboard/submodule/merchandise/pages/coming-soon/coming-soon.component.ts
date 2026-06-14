import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'app-merchandise-coming-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule],
  template: `
    <div class="page-wrap">
      <mat-card class="card">
        <div class="head">
          <mat-icon class="icon">construction</mat-icon>
          <h1 class="title">{{ feature }}</h1>
        </div>
        <p class="lead">Esta funcionalidad está en construcción.</p>
        <p class="sub">
          El módulo <strong>Comercializadora &raquo; Mercancía</strong> aún no está implementado en TesoroApp.
          Las pantallas <em>Edición</em>, <em>Envío</em> y <em>Recepción</em> estarán disponibles
          cuando termine el desarrollo del módulo.
        </p>
        <p class="hint">Si necesitás priorizar este módulo, abrí un ticket en Bugs Reportados.</p>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-wrap { display:flex; align-items:flex-start; justify-content:center; padding:32px 16px; }
    .card { max-width: 720px; width: 100%; padding: 24px 28px; border-left: 4px solid #f59e0b; }
    .head { display:flex; align-items:center; gap:12px; margin-bottom: 8px; }
    .icon { color:#f59e0b; font-size: 32px; height: 32px; width: 32px; }
    .title { margin: 0; font-size: 22px; font-weight: 600; color:#1f2937; }
    .lead { margin: 12px 0 6px; color:#374151; font-size: 15px; }
    .sub  { margin: 0 0 12px; color:#4b5563; font-size: 14px; line-height: 1.55; }
    .hint { margin: 0; font-size: 13px; color:#6b7280; }
  `]
})
export class MerchandiseComingSoonComponent {
  private route = inject(ActivatedRoute);
  feature: string = this.route.snapshot.data?.['feature'] ?? 'Mercancía';
}
