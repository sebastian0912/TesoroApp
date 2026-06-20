import {  Component, Inject, OnDestroy, PLATFORM_ID , ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { SharedModule } from '../../../../shared/shared.module';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import { UtilityServiceService } from '../../../../shared/services/utilityService/utility-service.service';
import { ConsoleLoggerService } from '../../../../shared/services/console-logger/console-logger.service';
import { NetworkStatusService } from '../../../../core/services/network-status.service';
import { OfflineSyncService } from '../../../../core/services/offline-sync.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { getLocalStorageItem, setLocalStorageItem } from '../../../../core/utils/safe-storage';

const SEDES_CACHE_KEY = 'sidebar.sedes.cache.v1';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-sidebar',
  imports: [
    SharedModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
} )
export class SidebarComponent implements OnDestroy {
  role: string = '';
  username: string = '';
  documento: string = '';
  appVersion: string = '';

  // Nombre visible de la sede actual del usuario
  sede: string = '';
  // Listado de sedes para el selector
  sedes: any[] = [];

  /** Estado de red + cola offline (movidos desde el navbar). */
  isOnline = true;
  pendingCount = 0;
  syncProgress: { current: number; total: number; phase: string } | null = null;

  private netSubs: Subscription[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private adminService: UtilityServiceService,
    private router: Router,
    private dialog: MatDialog,
    private consoleLogger: ConsoleLoggerService,
    private networkStatus: NetworkStatusService,
    private offlineSync: OfflineSyncService,
    private cdr: ChangeDetectorRef,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.consoleLogger.init();

      // La versión depende solo del IPC con Electron, no del usuario logueado.
      // Se dispara aquí para que aparezca lo antes posible, sin esperar a
      // ngOnInit / cargarSedes.
      this.getAppVersion();

      // Suscripciones al estado de red — alimentan el chip del header.
      this.netSubs.push(
        this.networkStatus.isOnline$.subscribe(status => {
          this.isOnline = status;
          this.cdr.markForCheck();
        }),
        this.offlineSync.pendingCount$.subscribe(count => {
          this.pendingCount = count;
          this.cdr.markForCheck();
        }),
        this.offlineSync.syncProgress$.subscribe(progress => {
          this.syncProgress = progress;
          this.cdr.markForCheck();
        }),
      );
    }
  }

  ngOnDestroy(): void {
    this.netSubs.forEach(s => s.unsubscribe());
    this.netSubs = [];
  }

  /** Texto humano del estado de red para el tooltip y aria-label. */
  get netStatusTitle(): string {
    if (this.syncProgress) {
      const verb = this.syncProgress.phase === 'sync' ? 'Sincronizando' : 'Actualizando caché';
      return `${verb} ${this.syncProgress.current}/${this.syncProgress.total}`;
    }
    if (!this.isOnline) {
      return this.pendingCount > 0
        ? `Sin conexión · ${this.pendingCount} pendiente(s)`
        : 'Sin conexión';
    }
    return this.pendingCount > 0
      ? `En línea · ${this.pendingCount} pendiente(s) por sincronizar`
      : 'En línea';
  }

  /** Etiqueta corta del chip. */
  get netStatusLabel(): string {
    if (this.syncProgress) return 'Sincronizando';
    return this.isOnline ? 'En línea' : 'Sin conexión';
  }

  /** Icono Material adecuado al estado actual. */
  get netStatusIcon(): string {
    if (this.syncProgress) return 'sync';
    return this.isOnline ? 'cloud_done' : 'cloud_off';
  }

  async ngOnInit(): Promise<void> {
    const user: any = this.adminService.getUser?.();
    if (!user) return;

    this.sede = user?.sede?.nombre ?? '';
    this.role = user?.rol?.nombre ?? '';
    this.documento = user?.numero_de_documento ?? '';
    this.username = [user?.datos_basicos?.nombres, user?.datos_basicos?.apellidos].filter(Boolean).join(' ');

    this.hidratarSedesDesdeCache();
    await this.cargarSedes();
  }

  /**
   * Carga inmediata desde localStorage para que el submenú "Cambiar Sede"
   * tenga contenido aunque el backend esté caído o estemos offline.
   */
  private hidratarSedesDesdeCache(): void {
    try {
      const raw = getLocalStorageItem(SEDES_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        this.sedes = parsed;
        this.cdr.markForCheck();
      }
    } catch {
      // cache corrupta: la ignoramos y dejamos que cargarSedes() la reescriba
    }
  }

  getAppVersion(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const w = window as any;
    const getVersion = w.electron?.version?.get;
    if (typeof getVersion !== 'function') return;
    // OnPush: la promesa resuelve fuera del ciclo de detección, así que
    // hay que markForCheck explícitamente o la vista se queda con appVersion=''.
    Promise.resolve(getVersion()).then((response: any) => {
      this.appVersion = response ?? '';
      this.cdr.markForCheck();
    });
  }

  async cargarSedes(): Promise<void> {
    // Sin red no tiene sentido pegar al backend: el chip ya comunica el estado
    // y la cache local ya hidrató this.sedes en ngOnInit. Salir silenciosamente
    // evita un Swal bloqueante cada vez que se entra al dashboard offline.
    if (!this.isOnline) return;

    try {
      const data: any = await firstValueFrom(this.adminService.traerSucursales());
      // Soporta distintos formatos de respuesta
      const lista = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : Array.isArray(data?.sucursal)
            ? data.sucursal
            : [];

      this.sedes = [...lista].sort((a: any, b: any) => (a?.nombre ?? '').localeCompare(b?.nombre ?? ''));
      this.cdr.markForCheck();

      try {
        setLocalStorageItem(SEDES_CACHE_KEY, JSON.stringify(this.sedes));
      } catch {}
    } catch {
      // Si la cache ya nos dio una lista, no molestamos al usuario con un Swal.
      // Solo avisamos si quedamos completamente sin datos.
      if (!this.sedes.length) {
        Swal.fire('Error', 'No fue posible cargar las sedes.', 'error');
      }
    }
  }

  /**
   * Cambia la sede del usuario actual.
   * Espera un UUID de sede (string). Si tu template envía el objeto, pasa su .id.
   */
  onSedeSeleccionada(sedeId: string): void {
    // Cambiar de sede toca el backend (no se puede encolar offline porque la
    // vista se recarga al confirmar). Bloqueamos de forma explícita en vez de
    // dejar que el HTTP falle con un Swal genérico.
    if (!this.isOnline) {
      Swal.fire(
        'Sin conexión',
        'Necesitas estar en línea para cambiar de sede.',
        'info',
      );
      return;
    }

    const user: any = this.adminService.getUser?.();
    if (!user?.id) {
      Swal.fire('Error', 'No se pudo identificar el usuario.', 'error');
      return;
    }

    // Llamamos el servicio que cambia la sede por cédula (envía UUID)
    this.adminService.cambiarSedePorUsuarioId(user.id, sedeId).subscribe({
      next: (res: any) => {
        // Respuesta esperada: { ok: boolean, changed: boolean, sede_id, sede }
        if (!res?.ok) {
          Swal.fire('Error', 'Hubo un problema al asignar la sede.', 'error');
          return;
        }

        // Buscar el nombre desde el catálogo local si viene solo el id
        const sedeEncontrada = this.sedes.find(s => String(s.id) === String(res.sede_id || sedeId));
        const nombreSede = res?.sede ?? sedeEncontrada?.nombre ?? this.sede;

        // Actualizar user en memoria/localStorage
        user.sede = {
          id: res?.sede_id ?? sedeEncontrada?.id ?? sedeId,
          nombre: nombreSede,
          activa: sedeEncontrada?.activa ?? true
        };
        this.sede = nombreSede;

        // Persistir
        try {
          setLocalStorageItem('user', JSON.stringify(user));
        } catch {}

        Swal.fire('Editado', 'La sede ha sido asignada.', 'success').then(() => {
          const currentUrl = this.router.url;
          this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
            this.router.navigateByUrl(currentUrl);
          });
        });
      },
      error: () => {
        Swal.fire('Error', 'Hubo un problema al asignar la sede.', 'error');
      }
    });
  }

  prueba(): void {
    this.router.navigate(['/dashboard/users/change-password']);
  }

  abrirReporteBug(): void {
    import('../../../../shared/components/bug-report-dialog/bug-report-dialog.component').then(
      (m) => {
        this.dialog.open(m.BugReportDialogComponent, {
          width: '600px',
          maxHeight: '90vh',
          disableClose: true,
        });
      }
    );
  }

  /**
   * Abre el diálogo de "Envíos pendientes" — qué archivos / datos quedaron en
   * cola local sin subir (el número del chip). Disponible online y offline.
   */
  abrirEstadoConexion(): void {
    import('../../../../shared/components/offline-queue-dialog/offline-queue-dialog.component').then(
      (m) => {
        this.dialog.open(m.OfflineQueueDialogComponent, {
          width: '600px',
          maxHeight: '90vh',
          autoFocus: false,
        });
      }
    );
  }
}
