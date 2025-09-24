import { SeleccionService } from './../../../hiring/service/seleccion/seleccion.service';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { NgFor, NgForOf, NgIf } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CrearEditarVacanteComponent } from '../../components/crear-editar-vacante/crear-editar-vacante.component';
import { MatMenuModule } from '@angular/material/menu';
import { catchError, finalize, of } from 'rxjs';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { SharedModule } from '@/app/shared/shared.module';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { NativeDateModule } from '@angular/material/core';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

// NUEVO: módulos para toggle, iconos y card (si no vienen desde SharedModule)
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-vacantes',
  imports: [
    SharedModule,
    MatTableModule,
    FormsModule,
    NgFor,
    NgForOf,
    MatMenuModule,
    MatPaginatorModule,
    MatSortModule,
    MatDatepickerModule,
    NativeDateModule,
    MatDialogModule,
    MatButtonToggleModule,
    MatIconModule,
    MatCardModule,
  ],
  templateUrl: './vacantes.component.html',
  styleUrl: './vacantes.component.css'
})
export class VacantesComponent implements OnInit {
  vacantes: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'acciones',
    'fechaPublicado',
    'finca',
    'cargo',
    'oficinas',
    'pruebaOContratacion',
    'municipio',
    'experiencia',
    'observacionVacante',
    'descripcion',
    'salario',
    'auxilioTransporte',
    'tipoContratacion',
    'temporal',
    'ruta',
    'fechadeIngreso',
    'preseleccionados',
    'contratados',
  ];

  // Toggle de vista (tabla | cards)
  viewMode: 'table' | 'card' = 'table';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  permitido = false;
  loading = false;

  constructor(
    private dialog: MatDialog,
    private vacantesService: VacantesService,
    private utilityService: UtilityServiceService,
    private seleccionService: SeleccionService
  ) { }

  async ngOnInit(): Promise<void> {
    const saved = (typeof window !== 'undefined')
      ? (localStorage.getItem('vacantes:viewMode') as 'table' | 'card' | null)
      : null;
    if (saved) this.viewMode = saved;

    await this.loadData();

    const user = this.utilityService.getUser();
    this.permitido = this.isManager(user);

    // Filtro simple
    this.dataSource.filterPredicate = (data: any, filter: string) =>
      JSON.stringify(data).toLowerCase().includes(filter);
  }

  // ========= Toggle de vista =========
  onToggleView(mode: 'table' | 'card'): void {
    this.viewMode = mode;
    try { localStorage.setItem('vacantes:viewMode', mode); } catch { }
  }

  // ========= Datos para cards =========
  get filteredVacantes(): any[] {
    return this.dataSource?.filteredData ?? this.dataSource?.data ?? [];
  }

  // Mejor rendimiento en *ngFor
  trackById = (_: number, v: any) => v?.id ?? v?.codigo ?? _;

  // Iniciales para avatar de la card
  initials(text: string): string {
    if (!text) return '?';
    const parts = String(text).trim().split(/\s+/);
    const a = parts[0]?.[0] ?? '';
    const b = parts[1]?.[0] ?? '';
    return (a + b).toUpperCase();
  }

  private normalize(s?: string | null): string {
    return (s ?? '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toUpperCase();
  }

  private splitToArray(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.filter(Boolean) as string[];
    if (typeof raw === 'string') {
      return raw.split(/[;,|]/).map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  private extractTargetOffices(user: any): string[] {
    const parts = [
      ...this.splitToArray(user?.sede?.nombre),
    ];
    return Array.from(new Set(parts));
  }

  private matchOffice(vacante: any, officeNames: string[]): boolean {
    if (!officeNames.length) return false;
    const wanted = new Set(officeNames.map(n => this.normalize(n)));
    const oficinas = Array.isArray(vacante?.oficinasQueContratan) ? vacante.oficinasQueContratan : [];
    return oficinas.some((o: any) => wanted.has(this.normalize(o?.nombre)));
  }

  loadData(): void {
    this.loading = true;

    this.vacantesService.listarVacantes().pipe(
      catchError(() => {
        Swal.fire('Error', 'Ocurrió un error al cargar las vacantes', 'error');
        return of([] as any[]);
      }),
      finalize(() => this.loading = false)
    ).subscribe((response: any[]) => {
      const user = this.utilityService.getUser();

      let rows: any[];
      if (this.isManager(user)) {
        rows = response; // sin filtro
      } else if (this.isSubaUser(user)) {
        const target = ['VIRTUAL', 'TOCANCIPÁ', 'ZIPAQUIRÁ'];
        rows = response.filter(v => this.matchOffice(v, target));
      } else {
        rows = response.filter(v => this.matchOffice(v, this.extractTargetOffices(user)));
      }

      rows = this.reordenarCumplidasAlFinal(rows);
      this.dataSource.data = rows;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }

  // ===== Helpers de rol/correo
  private isManager(user: any): boolean {
    const raw = user?.rol ?? user?.roles ?? [];
    const roleNames: string[] = Array.isArray(raw)
      ? raw
        .map((r: any) => (typeof r === 'string' ? r : r?.nombre))
        .filter((v: any): v is string => !!v)
      : [typeof raw === 'string' ? raw : raw?.nombre].filter(Boolean) as string[];
    const upper = roleNames.map(r => r.toUpperCase());
    return upper.includes('GERENCIA') || upper.includes('ADMIN');
  }

  private isSubaUser(user: any): boolean {
    return (user?.correo_electronico || '').toLowerCase() === 'oficinasuba.rtc@gmail.com';
  }

  // ===== Filtro
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  // ===== Modales crear/editar
  openModalEdit(vacante?: any): void {
    const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
      width: '95vw',
      maxWidth: '95vw',
      data: vacante || null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const isPrueba = result.pruebaOContratacion === 'Prueba';

      const payload = {
        cargo: result.cargo?.trim() || null,
        temporal: result.temporal?.trim() || null,
        area: result.area || null,
        empresaUsuariaSolicita: result.empresaUsuariaSolicita?.trim() || null,
        finca: result.finca?.trim() || null,
        experiencia: result.experiencia?.trim() || null,
        descripcion: result.descripcion?.trim() || null,
        salario: this.parseCurrency(result.salario),
        codigoElite: result.codigoElite?.trim() || null,
        observacionVacante: result.observacionVacante?.trim() || null,

        // Condicionales
        pruebaOContratacion: isPrueba ? 'Prueba' : 'Contratación',
        fechadePruebatecnica: isPrueba ? this.formatDate(result.fechadePruebatecnica) : null,
        horadePruebatecnica: isPrueba ? (result.horadePruebatecnica || null) : null,

        // Fecha de ingreso (si aplica ya viene validado en el form)
        fechadeIngreso: this.formatDate(result.fechadeIngreso) || null,

        fechaPublicado: result.fechaPublicado || new Date().toISOString(),
        quienpublicolavacante: result.quienpublicolavacante || 'Sistema',
        estadovacante: result.estadovacante || 'Activa',

        // Distribución + total solicitadas
        personasSolicitadas: Number(result.personasSolicitadas) || 0,
        municipiosDistribucion: this.mapMunicipiosDistribucion(result.municipiosDistribucion),

        // Oficinas (nombre + ruta)
        oficinasQueContratan: (result.oficinasQueContratan || []).map((o: any) => ({
          nombre: o?.nombre?.trim() || '',
          ruta: !!o?.ruta,
        })),

        tipoContratacion: result.tipoContratacion?.trim() || null,
        municipio: Array.isArray(result.municipio) ? result.municipio : [],
        auxilioTransporte: result.auxilioTransporte,
      };

      this.vacantesService.actualizarVacante(vacante?.id, payload).subscribe({
        next: async () => {
          await this.loadData();
          Swal.fire('¡Vacante actualizada!', 'Los datos se guardaron correctamente', 'success');
        },
        error: (error: any) => {
          Swal.fire('Error al guardar', error?.message || 'Error desconocido al actualizar la vacante', 'error');
        }
      });
    });
  }

  openModal(vacante?: any): void {
    const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
      width: '95vw',
      maxWidth: '95vw',
      data: vacante ? vacante : null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const isPrueba = result.pruebaOContratacion === 'Prueba';
      const oficinas = Array.isArray(result.oficinasQueContratan) ? result.oficinasQueContratan : [];

      const payload = {
        cargo: result.cargo?.trim() || null,
        area: result.area || null,
        empresaUsuariaSolicita: result.empresaUsuariaSolicita?.trim() || null,
        finca: result.finca?.trim() || null,
        ubicacionPruebaTecnica: result.ubicacionPruebaTecnica?.trim() || null,
        experiencia: result.experiencia?.trim() || null,

        // Condicionales
        fechadePruebatecnica: isPrueba ? this.formatDate(result.fechadePruebatecnica) : null,
        horadePruebatecnica: isPrueba ? (result.horadePruebatecnica || null) : null,
        fechadeIngreso: this.formatDate(result.fechadeIngreso) || null,
        pruebaOContratacion: isPrueba ? 'Prueba' : 'Contratación',

        observacionVacante: result.observacionVacante?.trim() || null,
        temporal: result.temporal?.trim() || null,
        descripcion: result.descripcion?.trim() || null,
        fechaPublicado: this.formatDate(new Date()),
        quienpublicolavacante: result.quienpublicolavacante?.trim() || 'Usuario Logueado',
        estadovacante: result.estadovacante?.trim() || 'Activa',
        salario: this.parseCurrency(result.salario),
        codigoElite: result.codigoElite?.trim() || null,

        // Distribución + total solicitadas
        personasSolicitadas: Number(result.personasSolicitadas) || 0,
        municipiosDistribucion: this.mapMunicipiosDistribucion(result.municipiosDistribucion),

        // Oficinas (nombre + ruta)
        oficinasQueContratan: oficinas.map((oficina: any) => ({
          nombre: oficina?.nombre?.trim() || '',
          ruta: !!oficina?.ruta
        })),

        tipoContratacion: result.tipoContratacion?.trim() || null,
        municipio: Array.isArray(result.municipio) ? result.municipio : [],
        auxilioTransporte: result.auxilioTransporte,
      };

      this.vacantesService.enviarVacante(payload).subscribe({
        next: async () => {
          await this.loadData();
          Swal.fire('¡Éxito!', 'La vacante ha sido enviada correctamente', 'success');
        },
        error: (error) => {
          Swal.fire('Error', `Problema al enviar la vacante: ${error?.message || 'Error desconocido'}`, 'error');
        }
      });
    });
  }

  // ===== Utilidades =====
  formatDate(date: Date | string | null): string | null {
    if (!date) return null;
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }

  eliminarVacante(vacante: any): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'No podrás revertir esto',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar'
    }).then(result => {
      if (result.isConfirmed) {
        this.vacantesService.eliminarVacante(vacante.id).subscribe(() => {
          this.vacantes = this.vacantes.filter(v => v.id !== vacante.id);
          Swal.fire('Eliminado!', 'La vacante ha sido eliminada.', 'success');
          this.loadData();
        });
      }
    });
  }

  escogerVacante(vacante: any): void {
    localStorage.setItem('vacanteSeleccionada', JSON.stringify(vacante));
    Swal.fire('Vacante seleccionada', 'Se almacenó la vacante para el proceso de selección', 'success');
  }

  // ---------- Subida Excel ----------
  subirArchivoExcel(_: any): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const datosProcesados = this.procesarDatosExcel(jsonData);
        this.enviarDatosExcel(datosProcesados);
      };
      reader.readAsArrayBuffer(file);
    }
    event.target.value = '';
  }

  procesarDatosExcel(jsonData: any[]): any[] {
    const datosProcesados: any[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const fila = jsonData[i];
      if (fila && fila.length > 0) {
        const vacante = {
          empresa_temporal: fila[0] || '',
          empresa_usuaria: fila[1] || '',
          centro_costo_carnet: fila[2] || '',
          empresa_usuaria_centro_costo: fila[3] || '',
          ciudad: fila[4] || '',
          telefono_encargado: fila[5] || '',
          sublabor: fila[6] || '',
          categoria: fila[7] || '',
          ccostos: fila[8] || '',
          subcentro: fila[9] || '',
          grupo: fila[10] || '',
          operacion: fila[11] || '',
          salario: fila[12] || 0,
          auxilio_transporte: fila[13] || '',
          ruta: fila[14] || '',
          valor_transporte: fila[15] || 0,
          horas_extras: fila[16] || 0,
          porcentaje_arl: fila[17] || 0
        };
        datosProcesados.push(vacante);
      }
    }
    return datosProcesados;
  }

  enviarDatosExcel(datos: any[]): void {
    // ⚠️ Ajusta este método según tu servicio real.
    // Si NO tienes vacantesService.crearDetalleLaboral, comenta esta llamada o crea el método.
    // this.vacantesService.crearDetalleLaboral(datos).subscribe(
    //   () => {
    //     Swal.fire('Éxito', 'Datos subidos correctamente', 'success');
    //     this.loadData();
    //   },
    //   () => {
    //     Swal.fire('Error', 'Ocurrió un error al subir los datos', 'error');
    //   }
    // );
    Swal.fire('Aviso', 'Implementa el endpoint para subir Excel (crearDetalleLaboral).', 'info');
  }

  getSiglaTemporal(temporal: string): string {
    switch (temporal) {
      case 'TU ALIANZA SAS': return 'TA';
      case 'APOYO LABORAL SAS': return 'AL';
      default: return temporal;
    }
  }

  descargarExcelVacantes(_: Event): void {
    this.dialog.open(DateRangeDialogComponent, {
      width: '400px',
      data: { title: 'Seleccionar rango de fechas', startDate: null, endDate: null }
    }).afterClosed().subscribe(result => {
      if (result) {
        const { start, end } = result;
        this.vacantesService.getVacantesExcel(start, end).subscribe(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vacantes_${start || 'inicio'}_${end || 'hoy'}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }
    });
  }

  isNumber(val: any): boolean {
    return typeof val === 'number' && !isNaN(val);
  }

  abrirFormularioPreRegistroVacantes(): void {
    window.open('https://formulario.tsservicios.co/formulario/formulario-pre-registro-vacantes', '_blank');
  }

  // ================== Semaforización ==================
  /** Total requerido desde el backend moderno. */
  totalRequerida(v: any): number {
    // 1) Si viene personasSolicitadas (nuevo campo)
    const total = Number(v?.personasSolicitadas);
    if (Number.isFinite(total) && total > 0) return total;

    // 2) Respaldo: sumar distribución si viene
    const dist = Array.isArray(v?.municipiosDistribucion) ? v.municipiosDistribucion : [];
    const sumDist = dist.reduce((acc: number, d: any) => acc + (Number(d?.cantidad) || 0), 0);
    if (sumDist > 0) return sumDist;

    // 3) Último recurso: 0
    return 0;
  }

  countPre(v: any): number {
    const p = v?.preseleccionados;
    if (Array.isArray(p)) return p.length;
    return this.toInt(p);
  }

  countCont(v: any): number {
    const c = v?.contratados;
    if (Array.isArray(c)) return c.length;
    return this.toInt(c);
  }

  private toInt(v: unknown): number {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string') {
      const m = v.match(/-?\d+/);
      return m ? parseInt(m[0], 10) : 0;
    }
    return 0;
  }

  semaforoPre(v: any): string {
    const req = this.totalRequerida(v);
    const pre = this.countPre(v);
    return pre >= req ? 'semaforo-ok' : 'semaforo-error';
  }

  semaforoCont(v: any): string {
    const req = this.totalRequerida(v);
    const pre = this.countPre(v);
    const cont = this.countCont(v);

    if (cont >= req) return 'semaforo-ok';
    if (pre >= req && cont < req) return 'semaforo-warn';
    return 'semaforo-error';
  }

  private isCumplida(v: any): boolean {
    const req = this.totalRequerida(v);
    return this.countPre(v) === req && this.countCont(v) === req;
  }

  private reordenarCumplidasAlFinal(arr: any[]): any[] {
    const no: any[] = [];
    const si: any[] = [];
    for (const v of arr) (this.isCumplida(v) ? si : no).push(v);
    return [...no, ...si];
  }

  private parseCurrency(val: any): number {
    // Convierte "1.423.500" → 1423500
    return Number(String(val ?? '').replace(/[^\d]/g, '')) || 0;
  }

  private mapMunicipiosDistribucion(arr: any[]): Array<{ municipio: string; cantidad: number }> {
    const src = Array.isArray(arr) ? arr : [];
    return src
      .map(d => ({
        municipio: String(d?.municipio ?? '').trim(),
        cantidad: Number(d?.cantidad) || 0,
      }))
      .filter(d => !!d.municipio);
  }
}
