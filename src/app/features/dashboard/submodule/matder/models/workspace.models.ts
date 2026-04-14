export type WorkspaceRole = 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export interface WorkspaceResponse {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  owner: string;
  owner_name: string | null;
  member_count: number;
  board_count: number;
  current_user_role: WorkspaceRole | null;
  can_manage_members: boolean;
  can_create_boards: boolean;
  can_delete_workspace: boolean;
  is_favorite?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberResponse {
  id: number;
  workspace: number;
  user: string;
  username: string | null;
  full_name: string | null;
  role: WorkspaceRole;
  active: boolean;
  added_by: string | null;
  joined_at: string;
  updated_at: string;
}
