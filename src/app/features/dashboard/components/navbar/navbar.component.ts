import {
  Component,
  EventEmitter,
  OnInit,
  OnDestroy,
  Output,
  Inject,
  PLATFORM_ID,
  ElementRef,
  ViewChild,
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
  acciones: string[];
  permiso_ids: Record<string, string>;
  hijos: PermNode[];
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
  @ViewChild('sidebarRef', { static: false }) asideRef?: ElementRef<HTMLElement>;

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

  // ==== SSR flag ====
  private readonly isBrowser: boolean;

  // ==== Mapas de rutas e íconos (declarados ANTES de usarlos) ====
  private readonly routeMap: Record<string, string> = {
    // Administración
    'ADMINISTRACIÓN': 'users/manage-users',

    // Gestión documental
    'Adjuntar documentación': 'document-management/upload-documents',
    'Buscar documentación': 'document-management/search-documents',
    'Estructura documental': 'document-management/create-doc-structure',
    'Permisos de documentación de empresas usuarias': 'document-management/company-docs-access',

    // Pagos
    'Comprobantes de pago': 'payments/pay-slips',
    'Formas de pago': 'payments/payments-method',

    // Mercancía
    'Envío de mercancía': 'merchandise/send-merchandise',
    'Edición de mercancía': 'merchandise/edit-merchandise',
    'Recepción de mercancía': 'merchandise/receive-merchandise',

    // Selección y contratación
    'Formulario de consulta': 'hiring/query-form',
    'Listado de errores': 'hiring/error-listing',
    'Reporte de contratación': 'hiring/hiring-report',
    'Ver reporte de contratación': 'hiring/view-reports',
    'Consultar documentación': 'hiring/consult-contracting-documentation',
    'Gerencia 901': 'hiring/banned-management',
    'Reporte 901': 'hiring/banned-report',
    'Selección': 'hiring/recruitment-pipeline',
    'Ver entrevistas de recepción': 'hiring/view-reception-interviews',

    // Vacantes
    'Gestión de vacantes': 'vacancies',

    // Tesorería
    'Gestión de trabajadores': 'treasury/manage-workers',

    // Mercado
    'Carga de mercado': 'market/load-market',
    'Carga de mercado (ferias)': 'market/load-fair-market',
    'Carga de mercado (comercializadora)': 'market/marketing-market',

    // Autorizaciones
    'Bono de mercado': 'authorizations/market-bonus',
    'Prestado de dinero': 'authorizations/money-loan',

    // Préstamos (alias)
    'PRESTADO PARA REALIZAR': 'money-loan/loan-to-perform',
    'PRESTAMO POR CALAMIDAD': 'money-loan/emergency-loan',

    // Traslados
    'Procesos de traslados': 'eps-transfers/process-transfers',
    'Consulta de traslados': 'eps-transfers/transfer-query',

    // Historial
    'Historial de autorizaciones': 'history/authorizations-history',
    'Historial de modificaciones': 'history/modifications-history',

    // Gestión roles
    'GESTIÓN ROLES': 'users/manage-roles',
    'GESTIÓN MÓDULOS': 'users/manage-modules',
    'PARAMETRIZACIÓN': 'users/manage-parameterization',
    'GESTIÓN CARGOS': 'positions/manage-positions',
    'GESTIÓN CENTRO DE COSTOS': 'farms/management-farms',

    // Ausentismos
    'AUSENTISMOS': 'hiring/absences',

    // Cargas masivas tesorería
    'CARGAS MASIVAS': 'treasury/upload-treasury',

    // Robots
    'Robots': '/robots/dashboard-robots',
  };

  private readonly iconMap: Record<string, string> = {
    // Raíces y categorías
    'Comercializadora': 'storefront',
    'Gestión del programa': 'manage_accounts',
    'Procesos empresa': 'work',
    'Procesos empresariales': 'work',
    'Tesoreria': 'account_balance',

    // Mercancía
    'Mercancía': 'inventory_2',
    'Edición de mercancía': 'edit',
    'Envío de mercancía': 'local_shipping',
    'Recepción de mercancía': 'assignment_turned_in',

    // Gestión del programa
    'Administración': 'admin_panel_settings',

    // Gestión documental
    'Gestión documental': 'folder',
    'Adjuntar documentación': 'upload_file',
    'Buscar documentación': 'search',
    'Estructura documental': 'schema',
    'Permisos de documentación de empresas usuarias': 'lock',

    // Pagos
    'Pagos': 'payments',
    'CARGOS': 'assignment',
    'Comprobantes de pago': 'receipt_long',
    'Formas de pago': 'credit_card',

    // Selección y contratación
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

    // Vacantes
    'Vacantes': 'work',
    'Gestión de vacantes': 'work',

    // Tesorería / Autorizaciones / Ayudas / Historial / Mercado / Operaciones
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

    // Préstamos / Traslados
    'Prestamo de dinero': 'savings',
    'Prestado para realizar': 'schedule',
    'Prestamo por calamidad': 'warning_amber',
    'Préstamos': 'savings',
    'Prestamo para realizar': 'schedule',
    'Traslados': 'swap_horiz',
    'Consulta de traslados': 'search',
    'Procesos de traslados': 'sync_alt',

    // Gestión roles
    'GESTIÓN ROLES': 'security',
    'GESTIÓN MÓDULOS': 'view_module',
    'GESTIÓN CARGOS': 'assignment',
    'GESTIÓN CENTRO DE COSTOS': 'account_balance_wallet',
    'PARAMETRIZACIÓN': 'settings',

    // Ausentismos
    'AUSENTISMOS': 'event_busy',

    // Robots
    'Robots': 'smart_toy',
  };

  // Índices calculados en constructor (evita TS2729)
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
    if (this.isBrowser) {
      window.removeEventListener('resize', this.onResize);
    }
  }

  // ======== SSR-safe localStorage ========
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

  // ======== Estado UI persistente ========
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

  // ======== Cierre seguro ========
  cancelClose(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  public scheduleClose(ev?: PointerEvent): void {
    if (this.pinOpen || this.isMobile) return;

    const aside = this.asideRef?.nativeElement;
    const to = ev?.relatedTarget as Node | null;
    if (aside && to && aside.contains(to)) return;

    this.cancelClose();
    this.closeTimer = setTimeout(() => {
      this.activeRoot = null;
    }, this.CLOSE_DELAY);
  }

  onLeafClick(): void {
    this.cancelClose();
    this.activeRoot = null;

    if (this.isBrowser && typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches) {
      this.isSidebarHidden = true; // móvil
    }
    this.saveUIState();
  }

  // ======== Permisos: lectura de árbol ========
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
      }

      if (Array.isArray(tree)) {
        this.permTree = tree as PermNode[];
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

  // ======== Panel izquierdo (raíces) ========
  public get rootModules(): PermNode[] {
    return (this.permTree || []).filter((n) => this.canRead(n));
  }

  public onModuleEnter(mod: PermNode): void {
    this.cancelClose();
    this.activeRoot = mod;
    (mod.hijos || []).forEach((h) => (this.expanded[h.id] = true));
  }

  public onPanelLeave(): void {
    this.scheduleClose();
  }

  public onRightPanelEnter(): void {
    this.cancelClose();
  }

  // ======== Expand/Collapse ========
  public isExpanded(id: string): boolean {
    return !!this.expanded[id];
  }

  public toggleNode(id: string): void {
    this.expanded[id] = !this.expanded[id];
  }

  public toggleAll(root: PermNode): void {
    const hasCollapsed = this.isAnyCollapsed(root);
    this.walk(root, (n) => (this.expanded[n.id] = hasCollapsed));
  }

  public isAnyCollapsed(root: PermNode): boolean {
    let collapsed = false;
    this.walk(root, (n) => {
      if (n.hijos?.length && !this.isExpanded(n.id)) collapsed = true;
    });
    return collapsed;
  }

  private walk(node: PermNode, fn: (n: PermNode) => void): void {
    fn(node);
    (node.hijos || []).forEach((h) => this.walk(h, fn));
  }

  // ======== Texto & normalización ========
  private toSentenceCase(s: string = ''): string {
    const t = s.toLowerCase();
    return t.replace(/^\p{L}/u, (c) => c.toUpperCase());
  }

  public formatLabel(nombre: string): string {
    return this.toSentenceCase(nombre);
  }

  private indexByUpper<T extends Record<string, string>>(obj: T): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of Object.keys(obj)) out[k.toUpperCase()] = obj[k];
    return out;
  }

  // ======== Navegación / rutas ========
  public getNodeRoute(node: PermNode): string {
    const base = '/dashboard';
    const key = (node?.nombre ?? '').toUpperCase();
    const mapped = this.routeMapIndex[key];
    if (mapped) return `${base}/${mapped}`;
    return `${base}/${this.slug(node.nombre)}`;
  }

  // ======== Iconos ========
  public getModuleIcon(nombre: string): string {
    return this.iconMapIndex[(nombre ?? '').toUpperCase()] || 'widgets';
  }

  public getNodeIcon(nombre: string): string {
    return this.iconMapIndex[(nombre ?? '').toUpperCase()] || 'radio_button_unchecked';
  }

  // ======== Layout utils ========
  private onResize = () => this.checkMobile();

  private checkMobile(): void {
    if (!this.isBrowser) return;
    this.isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
    this.isSidebarHidden = this.isMobile ? true : false;
    this.saveUIState();
  }

  public toggleSidebar(): void {
    this.isSidebarHidden = !this.isSidebarHidden;
    this.saveUIState();
  }

  public openSidebarForMobile(): void {
    this.isSidebarHidden = false;
    if (!this.activeRoot && this.rootModules.length) {
      this.activeRoot = this.rootModules[0];
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

  // ======== Cierre por clic fuera / ESC ========
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.isBrowser || this.pinOpen) return;
    const aside = this.asideRef?.nativeElement;
    if (!aside || this.isMobile) return;
    const target = e.target as Node;
    if (!aside.contains(target)) {
      this.closeAll('outside');
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (!this.isBrowser) return;
    this.closeAll('esc');
  }

  // ======== Otros helpers ========
  public cerrarSesion(): void {
    this.lsClear();
    this.router.navigate(['']);
  }

  public trackByNodeId = (_: number, n: PermNode) => n.id;
  private readonly READ_KEYS = new Set(['VER', 'LEER', 'READ', 'VIEW']);

  public canRead(n: PermNode): boolean {
    const acc = (n.acciones ?? []).map(a => (a || '').toUpperCase());
    const hasAction = acc.some(a => this.READ_KEYS.has(a));

    const permKeys = Object.keys(n.permiso_ids ?? {}).map(k => k.toUpperCase());
    const hasPerm = permKeys.some(k => this.READ_KEYS.has(k));

    if (hasAction || hasPerm) return true;
    return (n.hijos ?? []).some(h => this.canRead(h));
  }

  private slug(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
