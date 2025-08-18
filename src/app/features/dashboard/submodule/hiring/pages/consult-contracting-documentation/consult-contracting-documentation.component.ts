import { SharedModule } from '@/app/shared/shared.module';
import { Component, OnInit } from '@angular/core';
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
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

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
export class ConsultContractingDocumentationComponent implements OnInit {
  /** ---------- CONTROLES ---------- */
  cedulaControl = new FormControl('');
  user: any;
  /** ---------- TABLA PRINCIPAL ---------- */
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'cedula', 'tipo_documento', 'nombre', 'finca', 'fecha_ingreso', 'codigo_contrato', 'fechaContratacion', 'ficha_tecnica', 'pdf_cedula',  // ← coincide 100 %
    'procuraduria', 'contraloria', 'ofac', 'policivos',
    'adres', 'sisben', 'contrato', 'entrega_documentos',
    'arl', 'examen', 'fondo_pension', 'eps', 'caja', 'pago_seguridad_social',

  ];



  private crearFilaBase(cedula: string) {
    return {
      encontrado: true,
      cedula,
      tipo_documento: '',
      nombre: '',
      finca: '',
      fecha_ingreso: '',
      codigo_contrato: '',
      fechaContratacion: '',
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
      fecha_procuraduria: '',
      pdf_contraloria: '',
      fecha_contraloria: '',
      pdf_ofac: '',
      fecha_ofac: '',
      pdf_policivos: '',
      fecha_policivos: '',
      pdf_adres: '',
      fecha_adres: '',
      pdf_sisben: '',
      fecha_sisben: '',
      pdf_contrato: '',
      fecha_contrato: '',
      pdf_entrega_documentos: '',
      fecha_entrega_documentos: '',
      pdf_arl: '',
      fecha_arl: '',
      pdf_examen: '',
      fecha_examen: '',
      pdf_fondo_pension: '',
      fecha_fondo_pension: '',
      pdf_eps: '',
      fecha_eps: '',
      pdf_caja: '',
      fecha_caja: '',
      pdf_pago_seguridad_social: '',
      fecha_pago_seguridad_social: ''
    };
  }

  constructor(
    private gestionDocumentalService: GestionDocumentalService,
    private seleccionService: SeleccionService,
    private dialog: MatDialog,
    private infoVacantesService: InfoVacantesService,
    private utilityService: UtilityServiceService
  ) { }

  ngOnInit(): void {
    this.user = this.utilityService.getUser();
    console.log('Usuario actual:', this.user);
    // rol
    console.log('Rol del usuario:', this.user?.rol);
  }

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

  parseFecha(fecha: string): Date | null {
    if (!fecha) return null;
    const [dia, mes, anio] = fecha.split('/');
    return new Date(+anio, +mes - 1, +dia);
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
            row.tipo_documento = contratacionData.tipodedocumento || '';
            row.nombre = contratacionData.nombre_completo || contratacionData.nombreCompleto || '';
            row.finca = contratacionData.centro_costo_carnet || '';
            row.fecha_ingreso = this.parseFecha(contratacionData.fechaIngreso) || '';
            row.codigo_contrato = contratacionData.codigo_contrato || '';
            row.fechaContratacion = this.parseFecha(contratacionData.fechaContratacion) || '';
          } else {
            row.nombre_completo = '';
            row.tipo_documento = '';
            row.nombre = '';
            row.finca = '';
            row.fecha_ingreso = '';
          }
          console.log('Datos de contratación:', respuestas);
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
                  row.fecha_procuraduria = doc.uploaded_at || '';
                  break;
                case 'contraloria':
                  row.contraloria = '✔';
                  row.pdf_contraloria = doc.file_url || '';
                  row.fecha_contraloria = doc.uploaded_at || '';
                  break;
                case 'ofac':
                  row.ofac = '✔';
                  row.pdf_ofac = doc.file_url || '';
                  row.fecha_ofac = doc.uploaded_at || '';
                  break;
                case 'policivo':
                case 'policivos':
                  row.policivos = '✔';
                  row.pdf_policivos = doc.file_url || '';
                  row.fecha_policivos = doc.uploaded_at || '';
                  break;
                case 'adres':
                case 'adress':
                  row.adres = '✔';
                  row.pdf_adres = doc.file_url || '';
                  row.fecha_adres = doc.uploaded_at || '';
                  break;
                case 'sisben':
                  row.sisben = '✔';
                  row.pdf_sisben = doc.file_url || '';
                  row.fecha_sisben = doc.uploaded_at || '';
                  break;
                case 'contrato':
                  row.contrato = '✔';
                  row.pdf_contrato = doc.file_url || '';
                  row.fecha_contrato = doc.uploaded_at || '';
                  break;
                case 'entrega_de_documentos':
                  row.entrega_documentos = '✔';
                  row.pdf_entrega_documentos = doc.file_url || '';
                  row.fecha_entrega_documentos = doc.uploaded_at || '';
                  break;
                case 'arl':
                  row.arl = '✔';
                  row.pdf_arl = doc.file_url || '';
                  row.fecha_arl = doc.uploaded_at || '';
                  break;
                case 'examen':
                case 'examenes_medicos':
                  row.examen = '✔';
                  row.pdf_examen = doc.file_url || '';
                  row.fecha_examen = doc.uploaded_at || '';
                  break;
                case 'afp':
                  row.fondo_pension = '✔';
                  row.pdf_fondo_pension = doc.file_url || '';
                  row.fecha_fondo_pension = doc.uploaded_at || '';
                  break;
                case 'ficha_tecnica':
                  row.ficha_tecnica = '✔';
                  row.pdf_ficha_tecnica = doc.file_url || '';
                  row.fecha_ficha_tecnica = doc.uploaded_at || '';
                  break;
                case 'cedula':
                  row.pdf_cedula = doc.file_url || '';
                  row.fecha_cedula = doc.uploaded_at || '';
                  break;
                case 'eps':
                  row.eps = '✔';
                  row.pdf_eps = doc.file_url || '';
                  row.fecha_eps = doc.uploaded_at || '';
                  break;
                case 'caja':
                  row.caja = '✔';
                  row.pdf_caja = doc.file_url || '';
                  row.fecha_caja = doc.uploaded_at || '';
                  break;
                case 'pago_seguridad_social':
                  row.pago_seguridad_social = '✔';
                  row.pdf_pago_seguridad_social = doc.file_url || '';
                  row.fecha_pago_seguridad_social = doc.uploaded_at || '';
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

  exportarExcelFaltantes(): void {
    const data: any[] = (this.dataSource?.data || []).map(x => ({ ...x })) as any[];

    // Orden exacto de columnas que quieres en el Excel
    const headers = [
      'Cédula',
      'Tipo de Documento',
      'Nombre',
      'Finca',
      'Fecha ingreso',
      'Código de contrato',
      'Ficha Técnica',
      'PDF Cédula',
      'Procuraduría',
      'Contraloría',
      'OFAC',
      'Policivos',
      'ADRES',
      'SISBEN',
      'Contrato',
      'Entrega de Documentos',
      'ARL',
      'Examen',
      'Fondo de Pensión',
      'EPS',
      'Caja de Compensación',
      'Pago Seguridad Social',
    ];

    // Helper: 1 si hay archivo/url o flag "✔", 0 si no
    const toBin = (v: any) => (v && String(v).trim() !== '' ? 1 : 0);
    const isCheck = (v: any) => String(v || '').trim() === '✔';

    // Helper: prioriza pdfField, y si no existe usa un flag alterno (✔)
    const hasDoc = (item: any, pdfField: string, altFlagField?: string) => {
      if (pdfField in item) return toBin(item[pdfField]);
      if (altFlagField) return isCheck(item[altFlagField]) ? 1 : 0;
      return 0;
    };

    const rows = data.map((item) => {
      return {
        'Cédula': item.cedula ?? '',
        'Tipo de Documento': item.tipo_documento ?? '',
        'Nombre': item.nombre ?? '',
        'Finca': item.finca ?? '',
        'Fecha ingreso': item.fecha_ingreso ?? '',
        'Código de contrato': item.codigo_contrato ?? '',

        // Documentos (1 si hay pdf_*, 0 si no). En algunos hago fallback al flag "✔".
        'Ficha Técnica': hasDoc(item, 'pdf_ficha_tecnica', 'ficha_tecnica'),
        'PDF Cédula': hasDoc(item, 'pdf_cedula'),
        'Procuraduría': hasDoc(item, 'pdf_procuraduria', 'procuraduria'),
        'Contraloría': hasDoc(item, 'pdf_contraloria', 'contraloria'),
        'OFAC': hasDoc(item, 'pdf_ofac', 'ofac'),
        'Policivos': hasDoc(item, 'pdf_policivos', 'policivos'),
        'ADRES': hasDoc(item, 'pdf_adres', 'adres'),
        'SISBEN': hasDoc(item, 'pdf_sisben', 'sisben'),
        'Contrato': hasDoc(item, 'pdf_contrato', 'contrato'),
        'Entrega de Documentos': hasDoc(item, 'pdf_entrega_documentos', 'entrega_documentos'),
        'ARL': hasDoc(item, 'pdf_arl', 'arl'),
        'Examen': hasDoc(item, 'pdf_examen', 'examen'),
        'Fondo de Pensión': hasDoc(item, 'pdf_fondo_pension', 'fondo_pension'),
        'EPS': hasDoc(item, 'pdf_eps', 'eps'),
        'Caja de Compensación': hasDoc(item, 'pdf_caja', 'caja'),
        'Pago Seguridad Social': hasDoc(item, 'pdf_pago_seguridad_social', 'pago_seguridad_social'),
      };
    });

    // Crea la hoja con el orden de headers deseado
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    // Ajuste de anchos aproximados
    ws['!cols'] = headers.map(h => ({ wch: Math.max(18, h.length + 2) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Faltantes');

    const filename = `faltantes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }


  descargarChecklistExcel(startDate: Date, endDate: Date): void {
    if (!startDate || !endDate) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, seleccione un rango de fechas válido.'
      });
      return;
    }

    // 1. Mostrar modal de carga
    Swal.fire({
      title: 'Generando archivo...',
      icon: 'info',
      text: 'Por favor espera un momento.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    this.infoVacantesService.descargarChecklistJson(startDate, endDate).subscribe(json => {
      Swal.close(); // 2. Cerrar modal de carga

      if (!json || !json.rows || !json.rows.length) {
        Swal.fire({
          icon: 'info',
          title: 'Sin registros',
          text: 'No se encontraron registros en el rango seleccionado.'
        });
        return;
      }

      // 3. Mapea los encabezados a títulos "bonitos" para el Excel (opcional)
      const headerMap: Record<string, string> = {
        cedula: 'Cédula',
        tipo_documento: 'Tipo Documento',
        primer_apellido: 'Primer Apellido',
        segundo_apellido: 'Segundo Apellido',
        primer_nombre: 'Primer Nombre',
        segundo_nombre: 'Segundo Nombre',
        ficha_tecnica: 'Ficha Técnica',
        cedula_doc: 'Cédula Doc.',
        procuraduria: 'Procuraduría',
        contraloria: 'Contraloría',
        ofac: 'OFAC',
        policivos: 'Policivos',
        adres: 'Adres',
        sisben: 'Sisbén',
        contrato: 'Contrato',
        entrega_documentos: 'Entrega Documentos',
        arl: 'ARL',
        examenes_medicos: 'Exámenes Médicos',
        afp: 'AFP'
      };

      const headers: string[] = json.headers;
      const rows: any[] = json.rows;

      // 4. Opcional: Mapea los headers para el Excel (puedes quitar esto si prefieres los nombres técnicos)
      const displayHeaders = headers.map(h => headerMap[h] || h);

      // 5. Prepara los datos para Excel asegurando el orden de columnas
      const dataForExcel = rows.map((row: any) => {
        const newRow: any = {};
        headers.forEach(h => {
          if (h === 'cedula') {
            // Convertir a número (solo si no tiene ceros a la izquierda)
            newRow[headerMap[h] || h] = Number(row[h]);
          } else {
            newRow[headerMap[h] || h] = row[h];
          }
        });
        return newRow;
      });

      // 6. Crea el worksheet y el workbook
      const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataForExcel, { header: displayHeaders });
      XLSX.utils.sheet_add_aoa(worksheet, [displayHeaders], { origin: 'A1' });

      const workbook: XLSX.WorkBook = {
        Sheets: { 'Checklist': worksheet },
        SheetNames: ['Checklist']
      };

      // 7. Genera el archivo Excel
      const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

      // 8. Descarga el archivo
      const fechaActual = new Date().toISOString().slice(0, 10);
      saveAs(
        new Blob([excelBuffer], { type: 'application/octet-stream' }),
        `checklist_documental_${fechaActual}.xlsx`
      );

    }, error => {
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el archivo.'
      });
    });
  }


  verReporteAuditoria(): void {
    const data: any[] = Array.isArray(this.dataSource?.data) ? this.dataSource.data : [];
    if (!data.length) {
      Swal.fire('Sin datos', 'No hay registros para exportar.', 'info');
      return;
    }

    const f = (v: any) => {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const headers = [
      'Cédula',
      'Tipo de Documento',
      'Nombre',
      'Finca',
      'Fecha ingreso',
      'Código de contrato',
      'Fecha de contratación',

      'Ficha Técnica',
      'Fecha Ficha Técnica',

      'PDF Cédula',
      'Fecha Cédula',

      'Procuraduría',
      'Fecha Procuraduría',

      'Contraloría',
      'Fecha Contraloría',

      'OFAC',
      'Fecha OFAC',

      'Policivos',
      'Fecha Policivos',

      'ADRES',
      'Fecha ADRES',

      'SISBEN',
      'Fecha SISBEN',

      'Contrato',
      'Fecha Contrato',

      'Entrega de Documentos',
      'Fecha Entrega de Documentos',

      'ARL',
      'Fecha ARL',

      'Examen',
      'Fecha Examen',

      'Fondo de Pensión',
      'Fecha Fondo de Pensión',

      'EPS',
      'Fecha EPS',

      'Caja de Compensación',
      'Fecha Caja',

      'Pago Seguridad Social',
      'Fecha Pago Seguridad Social'
    ] as const;

    type Header = (typeof headers)[number];
    type Row = Record<Header, string | number>;

    const rows: Row[] = data.map(r => ({
      'Cédula': r.cedula ?? '',
      'Tipo de Documento': r.tipo_documento ?? '',
      'Nombre': r.nombre ?? '',
      'Finca': r.finca ?? '',
      'Fecha ingreso': f(r.fecha_ingreso),
      'Código de contrato': r.codigo_contrato ?? '',
      'Fecha de contratación': f(r.fechaContratacion),

      'Ficha Técnica': r.ficha_tecnica ?? '',
      'Fecha Ficha Técnica': f(r.fecha_ficha_tecnica),

      'PDF Cédula': r.pdf_cedula ?? '',
      'Fecha Cédula': f(r.fecha_cedula),

      'Procuraduría': r.procuraduria ?? '',
      'Fecha Procuraduría': f(r.fecha_procuraduria),

      'Contraloría': r.contraloria ?? '',
      'Fecha Contraloría': f(r.fecha_contraloria),

      'OFAC': r.ofac ?? '',
      'Fecha OFAC': f(r.fecha_ofac),

      'Policivos': r.policivos ?? '',
      'Fecha Policivos': f(r.fecha_policivos),

      'ADRES': r.adres ?? '',
      'Fecha ADRES': f(r.fecha_adres),

      'SISBEN': r.sisben ?? '',
      'Fecha SISBEN': f(r.fecha_sisben),

      'Contrato': r.contrato ?? '',
      'Fecha Contrato': f(r.fecha_contrato),

      'Entrega de Documentos': r.entrega_documentos ?? '',
      'Fecha Entrega de Documentos': f(r.fecha_entrega_documentos),

      'ARL': r.arl ?? '',
      'Fecha ARL': f(r.fecha_arl),

      'Examen': r.examen ?? '',
      'Fecha Examen': f(r.fecha_examen),

      'Fondo de Pensión': r.fondo_pension ?? '',
      'Fecha Fondo de Pensión': f(r.fecha_fondo_pension),

      'EPS': r.eps ?? '',
      'Fecha EPS': f(r.fecha_eps),

      'Caja de Compensación': r.caja ?? '',
      'Fecha Caja': f(r.fecha_caja),

      'Pago Seguridad Social': r.pago_seguridad_social ?? '',
      'Fecha Pago Seguridad Social': f(r.fecha_pago_seguridad_social),
    }));

    const ws = XLSX.utils.json_to_sheet(rows as any, { header: [...headers] });

    // ✅ Ancho de columnas con tipos correctos
    const colWidths = (headers as readonly Header[]).map((h) => ({
      wch: Math.min(
        50,
        Math.max(
          h.length + 2,
          ...rows.map((row) => String(row[h] ?? '').length + 2)
        )
      )
    }));
    (ws as any)['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    XLSX.writeFile(wb, `reporte_auditoria_${yyyy}-${mm}-${dd}.xlsx`);
  }


}


