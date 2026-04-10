export interface BoardColorOption {
  label: string;
  value: string;
}

export interface CardPriorityOption {
  label: string;
  value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  accent: string;
}

export interface CardStatusOption {
  label: string;
  value: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  accent: string;
}

export interface WorkLabelSuggestion {
  name: string;
  color: string;
}

export interface BoardLabelChoice {
  id: number | null;
  name: string;
  color: string;
  source: 'board' | 'suggested' | 'custom';
}

export interface BoardsStat {
  label: string;
  value: string;
  caption: string;
  icon: string;
}
