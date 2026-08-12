import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../shared.module';
import { BugReportService, BugReportPayload } from '../../services/bug-report/bug-report.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-bug-report-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule],
  templateUrl: './bug-report-dialog.component.html',
  styleUrl: './bug-report-dialog.component.css',
})
export class BugReportDialogComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  capturando = true;
  screenshotPreview: string | null = null;

  categorias = [
    'Error de interfaz',
    'Error de funcionalidad',
    'Error de carga/rendimiento',
    'Error de datos',
    'Error de permisos',
    'Mejora/Sugerencia',
    'Otro',
  ];

  prioridades = ['Baja', 'Media', 'Alta', 'Crítica'];

  autoData: Partial<BugReportPayload> = {};

  constructor(
    private dialogRef: MatDialogRef<BugReportDialogComponent>,
    private fb: FormBuilder,
    private bugReportService: BugReportService,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) private data: { screenshot: string | null }
  ) {}

  async ngOnInit(): Promise<void> {
    this.form = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', [Validators.required]],
      categoria: ['Error de funcionalidad', Validators.required],
      prioridad: ['Media', Validators.required],
    });

    // Usar screenshot pre-capturado (antes de abrir el dialog) + resto de datos del sistema
    try {
      const fallback = this.bugReportService.getFallbackData();
      this.autoData = {
        ...fallback,
        screenshot_base64: this.data?.screenshot ?? null,
      };
      this.screenshotPreview = this.autoData.screenshot_base64 || null;
    } catch {
      this.autoData = this.bugReportService.getFallbackData();
    }
    this.capturando = false;
    this.cdr.markForCheck();
  }

  async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    const payload: BugReportPayload = {
      ...this.autoData as BugReportPayload,
      titulo: this.form.value.titulo,
      descripcion: this.form.value.descripcion,
      categoria: this.form.value.categoria,
      prioridad: this.form.value.prioridad,
      datos_adicionales: {},
    };

    this.bugReportService.enviarReporte(payload).subscribe({
      next: () => {
        this.loading = false;
        this.cdr.markForCheck();
        Swal.fire('Enviado', 'Tu reporte de bug ha sido enviado correctamente.', 'success');
        this.dialogRef.close(true);
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
        Swal.fire('Error', 'No se pudo enviar el reporte. Intenta de nuevo.', 'error');
      },
    });
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
