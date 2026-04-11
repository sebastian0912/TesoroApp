import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { KanbanService } from '../../services/kanban.service';
import { KanbanAuditLog } from '../../models/kanban.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-kanban-audit',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatChipsModule, MatProgressSpinnerModule,
  ],
  templateUrl: './kanban-audit.component.html',
  styleUrls: ['./kanban-audit.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanAuditComponent implements OnInit {
  logs = signal<KanbanAuditLog[]>([]);
  loading = signal(true);
  displayedColumns = ['created_at', 'usuario_nombre', 'accion', 'tipo_entidad', 'id_entidad'];

  constructor(private kanbanService: KanbanService) {}

  async ngOnInit(): Promise<void> {
    await this.loadLogs();
  }

  async loadLogs(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.kanbanService.getAuditLogs();
      this.logs.set(data);
    } catch {
      Swal.fire('Error', 'No se pudo cargar el historial de auditoría.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  getActionIcon(accion: string): string {
    const lower = accion.toLowerCase();
    if (lower.includes('crear') || lower.includes('create')) return 'add_circle';
    if (lower.includes('actualizar') || lower.includes('update')) return 'edit';
    if (lower.includes('eliminar') || lower.includes('delete')) return 'delete';
    if (lower.includes('mover') || lower.includes('move')) return 'swap_horiz';
    return 'history';
  }

  getActionColor(accion: string): string {
    const lower = accion.toLowerCase();
    if (lower.includes('crear') || lower.includes('create')) return '#388e3c';
    if (lower.includes('eliminar') || lower.includes('delete')) return '#d32f2f';
    if (lower.includes('actualizar') || lower.includes('update')) return '#1976d2';
    return '#616161';
  }
}
