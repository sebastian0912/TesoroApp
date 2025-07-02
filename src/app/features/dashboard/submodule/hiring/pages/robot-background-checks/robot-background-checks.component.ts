import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { SharedModule } from '@/app/shared/shared.module';
import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import Swal from 'sweetalert2';
import { RobotsService } from '../../service/robots/robots.service';
import * as XLSX from 'xlsx';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';

@Component({
  selector: 'app-robot-background-checks',
  imports: [
    SharedModule,
    InfoCardComponent
  ],
  templateUrl: './robot-background-checks.component.html',
  styleUrl: './robot-background-checks.component.css'
})
export class RobotBackgroundChecksComponent {
  /** ---------- CONTROLES ---------- */
  cedulaControl = new FormControl('');

  /** ---------- TABLA PRINCIPAL ---------- */
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'encontrado', 'cedula', 'hora_registro', 'oficina', 'tipo_documento',
    'estado_adress', 'apellido_adress', 'entidad_adress', 'pdf_adress', 'fecha_adress',
    'estado_policivo', 'anotacion_policivo', 'pdf_policivo',
    'estado_ofac', 'anotacion_ofac', 'pdf_ofac',
    'estado_contraloria', 'anotacion_contraloria', 'pdf_contraloria',
    'estado_sisben', 'tipo_sisben', 'pdf_sisben', 'fecha_sisben',
    'estado_procuraduria', 'anotacion_procuraduria', 'pdf_procuraduria',
    'estado_fondo_pension', 'entidad_fondo_pension', 'pdf_fondo_pension', 'fecha_fondo_pension',
    'estado_union', 'union_pdf', 'fecha_union_pdf'
  ];
  private readonly claves = ['cedula', 'tipo_documento', 'paquete'];
  constructor(
    private robotsService: RobotsService,
    private gestionDocumentalService: GestionDocumentalService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void { }

  /* ---------- BÚSQUEDA INDIVIDUAL ---------- */
  buscarPorCedula(): void {
    const cedula = this.cedulaControl.value?.trim();
    if (!cedula) {
      Swal.fire({ icon: 'warning', title: 'Cédula vacía', text: 'Ingrese una cédula.' });
      return;
    }
    this.robotsService.consultarEstadosRobots(cedula).subscribe({
      next: r => this.pintarRespuestaEnTabla(r, cedula),
      error: () => this.pintarRespuestaEnTabla(null, cedula)
    });
  }


  /* ---------- PEGAR LISTA DIRECTO EN TABLA ---------- */
  onTablePaste(evt: ClipboardEvent): void {
    const txt = evt.clipboardData?.getData('text') ?? '';
    if (!txt) { return; }
    evt.preventDefault();                                     // no pegar texto crudo
    if (txt.includes('\n') || txt.includes('\t') || txt.includes(',')) {
      this.procesarCedulasPegadas(txt);                       // lista de cédulas
    } else {
      this.cedulaControl.setValue(txt.trim());
      this.buscarPorCedula();                                 // cédula única
    }
  }

  procesarCedulasPegadas(texto: string): void {
    this.dataSource.data = [];
    const cedulas = texto.split(/[\n,\t;]+/).map(c => c.trim()).filter(Boolean);

    if (cedulas.length === 0) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No se detectaron cédulas en el texto pegado.' });
      return;
    }

    // Muestra el Swal de cargando
    Swal.fire({ icon: 'info', title: 'Consultando información...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let pendientes = cedulas.length * 2; // Cada cédula hace 2 consultas

    cedulas.forEach(c => {
      // Consulta robots
      this.robotsService.consultarEstadosRobots(c).subscribe({
        next: r => this.pintarRespuestaEnTabla(r, c),
        error: () => this.pintarRespuestaEnTabla(null, c),
        complete: () => {
          pendientes--;
          if (pendientes === 0) Swal.close();
        }
      });

      // Consulta documental
      this.gestionDocumentalService.consultarDocumentosPorCedulaYTipo(c, 2).subscribe({
        next: (docs: any) => {
          const documentos = Array.isArray(docs) ? docs : [docs];
          let idx = this.dataSource.data.findIndex(row => row.cedula === c);
          let row = idx >= 0 ? { ...this.dataSource.data[idx] } : { cedula: c, encontrado: true };

          documentos.forEach((doc: any) => {
            if (!doc || !doc.type_name) return;
            switch (doc.type_name.toUpperCase()) {
              case 'PROCURADURIA': row.pdf_procuraduria = doc.file_url; break;
              case 'POLICIVO':
              case 'POLICIVOS': row.pdf_policivo = doc.file_url; break;
              case 'OFAC': row.pdf_ofac = doc.file_url; break;
              case 'CONTRALORIA': row.pdf_contraloria = doc.file_url; break;
              case 'ADRES':
              case 'ADRESS': row.pdf_adress = doc.file_url; break;
              case 'SISBEN': row.pdf_sisben = doc.file_url; break;
              case 'FONDO PENSION': row.pdf_fondo_pension = doc.file_url; break;
              // agrega otros según tu catálogo
            }
          });

          if (idx >= 0) {
            this.dataSource.data[idx] = row;
            this.dataSource.data = [...this.dataSource.data];
          } else {
            this.dataSource.data = [...this.dataSource.data, row];
          }
        },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: `No se pudieron recuperar los documentos para la cédula ${c}.` }),
        complete: () => {
          pendientes--;
          if (pendientes === 0) Swal.close();
        }
      });
    });
  }




  /* ---------- AGREGAR FILA CON ✔ / ❌ ---------- */
  private pintarRespuestaEnTabla(res: any | null, cedulaFallback: string): void {
    const row = (res && (res.con_registros?.length || res.sin_consultar?.length))
      ? { ... (res.con_registros?.[0] ?? res.sin_consultar?.[0]), encontrado: true }
      : { cedula: cedulaFallback, encontrado: false };
    this.dataSource.data = [...this.dataSource.data, row];
  }

  /* ---------- FILTRO DE TABLA ---------- */
  applyFilters(ev: Event): void {
    this.dataSource.filter = (ev.target as HTMLInputElement).value.trim().toLowerCase();
  }

  /* ---------- INPUT FILE (EXCEL) ---------- */
  triggerFileInput(): void {
    (document.getElementById('fileInput') as HTMLInputElement).click();
  }

  /** ---------- CARGAR EXCEL (sin cambios funcionales) ---------- */
  cargarExcel(evt: any): void {
    const file = evt.target.files[0];
    if (!file) { Swal.fire({ icon: 'error', title: 'Error', text: 'Seleccione un archivo' }); return; }

    Swal.fire({ title: 'Cargando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
        if (!rows.length) { Swal.fire({ icon: 'error', title: 'Archivo vacío' }); return; }
        const mod = this.asignarClaves(rows);
        if (Object.keys(mod[0]).length !== this.claves.length) {
          Swal.fire({ icon: 'error', title: 'Formato incorrecto' }); return;
        }
        this.robotsService.enviarEstadosRobots(mod).subscribe({
          next: r => Swal.fire(r.message === 'success' ? { icon: 'success', title: 'Éxito' } : { icon: 'error', title: 'Error' }),
          error: () => Swal.fire({ icon: 'error', title: 'Error' }), complete: () => Swal.close()
        });
      } catch (_) { Swal.fire({ icon: 'error', title: 'Error al procesar' }); }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------- UTIL ---------- */
  private asignarClaves(data: any[]): any[] {
    return data
      .filter(r => r.some((c: any) => c !== null && c !== undefined && c !== ''))
      .map(r => {
        const obj: any = {};
        r.forEach((c: any, i: number) => { if (i < this.claves.length) { obj[this.claves[i]] = c || 'N/A'; } });
        return obj;
      });
  }
}
