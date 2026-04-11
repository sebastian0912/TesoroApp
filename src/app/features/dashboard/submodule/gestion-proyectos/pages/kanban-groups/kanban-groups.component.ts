import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { KanbanService } from '../../services/kanban.service';
import { KanbanUserGroup } from '../../models/kanban.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-kanban-groups',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatChipsModule, MatProgressSpinnerModule, MatDialogModule,
    MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './kanban-groups.component.html',
  styleUrls: ['./kanban-groups.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanGroupsComponent implements OnInit {
  groups = signal<KanbanUserGroup[]>([]);
  loading = signal(true);
  showForm = signal(false);
  editingGroup = signal<KanbanUserGroup | null>(null);

  formNombre = '';
  formDescripcion = '';

  displayedColumns = ['nombre', 'descripcion', 'miembros_count', 'acciones'];

  constructor(private kanbanService: KanbanService) {}

  async ngOnInit(): Promise<void> {
    await this.loadGroups();
  }

  async loadGroups(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.kanbanService.getGroups();
      this.groups.set(data);
    } catch {
      Swal.fire('Error', 'No se pudieron cargar los grupos.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.editingGroup.set(null);
    this.formNombre = '';
    this.formDescripcion = '';
    this.showForm.set(true);
  }

  openEdit(group: KanbanUserGroup): void {
    this.editingGroup.set(group);
    this.formNombre = group.nombre;
    this.formDescripcion = group.descripcion ?? '';
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingGroup.set(null);
  }

  async saveGroup(): Promise<void> {
    if (!this.formNombre.trim()) return;
    try {
      const editing = this.editingGroup();
      if (editing) {
        await this.kanbanService.updateGroup(editing.id, {
          nombre: this.formNombre.trim(),
          descripcion: this.formDescripcion.trim() || undefined,
        });
        Swal.fire('Actualizado', 'Grupo actualizado correctamente.', 'success');
      } else {
        await this.kanbanService.createGroup({
          nombre: this.formNombre.trim(),
          descripcion: this.formDescripcion.trim() || undefined,
        });
        Swal.fire('Creado', 'Grupo creado correctamente.', 'success');
      }
      this.showForm.set(false);
      await this.loadGroups();
    } catch {
      Swal.fire('Error', 'No se pudo guardar el grupo.', 'error');
    }
  }

  async deleteGroup(group: KanbanUserGroup): Promise<void> {
    const result = await Swal.fire({
      title: 'Eliminar grupo',
      text: `¿Seguro que deseas eliminar "${group.nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    try {
      await this.kanbanService.deleteGroup(group.id);
      Swal.fire('Eliminado', 'Grupo eliminado correctamente.', 'success');
      await this.loadGroups();
    } catch {
      Swal.fire('Error', 'No se pudo eliminar el grupo.', 'error');
    }
  }
}
