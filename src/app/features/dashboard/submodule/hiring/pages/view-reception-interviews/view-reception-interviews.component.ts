import { Component, OnInit } from '@angular/core';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { MatTableDataSource } from '@angular/material/table';
import { SharedModule } from '@/app/shared/shared.module';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-view-reception-interviews',
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
  styleUrl: './view-reception-interviews.component.css'
})
export class ViewReceptionInterviewsComponent implements OnInit {
  user: any;
  displayedColumns: string[] = [
    'tipo_documento',
    'numero',
    'primer_apellido',
    'segundo_apellido',
    'primer_nombre',
    'segundo_nombre',
    'pre_registro',
    'entrevistado',
    'examenes_medicos',
    'contratado',
    'fecha_nacimiento',
    'fecha_expedicion',
    'barrio',
    'whatsapp',
    'genero',
    'cuenta_experiencia_flores',
    'oficina',
    'created_at',
    'correo'
  ];

  filtroTexto: string = '';
  filtroOficina: string = '';
  fechaDesde: Date | null = null;
  fechaHasta: Date | null = null;
  oficinasUnicas: string[] = [];
  filtroCedula: string = '';

  dataSource = new MatTableDataSource<any>([]);

  constructor(
    private seleccionService: SeleccionService,
    private utilityService: UtilityServiceService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.seleccionService.getCandidatos().subscribe(
      (data) => {
        this.dataSource.data = data;
        this.oficinasUnicas = [...new Set(data.map((e: any) => e.oficina).filter(Boolean))].sort() as string[];

      },
      (error) => {
        Swal.fire('Error', 'No se pudieron cargar los candidatos.', 'error');
      }
    );

    this.user = this.utilityService.getUser() || '';
    if (!this.user) {
      Swal.fire('Atención', 'No se pudo determinar la sede actual.', 'warning');
    }

  }

  limpiarFiltros() {
    this.filtroTexto = '';
    this.filtroOficina = '';
    this.fechaDesde = null;
    this.fechaHasta = null;

    // Si tienes referencia al input de texto, límpialo visualmente también (opcional)
    const input = document.querySelector('input[placeholder="Buscar"]') as HTMLInputElement;
    if (input) input.value = '';
    this.applyAdvancedFilter();
  }


  downloadReport() {
    const dialogRef = this.dialog.open(DateRangeDialogComponent, {
      width: '400px',
      data: { startDate: null, endDate: null }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result || !result.start || !result.end) {
        Swal.fire('Atención', 'Debes seleccionar ambas fechas para descargar el reporte.', 'warning');
        return;
      }

      const start = new Date(result.start);
      const end = new Date(result.end);

      Swal.fire({
        title: 'Generando reporte...',
        text: 'Por favor espera.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Si el usuario NO es ADMIN/GERENCIA, descarga el reporte por oficina
      if (this.user.rol !== 'ADMIN' && this.user.rol !== 'GERENCIA') {
        this.seleccionService.exportarCandidatosPorOficinaExcel({
          start: result.start,
          end: result.end,
          oficina: this.user.sucursalde // o el campo correcto
        }).subscribe({
          next: (blob: Blob) => {
            Swal.close();
            this.downloadBlob(
              blob,
              `reporte_candidatos_${this.user.oficina || this.user.sucursalde}_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.xlsx`
            );
          },
          error: () => {
            Swal.close();
            Swal.fire('Error', 'No se pudo generar el reporte para la oficina.', 'error');
          }
        });
        return; // IMPORTANTE: solo descarga uno u otro, nunca ambos
      }

      // Si es ADMIN o GERENCIA, descarga el reporte general
      this.seleccionService.exportarCandidatosExcel({
        start: result.start,
        end: result.end
      }).subscribe({
        next: (blob: Blob) => {
          Swal.close();
          this.downloadBlob(
            blob,
            `reporte_candidatos_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.xlsx`
          );
        },
        error: () => {
          Swal.close();
          Swal.fire('Error', 'No se pudo generar el reporte.', 'error');
        }
      });
    });
  }

  // Utilidad profesional para descargar cualquier blob
  private downloadBlob(blob: Blob, fileName: string): void {
    if (!blob || blob.size === 0) {
      Swal.fire('Sin datos', 'No hay información para exportar en este rango de fechas.', 'info');
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }


  copiarTablaExcel() {
    const toColombiaDateTime = (utcString: string) => {
      if (!utcString) return '';
      const date = new Date(utcString);
      // Opciones para obtener los componentes
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      const partes = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
      const get = (type: string) => partes.find(x => x.type === type)?.value || '';

      // Armar como DD-MM-YYYY HH:mm:ss
      return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
    };

    const filas = this.dataSource.filteredData.map((row: any) =>
      [
        toColombiaDateTime(row.created_at),
        row.como_se_entero,
        row.tipo_documento,
        row.numero,
        row.primer_apellido,
        row.segundo_apellido,
        row.primer_nombre,
        row.segundo_nombre,
        row.fecha_nacimiento,
        row.fecha_expedicion,
        row.barrio,
        row.whatsapp,
        row.genero,
        row.cuenta_experiencia_flores,
        row.correo,
      ]
        .map(dato => (dato ?? '').toString().toUpperCase())
        .join('\t')
    );

    const textoTabla = filas.join('\n');

    navigator.clipboard.writeText(textoTabla).then(() => {
      Swal.fire('¡Copiado!', 'La tabla filtrada se copió al portapapeles.', 'success');
    });
  }



  // Filtro de texto general (ya lo tienes)
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.filtroTexto = filterValue;
    this.applyAdvancedFilter();
  }

  // Filtro avanzado
  applyAdvancedFilter() {
    const texto = this.filtroTexto?.trim().toLowerCase() ?? '';
    const oficina = this.filtroOficina?.trim().toLowerCase() ?? '';
    const desde = this.fechaDesde;
    const hasta = this.fechaHasta;
    const cedula = this.filtroCedula?.trim();

    this.dataSource.filterPredicate = (data: any, filter: string) => {
      // Filtro de texto general (en cualquier campo visible)
      const matchesText =
        texto === '' ||
        Object.values(data)
          .join(' ')
          .toLowerCase()
          .includes(texto);

      // Filtro exacto por cédula
      const matchesCedula =
        cedula === '' ||
        (data.numero ?? '').toString().includes(cedula);

      // Filtro por oficina exacta
      const matchesOficina =
        !oficina || (data.oficina ?? '').toLowerCase() === oficina;

      // Filtro por fecha (created_at)
      let matchesFecha = true;
      if (desde) {
        matchesFecha =
          matchesFecha &&
          new Date(data.created_at).setHours(0, 0, 0, 0) >= new Date(desde).setHours(0, 0, 0, 0);
      }
      if (hasta) {
        matchesFecha =
          matchesFecha &&
          new Date(data.created_at).setHours(0, 0, 0, 0) <= new Date(hasta).setHours(0, 0, 0, 0);
      }

      return matchesText && matchesOficina && matchesFecha && matchesCedula;
    };
    this.dataSource.filter = '' + Math.random(); // Trigger
  }


}
