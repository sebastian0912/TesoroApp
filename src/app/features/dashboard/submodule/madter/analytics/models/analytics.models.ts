import { DashboardBoardIndicator, DashboardWorkspaceIndicator } from '../../dashboard/models/dashboard.models';

export interface AnalyticsRingMetric {
  label: string;
  value: string;
  caption: string;
  progress: number;
  accent: string;
  icon: string;
}

export interface AnalyticsSignalCard {
  label: string;
  value: string;
  caption: string;
  tone: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet';
  icon: string;
}

export interface AnalyticsWorkspaceRow extends DashboardWorkspaceIndicator {
  todoShare: number;
  inProgressShare: number;
  blockedShare: number;
  completedShare: number;
}

export interface AnalyticsBoardRow extends DashboardBoardIndicator {
  todoShare: number;
  inProgressShare: number;
  blockedShare: number;
  completedShare: number;
  unassignedShare: number;
}
