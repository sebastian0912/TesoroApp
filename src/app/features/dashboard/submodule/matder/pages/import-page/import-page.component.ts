import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatderDashboardService } from '../../services/dashboard.service';
import { WorkspaceService } from '../../services/workspace.service';
import { WorkspaceResponse } from '../../models/workspace.models';
import { ImportLogResponse } from '../../models/dashboard.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-import-page',
  standalone: true,
  imports: [
    DatePipe, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatChipsModule,
  ],
  templateUrl: './import-page.component.html',
  styleUrls: ['./import-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportPageComponent implements OnInit {
  wss = signal<WorkspaceResponse[]>([]);
  logs = signal<ImportLogResponse[]>([]);
  wsId: number | null = null;
  file: File | null = null;
  importing = signal(false);

  constructor(
    public ds: MatderDashboardService,
    private wsService: WorkspaceService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const [w, l] = await Promise.all([this.wsService.list(), this.ds.getImportLogs()]);
      this.wss.set(w);
      this.logs.set(l);
      if (w.length) this.wsId = w[0].id;
    } catch { /* empty */ }
  }

  onFile(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.file = f;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (f) this.file = f;
  }

  async doImport(): Promise<void> {
    if (!this.file || !this.wsId) return;
    this.importing.set(true);
    try {
      const r = await this.ds.importFile(this.wsId, this.file);
      this.file = null;
      this.logs.set(await this.ds.getImportLogs());
      Swal.fire('Listo', `${r.boards_created} boards y ${r.cards_created} cards creados.`, r.errors?.length ? 'warning' : 'success');
    } catch {
      Swal.fire('Error', 'Error al importar.', 'error');
    } finally {
      this.importing.set(false);
    }
  }

  statusColor(s: string): string {
    return ({ COMPLETED: '#16a34a', FAILED: '#dc2626', PROCESSING: '#2563eb', PENDING: '#d97706' } as Record<string, string>)[s] ?? '#6b7280';
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }
}
