import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OfficeFormsService } from '../../services/office-forms.service';
import { DashboardData, FormSummary } from '../../models/office-forms.models';

/** Dashboard de Gestión de Oficina: KPIs + todos los formularios registrados. */
@Component({
  selector: 'app-office-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
  <div class="dash">
    <header class="dash__head">
      <div>
        <h1>Gestión de Oficina</h1>
        <p>Formularios dinámicos, respuestas y archivos de tus oficinas.</p>
      </div>
      <button mat-flat-button color="primary" routerLink="builder">
        <mat-icon>add</mat-icon> Nuevo formulario
      </button>
    </header>

    @if (loading()) {
      <div class="dash__loading"><mat-spinner diameter="34"></mat-spinner></div>
    } @else if (data(); as d) {
      <div class="kpis">
        <div class="kpi"><div class="kpi__n">{{ d.total_forms }}</div><div class="kpi__l">Formularios</div></div>
        <div class="kpi"><div class="kpi__n">{{ d.published_forms }}</div><div class="kpi__l">Publicados</div></div>
        <div class="kpi"><div class="kpi__n">{{ d.draft_forms }}</div><div class="kpi__l">Borradores</div></div>
        <div class="kpi kpi--accent"><div class="kpi__n">{{ d.total_responses }}</div><div class="kpi__l">Respuestas</div></div>
      </div>

      <div class="tablewrap">
        <table class="tbl">
          <thead>
            <tr><th>Formulario</th><th>Ubicación</th><th>Estado</th><th>Visibilidad</th><th>Campos</th><th>Respuestas</th><th></th></tr>
          </thead>
          <tbody>
            @for (f of d.forms; track f.id) {
              <tr>
                <td class="tbl__title">{{ f.title }}</td>
                <td>{{ f.parent_module || '—' }}</td>
                <td><span class="chip" [class.chip--ok]="f.status==='PUBLISHED'">{{ statusLabel(f.status) }}</span></td>
                <td>{{ f.visibility === 'PUBLIC' ? 'Público' : 'Privado' }}</td>
                <td class="num">{{ f.field_count }}</td>
                <td class="num">{{ f.response_count }}</td>
                <td class="tbl__actions">
                  <button mat-icon-button matTooltip="Ver respuestas" (click)="goResponses(f)"><mat-icon>table_rows</mat-icon></button>
                  <button mat-icon-button matTooltip="Llenar" (click)="goFill(f)"><mat-icon>edit_note</mat-icon></button>
                  <button mat-icon-button matTooltip="Editar" (click)="goEdit(f)"><mat-icon>tune</mat-icon></button>
                </td>
              </tr>
            }
            @if (!d.forms.length) {
              <tr><td colspan="7" class="tbl__empty">Aún no hay formularios. Crea el primero con “Nuevo formulario”.</td></tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="dash__error">No se pudo cargar el dashboard. <button mat-button (click)="load()">Reintentar</button></div>
    }
  </div>
  `,
  styles: [`
    .dash { padding: 8px 4px 40px; }
    .dash__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .dash__head h1 { font-size: 26px; font-weight: 800; margin: 0; color: #0f172a; }
    .dash__head p { color: #64748b; margin: 4px 0 0; }
    .dash__loading { display: flex; justify-content: center; padding: 60px 0; }
    .dash__error { padding: 40px 0; color: #64748b; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 20px 0; }
    @media (max-width: 800px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
    .kpi { border: 1px solid #e6eaf0; border-radius: 14px; background: #fff; padding: 16px 18px; }
    .kpi--accent { background: #1e293b; border-color: #1e293b; }
    .kpi--accent .kpi__n, .kpi--accent .kpi__l { color: #fff; }
    .kpi__n { font-size: 30px; font-weight: 800; color: #0f172a; }
    .kpi__l { color: #64748b; font-size: 13px; }
    .tablewrap { overflow-x: auto; border: 1px solid #e6eaf0; border-radius: 14px; background: #fff; }
    .tbl { width: 100%; border-collapse: collapse; min-width: 720px; }
    .tbl th { text-align: left; font-size: 12px; color: #64748b; font-weight: 600; padding: 12px 14px; border-bottom: 1px solid #eef2f7; }
    .tbl td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .tbl__title { font-weight: 600; color: #0f172a; }
    .tbl .num { text-align: center; }
    .tbl__actions { white-space: nowrap; text-align: right; }
    .tbl__empty { text-align: center; color: #94a3b8; padding: 30px 0; }
    .chip { font-size: 11px; background: #eef2f7; color: #475569; padding: 3px 8px; border-radius: 6px; font-weight: 600; }
    .chip--ok { background: #dcfce7; color: #15803d; }
  `],
})
export class OfficeDashboardComponent implements OnInit {
  private api = inject(OfficeFormsService);
  private router = inject(Router);

  data = signal<DashboardData | null>(null);
  loading = signal(true);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.dashboard().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => { this.data.set(null); this.loading.set(false); },
    });
  }

  statusLabel(s: string): string {
    return s === 'PUBLISHED' ? 'Publicado' : s === 'ARCHIVED' ? 'Archivado' : 'Borrador';
  }

  goResponses(f: FormSummary): void { this.router.navigate(['/dashboard/office-management/forms', f.id, 'responses']); }
  goFill(f: FormSummary): void { this.router.navigate(['/dashboard/office-management/forms', f.id, 'fill']); }
  goEdit(f: FormSummary): void { this.router.navigate(['/dashboard/office-management/builder', f.id]); }
}
