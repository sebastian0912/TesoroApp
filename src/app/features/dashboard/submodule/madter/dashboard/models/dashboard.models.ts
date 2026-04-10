export interface DashboardStat {
  label: string;
  value: string;
  caption: string;
  icon: string;
}

export interface ActivityItem {
  icon: string;
  title: string;
  description: string;
  time: string;
}

export interface DashboardOverviewResponse {
  totalWorkspaces: number;
  activeWorkspaces: number;
  totalBoards: number;
  activeBoards: number;
  totalLists: number;
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  assignedTasks: number;
  unassignedTasks: number;
  tasksWithDueDate: number;
  completionRate: number;
  workspaceCoverageRate: number;
  boardCoverageRate: number;
  assignmentCoverageRate: number;
  dueDateCoverageRate: number;
  dueSoonWindowDays: number;
  workspaceIndicators: DashboardWorkspaceIndicator[];
  boardIndicators: DashboardBoardIndicator[];
}

export interface DashboardWorkspaceIndicator {
  id: number;
  name: string;
  boardCount: number;
  taskCount: number;
  todoTaskCount: number;
  inProgressTaskCount: number;
  blockedTaskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  dueSoonTaskCount: number;
  progressPercent: number;
}

export interface DashboardBoardIndicator {
  id: number;
  name: string;
  workspaceName: string;
  accent: string;
  listCount: number;
  taskCount: number;
  todoTaskCount: number;
  inProgressTaskCount: number;
  blockedTaskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  dueSoonTaskCount: number;
  unassignedTaskCount: number;
  progressPercent: number;
}
