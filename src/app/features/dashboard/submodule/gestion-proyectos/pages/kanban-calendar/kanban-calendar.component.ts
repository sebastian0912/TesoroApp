import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { KanbanService } from '../../services/kanban.service';
import { KanbanCardSummary } from '../../models/kanban.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-kanban-calendar',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule],
  templateUrl: './kanban-calendar.component.html',
  styleUrls: ['./kanban-calendar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanCalendarComponent implements OnInit {
  cards = signal<KanbanCardSummary[]>([]);
  loading = signal(true);

  constructor(private kanbanService: KanbanService) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.kanbanService.getCalendarCards();
      this.cards.set(data);
    } catch {
      Swal.fire('Error', 'No se pudieron cargar las tarjetas del calendario.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  isOverdue(card: KanbanCardSummary): boolean {
    if (!card.fecha_vencimiento) return false;
    return new Date(card.fecha_vencimiento) < new Date() && card.estado !== 'completada';
  }
}
