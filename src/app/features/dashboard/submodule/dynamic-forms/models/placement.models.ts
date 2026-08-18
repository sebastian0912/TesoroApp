/**
 * Modelos de UBICACIÓN de formularios dinámicos (wire format snake_case del backend
 * ms-forms, /api/dynamic-forms). El formulario es una VISTA de un módulo anfitrión.
 */

export type PlacementStatus = 'PENDING' | 'LINKED' | 'FAILED' | 'UNLINKED';

/** Nodo del árbol de módulos para el selector de ubicación. */
export interface ModuleNode {
  id: string;
  label: string;
  icon?: string | null;
  route_path?: string | null;
  order_no?: number | null;
  manageable?: boolean;
  children?: ModuleNode[];
}

export interface Placement {
  form_id: number;
  placement_status: PlacementStatus;
  parent_module_id?: string | null;
  module_id?: string | null;
  responses_module_id?: string | null;
  responses_parent_module_id?: string | null;
  responses_menu_enabled?: boolean;
  slug?: string | null;
  route_path?: string | null;
  menu_label?: string | null;
  module_icon?: string | null;
  module_order_no?: number | null;
  placement_error?: string | null;
  placement_updated_at?: string | null;
  warnings?: string[] | null;
}

export interface PlacementRequest {
  parent_module_id: string;
  menu_label?: string;
  slug?: string;
  icon?: string;
  order_no?: number;
  responses_menu_enabled?: boolean;
  responses_parent_module_id?: string | null;
  fill_role_ids?: string[];
}

/** Resolución de una ruta a un formulario (canMatch / deep links). */
export interface RouteResolution {
  form_id: number;
  module_id?: string | null;
  menu_label?: string | null;
  route_path?: string | null;
  /** No nulo si la ruta pedida es un alias: el front debe redirigir aquí. */
  canonical_route_path?: string | null;
  /** true si el formulario quedó UNLINKED (padre/módulo borrado a mano). */
  unlinked?: boolean;
}
