import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatderDashboardService } from '../../services/dashboard.service';
import { WorkspaceService } from '../../services/workspace.service';
import { WorkspaceResponse } from '../../models/workspace.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-import-page', standalone: true,
  imports: [FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatProgressBarModule, MatProgressSpinnerModule],
  template: `
    <div class="header"><h2>Importar</h2><button mat-stroked-button (click)="ds.downloadTemplate()"><mat-icon>download</mat-icon> Plantilla</button></div>
    <mat-card class="upload">
      <mat-form-field appearance="outline" class="fw"><mat-label>Workspace</mat-label>
        <mat-select [(ngModel)]="wsId">@for (w of wss(); track w.id) { <mat-option [value]="w.id">{{ w.name }}</mat-option> }</mat-select>
      </mat-form-field>
      <div class="drop" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
        @if (!file) { <mat-icon>cloud_upload</mat-icon><p>Arrastra un archivo Excel aquí</p><label class="file-label"><input type="file" accept=".xlsx,.xls" (change)="onFile($event)" hidden><span class="btn">Seleccionar</span></label> }
        @else { <mat-icon>description</mat-icon><p>{{ file.name }}</p><button mat-button color="warn" (click)="file = null"><mat-icon>close</mat-icon></button> }
      </div>
      @if (importing()) { <mat-progress-bar mode="indeterminate"></mat-progress-bar> }
      <button mat-raised-button color="primary" [disabled]="!file || !wsId || importing()" (click)="doImport()"><mat-icon>upload_file</mat-icon> Importar</button>
    </mat-card>
  `,
  styles: [`.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}h2{margin:0;font-weight:500}.upload{padding:20px}.fw{width:100%}.drop{border:2px dashed #bdbdbd;border-radius:8px;padding:32px;text-align:center;margin:12px 0}.drop mat-icon{font-size:40px;width:40px;height:40px;color:#9e9e9e}.file-label{display:inline-block;margin-top:8px}.btn{background:#1976d2;color:white;padding:8px 16px;border-radius:4px;cursor:pointer}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportPageComponent implements OnInit {
  wss = signal<WorkspaceResponse[]>([]); wsId: number | null = null; file: File | null = null; importing = signal(false);
  constructor(public ds: MatderDashboardService, private wsService: WorkspaceService) {}
  async ngOnInit(): Promise<void> { try { const w = await this.wsService.list(); this.wss.set(w); if (w.length) this.wsId = w[0].id; } catch {} }
  onFile(e: Event): void { const f = (e.target as HTMLInputElement).files?.[0]; if (f) this.file = f; }
  onDrop(e: DragEvent): void { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) this.file = f; }
  async doImport(): Promise<void> {
    if (!this.file || !this.wsId) return;
    this.importing.set(true);
    try { const r = await this.ds.importFile(this.wsId, this.file); this.file = null; Swal.fire('Listo', `${r.boards_created} boards, ${r.cards_created} cards creados.`, r.errors?.length ? 'warning' : 'success'); }
    catch { Swal.fire('Error', 'Error al importar.', 'error'); }
    finally { this.importing.set(false); }
  }
}
