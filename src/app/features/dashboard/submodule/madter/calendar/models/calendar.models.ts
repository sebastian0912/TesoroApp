export interface CalendarTask {
  id: number;
  boardId: number;
  boardListId: number;
  workspaceId: number;
  title: string;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: string;
  boardName: string;
  boardListName: string;
  workspaceName: string;
  accent: string;
  boardAccessible: boolean;
  // Optimizaciones de rendimiento
  searchableContent: string;
  dateKey: string;
}

export interface CalendarDay {
  key: string;
  label: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  tasks: CalendarTask[];
}
