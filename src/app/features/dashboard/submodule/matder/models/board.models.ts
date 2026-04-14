export type ListType = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'UNASSIGNED';

export interface BoardResponse {
  id: number;
  uuid: string;
  workspace: number;
  workspace_name: string;
  workspace_role: string | null;
  name: string;
  description: string | null;
  accent: string;
  can_manage_content: boolean;
  is_favorite?: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardListResponse {
  id: number;
  uuid: string;
  board: number;
  name: string;
  list_type: ListType | null;
  position: number;
  cards: CardSummary[];
  created_at: string;
  updated_at: string;
}

export interface CardSummary {
  id: number;
  uuid: string;
  board_id: number;
  board_list: number;
  title: string;
  status: CardStatus;
  priority: CardPriority;
  due_at: string | null;
  position: number;
  assignee: string | null;
  assignee_name: string | null;
  assignee_group: number | null;
  created_at: string;
}

export type CardStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
export type CardPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ChecklistItemResponse {
  id: number;
  uuid: string;
  card: number;
  content: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CardCommentResponse {
  id: number;
  uuid: string;
  card: number;
  author: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface LabelResponse {
  id: number;
  uuid: string;
  board: number;
  name: string;
  color: string;
  created_at: string;
}

export interface CardLabelResponse {
  id: number;
  card: number;
  label: number;
  label_name: string;
  label_color: string;
}

export interface UploadResponse {
  id: number;
  uuid: string;
  card: number | null;
  original_name: string;
  file: string;
  mime_type: string | null;
  size_bytes: number;
  uploader: string | null;
  created_at: string;
}

export interface CardDetailResponse extends CardSummary {
  description: string | null;
  assignee_group_name: string | null;
  checklist_items: ChecklistItemResponse[];
  comments: CardCommentResponse[];
  card_labels: CardLabelResponse[];
  uploads: UploadResponse[];
  updated_at: string;
}
