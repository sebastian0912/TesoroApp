import { SharedModule } from '@/app/shared/shared.module';
import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import Swal from 'sweetalert2';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-consult-contracting-documentation',
  imports: [
    SharedModule,
  ],
  templateUrl: './consult-contracting-documentation.component.html',
  styleUrl: './consult-contracting-documentation.component.css'
})
export class ConsultContractingDocumentationComponent {
  /** ---------- CONTROLES ---------- */
  cedulaControl = new FormControl('');

  /** ---------- TABLA PRINCIPAL ---------- */
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'encontrado', 'cedula', 'procuraduria',
    'contraloria', 'ofac', 'policivos', 'adres', 'sisben',
    'contrato', 'entrega_documentos', 'arl', 'examen', 'fondo_pension'
  ];
  private crearFilaBase(cedula: string) {
    return {
      encontrado: true,
      cedula,
      procuraduria: '',
      contraloria: '',
      ofac: '',
      policivos: '',
      adres: '',
      sisben: '',
      contrato: '',
      entrega_documentos: '',
      arl: '',
      examen: '',
      fondo_pension: '',
      pdf_procuraduria: '',
      pdf_contraloria: '',
      pdf_ofac: '',
      pdf_policivos: '',
      pdf_adres: '',
      pdf_sisben: '',
      pdf_contrato: '',
      pdf_entrega_documentos: '',
      pdf_arl: '',
      pdf_examen: '',
      pdf_fondo_pension: ''
    };
  }


  constructor(
    private gestionDocumentalService: GestionDocumentalService,
    private dialog: MatDialog
  ) { }

  /* ---------- BÚSQUEDA INDIVIDUAL ---------- */
  buscarPorCedula(): void {
    const cedula = this.cedulaControl.value?.trim();
    if (!cedula) {
      Swal.fire({ icon: 'warning', title: 'Cédula vacía', text: 'Ingrese una cédula.' });
      return;
    }
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

    Swal.fire({ icon: 'info', title: 'Consultando información...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // Para saber cuándo todas las cédulas terminaron
    let pendientes = cedulas.length;

    cedulas.forEach(c => {
      // Inicializa la fila en el datasource desde el inicio:
      let idx = this.dataSource.data.findIndex(row => row.cedula === c);
      let row = idx >= 0 ? { ...this.dataSource.data[idx] } : this.crearFilaBase(c);

      // Siempre asegura que esté presente en la tabla:
      if (idx < 0) {
        this.dataSource.data = [...this.dataSource.data, row];
      }

      // Arreglo con todos los tipos a consultar
      const tipos = [2, 25, 27, 30, 32];

      // Ejecuta todas las consultas en paralelo
      forkJoin(
        tipos.map(tipo =>
          this.gestionDocumentalService.consultarDocumentosPorCedulaYTipo(c, tipo)
        )
      ).subscribe({
        next: (respuestas: any[]) => {
          // Procesa cada respuesta según el tipo solicitado
          respuestas.forEach((docs: any, i: number) => {
            const tipoConsulta = tipos[i];
            const documentos = Array.isArray(docs) ? docs : [docs];
            documentos.forEach((doc: any) => {
              if (!doc || !doc.type_name) return;
              const tipo = doc.type_name.toLowerCase().replace(/\s+/g, '_');

              switch (tipo) {
                case 'procuraduria':
                  row.procuraduria = '✔';
                  row.pdf_procuraduria = doc.file_url || '';
                  break;
                case 'contraloria':
                  row.contraloria = '✔';
                  row.pdf_contraloria = doc.file_url || '';
                  break;
                case 'ofac':
                  row.ofac = '✔';
                  row.pdf_ofac = doc.file_url || '';
                  break;
                case 'policivo':
                case 'policivos':
                  row.policivos = '✔';
                  row.pdf_policivos = doc.file_url || '';
                  break;
                case 'adres':
                case 'adress':
                  row.adres = '✔';
                  row.pdf_adres = doc.file_url || '';
                  break;
                case 'sisben':
                  row.sisben = '✔';
                  row.pdf_sisben = doc.file_url || '';
                  break;
                case 'contrato':
                  row.contrato = '✔';
                  row.pdf_contrato = doc.file_url || '';
                  break;
                case 'entrega_de_documentos':
                  row.entrega_documentos = '✔';
                  row.pdf_entrega_documentos = doc.file_url || '';
                  break;
                case 'arl':
                  row.arl = '✔';
                  row.pdf_arl = doc.file_url || '';
                  break;
                case 'examen':
                case 'examenes_medicos':
                  row.examen = '✔';
                  row.pdf_examen = doc.file_url || '';
                  break;
                case 'fondo_pension':
                  row.fondo_pension = '✔';
                  row.pdf_fondo_pension = doc.file_url || '';
                  break;
              }
            });
          });

          // Actualiza el datasource
          idx = this.dataSource.data.findIndex(row => row.cedula === c);
          this.dataSource.data[idx] = row;
          this.dataSource.data = [...this.dataSource.data];
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Error', text: `No se pudieron recuperar los documentos para la cédula ${c}.` });
        },
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

}
