import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkspaceService } from '../../services/workspace.service';
import { WorkspaceResponse, WorkspaceMemberResponse } from '../../models/workspace.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-workspaces-page',
  standalone: true,
  imports: [
    DatePipe, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
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
  searchQuery = '';
  filterState = 'all';

  // Detail mode
  detailMode = false;
  selectedWs: WorkspaceResponse | null = null;
  members = signal<WorkspaceMemberResponse[]>([]);
  membersLoading = signal(false);
  showAddMember = false;
  newMemberUser = '';
  newMemberRole = 'MEMBER';

  constructor(
    private wsService: WorkspaceService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
    // Check if we have an ID in the route (detail mode)
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const ws = this.workspaces().find(w => w.id === Number(id));
      if (ws) {
        this.openDetail(ws);
      } else {
        try {
          const detail = await this.wsService.get(Number(id));
          this.openDetail(detail);
        } catch { /* fallback to list */ }
      }
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.workspaces.set(await this.wsService.list());
    } catch {
      this.workspaces.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  get filteredWorkspaces(): WorkspaceResponse[] {
    let result = this.workspaces();
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.description ?? '').toLowerCase().includes(q) ||
        (w.owner_name ?? '').toLowerCase().includes(q)
      );
    }
    if (this.filterState === 'with_boards') {
      result = result.filter(w => w.board_count > 0);
    } else if (this.filterState === 'empty') {
      result = result.filter(w => w.board_count === 0);
    }
    return result;
  }

  async create(): Promise<void> {
    if (!this.formName.trim()) return;
    try {
      await this.wsService.create({ name: this.formName.trim(), description: this.formDesc.trim() || undefined });
      this.formName = '';
      this.formDesc = '';
      this.showForm.set(false);
      await this.load();
      Swal.fire('Creado', 'Workspace creado exitosamente.', 'success');
    } catch {
      Swal.fire('Error', 'No se pudo crear.', 'error');
    }
  }

  async remove(ws: WorkspaceResponse): Promise<void> {
    if (!ws.can_delete_workspace) {
      Swal.fire('Sin permiso', 'Solo el owner puede eliminar.', 'info');
      return;
    }
    const c = await Swal.fire({
      title: `Eliminar "${ws.name}"?`,
      text: 'Se borran boards, listas y tareas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
    });
    if (!c.isConfirmed) return;
    try {
      await this.wsService.delete(ws.id);
      if (this.detailMode) this.backToList();
      await this.load();
    } catch {
      Swal.fire('Error', 'No se pudo eliminar.', 'error');
    }
  }

  open(ws: WorkspaceResponse): void {
    this.router.navigate([`/dashboard/matder/workspaces/${ws.id}`]);
    this.openDetail(ws);
  }

  openDetail(ws: WorkspaceResponse): void {
    this.detailMode = true;
    this.selectedWs = ws;
    this.loadMembers(ws.id);
  }

  backToList(): void {
    this.detailMode = false;
    this.selectedWs = null;
    this.members.set([]);
    this.router.navigate(['/dashboard/matder/workspaces']);
  }

  async loadMembers(wsId: number): Promise<void> {
    this.membersLoading.set(true);
    try {
      this.members.set(await this.wsService.listMembers(wsId));
    } catch {
      this.members.set([]);
    } finally {
      this.membersLoading.set(false);
    }
  }

  async addMember(): Promise<void> {
    if (!this.newMemberUser.trim() || !this.selectedWs) return;
    try {
      await this.wsService.addMember(this.selectedWs.id, this.newMemberUser.trim(), this.newMemberRole);
      this.newMemberUser = '';
      this.showAddMember = false;
      await this.loadMembers(this.selectedWs.id);
      Swal.fire('Agregado', 'Miembro agregado correctamente.', 'success');
    } catch {
      Swal.fire('Error', 'No se pudo agregar el miembro.', 'error');
    }
  }

  async updateMemberRole(member: WorkspaceMemberResponse, role: string): Promise<void> {
    if (!this.selectedWs) return;
    try {
      await this.wsService.updateMember(this.selectedWs.id, member.id, { role });
      await this.loadMembers(this.selectedWs.id);
    } catch {
      Swal.fire('Error', 'No se pudo actualizar el rol.', 'error');
    }
  }

  async toggleMemberActive(member: WorkspaceMemberResponse): Promise<void> {
    if (!this.selectedWs) return;
    try {
      await this.wsService.updateMember(this.selectedWs.id, member.id, { active: !member.active });
      await this.loadMembers(this.selectedWs.id);
    } catch {
      Swal.fire('Error', 'No se pudo actualizar.', 'error');
    }
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }

  roleLabel(r: string | null): string {
    if (!r) return '';
    const m: Record<string, string> = { OWNER: 'Owner', MANAGER: 'Manager', MEMBER: 'Miembro', VIEWER: 'Viewer' };
    return m[r] ?? r.charAt(0) + r.slice(1).toLowerCase();
  }
}
