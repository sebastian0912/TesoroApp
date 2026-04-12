import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { KanbanService } from '../../services/kanban.service';
import { KanbanDashboardStats, KanbanProyecto } from '../../models/kanban.models';
import { BoardDialogComponent } from '../../components/board-dialog/board-dialog.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-kanban-dashboard',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule, MatProgressSpinnerModule, MatDialogModule,
  ],
  templateUrl: './kanban-dashboard.component.html',
  styleUrls: ['./kanban-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanDashboardComponent implements OnInit {
  stats = signal<KanbanDashboardStats | null>(null);
  loading = signal(true);
  proyectos = signal<KanbanProyecto[]>([]);
  selectedProyecto = signal<number | null>(null);

  constructor(
    private kanbanService: KanbanService,
    private router: Router,
    private dialog: MatDialog,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadProyectos();
    await this.loadStats();
  }

  async loadProyectos(): Promise<void> {
    try {
      const data = await this.kanbanService.getProyectos();
      this.proyectos.set(data);
      if (data.length > 0) {
        this.selectedProyecto.set(data[0].id);
      }
    } catch { /* ignore */ }
  }

  async loadStats(): Promise<void> {
    this.loading.set(true);
    try {
      const pid = this.selectedProyecto() ?? undefined;
      const data = await this.kanbanService.getDashboardStats(pid);
      this.stats.set(data);
    } catch {
      this.stats.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async onProyectoChange(id: number): Promise<void> {
    this.selectedProyecto.set(id);
    await this.loadStats();
  }

  navigateToBoards(): void {
    this.router.navigate(['/dashboard/gestion-proyectos/boards']);
  }

  navigateToCalendar(): void {
    this.router.navigate(['/dashboard/gestion-proyectos/calendario']);
  }

  navigateToFavorites(): void {
    this.router.navigate(['/dashboard/gestion-proyectos/favoritas']);
  }

  navigateTo(path: string): void {
    this.router.navigate([`/dashboard/gestion-proyectos/${path}`]);
  }

  openCreateBoard(): void {
    const dialogRef = this.dialog.open(BoardDialogComponent, {
      width: '520px',
      data: { mode: 'create' },
    });
    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          await this.kanbanService.createBoard(result);
          await this.loadProyectos();
          await this.loadStats();
          Swal.fire('Creado', 'Tablero creado con listas por defecto.', 'success');
        } catch {
          Swal.fire('Error', 'No se pudo crear el tablero.', 'error');
        }
      }
    });
  }
}
