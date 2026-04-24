export interface KanbanProyecto {
  id: number;
  nombre: string;
  descripcion?: string;
  estado: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  created_at: string;
}

export interface KanbanBoard {
  id: number;
  proyecto: number;
  nombre: string;
  descripcion?: string;
  color_acento: string;
  created_at: string;
  updated_at: string;
  listas?: KanbanBoardList[];
  labels?: KanbanLabel[];
}

export interface KanbanBoardList {
  id: number;
  board: number;
  nombre: string;
  posicion: number;
  tipo: 'normal' | 'done' | 'backlog';
  created_at: string;
  updated_at: string;
  cards?: KanbanCardSummary[];
}

export interface KanbanCardSummary {
  id: number;
  titulo: string;
  estado: KanbanCardEstado;
  posicion: number;
  fecha_vencimiento?: string;
  favorita: boolean;
  creador: string;
  asignado?: string;
  lista: number;
  created_at: string;
}

export interface KanbanCard {
  id: number;
  lista: number;
  titulo: string;
  descripcion?: string;
  posicion: number;
  estado: KanbanCardEstado;
  fecha_vencimiento?: string;
  completada_en?: string;
  creador: string;
  creador_nombre?: string;
  asignado?: string;
  asignado_nombre?: string;
  favorita: boolean;
  created_at: string;
  updated_at: string;
  checklist_items?: KanbanChecklistItem[];
  comments?: KanbanCardComment[];
  card_labels?: KanbanCardLabel[];
  assignees?: KanbanCardAssignee[];
  uploads?: KanbanUpload[];
}

export type KanbanCardEstado = 'abierta' | 'en_progreso' | 'completada' | 'archivada';

export interface KanbanLabel {
  id: number;
  board: number;
  nombre: string;
  color_hex: string;
}

export interface KanbanCardLabel {
  id: number;
  card: number;
  label: number;
  label_nombre?: string;
  label_color?: string;
}

export interface KanbanChecklistItem {
  id: number;
  card: number;
  contenido: string;
  completado: boolean;
  posicion: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanCardComment {
  id: number;
  card: number;
  usuario?: string;
  usuario_nombre?: string;
  cuerpo: string;
  created_at: string;
  updated_at: string;
}

export interface KanbanUpload {
  id: number;
  card: number;
  usuario?: string;
  archivo: string;
  nombre_original: string;
  tamano_bytes: number;
  content_type?: string;
  created_at: string;
}

export interface KanbanCardAssignee {
  id: number;
  card: number;
  usuario: string;
  usuario_nombre?: string;
}

export interface KanbanDashboardStats {
  total_boards: number;
  total_cards: number;
  cards_abiertas: number;
  cards_en_progreso: number;
  cards_completadas: number;
  cards_vencidas: number;
}

// ── Submódulo 1: Grupos ──────────────────────────────────

export interface KanbanUserGroup {
  id: number;
  nombre: string;
  descripcion?: string;
  created_at: string;
  updated_at: string;
  memberships?: KanbanGroupMembership[];
  miembros_count?: number;
}

export interface KanbanGroupMembership {
  id: number;
  grupo: number;
  usuario: string;
  usuario_nombre?: string;
  agregado_por?: string;
  created_at: string;
}

export interface KanbanGroupProject {
  id: number;
  proyecto: number;
  grupo: number;
  grupo_nombre?: string;
  proyecto_nombre?: string;
  agregado_por?: string;
  created_at: string;
}

export interface KanbanCardGroupAssignee {
  id: number;
  card: number;
  grupo: number;
  grupo_nombre?: string;
}

// ── Submódulo 2: Notificaciones ──────────────────────────

export type KanbanNotificationType = 'asignacion' | 'comentario' | 'vencimiento' | 'mencion' | 'estado' | 'general';

export interface KanbanNotification {
  id: number;
  usuario: string;
  titulo: string;
  mensaje: string;
  tipo: KanbanNotificationType;
  leida: boolean;
  created_at: string;
}

// ── Submódulo 3: Auditoría ───────────────────────────────

export interface KanbanAuditLog {
  id: number;
  usuario?: string;
  usuario_nombre?: string;
  accion: string;
  tipo_entidad: string;
  id_entidad?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ── Submódulo 4: Import ──────────────────────────────────

export interface KanbanImportLog {
  id: number;
  usuario?: string;
  usuario_nombre?: string;
  proyecto: number;
  nombre_archivo: string;
  boards_creados: number;
  cards_creados: number;
  errores?: string[];
  estado: 'pendiente' | 'procesando' | 'completado' | 'fallido';
  created_at: string;
}

export interface KanbanImportResult {
  id: number;
  boards_creados: number;
  cards_creados: number;
  errores: string[];
  estado: string;
}

// ── Analytics ────────────────────────────────────────────

export interface KanbanAnalytics {
  total_cards: number;
  total_boards: number;
  completadas: number;
  en_progreso: number;
  abiertas: number;
  archivadas: number;
  vencidas: number;
  proximas_vencer: number;
  con_fecha: number;
  asignadas: number;
  sin_asignar: number;
  tasa_completado: number;
  tasa_asignacion: number;
  tasa_con_fecha: number;
  board_indicators: KanbanBoardIndicator[];
}

export interface KanbanBoardIndicator {
  id: number;
  nombre: string;
  total_cards: number;
  abiertas: number;
  en_progreso: number;
  completadas: number;
  sin_asignar: number;
}
