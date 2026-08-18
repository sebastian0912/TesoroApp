/**
 * Modelos de Formularios Dinámicos. El API (ms-forms, /api/dynamic-forms) habla
 * snake_case — convención JSON de toda la plataforma — así que las interfaces
 * espejan el wire format tal cual (sin capas de mapeo ni shapes alternativos).
 * Contrato ÚNICO y tipado: nada de `any` en el dominio.
 *
 * Los tipos a nivel de CAMPO (DynamicField, FieldSchema, DocumentRef, FieldValue...)
 * viven en shared/components/forms/field.model.ts porque los componentes de campo
 * compartidos también los usan; aquí se re-exportan para tener un import único.
 */

export * from '@/app/shared/components/forms/field.model';

import { DynamicField, FieldSchema, FieldType, FieldValue } from '@/app/shared/components/forms/field.model';

export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type VersionStatus = 'PUBLISHED' | 'DEPRECATED';

export interface FormSection {
  code?: string;
  title?: string | null;
  order_no: number;
  fields: DynamicField[];
}

export interface VersionInfo {
  id: number;
  version: number;
  status: VersionStatus;
  published_at: string | null;
  created_by?: string | null;
  submissions_count?: number;
}

export interface FormStructure {
  form_id: number;
  form_code: string;
  form_name: string;
  form_description?: string | null;
  version: VersionInfo;
  sections: FormSection[];
}

export interface FormSummary {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  module_id?: string | null;
  responses_module_id?: string | null;
  owner_user_id: string;
  active: boolean;
  is_public: boolean;
  current_version?: number | null;
  submissions_count: number;
  created_at: string;
  updated_at?: string | null;
}

export interface FormDetail extends FormSummary {
  client_id?: string | null;
  created_by?: string | null;
  /** ok | partial | failed | skipped — resultado del aprovisionamiento de módulos. */
  provisioning?: string | null;
}

export interface FieldTypeInfo {
  code: FieldType;
  name: string;
  description?: string | null;
  icon: string;
  default_config: FieldSchema;
  order_no: number;
}

export interface PageResult<T> {
  content: T[];
  total: number;
  page: number;
  size: number;
}

/** { [sectionCode]: { [fieldName]: valor } } */
export type SubmissionPayload = Record<string, Record<string, FieldValue>>;

export interface Submission {
  id: number;
  form_id: number;
  form_code?: string | null;
  form_name?: string | null;
  version_id: number;
  version?: number | null;
  status: SubmissionStatus;
  payload: SubmissionPayload;
  submitted_at: string | null;
  created_by: string | null;
  public_link_id: number | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PublicLink {
  id: number;
  form_id: number;
  token: string;
  url: string;
  expires_at: string | null;
  max_submissions: number | null;
  submissions_count: number;
  revoked_at: string | null;
  created_at: string;
}

export interface DailyPoint {
  date: string;
  total: number;
}

export interface FieldStats {
  section: string;
  name: string;
  label: string;
  type: FieldType;
  distribution?: Record<string, number> | null;
  avg?: number | null;
  min?: number | null;
  max?: number | null;
  answered: number;
}

export interface FormAnalytics {
  form_id: number;
  total_submissions: number;
  by_status: Record<string, number>;
  daily: DailyPoint[];
  fields: FieldStats[];
}

export interface ProvisioningResult {
  status: 'ok' | 'partial' | 'failed' | 'skipped';
  module_id?: string | null;
  responses_module_id?: string | null;
  warnings?: string[];
}

// ---------- Requests ----------

export interface BuilderRequest {
  name: string;
  description?: string | null;
  category?: string | null;
  is_public?: boolean;
  client_id?: string | null;
  menu_parent_module_id?: string | null;
  fill_role_ids?: string[];
  sections: FormSection[];
}

export interface FormPatchRequest {
  name?: string;
  description?: string | null;
  category?: string | null;
  is_public?: boolean;
  active?: boolean;
}

export interface SubmissionCreateRequest {
  status?: SubmissionStatus;
  payload: SubmissionPayload;
}

export interface PublicLinkCreateRequest {
  expires_in_days?: number | null;
  max_submissions?: number | null;
}

/** Error RFC 7807 que devuelve el backend (propiedad code = código de negocio df_*). */
export interface ApiProblem {
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: Array<{ section: string; field: string; code: string; message: string }>;
}
