import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OfficeFormsService } from '../../services/office-forms.service';
import { ResponseSummary } from '../../models/office-forms.models';

/** Respuestas registradas de un formulario. */
@Component({
  selector: 'app-form-responses',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
  <div class="fr">
    <header class="fr__head">
      <button mat-icon-button (click)="back()"><mat-icon>arrow_back</mat-icon></button>
      <div>
        <h1>{{ title() || 'Respuestas' }}</h1>
        <p>{{ total() }} respuesta(s) registrada(s).</p>
      </div>
      <button mat-flat-button color="primary" (click)="fill()"><mat-icon>edit_note</mat-icon> Llenar</button>
    </header>

    @if (loading()) {
      <div class="fr__loading"><mat-spinner diameter="34"></mat-spinner></div>
    } @else {
      <div class="tablewrap">
        <table class="tbl">
          <thead><tr><th>#</th><th>Origen</th><th>Oficina</th><th>Enviado por</th><th>Fecha</th><th></th></tr></thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                <td>{{ r.id }}</td>
                <td><span class="chip" [class.chip--pub]="r.source==='PUBLIC'">{{ r.source==='PUBLIC' ? 'Público' : 'Interno' }}</span></td>
                <td>{{ r.office_id || '—' }}</td>
                <td>{{ r.submitted_by || 'Anónimo' }}</td>
                <td>{{ r.submitted_at | date:'short' }}</td>
                <td class="right"><button mat-button (click)="detail(r)">Ver <mat-icon>chevron_right</mat-icon></button></td>
              </tr>
            }
            @if (!rows().length) { <tr><td colspan="6" class="empty">Sin respuestas todavía.</td></tr> }
          </tbody>
        </table>
      </div>

      @if (total() > pageSize) {
        <div class="pager">
          <button mat-stroked-button [disabled]="page()===0" (click)="prev()"><mat-icon>chevron_left</mat-icon> Anterior</button>
          <span>Página {{ page() + 1 }}</span>
          <button mat-stroked-button [disabled]="(page()+1)*pageSize >= total()" (click)="next()">Siguiente <mat-icon>chevron_right</mat-icon></button>
        </div>
      }
    }
  </div>
  `,
  styles: [`
    .fr { padding: 8px 4px 40px; }
    .fr__head { display: flex; align-items: center; gap: 12px; }
    .fr__head h1 { font-size: 22px; font-weight: 800; margin: 0; color: #0f172a; }
    .fr__head p { color: #64748b; margin: 2px 0 0; }
    .fr__head > button:last-child { margin-left: auto; }
    .fr__loading { display: flex; justify-content: center; padding: 50px 0; }
    .tablewrap { margin-top: 16px; overflow-x: auto; border: 1px solid #e6eaf0; border-radius: 14px; background: #fff; }
    .tbl { width: 100%; border-collapse: collapse; min-width: 640px; }
    .tbl th { text-align: left; font-size: 12px; color: #64748b; font-weight: 600; padding: 12px 14px; border-bottom: 1px solid #eef2f7; }
    .tbl td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .tbl .right { text-align: right; }
    .empty { text-align: center; color: #94a3b8; padding: 28px 0; }
    .chip { font-size: 11px; background: #eef2f7; color: #475569; padding: 3px 8px; border-radius: 6px; font-weight: 600; }
    .chip--pub { background: #e0f2fe; color: #0369a1; }
    .pager { display: flex; align-items: center; gap: 14px; justify-content: center; margin-top: 16px; color: #64748b; }
  `],
})
export class FormResponsesComponent implements OnInit {
  private api = inject(OfficeFormsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  formId = 0;
  pageSize = 25;
  rows = signal<ResponseSummary[]>([]);
  total = signal(0);
  page = signal(0);
  title = signal('');
  loading = signal(true);

  ngOnInit(): void {
    this.formId = Number(this.route.snapshot.paramMap.get('id'));
    this.api.get(this.formId).subscribe({ next: f => this.title.set(f.title), error: () => {} });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.listResponses(this.formId, { page: this.page(), size: this.pageSize }).subscribe({
      next: (p) => { this.rows.set(p.content); this.total.set(p.total); this.loading.set(false); },
      error: () => { this.rows.set([]); this.loading.set(false); },
    });
  }

  next(): void { this.page.update(p => p + 1); this.load(); }
  prev(): void { this.page.update(p => Math.max(0, p - 1)); this.load(); }

  detail(r: ResponseSummary): void { this.router.navigate(['/dashboard/office-management/responses', r.id]); }
  fill(): void { this.router.navigate(['/dashboard/office-management/forms', this.formId, 'fill']); }
  back(): void { this.router.navigate(['/dashboard/office-management']); }
}
