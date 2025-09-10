import { Component, EventEmitter, OnInit, Output, Inject, PLATFORM_ID, } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SharedModule } from '../../../../shared/shared.module';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TesoreriaService } from '../../service/teroreria/tesoreria.service'; // Importación del servicio
import { DateRangeDialogComponent } from '../../../../shared/components/date-rang-dialog/date-rang-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { UtilityServiceService } from '../../../../shared/services/utilityService/utility-service.service';
import { AutorizacionesService } from '../../submodule/authorizations/services/autorizaciones/autorizaciones.service';
import { MercadoService } from '../../submodule/market/service/mercado/mercado.service';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import moment from 'moment';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

export interface PermNode {
  id: string;
  nombre: string;
  acciones: string[];                    // p.ej. ["LEER","CREAR",...]
  permiso_ids: Record<string, string>;   // p.ej. { LEER: "uuid", ... }
  hijos: PermNode[];
}

@Component({
  selector: 'app-navbar',
  imports: [SharedModule, RouterModule, MatIconModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit {

  @Output() public menuToggle = new EventEmitter<boolean>();

  public isSidebarHidden = false;
  public isMobile = false;
  public currentRoute?: string;

  // árbol de permisos (raíces)
  public permTree: PermNode[] = [];
  public activeRoot: PermNode | null = null;

  // estado UI
  private expanded: Record<string, boolean> = {};
  private closeTimer: any = null;
  private readonly CLOSE_DELAY = 200;
  private routerSubscription?: Subscription;

  // handler ligado para poder removerlo correctamente
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

    this.routerSubscription = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => (this.currentRoute = e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    clearTimeout(this.closeTimer);
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  /** Restaura el estado de ocultar sidebar */
  private loadUIState(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const hidden = localStorage.getItem('sidebarHidden');
    this.isSidebarHidden = hidden === 'true';
  }

  /* ============ Lectura de permisos_tree ============ */
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

  /* ============ Panel izquierdo (módulos raíz) ============ */
  public get rootModules(): PermNode[] {
    return (this.permTree || []).filter((n) => this.canRead(n));
  }

  public onModuleEnter(mod: PermNode): void {
    clearTimeout(this.closeTimer);
    this.activeRoot = mod;
    (mod.hijos || []).forEach((h) => (this.expanded[h.id] = true));
  }

  public onPanelLeave(): void {
    this.closeTimer = setTimeout(() => (this.activeRoot = null), this.CLOSE_DELAY);
  }

  public onRightPanelEnter(): void {
    clearTimeout(this.closeTimer);
  }

  /* ============ Toggle / expand ============ */
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
     Normalización de texto (mostrar solo primera mayúscula)
     y lookups insensibles a mayúsculas para rutas e iconos
     =========================================================== */

  // Convierte "GESTIÓN DOCUMENTAL" -> "Gestión documental"
  private toSentenceCase(s: string = ''): string {
    const t = s.toLowerCase();
    // Sube solo la primera letra (unicode-aware)
    return t.replace(/^\p{L}/u, (c) => c.toUpperCase());
  }

  // Se usa en el template: {{ formatLabel(node.nombre) }}
  public formatLabel(nombre: string): string {
    return this.toSentenceCase(nombre);
  }

  // Crea un índice de un mapa convirtiendo las claves a UPPERCASE
  private indexByUpper<T extends Record<string, string>>(obj: T): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of Object.keys(obj)) out[k.toUpperCase()] = obj[k];
    return out;
  }

  /* ============ Navegación / rutas ============ */
  // NOTA: rutas relativas (sin "/" inicial). getNodeRoute compone con "/dashboard"
  private readonly routeMap: Record<string, string> = {
    // Raíces
    // Administración
    'Administración': 'users/manage-users',

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

    // PRESTADO PARA REALIZAR
    // PRESTAMO POR CALAMIDAD
    'PRESTADO PARA REALIZAR': 'money-loan/loan-to-perform',
    'PRESTAMO POR CALAMIDAD': 'money-loan/emergency-loan',

    // Traslados
    'Procesos de traslados': 'eps-transfers/process-transfers',
    'Consulta de traslados': 'eps-transfers/transfer-query',

    // Historial
    'Historial de autorizaciones': 'history/authorizations-history',
    'Historial de modificaciones': 'history/modifications-history',

    // GESTION ROLES
    'GESTIÓN ROLES': 'users/manage-roles',

    // AUSENTISMOS
    'AUSENTISMOS': 'hiring/absences',
  };

  // Índice insensible a mayúsculas para rutas
  private readonly routeMapIndex = this.indexByUpper(this.routeMap);

  public getNodeRoute(node: PermNode): string {
    const base = '/dashboard';
    const key = (node?.nombre ?? '').toUpperCase();
    const mapped = this.routeMapIndex[key];
    if (mapped) return `${base}/${mapped}`;
    // fallback slugify
    return `${base}/${this.slug(node.nombre)}`;
  }

  /* ============ Iconos ============ */
  private readonly iconMap: Record<string, string> = {
    // Raíces
    'Comercializadora': 'storefront',
    'Gestión del programa': 'manage_accounts',
    'Procesos empresa': 'work',
    'Procesos empresariales': 'work',
    'Tesoreria': 'account_balance',

    // COMERCIALIZADORA ▸ Mercancía
    'Mercancía': 'inventory_2',
    'Edición de mercancía': 'edit',
    'Envío de mercancía': 'local_shipping',
    'Recepción de mercancía': 'assignment_turned_in',

    // GESTION DEL PROGRAMA
    'Administración': 'admin_panel_settings',

    // Procesos empresariales ▸ Gestión documental
    'Gestión documental': 'folder',
    'Adjuntar documentación': 'upload_file',
    'Buscar documentación': 'search',
    'Estructura documental': 'schema',
    'Permisos de documentación de empresas usuarias': 'lock',

    // Procesos empresariales ▸ Pagos
    'Pagos': 'payments',
    'Comprobantes de pago': 'receipt_long',
    'Formas de pago': 'credit_card',

    // Procesos empresariales ▸ Selección y contratación
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

    // Procesos empresariales ▸ Vacantes
    'Vacantes': 'work',
    'Gestión de vacantes': 'work',

    // TESORERIA ▸ Autorizaciones / Ayudas / Historial / Mercado / Operaciones...
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

    // TESORERIA ▸ Préstamos / Tesorero / Traslados
    'Prestamo de dinero': 'savings',
    'Prestado para realizar': 'schedule',
    'Prestamo por calamidad': 'warning_amber',

    'Préstamos': 'savings',
    'Prestamo para realizar': 'schedule',

    'Traslados': 'swap_horiz',
    'Consulta de traslados': 'search',
    'Procesos de traslados': 'sync_alt',

    // GESTION ROLES
    'GESTIÓN ROLES': 'security',

    // AUSENTISMOS
    'AUSENTISMOS': 'event_busy',
  };

  // Índice insensible a mayúsculas para iconos
  private readonly iconMapIndex = this.indexByUpper(this.iconMap);

  public getModuleIcon(nombre: string): string {
    return this.iconMapIndex[(nombre ?? '').toUpperCase()] || 'widgets';
  }
  public getNodeIcon(nombre: string): string {
    return this.iconMapIndex[(nombre ?? '').toUpperCase()] || 'radio_button_unchecked';
  }

  /* ============ Utilidades ============ */
  private checkMobile(): void {
    this.isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
    if (this.isMobile && !this.isSidebarHidden) {
      this.isSidebarHidden = true;
    }
    if (!this.isMobile) this.isSidebarHidden = false;
  }

  public toggleSidebar(): void {
    this.isSidebarHidden = !this.isSidebarHidden;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('sidebarHidden', String(this.isSidebarHidden));
    }
  }

  public cerrarSesion(): void {
    if (isPlatformBrowser(this.platformId)) localStorage.clear();
    this.router.navigate(['']);
  }

  public trackByNodeId = (_: number, n: PermNode) => n.id;

  public canRead(n: PermNode): boolean {
    // si el nodo mismo tiene LEER -> OK
    if ((n.acciones || []).includes('LEER')) return true;
    // si cualquiera de sus hijos (o nietos, etc.) tiene LEER -> OK
    return (n.hijos || []).some(h => this.canRead(h));
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
