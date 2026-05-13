import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, interval, Subject, take } from 'rxjs';
import { startWith, switchMap, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';

import { VetadosService } from '../../service/vetados/vetados.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

import { EventEmitter, Output } from '@angular/core';
import { SharedModule } from '@/app/shared/shared.module';
import { CandidatoRecienteItem, RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-search-for-candidate',
  standalone: true,
  imports: [
    SharedModule,
    MatButtonModule
  ],
  templateUrl: './search-for-candidate.component.html',
  styleUrl: './search-for-candidate.component.css',
} )
export class SearchForCandidateComponent implements OnInit, OnDestroy {
  readonly yesNoStatusConfig: Record<string, { color: string; background: string }> = {
    'Sí': { color: '#065f46', background: '#d1fae5' },
    'No': { color: '#991b1b', background: '#fee2e2' },
  };

  /* ──────────  Outputs  ────────── */
  @Output() codigoContratoChange = new EventEmitter<string>();
  @Output() cedulaSeleccionada = new EventEmitter<string>();
  @Output() nombreCompletoChange = new EventEmitter<string>();
  @Output() idInfoEntrevistaAndreaChange = new EventEmitter<number>();
  // objetos completos
  @Output() candidatoSeleccionado = new EventEmitter<any>();

  /* ──────────  Propiedades  ────────── */
  cedula = '';
  observacion = '';
  mostrarObservacion = false;
  procesoValido = false;
  datosSeleccion: any = null;
  sede = '';

  /* Propiedades eliminadas tabla vetados */
  showTable = false;
  filtroCedula: string = '';

  /* Lista por orden de llegada (consultados o llenando el formulario) */
  recientes: CandidatoRecienteItem[] = [];
  recientesLoading = false;
  private readonly RECIENTES_REFRESH_MS = 3000;
  private readonly RECIENTES_LIMIT = 50;
  /* Cédulas que el usuario marcó "Atender" en este mismo render para refresco optimista. */
  private atendiendoSet = new Set<string>();

  /* Búsqueda manual por cédula: ahora es un slider inline (no un panel lateral). */
  busquedaAbierta = false;

  /** Ref al input de cédula del slider inline; usado para autofocus al abrir. */
  @ViewChild('busquedaInput') private busquedaInputRef?: ElementRef<HTMLInputElement>;

  /* Descarga de Excel: estado del request */
  excelDescargando = false;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private vetadosService: VetadosService,
    private utilityService: UtilityServiceService,
    private registroProcesoContratacion: RegistroProcesoContratacion,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) { }

  /* ──────────  Ciclo de vida  ────────── */
  async ngOnInit(): Promise<void> {
    await this.initUsuarioYAbreviacion();
    this.startRecientesPolling();
  }

  ngOnDestroy(): void {
    // Limpieza adicional si aplica (las suscripciones se auto-cancelan
    // por takeUntilDestroyed sin acción manual).
  }

  private async initUsuarioYAbreviacion(): Promise<void> {
    try {
      const user: any = await this.utilityService.getUser();
      this.sede = user?.sede?.nombre ?? '';
    } catch {
      this.sede = '';
    }
  }

  private startRecientesPolling(): void {
    interval(this.RECIENTES_REFRESH_MS).pipe(
      startWith(0),
      switchMap(() => {
        this.recientesLoading = true;
        this.cdr.markForCheck();
        return this.registroProcesoContratacion.getCandidatosRecientes(
          this.RECIENTES_LIMIT,
          this.sede || undefined
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.recientes = this.dedupeRecientes(data);
        this.recientesLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.recientesLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  refrescarRecientes(): void {
    this.recientesLoading = true;
    this.cdr.markForCheck();
    this.registroProcesoContratacion
      .getCandidatosRecientes(this.RECIENTES_LIMIT, this.sede || undefined)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.recientes = this.dedupeRecientes(data);
          this.recientesLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.recientesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Quita filas con el mismo numero_documento conservando la primera (el backend ya ordena: no atendidos por llegada, atendidos al final). */
  private dedupeRecientes(data: CandidatoRecienteItem[] | null | undefined): CandidatoRecienteItem[] {
    if (!data?.length) return [];
    const vistos = new Set<string>();
    const out: CandidatoRecienteItem[] = [];
    for (const item of data) {
      const key = String(item?.numero_documento ?? '').trim();
      if (!key) {
        out.push(item);
        continue;
      }
      if (vistos.has(key)) continue;
      vistos.add(key);
      out.push(item);
    }
    return out;
  }

  seleccionarReciente(item: CandidatoRecienteItem): void {
    if (!item?.numero_documento) return;
    this.cedula = String(item.numero_documento);

    // Optimismo: marca local y reordena al final mientras llega la respuesta del backend.
    const ced = String(item.numero_documento);
    this.atendiendoSet.add(ced);
    this.applyOptimisticAttended(ced);

    // Marca atendido en backend (tolerante a fallos: no bloquea la navegación).
    this.registroProcesoContratacion
      .markAttended({
        tipo_doc: item.tipo_doc ?? undefined,
        numero_documento: item.numero_documento,
        candidato_id: item.candidato_id,
      })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.atendiendoSet.delete(ced);
          // Refresco inmediato para reflejar el reorden real del backend
          this.refrescarRecientes();
        },
        error: () => {
          // Si falla, revertimos la marca optimista en el siguiente refresco
          this.atendiendoSet.delete(ced);
        },
      });

    this.buscarCandidato();
  }

  /** Marca optimista: pone atendido_hoy=true y mueve el item al final localmente. */
  private applyOptimisticAttended(cedula: string): void {
    const idx = this.recientes.findIndex((r) => String(r.numero_documento) === cedula);
    if (idx < 0) return;
    const item = { ...this.recientes[idx], atendido_hoy: true, atendido_at: new Date().toISOString() };
    const sinAtendidos = this.recientes.filter((r, i) => i !== idx && !r.atendido_hoy);
    const conAtendidos = this.recientes.filter((r, i) => i !== idx && r.atendido_hoy);
    this.recientes = [...sinAtendidos, ...conAtendidos, item];
    this.cdr.markForCheck();
  }

  abrirDialogExcel(): void {
    const ref = this.dialog.open(DateRangeDialogComponent, {
      width: '420px',
      autoFocus: false,
    });
    ref.afterClosed().pipe(take(1)).subscribe((res: { start: string | null; end: string | null } | undefined) => {
      if (!res || !res.start || !res.end) return;
      if (res.end < res.start) {
        Swal.fire('Rango inválido', 'La fecha "Hasta" no puede ser anterior a "Desde".', 'warning');
        return;
      }
      this.descargarExcel(res.start, res.end);
    });
  }

  private descargarExcel(start: string, end: string): void {
    this.excelDescargando = true;
    this.cdr.markForCheck();
    this.registroProcesoContratacion
      .downloadTurnosExcel({ start, end }, this.sede || undefined)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.excelDescargando = false;
          this.cdr.markForCheck();
        },
        error: async (err: any) => {
          this.excelDescargando = false;
          this.cdr.markForCheck();
          // El backend devuelve {message: "..."} como JSON cuando hay error.
          // Como el response es blob, hay que leer y parsear.
          let msg = 'No se pudo descargar el Excel.';
          const blob: Blob | null = err?.error instanceof Blob ? err.error : null;
          if (blob) {
            try {
              const text = await blob.text();
              try {
                const json = JSON.parse(text);
                if (json?.message) msg = String(json.message);
              } catch {
                if (text && text.length < 400) msg = text;
              }
            } catch {
              /* dejamos el msg por defecto */
            }
          } else if (err?.error?.message) {
            msg = String(err.error.message);
          } else if (err?.message) {
            msg = String(err.message);
          }
          const status = err?.status ?? 0;
          Swal.fire(
            'Error al descargar Excel',
            `${msg}<br><br><small>HTTP ${status}</small>`,
            'error'
          );
        }
      });
  }

  /** Toggle del slider de búsqueda inline. Al cerrar también colapsa el reporte. */
  toggleBusqueda(): void {
    this.busquedaAbierta = !this.busquedaAbierta;
    if (!this.busquedaAbierta) {
      this.mostrarObservacion = false;
    } else {
      // Esperar a que el slider termine la transición y enfocar el input.
      setTimeout(() => this.busquedaInputRef?.nativeElement?.focus(), 320);
    }
    this.cdr.markForCheck();
  }

  trackByRecienteId(_idx: number, item: CandidatoRecienteItem): number {
    return item.candidato_id;
  }

  buscarCandidato(): void {
    this.cedula = this.cedula.trim();
    if (!this.cedula) return;

    this.registroProcesoContratacion.getCandidatoPorDocumento(this.cedula, true).pipe(take(1)).subscribe({
      next: (candidato: any) => {
        if (!candidato) {
          this.candidatoSeleccionado.emit(null);
          Swal.fire('No encontrado', 'No se encontró un candidato con esa cédula.', 'info');
          return;
        }
        this.candidatoSeleccionado.emit(candidato);

        // Encolar la cédula en la cola FIFO de mi sede para HOY.
        // Idempotente en backend: si ya estaba en cola hoy en esta sede, no se
        // reordena. Si no, queda al final de la cola.
        const cedula = String(candidato?.numero_documento || this.cedula || '').trim();
        const tipoDoc = String(candidato?.tipo_doc || '').trim() || undefined;
        if (cedula) {
          this.registroProcesoContratacion
            .encolarCandidato({ tipo_doc: tipoDoc, numero_documento: cedula })
            .pipe(take(1), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.refrescarRecientes(),
              error: (err: any) => {
                console.warn('[encolar] no se pudo agregar a cola', err?.status, err?.error);
                // No bloqueamos el flujo: la consulta del candidato igual procede.
              },
            });
        }
      },
      error: () => Swal.fire('Error', 'Error al buscar el candidato.', 'error')
    });
  }

  async buscarCedula(): Promise<void> {
    if (!this.cedula) return;

    this.cedulaSeleccionada.emit(this.cedula);

    try {
      const vetado = await firstValueFrom(
        this.vetadosService.listarReportesVetadosPorCedula(this.cedula).pipe(take(1))
      );
      this.procesarVetado(vetado);
    } catch {
      Swal.fire('Error', 'Error inesperado al consultar la cédula.', 'error');
    }
  }

  /* vetados */
  private procesarVetado(vetado: any[] | null): void {
    if (!vetado?.length) return;
    this.procesoValido = true;
  }

  /* ──────────  Observación  ────────── */
  mostrarCampoObservacion(): void {
    console.log('mostrarCampoObservacion()');
    this.mostrarObservacion = true;
  }

  enviarObservacion(): void {
    if (!this.observacion.trim()) {
      Swal.fire('Error', 'Debe escribir una observación.', 'error');
      return;
    }

    this.utilityService.getUser().then((u: any) => {
      if (!u) {
        Swal.fire('Error', 'No hay usuario en sesión', 'error');
        return;
      }

      const nombre = `${u?.datos_basicos?.nombres ?? ''} ${u?.datos_basicos?.apellidos ?? ''} - ${u?.rol?.nombre ?? ''}`.trim();
      const sedeNombre = u?.sede?.nombre ?? '';

      const reporte = {
        cedula: this.cedula,
        observacion: this.observacion.trim(),
        centro_costo_carnet: '',
        reportadoPor: nombre
      };

      this.vetadosService.enviarReporte(reporte, sedeNombre).pipe(take(1)).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Observación enviada.', 'success');
          this.mostrarObservacion = false;
          this.observacion = '';
        },
        error: () => Swal.fire('Error', 'No se pudo enviar la observación.', 'error')
      });
    });
  }
}
