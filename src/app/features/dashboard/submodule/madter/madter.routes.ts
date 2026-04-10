import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent
      ),
  },
  {
    path: 'workspaces',
    loadComponent: () =>
      import('./workspaces/pages/workspaces-page/workspaces-page.component').then(
        (m) => m.WorkspacesPageComponent
      ),
  },
  {
    path: 'workspaces/:id',
    loadComponent: () =>
      import('./workspaces/pages/workspace-detail-page/workspace-detail-page.component').then(
        (m) => m.WorkspaceDetailPageComponent
      ),
  },
  {
    path: 'boards',
    loadComponent: () =>
      import('./boards/pages/boards-page/boards-page.component').then(
        (m) => m.BoardsPageComponent
      ),
  },
  {
    path: 'board/:id',
    loadComponent: () =>
      import('./boards/pages/board-preview-page/board-preview-page.component').then(
        (m) => m.BoardPreviewPageComponent
      ),
  },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./favorites/pages/favorites-page/favorites-page.component').then(
        (m) => m.FavoritesPageComponent
      ),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./calendar/pages/calendar-page/calendar-page.component').then(
        (m) => m.CalendarPageComponent
      ),
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./analytics/pages/analytics-page/analytics-page.component').then(
        (m) => m.AnalyticsPageComponent
      ),
  },
  {
    path: 'import',
    loadComponent: () =>
      import('./import/pages/import-page/import-page.component').then(
        (m) => m.ImportPageComponent
      ),
  },
  { path: '**', redirectTo: 'dashboard' },
];
