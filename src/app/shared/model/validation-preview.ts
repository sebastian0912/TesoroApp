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
}

export interface PreviewDialogResult<TResult = any> {
  accepted: boolean;
  result?: TResult;
  items?: any[];
}
