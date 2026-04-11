import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BoardService } from '../../services/board.service';
import { BoardResponse } from '../../models/board.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-boards-page',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="header"><h2>Tableros</h2>
      <mat-form-field appearance="outline" class="search"><mat-label>Buscar</mat-label><input matInput [(ngModel)]="search"><mat-icon matSuffix>search</mat-icon></mat-form-field>
    </div>
    @if (loading()) { <div class="center"><mat-spinner diameter="40"></mat-spinner></div> }
    @else if (filtered.length === 0) { <div class="empty"><mat-icon>dashboard_customize</mat-icon><p>No hay tableros.</p></div> }
    @else {
      <div class="grid">
        @for (b of filtered; track b.id) {
          <mat-card class="bcard" [style.border-top]="'4px solid ' + b.accent" (click)="open(b.id)">
            <strong>{{ b.name }}</strong>
            <span class="ws">{{ b.workspace_name }}</span>
            <p class="desc">{{ b.description || 'Sin descripción' }}</p>
            @if (b.can_manage_content) {
              <button mat-icon-button color="warn" class="del" (click)="del($event, b)" matTooltip="Eliminar"><mat-icon>delete</mat-icon></button>
            }
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .header h2 { margin: 0; font-weight: 500; } .search { width: 240px; }
    .center { display: flex; justify-content: center; padding: 48px; }
    .empty { text-align: center; padding: 48px; } .empty mat-icon { font-size: 48px; width: 48px; height: 48px; color: #9e9e9e; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .bcard { padding: 20px; cursor: pointer; position: relative; } .bcard:hover { box-shadow: 0 4px 16px rgba(0,0,0,.12); }
    .ws { display: block; font-size: .75rem; color: rgba(0,0,0,.45); margin: 2px 0 8px; }
    .desc { font-size: .85rem; color: rgba(0,0,0,.54); margin: 0; }
    .del { position: absolute; top: 8px; right: 8px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardsPageComponent implements OnInit {
  boards = signal<BoardResponse[]>([]);
  loading = signal(true);
  search = '';

  constructor(private boardService: BoardService, private router: Router) {}
  async ngOnInit(): Promise<void> { this.loading.set(true); try { this.boards.set(await this.boardService.listBoards()); } catch {} finally { this.loading.set(false); } }

  get filtered(): BoardResponse[] {
    const t = this.search.toLowerCase();
    if (!t) return this.boards();
    return this.boards().filter(b => b.name.toLowerCase().includes(t) || (b.description ?? '').toLowerCase().includes(t) || b.workspace_name.toLowerCase().includes(t));
  }

  open(id: number): void { this.router.navigate([`/dashboard/matder/boards/${id}`]); }

  async del(e: Event, b: BoardResponse): Promise<void> {
    e.stopPropagation();
    const c = await Swal.fire({ title: `¿Eliminar "${b.name}"?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar' });
    if (c.isConfirmed) { try { await this.boardService.deleteBoard(b.id); this.boards.set(this.boards().filter(x => x.id !== b.id)); } catch {} }
  }
}
