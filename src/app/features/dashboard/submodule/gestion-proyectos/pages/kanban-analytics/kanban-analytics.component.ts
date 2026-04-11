import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { KanbanService } from '../../services/kanban.service';
import { KanbanAnalytics, KanbanBoardIndicator } from '../../models/kanban.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-kanban-analytics',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatProgressSpinnerModule, MatProgressBarModule,
  ],
  templateUrl: './kanban-analytics.component.html',
  styleUrls: ['./kanban-analytics.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanAnalyticsComponent implements OnInit {
  analytics = signal<KanbanAnalytics | null>(null);
  loading = signal(true);
  boardColumns = ['nombre', 'total_cards', 'abiertas', 'en_progreso', 'completadas', 'sin_asignar'];

  constructor(private kanbanService: KanbanService) {}

  async ngOnInit(): Promise<void> {
    await this.loadAnalytics();
  }

  async loadAnalytics(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.kanbanService.getAnalytics();
      this.analytics.set(data);
    } catch {
      Swal.fire('Error', 'No se pudieron cargar las analíticas.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  trackBoard(_: number, board: KanbanBoardIndicator): number {
    return board.id;
  }
}
