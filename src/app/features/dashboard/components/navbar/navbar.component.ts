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
import { SharedModule } from '../../../../shared/shared.module';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

export interface PermNode {
  id: string;
  nombre: string;
  acciones: string[];
  permiso_ids: Record<string, string>;
  hijos: PermNode[];
}

@Component({
  selector: 'app-navbar',
  imports: [SharedModule, RouterModule, MatIconModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Output() public menuToggle = new EventEmitter<boolean>();
  @ViewChild('sidebarRef', { static: false }) asideRef?: ElementRef<HTMLElement>;

  public isSidebarHidden = false;
  public isMobile = false;
  public pinOpen = false;
  public currentRoute?: string;

  // árbol de permisos (raíces)
  public permTree: PermNode[] = [];
  public activeRoot: PermNode | null = null;

  // estado UI
  private expanded: Record<string, boolean> = {};

  // ⏳ Cierre diferido
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly CLOSE_DELAY = 500;

  private routerSubscription?: Subscription;

  // breakpoint y handler
  private readonly MOBILE_BREAKPOINT = 900;
  private resizeHandler = () => this.checkMobile();

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadPermTreeFromStorage();
      this.loadUIState();
      this.checkMobile();
      window.addEventListener('resize', this.resizeHandler);
    }

    // Cerrar/ajustar al navegar
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
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  /* ===========================
     Estado UI persistente
     =========================== */
  private loadUIState(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const hidden = localStorage.getItem('sidebarHidden');
    const pin = localStorage.getItem('sidebarPin');
    this.isSidebarHidden = hidden === 'true';
    this.pinOpen = pin === 'true';
  }

  private saveUIState(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem('sidebarHidden', String(this.isSidebarHidden));
    localStorage.setItem('sidebarPin', String(this.pinOpen));
  }

  /* ===========================
     Cierre seguro
     =========================== */
  // Cancela cualquier cierre pendiente
  cancelClose(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  // Programa el cierre sólo si realmente sales del <aside>
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
    if (matchMedia('(hover: none)').matches) this.isSidebarHidden = true; // móvil
    this.saveUIState();
  }

  /* ===========================
     Lectura de permisos_tree
     =========================== */
  private loadPermTreeFromStorage(): void {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const user = JSON.parse(raw);
      const tree = user?.permisos_tree;
      if (Array.isArray(tree)) this.permTree = tree;
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Error de permisos',
        text: 'No se pudo cargar el árbol de permisos.',
      });
    }
  }

  /* ===========================
     Panel izquierdo (raíces)
     =========================== */
  public get rootModules(): PermNode[] {
    return (this.permTree || []).filter((n) => this.canRead(n));
  }

  public onModuleEnter(mod: PermNode): void {
    this.cancelClose(); // evita cierre al pasar al derecho
    this.activeRoot = mod;
    (mod.hijos || []).forEach((h) => (this.expanded[h.id] = true));
  }

  // Si tu template aún llama onPanelLeave()
  public onPanelLeave(): void {
    this.scheduleClose();
  }

  public onRightPanelEnter(): void {
    this.cancelClose(); // al entrar al derecho, cancela cierre
  }

  /* ===========================
     Expand/collapse utilidades
     =========================== */
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

  /* ===========================================================
     Normalización de texto e índices case-insensitive
     =========================================================== */
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

  /* ===========================
     Navegación / rutas
     =========================== */
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
    'GESTIÓN CARGOS': 'positions/manage-positions',

    // Ausentismos
    'AUSENTISMOS': 'hiring/absences',

    // Cargas masivas tesorería
    'CARGAS MASIVAS': 'treasury/upload-treasury',
  };

  private readonly routeMapIndex = this.indexByUpper(this.routeMap);

  public getNodeRoute(node: PermNode): string {
    const base = '/dashboard';
    const key = (node?.nombre ?? '').toUpperCase();
    const mapped = this.routeMapIndex[key];
    if (mapped) return `${base}/${mapped}`;
    return `${base}/${this.slug(node.nombre)}`;
  }

  /* ===========================
     Iconos
     =========================== */
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
    // Ausentismos
    'AUSENTISMOS': 'event_busy',
  };

  private readonly iconMapIndex = this.indexByUpper(this.iconMap);

  public getModuleIcon(nombre: string): string {
    return this.iconMapIndex[(nombre ?? '').toUpperCase()] || 'widgets';
  }

  public getNodeIcon(nombre: string): string {
    return this.iconMapIndex[(nombre ?? '').toUpperCase()] || 'radio_button_unchecked';
  }

  /* ===========================
     Utilidades layout
     =========================== */
  private checkMobile(): void {
    this.isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
    if (this.isMobile) {
      // en móvil, por defecto oculto hasta abrir con botón
      this.isSidebarHidden = true;
    } else {
      // en desktop, visible barra izquierda
      this.isSidebarHidden = false;
    }
    this.saveUIState();
  }

  public toggleSidebar(): void {
    this.isSidebarHidden = !this.isSidebarHidden;
    this.saveUIState();
  }

  public openSidebarForMobile(): void {
    // usado por el botón hamburguesa
    this.isSidebarHidden = false;
    if (!this.activeRoot && this.rootModules.length) {
      this.activeRoot = this.rootModules[0];
    }
    this.saveUIState();
  }

  public closeAll(_source: 'backdrop' | 'outside' | 'esc' | 'api' = 'api'): void {
    if (this.pinOpen) return; // respetar pin
    this.activeRoot = null;
    if (this.isMobile) this.isSidebarHidden = true;
    this.saveUIState();
  }

  public togglePin(): void {
    this.pinOpen = !this.pinOpen;
    this.saveUIState();
  }

  /* ===========================
     Cierre por clic fuera / ESC
     =========================== */
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.pinOpen) return;
    const aside = this.asideRef?.nativeElement;
    if (!aside || this.isMobile) return;
    const target = e.target as Node;
    if (!aside.contains(target)) {
      this.closeAll('outside');
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.closeAll('esc');
  }

  /* ===========================
     Otros helpers
     =========================== */
  public cerrarSesion(): void {
    if (isPlatformBrowser(this.platformId)) localStorage.clear();
    this.router.navigate(['']);
  }

  public trackByNodeId = (_: number, n: PermNode) => n.id;

  public canRead(n: PermNode): boolean {
    if ((n.acciones || []).includes('LEER')) return true;
    return (n.hijos || []).some((h) => this.canRead(h));
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
