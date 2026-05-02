import {
  Component,
  EventEmitter,
  OnInit,
  OnDestroy,
  Output,
  Inject,
  PLATFORM_ID,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from '../../../../shared/shared.module';
import { NetworkStatusService } from '../../../../core/services/network-status.service';
import { OfflineSyncService } from '../../../../core/services/offline-sync.service';

export interface PermNode {
  id: string;
  nombre: string;
  ruta?: string;
  icono?: string;
  orden?: number;
  acciones?: string[];
  permiso_ids?: Record<string, string>;
  hijos?: PermNode[];

  // Campos pre-calculados durante decorate(). El template los lee directo
  // para no recomputar string-ops y recorridos en cada change-detection.
  __route?: string;
  __icon?: string;
  __canRead?: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-navbar',
  standalone: true,
  imports: [SharedModule, RouterModule, MatIconModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Output() public menuToggle = new EventEmitter<boolean>();

  public isSidebarHidden = false;
  public isMobile = false;
  public pinOpen = false;
  public currentRoute?: string;
  public isOnline = true;
  public pendingCount = 0;
  public syncProgress: { current: number; total: number; phase: string } | null = null;

  // Lo que el template realmente renderiza: árbol decorado y filtrado por permiso.
  public visibleRoots: PermNode[] = [];
  public activeRoot: PermNode | null = null;

  // Set de root.id activos por la ruta actual. Lookup O(1) desde el template
  // en lugar del DFS-por-render que hacía `isTreeActive` antes.
  private activeRootIds = new Set<string>();

  private expanded: Record<string, boolean> = {};
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly CLOSE_DELAY = 500;
  private readonly MOBILE_BREAKPOINT = 900;
  private readonly READ_KEYS = new Set(['VER', 'LEER', 'READ', 'VIEW']);

  private routerSubscription?: Subscription;
  private offlineSubs: Subscription[] = [];
  private onQueueUpdated?: () => void;
  private onRequestFailed?: (ev: Event) => void;
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private router: Router,
    private http: HttpClient,
    private networkStatus: NetworkStatusService,
    private offlineSync: OfflineSyncService,
    private cdr: ChangeDetectorRef,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      // Subs guardadas para teardown en ngOnDestroy. Antes el navbar dejaba
      // 3 subs y 2 listeners abiertos en cada reinstancia (HMR, login/logout
      // repetido) → toasts duplicados y leak.
      this.offlineSubs.push(
        this.networkStatus.isOnline$.subscribe(status => { this.isOnline = status; }),
        this.offlineSync.pendingCount$.subscribe(count => { this.pendingCount = count; }),
        this.offlineSync.syncProgress$.subscribe(progress => {
          this.syncProgress = progress;
          this.cdr.markForCheck();
        }),
      );

      this.onQueueUpdated = () => this.offlineSync.updatePendingCount();
      window.addEventListener('offline-queue-updated', this.onQueueUpdated);

      // Toast no-bloqueante cuando una request encolada falla en replay.
      // Antes el fallo era silencioso: la fila se marcaba 'failed' y los
      // archivos se borraban sin avisar al usuario.
      this.onRequestFailed = (ev: Event) => {
        const detail = (ev as CustomEvent).detail || {};
        const url: string = detail.url || '';
        const reason: string = detail.reason || 'Error desconocido';
        const shortPath = (() => {
          try { return new URL(url, environment.apiUrl).pathname; } catch { return url; }
        })();
        Swal.fire({
          toast: true,
          position: 'bottom-end',
          icon: 'error',
          title: 'Envío offline falló',
          text: `${shortPath} → ${reason}`,
          timer: 6000,
          showConfirmButton: false,
        });
      };
      window.addEventListener('offline-request-failed', this.onRequestFailed);
    }
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.loadPermTreeFromStorage();
      this.refreshPermisos();
      this.loadUIState();
      this.checkMobile();
      window.addEventListener('resize', this.onResize);
    }

    this.routerSubscription = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentRoute = e.urlAfterRedirects;
        this.recomputeActiveRoots();

        if (!this.pinOpen) this.activeRoot = null;
        if (this.isMobile) this.isSidebarHidden = true;

        this.saveUIState();
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.cancelClose();
    for (const s of this.offlineSubs) {
      try { s.unsubscribe(); } catch { /* noop */ }
    }
    this.offlineSubs = [];
    if (this.isBrowser) {
      window.removeEventListener('resize', this.onResize);
      if (this.onQueueUpdated) {
        window.removeEventListener('offline-queue-updated', this.onQueueUpdated);
        this.onQueueUpdated = undefined;
      }
      if (this.onRequestFailed) {
        window.removeEventListener('offline-request-failed', this.onRequestFailed);
        this.onRequestFailed = undefined;
      }
    }
  }

  // ===== localStorage SSR-safe =====
  private lsGet(key: string): string | null {
    if (!this.isBrowser) return null;
    try { return localStorage.getItem(key); } catch { return null; }
  }
  private lsSet(key: string, val: string): void {
    if (!this.isBrowser) return;
    try { localStorage.setItem(key, val); } catch { /* noop */ }
  }
  private lsClear(): void {
    if (!this.isBrowser) return;
    try { localStorage.clear(); } catch { /* noop */ }
  }

  private loadUIState(): void {
    this.isSidebarHidden = this.lsGet('sidebarHidden') === 'true';
    this.pinOpen = this.lsGet('sidebarPin') === 'true';
  }

  private saveUIState(): void {
    this.lsSet('sidebarHidden', String(this.isSidebarHidden));
    this.lsSet('sidebarPin', String(this.pinOpen));
  }

  // ===== cierre por hover =====
  cancelClose(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  public scheduleClose(ev?: MouseEvent | PointerEvent): void {
    if (!this.isBrowser) return;
    if (this.pinOpen || this.isMobile) return;

    const to = (ev?.relatedTarget ?? null) as Node | null;
    if (to) {
      const sidebar = document.getElementById('app-sidebar');
      if (sidebar && sidebar.contains(to)) return;
    }

    this.cancelClose();
    this.closeTimer = setTimeout(() => {
      this.activeRoot = null;
      this.cdr.markForCheck();
    }, this.CLOSE_DELAY);
  }

  onLeafClick(): void {
    this.cancelClose();
    this.activeRoot = null;

    if (this.isBrowser && typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches) {
      this.isSidebarHidden = true;
    }
    this.saveUIState();
  }

  // ===== permisos =====
  private loadPermTreeFromStorage(): void {
    try {
      const rawUser = this.lsGet('user');
      const rawTree = this.lsGet('permisos_tree');

      let tree: unknown = null;
      if (rawUser) {
        const user = JSON.parse(rawUser);
        tree = user?.permisos_tree ?? null;
      }
      if (!Array.isArray(tree) && rawTree) {
        tree = JSON.parse(rawTree);
      }
      if (!Array.isArray(tree)) return;

      this.setTree(tree as PermNode[]);
    } catch {
      if (this.isBrowser) {
        Swal.fire({
          icon: 'error',
          title: 'Error de permisos',
          text: 'No se pudo cargar el árbol de permisos.',
        });
      }
    }
  }

  /**
   * Punto único donde el árbol entrante se normaliza, decora y filtra. El
   * template lee `visibleRoots` y nunca recalcula nada por nodo en render.
   */
  private setTree(raw: PermNode[]): void {
    const decorated = raw.map(n => this.decorate(n));
    this.visibleRoots = decorated.filter(n => n.__canRead);
    this.purgeStaleExpanded(decorated);
    this.recomputeActiveRoots();
    this.cdr.markForCheck();
  }

  /**
   * Pre-computa ruta, ícono y permiso por nodo. Una sola vez por carga de
   * árbol. El template lee `node.__route` / `node.__icon` directamente.
   */
  private decorate(n: PermNode): PermNode {
    const hijos = (n.hijos ?? []).map(h => this.decorate(h));
    return {
      ...n,
      acciones: n.acciones ?? [],
      permiso_ids: n.permiso_ids ?? {},
      hijos,
      __route: this.computeRoute(n),
      __icon: this.computeIcon(n),
      __canRead: this.computeCanRead(n, hijos),
    };
  }

  private computeRoute(node: PermNode): string {
    const base = '/dashboard';
    if (!node.ruta) return base;
    if (node.ruta.startsWith('/')) return node.ruta;
    return `${base}/${node.ruta}`;
  }

  private computeIcon(node: PermNode): string {
    return node?.icono || '';
  }

  private computeCanRead(node: PermNode, decoratedChildren: PermNode[]): boolean {
    const acc = (node.acciones ?? []).map(a => (a || '').toUpperCase());
    if (acc.some(a => this.READ_KEYS.has(a))) return true;
    const permKeys = Object.keys(node.permiso_ids ?? {}).map(k => k.toUpperCase());
    if (permKeys.some(k => this.READ_KEYS.has(k))) return true;
    return decoratedChildren.some(c => c.__canRead === true);
  }

  private purgeStaleExpanded(roots: PermNode[]): void {
    const live = new Set<string>();
    const walk = (ns: PermNode[]) => ns.forEach(n => { live.add(n.id); walk(n.hijos ?? []); });
    walk(roots);
    for (const k of Object.keys(this.expanded)) {
      if (!live.has(k)) delete this.expanded[k];
    }
  }

  public refreshPermisos(): void {
    const rawUser = this.lsGet('user');
    if (!rawUser) return;
    try {
      const user = JSON.parse(rawUser);
      if (!user?.id) return;

      const apiUrl = environment.apiUrl.replace(/\/$/, '');
      this.http.get<any>(`${apiUrl}/gestion_admin/usuarios/${user.id}/`).subscribe({
        next: (resp) => {
          this.lsSet('user', JSON.stringify(resp));
          this.loadPermTreeFromStorage();
        },
        error: (err) => console.error('Error fetching dynamic perms', err),
      });
    } catch (e) {
      console.error('Error loading user perms', e);
    }
  }

  // ===== template helpers =====
  public hasChildren(n: PermNode | null | undefined): boolean {
    return !!n?.hijos?.length;
  }

  public onRootClick(root: PermNode | null): void {
    if (!root) {
      this.activeRoot = null;
      if (this.isMobile) this.isSidebarHidden = true;
      this.saveUIState();
      return;
    }
    this.cancelClose();
    this.activeRoot = root;
    (root.hijos ?? []).forEach(h => (this.expanded[h.id] = true));
    if (this.isMobile) this.isSidebarHidden = false;
    this.saveUIState();
  }

  public onNodeClick(node: PermNode): void {
    if (this.hasChildren(node)) {
      this.toggleNode(node.id);
      return;
    }
    this.router.navigateByUrl(this.getNodeRoute(node));
    this.onLeafClick();
  }

  // ===== expand/collapse =====
  public isExpanded(id: string): boolean {
    return !!this.expanded[id];
  }

  public toggleNode(id: string): void {
    this.expanded[id] = !this.expanded[id];
  }

  // ===== rutas / íconos (lectura cacheada) =====
  public getNodeRoute(node: PermNode): string {
    return node.__route ?? this.computeRoute(node);
  }

  public getNodeIcon(node: PermNode): string {
    return node.__icon || 'radio_button_unchecked';
  }

  public getModuleIcon(node: PermNode): string {
    return node.__icon || 'widgets';
  }

  public isRouteActive(route: string): boolean {
    return (this.currentRoute ?? this.router.url) === route;
  }

  public isTreeActive(root: PermNode): boolean {
    return this.activeRootIds.has(root.id);
  }

  /**
   * Recorre el árbol decorado una sola vez por cambio de ruta y guarda los
   * root.id cuya descendencia contiene la ruta actual. El template solo hace
   * `.has()` después.
   */
  private recomputeActiveRoots(): void {
    const current = this.currentRoute ?? this.router.url;
    const next = new Set<string>();
    for (const root of this.visibleRoots) {
      if (this.subtreeMatchesRoute(root, current)) next.add(root.id);
    }
    this.activeRootIds = next;
  }

  private subtreeMatchesRoute(node: PermNode, current: string): boolean {
    if (!this.hasChildren(node)) return node.__route === current;
    return (node.hijos ?? []).some(h => this.subtreeMatchesRoute(h, current));
  }

  // ===== responsive =====
  private onResize = () => this.checkMobile();

  private checkMobile(): void {
    if (!this.isBrowser) return;
    this.isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
    this.isSidebarHidden = this.isMobile;
    this.saveUIState();
  }

  public toggleSidebar(): void {
    this.isSidebarHidden = !this.isSidebarHidden;
    this.saveUIState();
  }

  public closeAll(_source: 'backdrop' | 'outside' | 'esc' | 'api' = 'api'): void {
    if (this.pinOpen) return;
    this.activeRoot = null;
    if (this.isMobile) this.isSidebarHidden = true;
    this.saveUIState();
  }

  public togglePin(): void {
    this.pinOpen = !this.pinOpen;
    this.saveUIState();
  }

  // ===== click fuera / ESC =====
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.isBrowser || this.pinOpen) return;
    if (this.isMobile) return;

    const sidebar = document.getElementById('app-sidebar');
    const target = e.target as Node;
    if (sidebar && !sidebar.contains(target)) {
      this.closeAll('outside');
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (!this.isBrowser) return;
    this.closeAll('esc');
  }

  // ===== auth =====
  public async cerrarSesion(): Promise<void> {
    // Si el usuario tiene mutaciones encoladas sin sincronizar, AVISAR antes
    // de borrar. Antes el logout silencioso evaporaba 30 PDFs encolados sin
    // forma de recuperarlos. Ahora la cola sobrevive a logout normal y solo
    // se borra si el usuario lo confirma.
    let pendingNow = 0;
    try { pendingNow = this.pendingCount || 0; } catch { /* noop */ }

    const electronApi = (typeof window !== 'undefined' ? (window as any).electron : null);

    if (pendingNow > 0) {
      const result = await Swal.fire({
        icon: 'warning',
        title: `Tienes ${pendingNow} envío(s) pendiente(s)`,
        html:
          'Hay datos / archivos esperando subir cuando vuelvas a tener red.<br><br>' +
          '<b>Mantener pendientes:</b> se reproducirán cuando vuelvas a entrar con tu usuario.<br>' +
          '<b>Borrar y salir:</b> se perderán definitivamente.',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Mantener pendientes y salir',
        denyButtonText: 'Borrar y salir',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
      });

      if (result.isDismissed) return;

      if (result.isDenied) {
        this.lsClear();
        const wipePromise: Promise<any> = electronApi?.db?.clearUserData
          ? electronApi.db.clearUserData().catch(() => null)
          : Promise.resolve();
        wipePromise.finally(() => this.router.navigate(['']));
        return;
      }

      // result.isConfirmed: mantener cola, borrar SOLO el cache de GETs.
      this.lsClear();
      const cachePromise: Promise<any> = electronApi?.db?.clearCache
        ? electronApi.db.clearCache().catch(() => null)
        : Promise.resolve();
      cachePromise.finally(() => this.router.navigate(['']));
      return;
    }

    // Sin pendientes: solo borramos cache (la cola está vacía).
    this.lsClear();
    const cachePromise: Promise<any> = electronApi?.db?.clearCache
      ? electronApi.db.clearCache().catch(() => null)
      : (electronApi?.db?.clearUserData
          ? electronApi.db.clearUserData().catch(() => null)
          : Promise.resolve());
    cachePromise.finally(() => this.router.navigate(['']));
  }

  public trackByNodeId = (_: number, n: PermNode) => n.id;
}
