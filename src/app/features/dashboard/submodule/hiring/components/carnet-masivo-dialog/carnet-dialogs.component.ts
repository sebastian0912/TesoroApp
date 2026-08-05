/**
 * Alias histórico: estos diálogos se movieron a `shared/components/confirm-dialog`
 * al necesitarlos también el pipeline (borrar procesos desde el historial).
 * Se reexportan con los nombres viejos para no tocar los llamadores.
 */
export {
  AvisoDialogComponent as CarnetAvisoDialogComponent,
  ProgresoDialogComponent as CarnetProgresoDialogComponent,
} from '@/app/shared/components/confirm-dialog/confirm-dialog.component';
export type { AvisoDialogData as CarnetAvisoData } from '@/app/shared/components/confirm-dialog/confirm-dialog.component';
