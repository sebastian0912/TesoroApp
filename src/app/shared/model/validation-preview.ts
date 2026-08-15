export type PreviewPhase = 'pre' | 'post';
export type PreviewFieldType = 'text' | 'select' | 'number';
export type PreviewSeverity = 'error' | 'warn' | 'info';

export interface PreviewIssue {
  id: string;
  itemId: string;
  severity: PreviewSeverity;
  message: string;
  field?: string; // clave del campo editable si aplica
  meta?: any; // opcional: rowIndex, code, etc.
  resolutionAction?: string; // 'upload-pdf' | etc.
  category?: string; // tipo/categoría del issue (p.ej. 'Sin equivalencia CECO').
                     // Si los issues la traen, el diálogo muestra un resumen por tipo.
}

export interface PreviewColumn<T = any> {
  key: string;
  header: string;
  width?: string;
  cell: (item: T) => any;
}

export interface PreviewOption<T = any> {
  value: T;
  label: string;
}

export interface PreviewField<T = any> {
  key: string;
  label: string;
  type: PreviewFieldType;

  placeholder?: string;
  hint?: string;

  required?: boolean;

  options?: PreviewOption<any>[];

  visible?: (item: T) => boolean;
  disabled?: (item: T) => boolean;

  normalize?: (value: any, item: T) => any;
  validate?: (value: any, item: T) => string | null;

  onChange?: (item: T) => void;
}

export interface PreviewSchema<TItem = any, TResult = any> {
  title: string;
  subtitle?: string;

  itemId: (item: TItem) => string;

  columns: PreviewColumn<TItem>[];
  editFields: PreviewField<TItem>[];

  validateItem: (item: TItem) => PreviewIssue[];

  // Validaciones cruzadas (duplicados, consistencia, etc.)
  validateAll?: (items: TItem[]) => PreviewIssue[];

  // Qué devuelve el diálogo cuando todo está OK
  buildResult: (items: TItem[]) => TResult;

  allowRemove?: boolean;
  removeLabel?: string;
  allowCancel?: boolean;
}

export interface PreviewDialogData<TItem = any, TResult = any> {
  schema: PreviewSchema<TItem, TResult>;
  items: TItem[];

  // fase + issues externos (backend)
  phase?: PreviewPhase;
  externalIssues?: PreviewIssue[];

  // overrides opcionales (si quieres reemplazar el título/subtítulo del schema en el diálogo)
  title?: string;
  subtitle?: string;

  // Si es true, el bloque "Resumen por tipo de caso" lista SOLO categorías de
  // error (oculta las advertencias). Opt-in por pantalla; por defecto muestra
  // errores y advertencias.
  summaryErrorsOnly?: boolean;

  // Handlers opcionales
  uploadHandler?: (file: File, itemId: string) => Promise<void> | void;

  // Validación contra servidor al apretar "Confirmar Todo". Si se define, el
  // dialog NO cierra de inmediato: llama al handler, marca como removidas las
  // filas que el servidor aceptó (acceptedItemIds) y empuja a externalIssues
  // los motivos del servidor para las filas rechazadas. El usuario corrige y
  // reintenta hasta que la lista esté vacía. El dialog cierra automáticamente
  // cuando ya no quedan filas pendientes.
  serverValidate?: (items: TItem[]) => Promise<ServerValidateResult>;
}

export interface ServerValidateResult {
  acceptedItemIds: string[];
  errors: PreviewIssue[];
  // Resultado acumulado del servidor (lo que normalmente regresaría la HTTP),
  // se devuelve al llamador en PreviewDialogResult.result cuando todo pasó.
  serverResult?: unknown;
}

export interface PreviewDialogResult<TResult = any> {
  accepted: boolean;
  result?: TResult;
  items?: any[];
}
