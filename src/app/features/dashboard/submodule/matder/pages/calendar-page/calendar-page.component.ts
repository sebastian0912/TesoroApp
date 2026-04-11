import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BoardService } from '../../services/board.service';
import { CardSummary } from '../../models/board.models';

@Component({
  selector: 'app-calendar-page', standalone: true,
  imports: [DatePipe, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h2>Calendario</h2>
    @if (loading()) { <div class="center"><mat-spinner diameter="40"></mat-spinner></div> }
    @else if (cards().length === 0) { <mat-card class="empty"><mat-icon>event_busy</mat-icon><p>No hay tarjetas con fecha de vencimiento asignadas.</p></mat-card> }
    @else { <div class="list">@for (c of cards(); track c.id) {
      <mat-card class="item"><div class="pri" [style.background]="prioColor(c.priority)"></div><div class="body"><strong>{{ c.title }}</strong><span>{{ c.due_at | date:'mediumDate' }} · {{ c.status }} · {{ c.priority }}</span></div></mat-card>
    }</div> }
  `,
  styles: [`.center{display:flex;justify-content:center;padding:48px}h2{font-weight:500}.empty{text-align:center;padding:48px}.empty mat-icon{font-size:48px;width:48px;height:48px;color:#9e9e9e}.list{display:flex;flex-direction:column;gap:8px}.item{display:flex;overflow:hidden}.pri{width:4px;flex-shrink:0}.body{padding:12px;flex:1}.body strong{display:block}.body span{font-size:.8rem;color:rgba(0,0,0,.5)}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPageComponent implements OnInit {
  cards = signal<CardSummary[]>([]);
  loading = signal(true);
  constructor(private boardService: BoardService) {}
  async ngOnInit(): Promise<void> { try { this.cards.set(await this.boardService.getCalendarCards()); } catch {} finally { this.loading.set(false); } }
  prioColor(p: string): string { return ({ LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', URGENT: '#7c3aed' } as any)[p] ?? '#9e9e9e'; }
}
