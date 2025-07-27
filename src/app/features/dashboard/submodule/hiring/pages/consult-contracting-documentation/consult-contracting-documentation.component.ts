import { SharedModule } from '@/app/shared/shared.module';
import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import Swal from 'sweetalert2';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { catchError, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { OrdenUnionDialogComponent } from '../../components/orden-union-dialog/orden-union-dialog.component';
import { MatDialogModule } from '@angular/material/dialog';
import { SeleccionService } from '../../service/seleccion/seleccion.service';

@Component({
  selector: 'app-consult-contracting-documentation',
  imports: [
    SharedModule,
    MatButtonModule,
    MatDialogModule
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
    'cedula', 'nombre', 'finca', 'fecha_ingreso', 'ficha_tecnica', 'pdf_cedula',  // ← coincide 100 %
    'procuraduria', 'contraloria', 'ofac', 'policivos',
    'adres', 'sisben', 'contrato', 'entrega_documentos',
    'arl', 'examen', 'fondo_pension', 'eps', 'caja', 'pago_seguridad_social',
  ];

  private crearFilaBase(cedula: string) {
    return {
      encontrado: true,
      cedula,

      nombre: '',
      finca: '',
      fecha_ingreso: '',

      ficha_tecnica: '',
      pdf_cedula: '',
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
      pdf_fondo_pension: '',
      pdf_eps: '',
      pdf_caja: '',
      pdf_pago_seguridad_social: ''
    };
  }

  constructor(
    private gestionDocumentalService: GestionDocumentalService,
    private seleccionService: SeleccionService,
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
    evt.preventDefault();
    if (txt.includes('\n') || txt.includes('\t') || txt.includes(',')) {
      this.procesarCedulasPegadas(txt);
    } else {
      this.cedulaControl.setValue(txt.trim());
      this.buscarPorCedula();
    }
  }

  procesarCedulasPegadas(texto: string): void {
    this.dataSource.data = [];
    const cedulas = texto.split(/[\n,\t;]+/).map(c => c.trim()).filter(Boolean);

    if (cedulas.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin datos',
        text: 'No se detectaron cédulas en el texto pegado.'
      });
      return;
    }

    Swal.fire({
      icon: 'info',
      title: 'Consultando información...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    let pendientes = cedulas.length;

    cedulas.forEach(c => {
      let idx = this.dataSource.data.findIndex(row => row.cedula === c);
      let row = idx >= 0 ? { ...this.dataSource.data[idx] } : this.crearFilaBase(c);

      if (idx < 0) {
        this.dataSource.data = [...this.dataSource.data, row];
      }

      const tipos = [2, 25, 27, 29, 30, 32, 34, 36, 37, 38];

      forkJoin([
        this.seleccionService.buscarEncontratacion(c).pipe(
          catchError(() => of(null))
        ),
        forkJoin(
          tipos.map(tipo =>
            this.gestionDocumentalService.consultarDocumentosPorCedulaYTipo(c, tipo)
              .pipe(
                catchError(() => of([]))
              )
          )
        )
      ]).subscribe({
        next: ([contratacionData, respuestas]: [any, any[]]) => {
          // --- Datos personales y de contratación ---
          if (contratacionData) {
            row.nombre_completo = contratacionData.nombre_completo || contratacionData.nombreCompleto || '';
            row.nombre = contratacionData.nombre_completo || contratacionData.nombreCompleto || '';
            row.finca = contratacionData.centro_de_costos || '';
            row.fecha_ingreso = contratacionData.fechaIngreso || '';
          } else {
            row.nombre_completo = '';
            row.nombre = '';
            row.finca = '';
            row.fecha_ingreso = '';
          }

          // --- Documentos ---
          respuestas.forEach((docs: any, i: number) => {
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
                case 'afp':
                  row.fondo_pension = '✔';
                  row.pdf_fondo_pension = doc.file_url || '';
                  break;
                case 'ficha_tecnica':
                  row.ficha_tecnica = '✔';
                  row.pdf_ficha_tecnica = doc.file_url || '';
                  break;
                case 'cedula':
                  row.pdf_cedula = doc.file_url || '';
                  break;
                case 'eps':
                  row.eps = '✔';
                  row.pdf_eps = doc.file_url || '';
                  break;
                case 'caja':
                  row.caja = '✔';
                  row.pdf_caja = doc.file_url || '';
                  break;
                case 'pago_seguridad_social':
                  row.pago_seguridad_social = '✔';
                  row.pdf_pago_seguridad_social = doc.file_url || '';
                  break;

                // Agrega más tipos si es necesario
              }
            });
          });

          // Actualizar la fila en la tabla (por referencia y por spread)
          idx = this.dataSource.data.findIndex(row => row.cedula === c);
          this.dataSource.data[idx] = row;
          this.dataSource.data = [...this.dataSource.data];
        },
        error: () => {
          // Puedes mostrar un error global aquí si lo deseas
        },
        complete: () => {
          pendientes--;
          if (pendientes === 0) Swal.close();
        }
      });
    });
  }

  /* ---------- FILTRO DE TABLA ---------- */
  applyFilters(ev: Event): void {
    this.dataSource.filter = (ev.target as HTMLInputElement).value.trim().toLowerCase();
  }

  limpiarTabla() {
    this.dataSource.data = [];
    this.cedulaControl.setValue('');
  }

  descargarZip(): void {
    Swal.fire({
      title: '¿Deseas descargar los archivos PDF?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, por favor',
      cancelButtonText: 'No'
    }).then(result => {
      if (result.isConfirmed) {
        this.abrirDialogOrden();
      }
    });
  }

  abrirDialogOrden(): void {
    const antecedentes = [
      { id: 34, name: 'FICHA TÉCNICA' },
      { id: 29, name: 'CEDULA' },
      { id: 3, name: 'PROCURADURIA' },
      { id: 4, name: 'CONTRALORIA' },
      { id: 5, name: 'OFAC' },
      { id: 6, name: 'POLICIVOS' },
      { id: 7, name: 'ADRES' },
      { id: 8, name: 'SISBEN' },
      { id: 25, name: 'CONTRATO' },
      { id: 27, name: 'ENTREGA DE DOCUMENTOS' },
      { id: 30, name: 'ARL' },
      { id: 32, name: 'EXAMENES MEDICOS' },
      { id: 11, name: 'AFP' },
      { id: 36, name: 'EPS' },
      { id: 37, name: 'CAJA DE COMPENSACION' },
      { id: 38, name: 'PAGO SEGURIDAD SOCIAL' }
    ];

    const dialogRef = this.dialog.open(OrdenUnionDialogComponent, {
      width: '400px',
      height: '65vh',
      data: { antecedentes }
    });

    dialogRef.afterClosed().subscribe((ordenSeleccionado: number[] | null) => {
      if (ordenSeleccionado) {
        this.descargarZipConUnion(ordenSeleccionado);
      }
    });
  }

  descargarZipConUnion(ordenSeleccionado: any): void {
    // imprimir cedulas
    const cedulas = this.dataSource.data
      .filter(row => row.encontrado && row.cedula)
      .map(row => row.cedula);

    Swal.fire({
      title: 'Preparando descarga...',
      text: 'Esto puede tardar unos segundos',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.gestionDocumentalService.descargarZipPorCedulasYOrden(cedulas, ordenSeleccionado)
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `documentos_union_${new Date().toISOString()}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          Swal.close();
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar el archivo.' });
        }
      });
  }
}


