export interface WorkspaceViewModel {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  ownerUsername: string;
  currentUserRole: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';
  canManageMembers: boolean;
  canCreateBoards: boolean;
  canDeleteWorkspace: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  boardCount: number;
  latestBoardName: string | null;
}
