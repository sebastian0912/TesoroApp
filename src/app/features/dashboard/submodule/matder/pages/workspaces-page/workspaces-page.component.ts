import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WorkspaceService } from '../../services/workspace.service';
import { WorkspaceResponse } from '../../models/workspace.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-workspaces-page',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatChipsModule, MatProgressSpinnerModule],
  templateUrl: './workspaces-page.component.html',
  styleUrls: ['./workspaces-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspacesPageComponent implements OnInit {
  workspaces = signal<WorkspaceResponse[]>([]);
  loading = signal(true);
  showForm = signal(false);
  formName = '';
  formDesc = '';

  constructor(private wsService: WorkspaceService, private router: Router) {}

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try { this.workspaces.set(await this.wsService.list()); } catch { this.workspaces.set([]); }
    finally { this.loading.set(false); }
  }

  async create(): Promise<void> {
    if (!this.formName.trim()) return;
    try {
      await this.wsService.create({ name: this.formName.trim(), description: this.formDesc.trim() || undefined });
      this.formName = ''; this.formDesc = ''; this.showForm.set(false);
      await this.load();
      Swal.fire('Creado', 'Workspace creado. Eres OWNER.', 'success');
    } catch { Swal.fire('Error', 'No se pudo crear.', 'error'); }
  }

  async remove(ws: WorkspaceResponse): Promise<void> {
    if (!ws.can_delete_workspace) { Swal.fire('Sin permiso', 'Solo el owner puede eliminar.', 'info'); return; }
    const c = await Swal.fire({ title: `¿Eliminar "${ws.name}"?`, text: 'Se borran boards, listas y tareas.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar' });
    if (!c.isConfirmed) return;
    try { await this.wsService.delete(ws.id); await this.load(); } catch { Swal.fire('Error', 'No se pudo eliminar.', 'error'); }
  }

  open(ws: WorkspaceResponse): void {
    this.router.navigate([`/dashboard/matder/workspaces/${ws.id}`]);
  }

  roleLabel(r: string | null): string {
    return r ? r.charAt(0) + r.slice(1).toLowerCase() : '';
  }
}
