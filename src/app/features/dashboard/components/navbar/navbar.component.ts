import {
  Component,
  EventEmitter,
  OnInit,
  OnDestroy,
  Output,
  Inject,
  PLATFORM_ID,
  HostListener,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from '../../../../shared/shared.module';

export interface PermNode {
  id: string;
  nombre: string;
  acciones?: string[];
  permiso_ids?: Record<string, string>;
  hijos?: PermNode[];
}

@Component({
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

  public permTree: PermNode[] = [];
  public activeRoot: PermNode | null = null;

  private expanded: Record<string, boolean> = {};
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly CLOSE_DELAY = 500;

  private routerSubscription?: Subscription;
  private readonly MOBILE_BREAKPOINT = 900;

  private readonly isBrowser: boolean;

  private readonly routeMap: Record<string, string> = {
    'ADMINISTRACIÓN': 'users/manage-users',

    'Adjuntar documentación': 'document-management/upload-documents',
    'Buscar documentación': 'document-management/search-documents',
    'Estructura documental': 'document-management/create-doc-structure',
    'Permisos de documentación de empresas usuarias': 'document-management/company-docs-access',
    'TABLA RETENCIÓN': 'document-management/withholding-table',

    'Comprobantes de pago': 'payments/pay-slips',
    'Formas de pago': 'payments/payments-method',

    'Envío de mercancía': 'merchandise/send-merchandise',
    'Edición de mercancía': 'merchandise/edit-merchandise',
    'Recepción de mercancía': 'merchandise/receive-merchandise',

    'Formulario de consulta': 'hiring/query-form',
    'Listado de errores': 'hiring/error-listing',
    'Reporte de contratación': 'hiring/hiring-report',
    'Ver reporte de contratación': 'hiring/view-reports',
    'Consultar documentación': 'hiring/consult-contracting-documentation',
    'Gerencia 901': 'hiring/banned-management',
    'Reporte 901': 'hiring/banned-report',
    'Selección': 'hiring/recruitment-pipeline',
    'Ver entrevistas de recepción': 'hiring/view-reception-interviews',
    'Tarjetas': 'hiring/tarjetas',  

    'Gestión de vacantes': 'vacancies',
    'Gestión de trabajadores': 'treasury/manage-workers',

    'Carga de mercado': 'market/load-market',
    'Carga de mercado (ferias)': 'market/load-fair-market',
    'Carga de mercado (comercializadora)': 'market/marketing-market',

    'Bono de mercado': 'authorizations/market-bonus',
    'Prestado de dinero': 'authorizations/money-loan',

    'PRESTADO PARA REALIZAR': 'money-loan/loan-to-perform',
    'PRESTAMO POR CALAMIDAD': 'money-loan/emergency-loan',

    'Procesos de traslados': 'eps-transfers/process-transfers',
    'Consulta de traslados': 'eps-transfers/transfer-query',

    'Historial de autorizaciones': 'history/authorizations-history',
    'Historial de modificaciones': 'history/modifications-history',

    'GESTIÓN ROLES': 'users/manage-roles',
    'GESTIÓN MÓDULOS': 'users/manage-modules',
    'PARAMETRIZACIÓN': 'users/manage-parameterization',
    'GESTIÓN CARGOS': 'positions/manage-positions',
    'GESTIÓN CENTRO DE COSTOS': 'farms/management-farms',

    'AUSENTISMOS': 'hiring/absences',
    'CARGAS MASIVAS': 'treasury/upload-treasury',

    'Robots': 'robots/dashboard-robots',
  };

  private readonly iconMap: Record<string, string> = {
    'Comercializadora': 'storefront',
    'Gestión del programa': 'manage_accounts',
    'Procesos empresa': 'work',
    'Procesos empresariales': 'work',
    'Tesoreria': 'account_balance',

    'Mercancía': 'inventory_2',
    'Edición de mercancía': 'edit',
    'Envío de mercancía': 'local_shipping',
    'Recepción de mercancía': 'assignment_turned_in',

    'Administración': 'admin_panel_settings',

    'Gestión documental': 'folder',
    'Adjuntar documentación': 'upload_file',
    'Buscar documentación': 'search',
    'Estructura documental': 'schema',
    'Permisos de documentación de empresas usuarias': 'lock',

    'Pagos': 'payments',
    'CARGOS': 'assignment',
    'Comprobantes de pago': 'receipt_long',
    'Formas de pago': 'credit_card',

    'Selección y contratación': 'how_to_reg',
    'Contratación 1.0': 'assignment',
    'Formulario de consulta': 'fact_check',
    'Listado de errores': 'bug_report',
    'Reporte de contratación': 'insert_chart',
    'Ver reporte de contratación': 'visibility',
    'Contratación 2.0': 'assignment_turned_in',
    'Consultar documentación': 'find_in_page',
    'Gerencia 901': 'workspace_premium',
    'Reporte 901': 'insert_chart',
    'Selección': 'person_search',
    'Ver entrevistas de recepción': 'record_voice_over',

    'Vacantes': 'work',
    'Gestión de vacantes': 'work',

    'Autorizaciones': 'approval',
    'Bono de mercado': 'redeem',
    'Prestado de dinero': 'paid',
    'Ayudas': 'volunteer_activism',
    'Cargar mercados con código': 'qr_code_scanner',
    'Cargar mercados sin código': 'shopping_cart',
    'Historial': 'history',
    'Historial de autorizaciones': 'history',
    'Historial de modificaciones': 'manage_history',
    'Mercado': 'shopping_bag',
    'Carga de mercado': 'upload_file',
    'Carga de mercado (comercializadora)': 'storefront',
    'Carga de mercado (ferias)': 'festival',
    'Operaciones de tesorería': 'calculate',
    'Cargas masivas': 'dataset',
    'Gestión de trabajadores': 'group',

    'Prestamo de dinero': 'savings',
    'Prestado para realizar': 'schedule',
    'Prestamo por calamidad': 'warning_amber',
    'Préstamos': 'savings',
    'Prestamo para realizar': 'schedule',
    'Traslados': 'swap_horiz',
    'Consulta de traslados': 'search',
    'Procesos de traslados': 'sync_alt',

    'GESTIÓN ROLES': 'security',
    'GESTIÓN MÓDULOS': 'view_module',
    'GESTIÓN CARGOS': 'assignment',
    'GESTIÓN CENTRO DE COSTOS': 'account_balance_wallet',
    'PARAMETRIZACIÓN': 'settings',

    'AUSENTISMOS': 'event_busy',

    'Robots': 'smart_toy',
    'TABLA RETENCIÓN': 'table_chart',
    'Tarjetas': 'credit_card',
  };

  private routeMapIndex!: Record<string, string>;
  private iconMapIndex!: Record<string, string>;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.routeMapIndex = this.indexByUpper(this.routeMap);
    this.iconMapIndex = this.indexByUpper(this.iconMap);
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
  private indexByUpper<T extends Record<string, string>>(obj: T): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of Object.keys(obj)) out[k.toUpperCase()] = obj[k];
    return out;
  }

  public getNodeRoute(node: PermNode): string {
    const base = '/dashboard';
    const key = (node?.nombre ?? '').toUpperCase();
    const mapped = this.routeMapIndex[key];

    if (mapped) {
      if (mapped.startsWith('/')) return mapped;
      return `${base}/${mapped}`;
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
  public getModuleIcon(nombre: string): string {
    return this.iconMapIndex[(nombre ?? '').toUpperCase()] || 'widgets';
  }

  public getNodeIcon(nombre: string): string {
    return this.iconMapIndex[(nombre ?? '').toUpperCase()] || 'radio_button_unchecked';
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
