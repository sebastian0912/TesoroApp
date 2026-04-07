import { 
  Component,
  EventEmitter,
  OnInit,
  OnDestroy,
  Output,
  Inject,
  PLATFORM_ID,
  HostListener,
  ChangeDetectionStrategy 
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
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-navbar',
  standalone: true,
  imports: [SharedModule, RouterModule, MatIconModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
} )
export class NavbarComponent implements OnInit, OnDestroy {
  @Output() public menuToggle = new EventEmitter<boolean>();

  public isSidebarHidden = false;
  public isMobile = false;
  public pinOpen = false;
  public currentRoute?: string;
  public isOnline = true;
  public pendingCount = 0;

  public permTree: PermNode[] = [];
  public activeRoot: PermNode | null = null;

  private expanded: Record<string, boolean> = {};
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly CLOSE_DELAY = 500;

  private routerSubscription?: Subscription;
  private readonly MOBILE_BREAKPOINT = 900;

  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private router: Router,
    private http: HttpClient,
    private networkStatus: NetworkStatusService,
    private offlineSync: OfflineSyncService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.networkStatus.isOnline$.subscribe(status => {
        this.isOnline = status;
      });
      this.offlineSync.pendingCount$.subscribe(count => {
        this.pendingCount = count;
      });
      window.addEventListener('offline-queue-updated', () => {
        this.offlineSync.updatePendingCount();
      });
    }
  }

  async ngOnInit(): Promise<void> {
    if (this.isBrowser) {
      this.loadPermTreeFromStorage();
      this.loadUIState();
      this.checkMobile();
      window.addEventListener('resize', this.onResize);
    }

    this.routerSubscription = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentRoute = e.urlAfterRedirects;

        if (!this.pinOpen) this.activeRoot = null;
        if (this.isMobile) this.isSidebarHidden = true;

        this.saveUIState();
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.cancelClose();
    if (this.isBrowser) window.removeEventListener('resize', this.onResize);
  }

  // ===== localStorage SSR-safe =====
  private lsGet(key: string): string | null {
    if (!this.isBrowser) return null;
    try { return localStorage.getItem(key); } catch { return null; }
  }
  private lsSet(key: string, val: string): void {
    if (!this.isBrowser) return;
    try { localStorage.setItem(key, val); } catch { }
  }
  private lsClear(): void {
    if (!this.isBrowser) return;
    try { localStorage.clear(); } catch { }
  }

  private loadUIState(): void {
    const hidden = this.lsGet('sidebarHidden');
    const pin = this.lsGet('sidebarPin');
    this.isSidebarHidden = hidden === 'true';
    this.pinOpen = pin === 'true';
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

    // si te mueves dentro del sidebar (left <-> right), NO cierres
    if (to) {
      const sidebar = document.getElementById('app-sidebar');
      if (sidebar && sidebar.contains(to)) return;
    }

    this.cancelClose();
    this.closeTimer = setTimeout(() => {
      this.activeRoot = null;
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

        // Fix for old storage payloads without 'icono'
        if (user?.permisos_tree?.length > 0 && user.permisos_tree[0].icono === undefined) {
          this.lsClear();
          this.router.navigate(['']);
          return;
        }

        tree = (user?.permisos_tree ?? null);
      }

      if (!Array.isArray(tree) && rawTree) {
        tree = JSON.parse(rawTree);
        console.log('tree from rawTree:', tree);
      }

      if (Array.isArray(tree)) {
        // normaliza hijos faltantes
        const normalize = (n: PermNode): PermNode => ({
          ...n,
          acciones: n.acciones ?? [],
          permiso_ids: n.permiso_ids ?? {},
          hijos: (n.hijos ?? []).map(normalize),
        });

        this.permTree = (tree as PermNode[]).map(normalize);
        console.log('Loaded permTree:', this.permTree);
      }
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

          if (!this.isMobile && this.visibleRootModules.length > 0 && !this.activeRoot) {
            this.activeRoot = this.visibleRootModules[0];
          }
        },
        error: (err) => {
          console.error('Error fetching dynamic perms', err);
        }
      });
    } catch (e) {
      console.error('Error loading user perms', e);
    }
  }

  // ===== roots =====
  public get rootModules(): PermNode[] {
    return (this.permTree || []).filter((n) => this.canRead(n));
  }

  public get visibleRootModules(): PermNode[] {
    return this.rootModules;
  }

  public hasChildren(n: PermNode | null | undefined): boolean {
    return !!n?.hijos?.length;
  }

  public onRootEnter(root: PermNode | null): void {
    if (this.isMobile) return;

    if (!root) {
      if (!this.pinOpen) this.activeRoot = null;
      return;
    }

    this.cancelClose();
    this.activeRoot = root;
    (root.hijos ?? []).forEach((h) => (this.expanded[h.id] = true));
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
    (root.hijos ?? []).forEach((h) => (this.expanded[h.id] = true));

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

  // ===== rutas =====
  public getNodeRoute(node: PermNode): string {
    const base = '/dashboard';

    if (node.ruta) {
      if (node.ruta.startsWith('/')) return node.ruta;
      return `${base}/${node.ruta}`;
    }

    return `${base}/${this.slug(node.nombre)}`;
  }

  public isRouteActive(route: string): boolean {
    const current = this.currentRoute ?? this.router.url;
    return current === route;
  }

  public isTreeActive(root: PermNode): boolean {
    const current = this.currentRoute ?? this.router.url;
    let found = false;

    const dfs = (n: PermNode) => {
      if (found) return;

      if (!this.hasChildren(n)) {
        if (this.getNodeRoute(n) === current) found = true;
        return;
      }

      (n.hijos ?? []).forEach(dfs);
    };

    dfs(root);
    return found;
  }

  // ===== iconos =====
  public getModuleIcon(node: PermNode): string {
    return node?.icono && node.icono !== 'widgets' ? node.icono : 'widgets';
  }

  public getNodeIcon(node: PermNode): string {
    return node?.icono && node.icono !== 'widgets' ? node.icono : 'radio_button_unchecked';
  }

  // ===== responsive =====
  private onResize = () => this.checkMobile();

  private checkMobile(): void {
    if (!this.isBrowser) return;
    this.isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
    this.isSidebarHidden = this.isMobile ? true : false;
    this.saveUIState();
  }

  public toggleSidebar(): void {
    this.isSidebarHidden = !this.isSidebarHidden;

    if (this.isMobile && !this.isSidebarHidden && !this.activeRoot && this.visibleRootModules.length) {
      this.activeRoot = this.visibleRootModules[0];
    }

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
  public cerrarSesion(): void {
    this.lsClear();
    this.router.navigate(['']);
  }

  public trackByNodeId = (_: number, n: PermNode) => n.id;

  private readonly READ_KEYS = new Set(['VER', 'LEER', 'READ', 'VIEW']);

  public canRead(n: PermNode): boolean {
    const acc = (n.acciones ?? []).map((a) => (a || '').toUpperCase());
    const hasAction = acc.some((a) => this.READ_KEYS.has(a));

    const permKeys = Object.keys(n.permiso_ids ?? {}).map((k) => k.toUpperCase());
    const hasPerm = permKeys.some((k) => this.READ_KEYS.has(k));

    if (hasAction || hasPerm) return true;
    return (n.hijos ?? []).some((h) => this.canRead(h));
  }

  private slug(name: string): string {
    return (name ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
