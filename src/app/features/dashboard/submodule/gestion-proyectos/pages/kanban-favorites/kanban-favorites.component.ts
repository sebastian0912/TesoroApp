import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { KanbanService } from '../../services/kanban.service';
import { KanbanCardSummary } from '../../models/kanban.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-kanban-favorites',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule],
  templateUrl: './kanban-favorites.component.html',
  styleUrls: ['./kanban-favorites.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanFavoritesComponent implements OnInit {
  cards = signal<KanbanCardSummary[]>([]);
  loading = signal(true);

  constructor(private kanbanService: KanbanService) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.kanbanService.getFavoriteCards();
      this.cards.set(data);
    } catch {
      Swal.fire('Error', 'No se pudieron cargar las favoritas.', 'error');
    } finally {
      this.loading.set(false);
    }
  }
}
