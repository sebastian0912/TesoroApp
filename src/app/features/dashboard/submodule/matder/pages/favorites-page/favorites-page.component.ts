import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BoardService } from '../../services/board.service';
import { BoardResponse } from '../../models/board.models';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [
    DatePipe, FormsModule, MatCardModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
  ],
  templateUrl: './favorites-page.component.html',
  styleUrls: ['./favorites-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPageComponent implements OnInit {
  boards = signal<BoardResponse[]>([]);
  loading = signal(true);
  search = '';
  private favoriteIds: Set<number> = new Set();

  constructor(private boardService: BoardService, private router: Router) {
    this.loadFavorites();
  }

  async ngOnInit(): Promise<void> {
    try {
      const all = await this.boardService.listBoards();
      this.boards.set(all.filter(b => this.favoriteIds.has(b.id)));
    } catch { /* empty */ }
    finally { this.loading.set(false); }
  }

  get filtered(): BoardResponse[] {
    if (!this.search) return this.boards();
    const q = this.search.toLowerCase();
    return this.boards().filter(b =>
      b.name.toLowerCase().includes(q) || b.workspace_name.toLowerCase().includes(q)
    );
  }

  toggleFavorite(board: BoardResponse): void {
    if (this.favoriteIds.has(board.id)) {
      this.favoriteIds.delete(board.id);
      this.boards.set(this.boards().filter(b => b.id !== board.id));
    } else {
      this.favoriteIds.add(board.id);
    }
    this.saveFavorites();
  }

  private loadFavorites(): void {
    try {
      const stored = localStorage.getItem('matder_favorites');
      if (stored) this.favoriteIds = new Set(JSON.parse(stored));
    } catch { /* ignore */ }
  }

  private saveFavorites(): void {
    localStorage.setItem('matder_favorites', JSON.stringify([...this.favoriteIds]));
  }

  open(id: number): void {
    this.router.navigate([`/dashboard/matder/boards/${id}`]);
  }

  nav(path: string): void {
    this.router.navigate([`/dashboard/matder/${path}`]);
  }
}
