export type ColumnType = 'select' | 'text' | 'date' | 'actions';

export interface ColumnConfig {
  columnDef: string;
  header: string;
  type: ColumnType;
  options?: { value: string; viewValue: string }[];
  placeholder?: string;
  cellFn?: (row: any) => string | number | boolean;
  editable?: boolean; // Si quieres inline editing
  width?: string; // Ej: '150px'
  align?: 'start' | 'center' | 'end';
  tooltipFn?: (row: any) => string; // Para tooltips custom
}

