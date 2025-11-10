import { Component, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import Swal from 'sweetalert2';

import { SharedModule } from '@/app/shared/shared.module';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';

export interface EnEsperaItem {
  tipo_doc: string | null;
  numero_documento: string;         // texto (conserva posible 'X...')
  apellidos_nombres: string | null;
  tiene_experiencia: 'SI' | 'NO';
  barrio: string | null;
  area_experiencia: string | null;
  celular: string | null;
  whatsapp: string | null;
  motivo_espera: string | null;     // <<< NUEVO
}

@Component({
  selector: 'app-view-reception-interviews',
  standalone: true,
  imports: [
    SharedModule,
    MatDialogModule,
    MatButtonModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule
  ],
  templateUrl: './view-reception-interviews.component.html',
  styleUrls: ['./view-reception-interviews.component.css']
})
export class ViewReceptionInterviewsComponent implements OnInit {
  user: any;

  /** Solo columnas del nuevo endpoint EN_ESPERA */
  displayedColumns: string[] = [
    'tipo_doc',
    'numero_documento',
    'apellidos_nombres',
    'tiene_experiencia',
    'barrio',
    'area_experiencia',
    'celular',
    'whatsapp',
    'motivo_espera'                 // <<< NUEVO
  ];

  // Filtros visibles en UI
  filtroTexto = '';
  filtroOficina = '';               // se usa para recargar desde backend
  fechaDesde: Date | null = null;   // solo para Excel por rango
  fechaHasta: Date | null = null;   // solo para Excel por rango
  oficinasUnicas: string[] = [];    // llenamos con la sede del usuario si existe
  filtroCedula = '';

  dataSource = new MatTableDataSource<EnEsperaItem>([]);

  constructor(
    private utilityService: UtilityServiceService,
    private registroProcesoContratacion: RegistroProcesoContratacion,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.user = this.utilityService.getUser() || null;

    // Sugerimos como opción de oficina la sede del usuario (si la hay)
    const sedeUsuario = (this.user?.sede?.nombre || '').trim();
    this.oficinasUnicas = sedeUsuario ? [sedeUsuario] : [];

    // Carga inicial (si hay sede la usamos, si no, sin filtro => todas las oficinas del día)
    this.cargarUltimosEnEspera(sedeUsuario || undefined);

    // Configuramos el predicate de filtros (texto y cédula)
    this.configFilterPredicate();
  }

  /** Llama al endpoint /reporte/ultimos-en-espera?oficina=... (hoy) */
  private cargarUltimosEnEspera(oficina?: string): void {
    this.registroProcesoContratacion.getUltimosEnEspera(oficina).subscribe({
      next: (data) => {
        this.dataSource.data = data || [];
        // refresca filtros vigentes
        this.applyAdvancedFilter();
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar la lista de candidatos EN ESPERA.', 'error');
      }
    });
  }

  /** Cambia de oficina desde el select y recarga desde backend */
  recargarConOficina(): void {
    const oficina = (this.filtroOficina || '').trim() || undefined;
    this.cargarUltimosEnEspera(oficina);
  }

  // ================= Acciones de UI =================

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroCedula = '';
    // No reseteamos filtroOficina para no perder el contexto de recarga
    this.applyAdvancedFilter();

    // Limpia input visual (opcional)
    const input = document.querySelector('input[placeholder="Buscar"]') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  /** Descarga Excel por rango (reutiliza tu endpoint de entrevistas-excel) */
  downloadReport(): void {
    const dialogRef = this.dialog.open(DateRangeDialogComponent, {
      width: '400px',
      data: { startDate: null, endDate: null }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.start || !result?.end) {
        Swal.fire('Atención', 'Debes seleccionar ambas fechas para descargar el reporte.', 'warning');
        return;
      }

      const start = new Date(result.start);
      const end   = new Date(result.end);

      Swal.fire({
        title: 'Generando reporte...',
        text: 'Por favor espera.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const oficina = (this.user?.sede?.nombre || '').trim() || undefined;

      this.registroProcesoContratacion
        .downloadEntrevistasExcel(
          { start, end },
          oficina,
          `reporte_candidatos${oficina ? '_' + oficina : ''}_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.xlsx`
        )
        .subscribe({
          next: () => Swal.close(),
          error: () => {
            Swal.close();
            Swal.fire('Error', 'No se pudo generar el reporte.', 'error');
          }
        });
    });
  }

  /** Copia la tabla filtrada al portapapeles en formato tabulado (solo columnas visibles) */
  copiarTablaExcel(): void {
    const filas = this.dataSource.filteredData.map((row) =>
      [
        row.tipo_doc || '',
        row.numero_documento || '',
        row.apellidos_nombres || '',
        row.tiene_experiencia || '',
        row.barrio || '',
        row.area_experiencia || '',
        row.celular || '',
        row.whatsapp || '',
        row.motivo_espera || ''        // <<< NUEVO
      ]
      .map(dato => (dato ?? '').toString().toUpperCase())
      .join('\t')
    );

    const textoTabla = filas.join('\n');
    navigator.clipboard.writeText(textoTabla).then(() => {
      Swal.fire('¡Copiado!', 'La tabla filtrada se copió al portapapeles.', 'success');
    });
  }

  // ================= Búsqueda / Filtros en cliente =================

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.filtroTexto = filterValue;
    this.applyAdvancedFilter();
  }

  private configFilterPredicate(): void {
    this.dataSource.filterPredicate = (data: EnEsperaItem, _filter: string) => {
      const texto  = (this.filtroTexto ?? '').trim().toLowerCase();
      const cedula = (this.filtroCedula ?? '').trim();

      // Búsqueda general en los campos visibles (incluye motivo_espera)
      const buscable = [
        data.tipo_doc,
        data.numero_documento,
        data.apellidos_nombres,
        data.tiene_experiencia,
        data.barrio,
        data.area_experiencia,
        data.celular,
        data.whatsapp,
        data.motivo_espera           // <<< NUEVO
      ].map(v => (v ?? '').toString().toLowerCase()).join(' ');

      const matchesTexto  = !texto || buscable.includes(texto);
      const matchesCedula = !cedula || (data.numero_documento ?? '').toString().includes(cedula);

      return matchesTexto && matchesCedula;
    };
  }

  applyAdvancedFilter(): void {
    // dispara el predicate ya configurado
    this.dataSource.filter = Math.random().toString();
  }
}
