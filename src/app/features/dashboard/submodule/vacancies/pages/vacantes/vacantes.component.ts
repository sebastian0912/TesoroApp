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
import { catchError, finalize, Observable, of } from 'rxjs';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { SharedModule } from '@/app/shared/shared.module';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { NativeDateModule } from '@angular/material/core';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-vacantes',
  standalone: true,
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
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  permitido: boolean = false;

  constructor(
    private dialog: MatDialog,
    private vacantesService: VacantesService,
    private utilityService: UtilityServiceService,
    private seleccionService: SeleccionService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadData();
    const user = this.utilityService.getUser();
    // el rol es GERENCIA O ADMIN?
    this.permitido = user?.rol.nombre === 'GERENCIA' || user?.rol.nombre === 'ADMIN';
  }

  loading = false;

  private normalize(s?: string | null): string {
    return (s ?? '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') // quita acentos
      .trim()
      .toUpperCase();
  }

  // ADMIN / GERENCIA ven todo (aceptamos algunos alias comunes)
  private canSeeAll(user: any): boolean {
    const rol = this.normalize(user?.rol.nombre);
    return rol === 'ADMIN' || rol === 'GERENCIA';
  }

  // Convierte a array desde string/array y soporta separadores ; , |
  private splitToArray(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.filter(Boolean) as string[];
    if (typeof raw === 'string') {
      return raw.split(/[;,|]/).map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  // Tomamos las oficinas objetivo del usuario: sucursalde (principal), con fallbacks por si cambian el nombre del campo
  private extractTargetOffices(user: any): string[] {
    const parts = [
      ...this.splitToArray(user?.sede.nombre),   // <- lo que nos dijiste que viene
    ];
    // quitar duplicados
    const uni = Array.from(new Set(parts));
    return uni;
  }

  // ¿La vacante tiene alguna oficina con nombre que coincida con las oficinas del usuario?
  private matchOffice(vacante: any, officeNames: string[]): boolean {
    if (!officeNames.length) return false;
    const wanted = new Set(officeNames.map(n => this.normalize(n)));
    const oficinas = vacante?.oficinasQueContratan ?? [];
    return oficinas.some((o: any) => wanted.has(this.normalize(o?.nombre)));
  }

  loadData(): void {
    this.loading = true;

    this.vacantesService.listarVacantes().pipe(
      catchError(() => {
        Swal.fire('Error', 'Ocurrió un error al cargar las vacantes', 'error');
        return of([] as any[]); // si tienes interfaz, usa Vacante[]
      }),
      finalize(() => this.loading = false)
    ).subscribe((response: any[]) => {
      const user = this.utilityService.getUser();

      // 1) Filtrar por oficinas (comparando user.sucursalde vs oficinasQueContratan[].nombre)
      let rows = this.canSeeAll(user)
        ? response
        : response.filter(v => this.matchOffice(v, this.extractTargetOffices(user)));


      // 2) Reordenar (usa el resultado filtrado)
      rows = this.reordenarCumplidasAlFinal(rows);

      // 3) Asignar a la tabla
      this.dataSource.data = rows;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }


  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  openModalEdit(vacante?: any): void {
    const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
      minWidth: '80vw',
      data: vacante || null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const payload = {
          cargo: result.cargo,
          temporal: result.temporal,
          area: result.area,
          empresaUsuariaSolicita: result.empresaUsuariaSolicita,
          finca: result.finca,
          experiencia: result.experiencia,
          descripcion: result.descripcion,
          salario: Number(result.salario),
          codigoElite: result.codigoElite,
          observacionVacante: result.observacionVacante,
          fechadePruebatecnica: this.formatDate(result.fechadePruebatecnica) || null,
          horadePruebatecnica: result.pruebaOContratacion === 'Prueba' ? result.horadePruebatecnica : null,
          fechadeIngreso: this.formatDate(result.fechadeIngreso) || null,
          fechaPublicado: result.fechaPublicado || new Date().toISOString(),
          quienpublicolavacante: result.quienpublicolavacante || 'Sistema',
          estadovacante: result.estadovacante || 'Activa',
          oficinasQueContratan: result.oficinasQueContratan.map((o: any) => ({
            nombre: o.nombre,
            numeroDeGenteRequerida: o.numeroDeGenteRequerida,
            ruta: o.ruta
          })),
          pruebaOContratacion: result.pruebaOContratacion?.trim() || null,
          tipoContratacion: result.tipoContratacion?.trim() || null,
          municipio: Array.isArray(result.municipio) ? result.municipio : [],
          auxilioTransporte: result.auxilioTransporte,
        };

        this.vacantesService.actualizarVacante(vacante?.id, payload).subscribe({
          next: async () => {
            await this.loadData();
            Swal.fire({
              title: '¡Vacante actualizada!',
              text: 'Los datos han sido guardados correctamente',
              icon: 'success',
              confirmButtonText: 'Aceptar'
            });
          },
          error: (error: any) => {
            Swal.fire({
              title: 'Error al guardar',
              text: error.message || 'Error desconocido al actualizar la vacante',
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }

  openModal(vacante?: any): void {
    const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
      minWidth: '80vw',
      data: vacante ? vacante : null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const oficinas = Array.isArray(result.oficinasQueContratan) ? result.oficinasQueContratan : [];

        const payload = {
          cargo: result.cargo?.trim() || null,
          area: result.area || null,
          empresaUsuariaSolicita: result.empresaUsuariaSolicita?.trim() || null,
          finca: result.finca?.trim() || null,
          ubicacionPruebaTecnica: result.ubicacionPruebaTecnica?.trim() || null,
          experiencia: result.experiencia?.trim() || null,
          fechadePruebatecnica: result.fechadePruebatecnica ? this.formatDate(result.fechadePruebatecnica) : null,
          horadePruebatecnica: result.horadePruebatecnica?.trim() || null,
          observacionVacante: result.observacionVacante?.trim() || null,
          fechadeIngreso: result.fechadeIngreso ? this.formatDate(result.fechadeIngreso) : null,
          temporal: result.temporal?.trim() || null,
          descripcion: result.descripcion?.trim() || null,
          fechaPublicado: this.formatDate(new Date()),
          quienpublicolavacante: result.quienpublicolavacante?.trim() || "Usuario Logueado",
          estadovacante: result.estadovacante?.trim() || "Activa",
          salario: Number(result.salario) || 0,
          codigoElite: result.codigoElite?.trim() || null,
          oficinasQueContratan: oficinas.map((oficina: any) => ({
            nombre: oficina.nombre?.trim() || '',
            numeroDeGenteRequerida: Number(oficina.numeroDeGenteRequerida) || 1,
            ruta: !!oficina.ruta
          })),
          pruebaOContratacion: result.pruebaOContratacion?.trim() || null,
          tipoContratacion: result.tipoContratacion?.trim() || null,
          municipio: Array.isArray(result.municipio) ? result.municipio : [],
          auxilioTransporte: result.auxilioTransporte,
        };

        this.vacantesService.enviarVacante(payload).subscribe({
          next: async () => {
            await this.loadData();
            Swal.fire({
              title: '¡Éxito!',
              text: 'La vacante ha sido enviada correctamente',
              icon: 'success',
              confirmButtonText: 'Aceptar'
            });
          },
          error: (error) => {
            Swal.fire({
              title: 'Error',
              text: `Hubo un problema al enviar la vacante: ${error.message || 'Error desconocido'}`,
              icon: 'error',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      }
    });
  }

  formatDate(date: Date | string | null): string | null {
    if (!date) return null;
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }

  // Método para eliminar una vacante
  eliminarVacante(vacante: any): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "No podrás revertir esto",
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

  // Escoger vacante y almacenar
  escogerVacante(vacante: any): void {
    localStorage.setItem('vacanteSeleccionada', JSON.stringify(vacante));
    Swal.fire('Vacante seleccionada', 'La vacante ha sido almacenada para ejecutarla en su proceso de seleccion', 'success');
  }

  // ------------------ Subida y envío Excel ------------------
  subirArchivoExcel(event: any): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
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
    const datosProcesados = [];
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
    this.vacantesService.crearDetalleLaboral(datos).subscribe(
      () => {
        Swal.fire('Éxito', 'Datos subidos correctamente', 'success');
        this.loadData();
      },
      () => {
        Swal.fire('Error', 'Ocurrió un error al subir los datos', 'error');
      }
    );
  }

  getSiglaTemporal(temporal: string): string {
    switch (temporal) {
      case 'TU ALIANZA SAS':
        return 'TA';
      case 'APOYO LABORAL SAS':
        return 'AL';
      default:
        return temporal;
    }
  }

  descargarExcelVacantes(event: Event): void {
    this.dialog.open(DateRangeDialogComponent, {
      width: '400px',
      data: {
        title: 'Seleccionar rango de fechas',
        startDate: null,
        endDate: null
      }
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

  // =========================================================
  // ===============  SEMAFORIZACIÓN (Helper)  ===============
  // =========================================================

  totalRequerida(v: any): number {
    const oficinas = Array.isArray(v?.oficinasQueContratan) ? v.oficinasQueContratan : [];
    return oficinas.reduce((acc: number, o: any) => acc + this.toInt(o?.numeroDeGenteRequerida), 0);
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

  /**
   * PRESELECCIONADOS:
   * - Verde  (ok)   si pre >= requerido
   * - Rojo   (error) si pre  < requerido
   */
  semaforoPre(v: any): string {
    const req = this.totalRequerida(v);
    const pre = this.countPre(v);
    return pre >= req ? 'semaforo-ok' : 'semaforo-error';
  }

  /**
   * CONTRATADOS:
   * - Verde   (ok)   si cont >= requerido
   * - Naranja (warn) si pre  >= requerido pero cont < requerido
   * - Rojo    (error) si pre  < requerido (ni siquiera hay pre suficientes)
   */
  semaforoCont(v: any): string {
    const req = this.totalRequerida(v);
    const pre = this.countPre(v);
    const cont = this.countCont(v);

    if (cont >= req) return 'semaforo-ok';
    if (pre >= req && cont < req) return 'semaforo-warn';
    return 'semaforo-error';
  }

  /** ¿Cumplida? pre == requerido y cont == requerido */
  private isCumplida(v: any): boolean {
    const req = this.totalRequerida(v);
    return this.countPre(v) === req && this.countCont(v) === req;
  }

  /** Particiona estable: primero NO cumplidas, luego cumplidas */
  private reordenarCumplidasAlFinal(arr: any[]): any[] {
    const no: any[] = [];
    const si: any[] = [];
    for (const v of arr) (this.isCumplida(v) ? si : no).push(v);
    return [...no, ...si];
  }

  /** Accesor para números robusto */
  private toNumber(v: any): number {
    return typeof v === 'number' ? v : this.toInt(v);
  }

  /** Accesor de fechas -> timestamp */
  private toTime(v: any): number {
    if (!v) return 0;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }


}
