import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/kanban-dashboard/kanban-dashboard.component').then(m => m.KanbanDashboardComponent),
  },
  {
    path: 'boards',
    loadComponent: () =>
      import('./pages/boards-list/boards-list.component').then(m => m.BoardsListComponent),
  },
  {
    path: 'board/:boardId',
    loadComponent: () =>
      import('./pages/board-view/board-view.component').then(m => m.BoardViewComponent),
  },
  {
    path: 'calendario',
    loadComponent: () =>
      import('./pages/kanban-calendar/kanban-calendar.component').then(m => m.KanbanCalendarComponent),
  },
  {
    path: 'favoritas',
    loadComponent: () =>
      import('./pages/kanban-favorites/kanban-favorites.component').then(m => m.KanbanFavoritesComponent),
  },
  {
    path: 'grupos',
    loadComponent: () =>
      import('./pages/kanban-groups/kanban-groups.component').then(m => m.KanbanGroupsComponent),
  },
  {
    path: 'notificaciones',
    loadComponent: () =>
      import('./pages/kanban-notifications/kanban-notifications.component').then(m => m.KanbanNotificationsComponent),
  },
  {
    path: 'auditoria',
    loadComponent: () =>
      import('./pages/kanban-audit/kanban-audit.component').then(m => m.KanbanAuditComponent),
  },
  {
    path: 'importar',
    loadComponent: () =>
      import('./pages/kanban-import/kanban-import.component').then(m => m.KanbanImportComponent),
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./pages/kanban-analytics/kanban-analytics.component').then(m => m.KanbanAnalyticsComponent),
  },
];
