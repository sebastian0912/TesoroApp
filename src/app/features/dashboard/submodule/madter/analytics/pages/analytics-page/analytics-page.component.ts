import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { AuthResponse, AuthService } from '../../../core/services/auth/auth.service';
import { DashboardService } from '../../../core/services/dashboard/dashboard.service';
import { DashboardOverviewResponse } from '../../../dashboard/models/dashboard.models';
import {
  AnalyticsBoardRow,
  AnalyticsRingMetric,
  AnalyticsSignalCard,
  AnalyticsWorkspaceRow
} from '../../models/analytics.models';

@Component({
  standalone: true,
  selector: 'app-analytics-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './analytics-page.component.html',
  styleUrl: './analytics-page.component.css'
})
export class AnalyticsPageComponent {
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private router = inject(Router);

  loading = true;
  user: AuthResponse | null = null;
  overview: DashboardOverviewResponse | null = null;
  todayLabel = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  constructor() {
    this.loadAnalytics();
  }

  get userLabel(): string {
    return this.user?.fullName?.trim() || this.user?.username || 'Tu espacio';
  }

  get ringMetrics(): AnalyticsRingMetric[] {
    if (!this.overview) {
      return [];
    }

    return [
      {
        label: 'Tareas completadas',
        value: `${this.overview.completionRate}%`,
        caption: `${this.overview.completedTasks} de ${this.overview.totalTasks} tareas ya cerraron su ciclo.`,
        progress: this.overview.completionRate,
        accent: '#14b8a6',
        icon: 'task_alt'
      },
      {
        label: 'Trabajo en curso',
        value: `${this.toPercent(this.overview.inProgressTasks, this.overview.totalTasks)}%`,
        caption: `${this.overview.inProgressTasks} tareas estan avanzando activamente ahora mismo.`,
        progress: this.toPercent(this.overview.inProgressTasks, this.overview.totalTasks),
        accent: '#2563eb',
        icon: 'play_circle'
      },
      {
        label: 'Asignacion cubierta',
        value: `${this.overview.assignmentCoverageRate}%`,
        caption: `${this.overview.assignedTasks} tareas ya tienen responsable directo.`,
        progress: this.overview.assignmentCoverageRate,
        accent: '#0f766e',
        icon: 'assignment_ind'
      },
      {
        label: 'Fechas definidas',
        value: `${this.overview.dueDateCoverageRate}%`,
        caption: `${this.overview.tasksWithDueDate} tareas ya cuentan con fecha limite registrada.`,
        progress: this.overview.dueDateCoverageRate,
        accent: '#f59e0b',
        icon: 'event'
      }
    ];
  }

  get signalCards(): AnalyticsSignalCard[] {
    if (!this.overview) {
      return [];
    }

    return [
      {
        label: 'Tareas vencidas',
        value: String(this.overview.overdueTasks),
        caption: 'Trabajo que ya quedo fuera de su fecha limite.',
        tone: 'rose',
        icon: 'warning'
      },
      {
        label: `En ${this.overview.dueSoonWindowDays} dias`,
        value: String(this.overview.dueSoonTasks),
        caption: 'Trabajo que requiere seguimiento antes de vencer.',
        tone: 'amber',
        icon: 'event_upcoming'
      },
      {
        label: 'Sin asignar',
        value: String(this.overview.unassignedTasks),
        caption: 'Trabajo abierto que aun no tiene responsable.',
        tone: 'sky',
        icon: 'person_off'
      },
      {
        label: 'Bloqueadas',
        value: String(this.overview.blockedTasks),
        caption: 'Trabajo detenido por dependencias o impedimentos.',
        tone: 'violet',
        icon: 'block'
      }
    ];
  }

  get workspaceRows(): AnalyticsWorkspaceRow[] {
    return (this.overview?.workspaceIndicators ?? []).map(workspace => ({
      ...workspace,
      todoShare: this.toPercent(workspace.todoTaskCount, workspace.taskCount),
      inProgressShare: this.toPercent(workspace.inProgressTaskCount, workspace.taskCount),
      blockedShare: this.toPercent(workspace.blockedTaskCount, workspace.taskCount),
      completedShare: this.toPercent(workspace.completedTaskCount, workspace.taskCount)
    }));
  }

  get boardRows(): AnalyticsBoardRow[] {
    return (this.overview?.boardIndicators ?? []).map(board => ({
      ...board,
      todoShare: this.toPercent(board.todoTaskCount, board.taskCount),
      inProgressShare: this.toPercent(board.inProgressTaskCount, board.taskCount),
      blockedShare: this.toPercent(board.blockedTaskCount, board.taskCount),
      completedShare: this.toPercent(board.completedTaskCount, board.taskCount),
      unassignedShare: this.toPercent(board.unassignedTaskCount, board.taskCount),
    }));
  }

  goToDashboard(): void {
    void this.router.navigate(['/dashboard/madter/dashboard']);
  }

  goToBoards(): void {
    void this.router.navigate(['/dashboard/madter/boards']);
  }

  openBoard(boardId: number): void {
    void this.router.navigate(['/dashboard/madter/board', boardId]);
  }

  trackWorkspace(_: number, workspace: AnalyticsWorkspaceRow): number {
    return workspace.id;
  }

  trackBoard(_: number, board: AnalyticsBoardRow): number {
    return board.id;
  }

  private loadAnalytics(): void {
    forkJoin({
      user: this.authService.me(),
      overview: this.dashboardService.getOverview()
    }).subscribe({
      next: ({ user, overview }) => {
        this.user = user;
        this.overview = overview;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        void this.router.navigate(['/dashboard/madter/dashboard']);
      }
    });
  }

  private toPercent(value: number, total: number): number {
    if (!total) {
      return 0;
    }

    return Math.round((value * 100) / total);
  }
}
