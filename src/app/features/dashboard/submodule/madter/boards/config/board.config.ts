import { BoardColorOption, CardPriorityOption, CardStatusOption, WorkLabelSuggestion } from '../models/boards.models';

export const BOARD_COLOR_OPTIONS: BoardColorOption[] = [
  { label: 'Sky', value: '#38bdf8' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#fb7185' },
  { label: 'Emerald', value: '#34d399' },
  { label: 'Violet', value: '#a78bfa' },
  { label: 'Slate', value: '#64748b' }
];

export const CARD_PRIORITY_OPTIONS: CardPriorityOption[] = [
  { label: 'Baja', value: 'LOW', accent: '#34d399' },
  { label: 'Media', value: 'MEDIUM', accent: '#38bdf8' },
  { label: 'Alta', value: 'HIGH', accent: '#f59e0b' },
  { label: 'Urgente', value: 'URGENT', accent: '#fb7185' }
];

export const CARD_STATUS_OPTIONS: CardStatusOption[] = [
  { label: 'Por hacer', value: 'TODO', accent: '#64748b' },
  { label: 'En curso', value: 'IN_PROGRESS', accent: '#2563eb' },
  { label: 'Bloqueada', value: 'BLOCKED', accent: '#7c3aed' },
  { label: 'Hecha', value: 'DONE', accent: '#14b8a6' }
];

export const WORK_LABEL_SUGGESTIONS: WorkLabelSuggestion[] = [
  { name: 'Frontend', color: '#38bdf8' },
  { name: 'Backend', color: '#2563eb' },
  { name: 'QA', color: '#14b8a6' },
  { name: 'Bug', color: '#fb7185' },
  { name: 'Bloqueado', color: '#ef4444' },
  { name: 'Diseno', color: '#f59e0b' },
  { name: 'Infraestructura', color: '#8b5cf6' },
  { name: 'Documentacion', color: '#22c55e' },
  { name: 'Reunion', color: '#f97316' },
  { name: 'Cliente', color: '#06b6d4' }
];
