import { SharedModule } from '@/app/shared/shared.module';
import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import Swal from 'sweetalert2';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { HiringService } from '../../service/hiring.service';
import * as fontkit from 'fontkit';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable, { RowInput } from 'jspdf-autotable';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { REFERENCIAS_A, REFERENCIAS_F } from '@/app/shared/model/const';
import { switchMap, map, take, catchError, tap, finalize } from 'rxjs/operators';
import { of, forkJoin, firstValueFrom } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

type UploadedInfo = {
  file: File;
  fileName: string;
  previewUrl?: string; // URL creada con URL.createObjectURL
};

@Component({
  selector: 'app-generate-contracting-documents',
  imports: [
    SharedModule, RouterLink
  ],
  templateUrl: './generate-contracting-documents.component.html',
  styleUrl: './generate-contracting-documents.component.css'
})

export class GenerateContractingDocumentsComponent implements OnInit {
  @ViewChild('pdfPreviewIframe') pdfPreviewIframe!: ElementRef<HTMLIFrameElement>;
  pdfSafeUrl: SafeResourceUrl | null = null;

  cedula: string = '';
  nombreCompletoLogin: string = '';
  codigoContratacion: any = '';
  firmaPersonalAdministrativo: any = '';
  user: any = {};
  sede: any = '';
  cedulaPersonalAdministrativo: any = '';
  referenciasA = REFERENCIAS_A;
  referenciasF = REFERENCIAS_F;
  empresa: string = '';

  firma: any = '';
  candidato: any = {};
  vacante: any = {};
  huella: any = '';
  foto: any = '';

  private platformId = inject(PLATFORM_ID);
  private route = inject(ActivatedRoute);
  private utilService = inject(UtilityServiceService);
  private registroProcesoContratacion = inject(RegistroProcesoContratacion);
  private vacantesService = inject(VacantesService);
  private contratacionService = inject(HiringService);
  private gestionDocumentalService = inject(GestionDocumentalService);
  private sanitizer = inject(DomSanitizer);


  documentos = [
    { titulo: 'Autorización de datos' },
    { titulo: 'Entrega de documentos' },
    { titulo: 'Ficha técnica' },
    { titulo: 'Ficha técnica TA Completa' },
    { titulo: 'Contrato' },
    { titulo: 'Entrega carnets' },
    { titulo: 'Inducción capacitación' },
    { titulo: 'Formato solicitud' },
    { titulo: 'MANEJO_IMAGEN' },
    { titulo: 'FICHA_SOCIAL' },
    { titulo: 'Cedula' },
    { titulo: 'ARL' },
    { titulo: 'Figura Humana' },
    { titulo: 'EPS' },
    { titulo: 'CAJA' },
    { titulo: 'PAGO SEGURIDAD SOCIAL' },
    { titulo: 'PRUEBAS PSICOLOGICAS' },
    { titulo: 'PRUEBA LECTRO ESCRITURA' },
    { titulo: 'VISITA DOMICILIARIA' },
    { titulo: 'PRUEBA SST' },
  ];

  nombreCompleto = '';

  private randIndex(max: number): number {
    if (!Number.isFinite(max) || max <= 0) return 0;

    const c = globalThis.crypto as Crypto | undefined;

    // ¡IMPORTANTE! No "descolgar" el método. Úsalo ligado a `crypto` o con bind.
    if (c?.getRandomValues) {
      const getRV = c.getRandomValues.bind(c);   // evita "Illegal invocation"
      const buf = new Uint32Array(1);
      getRV(buf);
      return Number(buf[0] % max);
    }

    // Fallback no criptográfico (suficiente para UI)
    return Math.floor(Math.random() * max);
  }

  // ─────────────────────────────────────────────────────────────
  // Devuelve una referencia aleatoria según el tipo:
  //  'A' => this.referenciasA,  'F' => this.referenciasF
  // ─────────────────────────────────────────────────────────────
  getReferencia(tipo: 'A' | 'F'): string {
    const pool = tipo === 'A' ? this.referenciasA : this.referenciasF;
    if (!pool?.length) return '';
    return pool[this.randIndex(pool.length)];
  }

  uploadedFiles: { [key: string]: UploadedInfo } = {};

  typeMap: { [key: string]: number } = {
    Contrato: 42,
    "Autorización de datos": 37,
    "Entrega de documentos": 16,
    'Ficha técnica': 39,
    'Ficha técnica TA Completa': 39,
    Cedula: 3,
    ARL: 50,
    'Figura Humana': 32,
    EPS: 48,
    CAJA: 47,
    'PAGO SEGURIDAD SOCIAL': 52,
    'Entrega carnets': 81,
    'Inducción capacitación': 82,
    'Formato solicitud': 83,
    'PRUEBAS PSICOLOGICAS': 30,
    'PRUEBA LECTRO ESCRITURA': 31,
    'VISITA DOMICILIARIA': 22,
    'PRUEBA SST': 33,
    'MANEJO_IMAGEN': 14,
    'FICHA_SOCIAL': 17,
  };

  async ngOnInit(): Promise<void> {
    // SSR: no hagas nada del navegador
    if (!isPlatformBrowser(this.platformId)) {
      this.user = {};
      return;
    }

    // Loader
    Swal.fire({
      icon: 'info',
      title: 'Cargando datos...',
      text: 'Por favor, espera un momento.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // 1) Cédula: ruta -> localStorage
      const cedulaRuta = this.route.snapshot.paramMap.get('numeroDocumento') ?? '';
      this.cedula = cedulaRuta || localStorage.getItem('cedula') || '';
      if (this.cedula) localStorage.setItem('cedula', this.cedula);

      // 2) Usuario/sede
      this.user = this.utilService.getUser?.() ?? {};
      this.nombreCompletoLogin = `${this.user?.datos_basicos?.nombres ?? ''} ${this.user?.datos_basicos?.apellidos ?? ''}`.trim();
      this.cedulaPersonalAdministrativo = this.user?.numero_de_documento ?? '';
      this.sede = this.user?.sede?.nombre ?? '';

      // 3) Validación temprana
      if (!this.cedula) {
        Swal.close();
        Swal.fire('Sin datos', 'No hay cédula en la URL ni en sesión.', 'info');
        return;
      }

      // 4) Observables principales
      const datoCandidato$ = this.registroProcesoContratacion
        .getCandidatoPorDocumento(this.cedula, true)
        .pipe(take(1), catchError(() => of(null)));

      const datoAdministrativo$ = this.user?.numero_de_documento
        ? this.contratacionService.buscarEncontratacion(this.user.numero_de_documento)
          .pipe(take(1), catchError(() => of(null)))
        : of(null);

      // 5) Ejecutar, cargar vacante (si hay), y setear estado
      forkJoin({ datoCandidato: datoCandidato$, datoAdministrativo: datoAdministrativo$ })
        .pipe(
          switchMap(({ datoCandidato, datoAdministrativo }) => {
            this.candidato = datoCandidato;
            console.log('datoCandidato', datoCandidato);

            this.firma = datoCandidato?.biometria?.firma?.file_url ?? '';
            this.huella = datoCandidato?.biometria?.huella?.file_url ?? '';
            this.foto = datoCandidato?.biometria?.foto?.file_url ?? '';

            this.codigoContratacion =
              datoCandidato?.entrevistas?.[0]?.proceso?.contrato?.codigo_contrato ?? null;

            this.firmaPersonalAdministrativo = datoAdministrativo?.data?.[0]?.firmaSolicitante ?? '';

            const vacanteId = datoCandidato?.entrevistas?.[0]?.proceso?.publicacion ?? null;
            const vacante$ = vacanteId
              ? this.vacantesService.obtenerVacante(vacanteId).pipe(take(1), catchError(() => of(null)))
              : of(null);

            return vacante$.pipe(map(vac => ({ vac, datoAdministrativo, datoCandidato })));
          }),
          tap(({ vac }) => {
            this.vacante = vac ?? {};
            console.log('vacanteData', vac);
            this.empresa = this.vacante?.temporal || '';
            console.log('Código de contratación:', this.codigoContratacion);
          }),
          finalize(() => Swal.close())
        )
        .subscribe({
          next: () => { },
          error: (err) => {
            console.error(err);
            Swal.close();
            Swal.fire('Error', 'Ocurrió un error al cargar información.', 'error');
          },
        });

    } catch (error) {
      console.error('Error en ngOnInit:', error);
      Swal.close();
      this.user = {};
      Swal.fire('Error', 'Ocurrió un error inesperado.', 'error');
    }
  }

  isSubirPDF(doc: any): boolean {
    return [
      'Cedula', 'ARL', 'Figura Humana', 'EPS', 'CAJA', 'PAGO SEGURIDAD SOCIAL',
      'PRUEBAS PSICOLOGICAS', 'PRUEBA LECTRO ESCRITURA', 'VISITA DOMICILIARIA', 'PRUEBA SST'
    ].includes(doc.titulo);
  }

  subirArchivo(event: Event, campo: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.resetInput(input);
      return;
    }

    // Validación del nombre de archivo
    if (file.name.length > 100) {
      Swal.fire('Error', 'El nombre del archivo no debe exceder los 100 caracteres', 'error');
      this.resetInput(input);
      return;
    }

    // Revocar URL anterior si existía (evitar memory leaks)
    const prev = this.uploadedFiles[campo]?.previewUrl;
    if (prev) {
      try { URL.revokeObjectURL(prev); } catch { }

    }

    // Guardar archivo y URL de previsualización
    const previewUrl = URL.createObjectURL(file);
    this.uploadedFiles[campo] = { file, fileName: file.name, previewUrl };

    // Mostrar previsualización en el iframe (si es PDF)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      this.setPdfPreview(previewUrl);
    } else {
      // Si quieres permitir ver imágenes también, puedes poner el mismo previewUrl
      // this.setPdfPreview(previewUrl);
      Swal.fire('Aviso', 'El archivo seleccionado no es un PDF. Solo se previsualizan PDFs.', 'info');
    }

    // Permitir volver a seleccionar el mismo archivo
    this.resetInput(input);
  }

  private setPdfPreview(url: string) {
    if (this.pdfPreviewIframe && this.pdfPreviewIframe.nativeElement) {
      this.pdfPreviewIframe.nativeElement.src = url;
    }
  }

  private resetInput(input: HTMLInputElement): void {
    const newInput = input.cloneNode(true) as HTMLInputElement;
    input.parentNode?.replaceChild(newInput, input);
  }

  verPDF(doc: { titulo: string }) {
    const fileData = this.uploadedFiles[doc.titulo];
    if (fileData?.file) {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const blob = new Blob([fileReader.result as ArrayBuffer], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(blob);
        this.setPdfPreview(pdfUrl);
      };
      fileReader.readAsArrayBuffer(fileData.file);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se ha generado el documento',
      });
    }
  }

  async cargarpdf() {
    Swal.fire({
      title: 'Cargando...',
      text: 'Por favor, espera mientras se suben los archivos.',
      icon: 'info',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const { ok, fallidos } = await this.subirTodosLosArchivos();

      // cerrar SIEMPRE el loading antes de mostrar otro swal
      Swal.close();

      if (ok) {
        await Swal.fire({
          title: '¡Éxito!',
          text: 'Datos y archivos guardados exitosamente.',
          icon: 'success',
          confirmButtonText: 'Ok',
        });
        return;
      }

      // Si hubo fallidos, muestra resumen (y ya no queda cargando)
      const htmlFallidos = `
      <p style="margin:0 0 8px 0">Algunos archivos no se subieron:</p>
      <ul style="text-align:left;margin:0;padding-left:18px">
        ${fallidos.map(f => `<li><b>${f.key}</b>: ${this.escapeHtml(f.error)}</li>`).join('')}
      </ul>
    `;

      await Swal.fire({
        icon: 'warning',
        title: 'Guardado con advertencias',
        html: htmlFallidos,
        confirmButtonText: 'Ok',
      });

    } catch (error: any) {
      Swal.close();
      await Swal.fire({
        title: 'Error',
        text: `Hubo un error al subir los archivos: ${error?.message ?? String(error)}`,
        icon: 'error',
        confirmButtonText: 'Ok',
      });
    }
  }

  // Sube y SIEMPRE retorna resumen (nunca se queda “colgada”)
  async subirTodosLosArchivos(): Promise<{
    ok: boolean;
    exitosos: string[];
    fallidos: { key: string; error: string }[];
  }> {
    const archivosAEnviar = Object.keys(this.uploadedFiles)
      .filter((key) => (key in this.typeMap) && this.uploadedFiles[key]?.file)
      .map((key) => ({
        key,
        ...this.uploadedFiles[key],
        typeId: this.typeMap[key],
      }));

    if (archivosAEnviar.length === 0) {
      return { ok: true, exitosos: [], fallidos: [] };
    }

    const promesasDeSubida = archivosAEnviar.map(({ key, file, fileName, typeId }) =>
      new Promise<{ key: string }>((resolveSubida, rejectSubida) => {
        this.gestionDocumentalService
          .guardarDocumento(fileName, this.cedula, typeId, file, this.codigoContratacion)
          .pipe(take(1))
          .subscribe({
            next: () => resolveSubida({ key }),
            error: (err) =>
              rejectSubida({
                key,
                error: err?.error?.message || err?.message || 'Error desconocido',
              }),
          });
      })
    );

    const results = await Promise.allSettled(promesasDeSubida);

    const exitosos: string[] = [];
    const fallidos: { key: string; error: string }[] = [];

    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        exitosos.push(r.value.key);
      } else {
        const info = r.reason as { key: string; error: string };
        fallidos.push({ key: info.key, error: info.error });
      }
    });

    // Si necesitas lógica extra cuando viene "Contrato", hazla aquí,
    // PERO asegura que al final siempre retornas.
    // const contratoIncluido = archivosAEnviar.some(a => a.key === 'Contrato' || a.typeId === this.typeMap['Contrato']);
    // if (contratoIncluido) { ...await algo... }

    return { ok: fallidos.length === 0, exitosos, fallidos };
  }

  generarPDF(documento: string) {
    if (!this.empresa || this.empresa.trim() === '') {
      Swal.fire('Atención', 'Selecciona el candidato, la empresa no está definida.', 'warning');
      return;
    }

    const emp = this.empresa.toUpperCase().trim();

    if (documento === 'Autorización de datos') {
      this.generarAutorizacionDatos();
    }
    else if (documento === 'Entrega de documentos') {
      if (emp.includes('APOYO LINEA')) {
        this.generarEntregaDocsApoyo(); // TODO: If Alianza has its own, change it later
      } else if (emp.includes('APOYO')) {
        this.generarEntregaDocsApoyo();
      } else if (emp.includes('ALIANZA')) {
        // this.generarEntregaDocsAlianza(); // Pending if it exists
      } else {
        Swal.fire('Atención', 'Falta seleccionar la remision', 'info');
      }
    }
    else if (documento === 'Contrato') {
      if (emp.includes('ALIANZA')) {
        this.generarContratoTrabajoTuAlianza();
      } else {
        this.generarContratoTrabajo();
      }
    }
    else if (documento === 'Ficha técnica') {
      if (emp.includes('ALIANZA')) {
        this.generarFichaTecnicaTuAlianza();
      } else {
        this.generarFichaTecnica();
      }
    }
    else if (documento === 'Ficha técnica TA Completa') {
      if (emp.includes('ALIANZA')) {
        this.generarFichaTecnicaTuAlianzaCompleta();
      } else {
        Swal.fire('Atención', 'Este formato es exclusivo para Tu Alianza.', 'info');
      }
    }
    else if (documento === 'Entrega carnets') {
      this.generarEntregaCarnets();
    }
    else if (documento === 'Inducción capacitación') {
      this.generarInduccionCapacitacion();
    }
    else if (documento === 'Formato solicitud') {
      this.generarFormatoSolicitud();
    }
    else if (documento === 'MANEJO_IMAGEN') {
      this.generarManejoImagen();
    }
    else if (documento === 'FICHA_SOCIAL') {
      this.generarFichaSocial();
    } else {
      Swal.fire('Error', 'Funcionalidad de PDF no implementada para: ' + documento, 'error');
    }
  }

  // --- Manejo Imagen Modificado con Textos Formateados en Negrita ---
  async generarManejoImagen() {
    try {
      const cand: any = this.candidato ?? {};
      const vac: any = this.vacante ?? {};

      // ── Mapeo de Variables ──
      const nombreTrabajador = [
        cand.primer_apellido, cand.segundo_apellido,
        cand.primer_nombre, cand.segundo_nombre,
      ].map((x: any) => String(x ?? '').trim()).filter(Boolean).join(' ').toUpperCase();
      const numIdentificacion = String(cand.numero_documento ?? '').trim();
      const domicilioTrabajador = String(cand.residencia?.municipio ?? '').toUpperCase();

      const empresaUsuaria = this.safe(vac.empresaUsuariaSolicita).toUpperCase();
      const nitEmpresaUsuaria = this.safe(vac.nitEmpresaUsuaria ?? vac.nit ?? '');
      const domicilioEmpresaUsuaria = this.safe(vac.domicilioEmpresaUsuaria ?? vac.direccion ?? '');
      const representanteEmpresaUsuaria = this.safe(vac.representanteLegalEmpresaUsuaria ?? vac.representanteLegal ?? '').toUpperCase();
      const ccRepresentanteEmpresaUsuaria = this.safe(vac.ccRepresentanteEmpresaUsuaria ?? vac.ccRepresentante ?? '');

      const fechaActual = new Date();
      const opcionesFecha: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
      const fechaFirmaTexto = fechaActual.toLocaleDateString('es-CO', opcionesFecha);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      doc.setProperties({ title: `MANEJO_IMAGEN_${nombreTrabajador}.pdf`, author: 'Tu Alianza SAS / Apoyo Laboral' });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 12;
      const anchoTabla = pageWidth - (marginLeft * 2);

      const { logoPath } = this.getEmpresaInfo();

      autoTable(doc, {
        startY: 10,
        margin: { left: marginLeft },
        tableWidth: anchoTabla,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 7, halign: 'center', valign: 'middle', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, cellPadding: 0.5 },
        body: [
          [
            { content: '', rowSpan: 3, styles: { cellWidth: 28 } },
            { content: 'PROCESO DE CONTRATACIÓN', colSpan: 3, styles: { fontStyle: 'bold' } },
            { content: 'Página: 1 de 1', rowSpan: 3, styles: { fontStyle: 'bold', cellWidth: 22 } }
          ],
          [
            { content: 'ACUERDO Y AUTORIZACIÓN DE USO DE IMAGEN', colSpan: 3, styles: { fontStyle: 'bold' } }
          ],
          [
            { content: 'Código: AL CO-RE-12', styles: { fontStyle: 'bold' } },
            { content: 'Versión: 01', styles: { fontStyle: 'bold' } },
            { content: 'Fecha Emisión: Agosto 26-25', styles: { fontStyle: 'bold' } }
          ]
        ],
        didDrawCell: (data) => {
          if (data.row.index === 0 && data.column.index === 0 && logoPath) {
            try {
              const dimHeight = data.cell.height - 1;
              const dimWidth = 24;
              const posX = data.cell.x + (data.cell.width - dimWidth) / 2;
              const posY = data.cell.y + 0.5;
              doc.addImage(logoPath, 'PNG', posX, posY, dimWidth, dimHeight);
            } catch (e) { }
          }
        }
      });

      const finalYTabla = (doc as any).lastAutoTable.finalY;
      let currentY = finalYTabla + 6;

      // Mini-renderizador de Negritas justificado simple
      const printFormattedJustified = (textRaw: string, pSize = 7.5, indentLeft = 0) => {
        const words = textRaw.split(/(\s+)/); // separa espacios manteniendo para ancho
        doc.setFontSize(pSize);
        const espacioW = doc.getTextWidth(' ');

        let lineWords: any[] = [];
        let lineWidth = 0;
        const lineMaxW = anchoTabla - indentLeft;

        // Medir palabras y aplicar formatos primitivos **texto** para negrita
        let lines: any[][] = [];

        for (let i = 0; i < words.length; i++) {
          let word = words[i];
          if (/^\s+$/.test(word)) {
            // Es un bloque de espacio
            if (lineWidth > 0) { // no añadir el primer espacio a una linea vacia
              lineWords.push({ text: ' ', isSpace: true, bold: false, width: espacioW });
              lineWidth += espacioW;
            }
            continue;
          }

          let isBold = false;
          let wToPrint = word;
          if (wToPrint.includes('**')) {
            isBold = true;
            wToPrint = wToPrint.replace(/\*\*/g, '');
          }

          doc.setFont('helvetica', isBold ? 'bold' : 'normal');
          let textW = doc.getTextWidth(wToPrint);

          if (lineWidth + textW > lineMaxW && lineWords.length > 0) {
            // Remover último espacio si lo hay
            if (lineWords[lineWords.length - 1].isSpace) lineWords.pop();
            lines.push([...lineWords]);
            lineWords = [];
            lineWidth = 0;
          }

          lineWords.push({ text: wToPrint, isSpace: false, bold: isBold, width: textW });
          lineWidth += textW;
        }
        if (lineWords.length > 0) lines.push(lineWords);

        // Escribir líneas justificadas
        for (let l = 0; l < lines.length; l++) {
          let cLine = lines[l];
          let wordsOnly = cLine.filter(w => !w.isSpace);
          let rawLineWidth = wordsOnly.reduce((acc, curr) => acc + curr.width, 0);

          // Si no es la última línea de párrafo, calcula delta de espacios justificados
          let spaceExtraWidth = espacioW;
          if (l < lines.length - 1 && wordsOnly.length > 1) {
            const gapTotal = lineMaxW - rawLineWidth;
            spaceExtraWidth = gapTotal / (wordsOnly.length - 1);
          }

          let curX = marginLeft + indentLeft;
          for (let j = 0; j < cLine.length; j++) {
            const itm = cLine[j];
            if (itm.isSpace) {
              curX += spaceExtraWidth;
            } else {
              doc.setFont('helvetica', itm.bold ? 'bold' : 'normal');
              doc.text(itm.text, curX, currentY);
              curX += itm.width;
            }
          }

          currentY += (pSize * 0.35 + 0.8);
        }
        currentY += 1.5; // salto extra párrafo
      };

      const centerText = (text: string, size = 9) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(size);
        const split = doc.splitTextToSize(text, anchoTabla);
        doc.text(split, marginLeft + (anchoTabla / 2), currentY, { align: 'center', maxWidth: anchoTabla });
        currentY += (split.length * (size * 0.35 + 0.5)) + 1.5;
      };

      // == Contenido del Documento ==

      centerText('ACUERDO USO DE IMAGEN', 9);

      const pIntro = `Entre los suscritos a saber, **APOYO LABORAL TS**, persona jurídica identificada con NIT 900.814.587-1, con domicilio en la Carrera 2 # 8 - 156, Facatativá, Cundinamarca, debidamente representada por la señora MAYRA HUAMANÍ LÓPEZ, identificada con la cédula de extranjería N° 332.318 en su calidad de Representante Legal, quien para los efectos del presente documento se denominará **EL EMPLEADOR**; Y por otra parte, **${empresaUsuaria || '_________________'}**, persona jurídica con NIT **${nitEmpresaUsuaria || '___________'}**, con domicilio en la **${domicilioEmpresaUsuaria || '_________________'}**, legalmente representada por el señor(a) **${representanteEmpresaUsuaria || '_________________'}**, identificado con la cédula de ciudadanía No. **${ccRepresentanteEmpresaUsuaria || '___________'}**, quien en adelante se denominará **LA EMPRESA USUARIA**; Y por otra parte, el señor **${nombreTrabajador || '_________________'}**, identificado con la cédula de ciudadanía No. **${numIdentificacion || '___________'}**, mayor de edad, con domicilio en **${domicilioTrabajador || '___________'}**, quien en adelante se denominará **EL TRABAJADOR**; hemos celebrado el presente acuerdo de uso de imagen, conforme a la Ley Estatutaria 1581 de 2012 de protección de datos y normas reglamentarias y a las demás normas concordantes, previa a las siguientes consideraciones:`;
      printFormattedJustified(pIntro, 7.5);

      centerText('CONSIDERACIONES', 8.5);

      printFormattedJustified(`**I.** **EL EMPLEADOR Y LA EMPRESA USUARIA** en ejercicio de su objeto social desarrolla diversas campañas, tendientes a fortalecer su imagen corporativa, efectuar capacitaciones, en las cuales elabora material audiovisual en el que eventualmente puede utilizar el nombre, imagen, voz y/o apariencia **DEL TRABAJADOR**, las cuales pueden ser incluidas en las imágenes, fotos, grabaciones de video, cintas de audio, imágenes digitales, y similares tomadas o hechas por **EL EMPLEADOR Y/O EMPRESA USUARIA** o su personal, las cuáles serán incluidas en obras audiovisuales.`, 7.5);
      printFormattedJustified(`**II.** Que **EL EMPLEADOR Y/O LA EMPRESA USUARIA** es el titular de todos y cada uno de los derechos patrimoniales de autor sobre las obras audiovisuales señaladas en el numeral anterior, situación que declara y reconoce expresamente **EL TRABAJADOR**.`, 7.5);
      printFormattedJustified(`**III.** Que las partes convienen en celebrar el presente Acuerdo de Uso de Imagen, por medio del cual **EL TRABAJADOR** acepta su eventual participación en la ejecución y desarrollo de las obras audiovisuales anteriormente mencionadas.`, 7.5);

      printFormattedJustified(`En razón de lo expuesto, las Partes suscriben el presente documento, el cual está regido por la Legislación Colombiana, la Ley Estatutaria 1581 de 2012 y la Ley 23 de 1982 y por las siguientes:`, 7.5);

      centerText('CLÁUSULAS', 8.5);

      printFormattedJustified(`**1.** **OBJETO** - **EL TRABAJADOR** en uso de sus plenas facultades, autoriza irrevocablemente **AL EMPLEADOR Y /O LA EMPRESA USUARIA**, para que utilice su nombre, imagen, voz y/o apariencia, como tal, las cuales pueden ser incluidas en las imágenes, fotos, grabaciones de video, cintas de audio, imágenes digitales, y similares tomadas o hechas por el **EMPLEADOR Y/O LA EMPRESA USUARIA** o su personal, las cuáles serán incluidas en las Obras audiovisuales que este desarrolle en ejercicio de las campañas antes mencionadas y en consecuencia, acepta que el **EMPLEADOR Y/O LA EMPRESA USUARIA**, tiene la propiedad de tales imágenes, grabaciones de video y audio realizadas en ejercicio de las campañas antes mencionadas incluyendo la totalidad de derechos de autor, y puede usarlos para el propósito de publicarlos, reproducirlos y ponerlos a disposición del público en cualquier medio conocido o por conocerse. Estos usos incluyen, pero no se limitan a las ilustraciones, exhibiciones, grabaciones de videos, audio, transmisiones, reproducciones (totales o parciales), publicaciones, anuncios y materiales promocionales o educativos a través de cualquier plataforma de distribución existente o por inventarse, incluidas redes sociales. Así mismo, **EL TRABAJADOR** otorga esta autorización para los exclusivos efectos de emitir, publicar, divulgar y promocionar en cualquier lugar del mundo, y por el máximo tiempo permitido por la ley, las imágenes y datos antes mencionados.`, 7.5, 4);
      printFormattedJustified(`**2.** **MODALIDAD DE USO** - Tal utilización podrá realizarse mediante la divulgación a través de su reproducción, tanto en medios impresos como electrónicos/digitales, así como su comunicación, emisión y divulgación pública, a través de los medios existentes, o por inventarse, incluidos aquellos de acceso remoto, conocidos como internet, para los fines de presentación de las campañas y proyectos y los fines promocionales e informativos que **AL EMPLEADOR Y/O LA EMPRESA USUARIA** o un tercero autorizado por éste, estime convenientes.`, 7.5, 4);
      printFormattedJustified(`**3.** **VALOR** - **EL TRABAJADOR** manifiesta expresamente que esta autorización la otorga con carácter gratuito, por cuanto la obtención de su imagen para los fines antes previstos se efectúa en ejercicio del Contrato de Trabajo, por lo que expresamente entiende que no recibirá ningún tipo de compensación, bonificación o pago de ninguna naturaleza, ni para la realización de las obras audiovisuales en que estas se utilicen. Así mismo, **EL TRABAJADOR** reconoce que no existe ninguna expectativa sobre los eventuales efectos económicos de la divulgación o sobre el tipo de documento audiovisual que pueda realizar **AL EMPLEADOR Y/O LA EMPRESA USUARIA** o un tercero autorizado por éste para la realización del Proyecto.`, 7.5, 4);
      printFormattedJustified(`**4.** **VIGENCIA DE LA AUTORIZACIÓN** - La vigencia de la autorización de uso de imagen corresponde al máximo término establecido en la legislación vigente en Colombia en materia derechos de autor, con autorización para el territorio del mundo, durante el cual **EL EMPLEADOR Y/O LA EMPRESA USUARIA** es titular de los derechos sobre los videos resultado del Proyecto, quien podrá cederlos a un tercero.`, 7.5, 4);
      printFormattedJustified(`**5.** **PERFECCIONAMIENTO** - El presente convenio se rige por las normas de la República de Colombia y se perfecciona desde la firma del mismo.`, 7.5, 4);

      printFormattedJustified(`Las Partes suscriben el presente documento en dos (2) originales del mismo tenor y valor, el día      **${fechaFirmaTexto}**.`, 7.5);

      // Agregar sección de firmas, subiendo un poco más para que quepa en la misma plana
      currentY += 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Por EL EMPLEADOR', marginLeft, currentY);
      doc.text('Por EL TRABAJADOR', marginLeft + 90, currentY);

      const yLineaFirma = currentY + 22; // Reducido el salto de la firma

      // Inserción de firma del Empleador (MAYRA HUMANI LOPEZ), ahora apuntando a FirmaMayra.png
      const firmaAdmin = await this.fetchAsArrayBufferOrNull('firma/FirmaMayra.png');
      if (firmaAdmin) {
        try {
          const kind = (new Uint8Array(firmaAdmin)[0] === 0xFF) ? 'JPEG' : 'PNG';
          // Se redujo la Y y se amplió el Width para que se vea mas estirada como la firma de verdad
          doc.addImage(new Uint8Array(firmaAdmin), kind, marginLeft + 5, currentY + 1, 35, 20);
        } catch (e) { console.error('Error insertando firma admin Manejo Imagen', e); }
      }

      // Inserción de firma del Trabajador
      const firmaCand = await this.fetchAsArrayBufferOrNull(cand?.biometria?.firma?.file_url ?? this.firma);
      if (firmaCand) {
        try {
          const kind = (new Uint8Array(firmaCand)[0] === 0xFF) ? 'JPEG' : 'PNG';
          doc.addImage(new Uint8Array(firmaCand), kind, marginLeft + 95, currentY + 1, 35, 20);
        } catch (e) { console.error('Error insertando firma candidato Manejo Imagen', e); }
      }

      // Dibujar lineas de firma principales (Acortadas un poco para encajar en margins)
      doc.setLineWidth(0.3);
      const mWidth = anchoTabla / 2 - 10;
      doc.line(marginLeft, yLineaFirma, marginLeft + mWidth, yLineaFirma);
      doc.line(marginLeft + 90, yLineaFirma, marginLeft + 90 + mWidth, yLineaFirma);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('MAYRA HUMANÍ LÓPEZ', marginLeft, yLineaFirma + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Cedula de extranjería 332.318', marginLeft, yLineaFirma + 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(nombreTrabajador, marginLeft + 90, yLineaFirma + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`C.C                                            ${numIdentificacion}`, marginLeft + 90, yLineaFirma + 8);

      // Inserción de huella si la hay
      const huella = await this.fetchAsArrayBufferOrNull(cand?.biometria?.huella_dactilar?.file_url);
      if (huella) {
        try {
          const kind = (new Uint8Array(huella)[0] === 0xFF) ? 'JPEG' : 'PNG';
          doc.addImage(new Uint8Array(huella), kind, marginLeft + 90 + mWidth + 2, yLineaFirma - 20, 16, 22);
        } catch (e) { console.error('Error insertando huella en Manejo Imagen', e); }
      }

      // ---------------------------------------------------------
      // --- PÁGINA 2: Autorización de uso de Derechos de Imagen ---
      // ---------------------------------------------------------
      doc.addPage();
      currentY = 10;
      doc.setPage(2);

      // Tabla Encabezado Página 2
      autoTable(doc, {
        startY: currentY,
        margin: { left: marginLeft },
        tableWidth: anchoTabla,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 7, halign: 'center', valign: 'middle', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, cellPadding: 0.5 },
        body: [
          [
            { content: '', rowSpan: 3, styles: { cellWidth: 28 } },
            { content: 'PROCESO DE CONTRATACIÓN', colSpan: 3 },
            { content: 'Página: 1 de 1', rowSpan: 3, styles: { cellWidth: 22 } }
          ],
          [
            { content: 'AUTORIZACIÓN DE USO DE DERECHOS DE IMAGEN', colSpan: 3, styles: { fontStyle: 'bold' } }
          ],
          [
            { content: 'Código: AL CO-RE-13' },
            { content: 'Versión: 01' },
            { content: 'Fecha Emisión: Agosto 26-25' }
          ]
        ],
        didDrawCell: (data) => {
          if (data.row.index === 0 && data.column.index === 0 && logoPath) {
            try {
              const dimHeight = data.cell.height - 1;
              const dimWidth = 24;
              const posX = data.cell.x + (data.cell.width - dimWidth) / 2;
              const posY = data.cell.y + 0.5;
              doc.addImage(logoPath, 'PNG', posX, posY, dimWidth, dimHeight);
            } catch (e) { }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // Titulo Centrado
      centerText('Autorización de uso de Derechos de Imagen sobre fotografías y producciones audiovisuales (videos) y de propiedad intelectual otorgado', 10);

      currentY += 4;

      // Párrafos Justificados Pág 2
      const p2_1 = `Yo, ${nombreTrabajador} , con documento de identidad No. ${numIdentificacion} de ${domicilioTrabajador} , mediante el presente formato autorizo a la empresa Apoyo Laboral T.S. S.A.S., en adelante la Empresa Temporal y la empresa ${empresaUsuaria} S.A.S. en adelante Empresa Usuaria , para que hagan el uso y tratamiento de mis derechos de imagen para incluirlos sobre fotografías y producciones audiovisuales (videos); así como de los Derechos de Autor; los Derechos Conexos y en general todos aquellos derechos de propiedad intelectual que tengan que ver con el derecho de imagen. Todo esto con sujeción a la Ley 1581 de 2012 y por las normas legales aplicables, para las siguientes finalidades:`;
      printFormattedJustified(p2_1, 9);

      const p2_2 = `Este(os) video(os)/foto(s) podrá(n) ser utilizado(s) con fines informativos en diferentes escenarios y plataformas de comunicación internas y externas de la Empresa.`;
      printFormattedJustified(p2_2, 9);

      const p2_3 = `Este(os) video(os)/foto(s) es(son) sin ánimo de lucro y en ningún momento será utilizado para objetivos distintos a los requerimientos empresariales. La Empresa queda exenta de cualquier responsabilidad que se pueda derivar de la presente actividad con la firma de la autorización.`;
      printFormattedJustified(p2_3, 9);

      const p2_4 = `La presente autorización no tiene ámbito geográfico determinado, por lo que las imágenes en las que aparezca podrán ser utilizadas en el territorio del mundo, así mismo, tampoco tiene ningún límite de tiempo para su concesión, ni para explotación de las imágenes, o parte de estas, por lo que mi autorización se considera concedida por un plazo de tiempo ilimitado.`;
      printFormattedJustified(p2_4, 9);

      const p2_5 = `Declaro que soy responsable de la veracidad de los datos suministrados y que he sido informado que EMPRESA TEMPORAL Y LA EMPRESA USUARIA son responsable de los datos personales por mi suministrados y entiendo que los canales de atención al titular a mi disposición son: EMPRESA TEMPORAL Correo electrónico: protecciondedatos@tsservicios.co, Telefono: 6017444002 y EMPRESA USUARIA Correo Electrónico: datospersonales@eliteflower.com y Teléfono: 6018910444.`;
      printFormattedJustified(p2_5, 9);

      currentY += 4;
      const p2_6 = `Para constancia de lo anterior se firma y otorga esta autorización de manera voluntaria en la ciudad de ${domicilioTrabajador.toUpperCase()} el día     **${fechaFirmaTexto}**`;
      printFormattedJustified(p2_6, 9);

      // Firma del Trabajador (Pág 2 - Abajo a la izquierda)
      currentY = pageHeight - 50;

      const firmaCand2 = await this.fetchAsArrayBufferOrNull(cand?.biometria?.firma?.file_url ?? this.firma);
      if (firmaCand2) {
        try {
          const kind = (new Uint8Array(firmaCand2)[0] === 0xFF) ? 'JPEG' : 'PNG';
          doc.addImage(new Uint8Array(firmaCand2), kind, marginLeft + 5, currentY + 1, 35, 20);
        } catch (e) { console.error('Error insertando firma candidato Manejo Imagen Pag2', e); }
      }

      const yLineaFirma2 = currentY + 22;
      doc.setLineWidth(0.3);
      doc.line(marginLeft, yLineaFirma2, marginLeft + 75, yLineaFirma2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`Nombres: ${nombreTrabajador}`, marginLeft, yLineaFirma2 + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`C.C ${numIdentificacion}`, marginLeft, yLineaFirma2 + 8);


      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], 'MANEJO_IMAGEN.pdf', { type: 'application/pdf' });

      this.uploadedFiles['MANEJO_IMAGEN'] = { file, fileName: 'MANEJO_IMAGEN.pdf' };
      this.verPDF({ titulo: 'MANEJO_IMAGEN' });

    } catch (error) {
      console.error('Error generando MANEJO_IMAGEN:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al generar el PDF de Manejo de Imagen' });
    }
  }

  async generarFichaSocial() {
    try {
      const pdfBytes = await this.fetchAsArrayBufferOrNull('Docs/Ficha social.pdf');
      if (!pdfBytes) {
        Swal.fire('Error', 'No se encontró el formato Ficha social.pdf', 'error');
        return;
      }
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
      const cand = this.candidato;
      const db = cand?.datos_basicos || {};

      const setText = (campo: string, valor: any) => {
        try {
          const field = form.getTextField(campo);
          if (field && valor) field.setText(String(valor));
        } catch (e) {
          // Ignorar silenciosamente si el campo no existe.
        }
      };

      const setConditionalText = (campo: string, valor: any, condicion: boolean) => {
        if (condicion) setText(campo, valor);
      };

      const normalizeDate = (d: any) => d ? new Date(d).toISOString().split('T')[0] : '';
      const normalizeText = (text: any) => text ? String(text).toUpperCase().trim() : '';

      // ======== 1. DATOS BÁSICOS ========
      // Split names
      const nombresArr = normalizeText(db.nombres).split(' ');
      const apellidosArr = normalizeText(db.apellidos).split(' ');
      setText('NombresRow1', db.nombres);
      setText('1er ApellidoRow1', apellidosArr[0] || '');
      setText('2do ApellidoRow1', apellidosArr.slice(1).join(' ') || '');

      const tipoDoc = normalizeText(db.tipo_de_identificacion);
      setText('Row1', tipoDoc); // Tipo DOC (asumiendo que Row1 general es Tipo Doc dada la convención de otras fichas)
      setText('DOCUMENTO No', db.numero_de_documento);

      // ======== 2. DATOS DE CONTACTO ========
      setText('TeléfonoRow1', db.telefono ?? '');
      setText('Correo ElectrónicoRow1', db.correo_electronico ?? '');
      setText('Dirección de DomicilioRow1', db.direccion_de_residencia ?? '');
      setText('BarrioRow1', db.barrio ?? '');
      setText('Ciudad DomicilioRow1', cand?.municipio?.nombre ?? '');
      setText('DepartamentoRow1', cand?.departamento?.nombre ?? '');

      // ======== 3. ESTADO CIVIL Y TECNOLOGÍA ========
      setText('Estado CivilRow1', db.estado_civil ?? '');
      // Asumimos variables personalizadas si existen, o vacíos si no se preguntan
      setText('Teléfono InteligenteRow1', cand?.estudio_socioeconomico?.telefonoInteligente ?? 'SI');
      setText('Posee Plan de DatosRow1', cand?.estudio_socioeconomico?.planDatos ?? 'SI');

      // ======== 4. COMPOSICIÓN FAMILIAR ========
      // Checkboxes nativos de PDFText en Ficha Social (se cruzan con "X" en campos de texto según el mapper)
      const compFam = cand?.estudio_socioeconomico?.composicionFamiliar || [];
      const hasComp = (val: string) => compFam.includes(val) ? 'X' : '';
      setText('ConyugueCompañeroaRow1', hasComp('CONYUGE') || hasComp('COMPAÑERO(A)'));
      setText('Hijo aRow1', hasComp('HIJO(A)'));
      setText('MadreRow1', hasComp('MADRE'));
      setText('PadreRow1', hasComp('PADRE'));
      setText('HermanoaRow1', hasComp('HERMANO(A)'));
      setText('TíoRow1', hasComp('TIO(A)'));
      setText('SobrinoRow1', hasComp('SOBRINO(A)'));
      setText('CuñadoaRow1', hasComp('CUÑADO(A)'));
      setText('SuegroaRow1', hasComp('SUEGRO(A)'));
      setText('OtroRow1', hasComp('OTRO'));
      setText('CúalRow1', cand?.estudio_socioeconomico?.composicionFamiliarCual ?? '');
      setText('Familia con un solo ingresoRow1', cand?.estudio_socioeconomico?.unicoIngreso ? 'SI' : 'NO');

      // ======== 5. VIVIENDA ========
      const tipoVivienda = normalizeText(cand?.estudio_socioeconomico?.tipoVivienda);
      setText('CasaRow1', tipoVivienda === 'CASA' ? 'X' : '');
      setText('ApartamentoRow1', tipoVivienda === 'APARTAMENTO' ? 'X' : '');
      setText('FincaRow1', tipoVivienda === 'FINCA' ? 'X' : '');
      setText('HabitaciónRow1', tipoVivienda === 'HABITACION' || tipoVivienda === 'HABITACIÓN' ? 'X' : '');

      setText('No HabitacionesRow1', cand?.estudio_socioeconomico?.numHabitaciones ?? '');
      setText('No Personas por habitaciónRow1', cand?.estudio_socioeconomico?.personasPorHabitacion ?? '');

      const tenencia = normalizeText(cand?.estudio_socioeconomico?.tenenciaVivienda);
      setText('Propia Totalmente PagaRow1', tenencia.includes('PAGA') ? 'X' : '');
      setText('Propia la están pagandoRow1', tenencia.includes('PAGANDO') ? 'X' : '');
      setText('ArriendoRow1', tenencia === 'ARRIENDO' ? 'X' : '');
      setText('FamiliarRow1', tenencia === 'FAMILIAR' ? 'X' : '');

      const estadoVivienda = normalizeText(cand?.estudio_socioeconomico?.estadoVivienda);
      setText('Obra NegraRow1', estadoVivienda === 'OBRA NEGRA' ? 'X' : '');
      setText('Obra GrisRow1', estadoVivienda === 'OBRA GRIS' ? 'X' : '');
      setText('TerminadaRow1', estadoVivienda === 'TERMINADA' ? 'X' : '');

      const servs = cand?.estudio_socioeconomico?.serviciosPublicos || [];
      const hasServ = (val: string) => servs.includes(val) ? 'X' : '';
      setText('EnergíaRow1', hasServ('ENERGIA') || hasServ('ENERGÍA'));
      setText('AcueductoRow1', hasServ('ACUEDUCTO'));
      setText('AlcantarilladoRow1', hasServ('ALCANTARILLADO'));
      setText('Recolección BasurasRow1', hasServ('BASURAS') || hasServ('RECOLECCION BASURAS'));
      setText('Gas NaturalRow1', hasServ('GAS') || hasServ('GAS NATURAL'));
      setText('Teléfono FijoRow1', hasServ('TELEFONO') || hasServ('TELÉFONO FIJO'));
      setText('InternetRow1', hasServ('INTERNET'));

      const equip = cand?.estudio_socioeconomico?.equipamiento || [];
      const hasEquip = (val: string) => equip.includes(val) ? 'X' : '';
      setText('BañoEquipamiento de Casa', hasEquip('BAÑO'));
      setText('CocinaEquipamiento de Casa', hasEquip('COCINA'));
      setText('LavaderoEquipamiento de Casa', hasEquip('LAVADERO'));
      setText('PatioEquipamiento de Casa', hasEquip('PATIO'));

      // ======== 6. EDUCACIÓN ========
      if (cand?.educacion && cand?.educacion.length > 0) {
        // Tomamos la educación más reciente / superior
        const lastEd = cand.educacion[cand.educacion.length - 1];
        setText('Grado Escolaridad', normalizeText(lastEd?.nivel));
        setText('Institución', normalizeText(lastEd?.institucion));
        setText('Titulo Obtenido o Último Año Cursado', normalizeText(lastEd?.titulo));
        setText('Año Finalización', normalizeDate(lastEd?.fecha_finalizacion).substring(0, 4));
      }

      // ======== 7. CONTACTO DE EMERGENCIA ========
      if (cand?.referencias && cand?.referencias.length > 0) {
        // Priorizamos familiar como emergencia si no hay otro flag
        const refEm = cand.referencias.find((r: any) => r.tipo === 'Familiar') || cand.referencias[0];
        setText('Apellidos y NombresRow1', normalizeText(`${refEm?.nombres || ''} ${refEm?.apellidos || ''}`));
        setText('ParentescoRow1', normalizeText(refEm?.parentesco));
        setText('TeléfonoRow1_2', refEm?.telefono_1);
        setText('DirecciónRow1', refEm?.direccion);
        setText('Barrio MunicipioRow1', refEm?.barrio); // municipio no siempre está en ref nativa
      }

      // ======== 8. CÓNYUGE ========
      const conyuge = cand?.padres_conyuge?.find((p: any) => p.es_padre === 'Conyuge');
      if (conyuge) {
        setText('NombresRow1_2', normalizeText(conyuge.nombres));
        setText('ApellidosRow1', normalizeText(conyuge.apellidos));
        setText('No Doc IdentidadRow1', conyuge.identificacion);
        setText('Vive SNRow1', conyuge.vive === 'Si' ? 'SI' : 'NO');
        setText('DirecciónRow1_2', normalizeText(conyuge.direccion));
        setText('TeléfonoRow1_3', conyuge.telefono_1);
        setText('Barrio MunicipioRow1_2', normalizeText(conyuge.barrio));
        setText('OcupaciónRow1', normalizeText(conyuge.ocupacion));
        setText('Teléfono LaboralRow1', conyuge.telefono_2); // Asumiendo tel2 como laboral
        // Dirección Laboral no provista nativamente, omitida o vacía
      }

      // ======== 9. HIJOS ========
      const hijos = Array.isArray(cand?.hijos) ? cand.hijos : [];
      // Row1_2, Row2, Row3, Row4, Row5, Row6
      const suffixHijos = ['Row1_2', 'Row2', 'Row3', 'Row4', 'Row5', 'Row6'];
      hijos.slice(0, 6).forEach((h: any, i: number) => {
        const rowSuffix = suffixHijos[i];
        setText(`Apellidos y Nombres${rowSuffix}`, normalizeText(`${h.apellidos || ''} ${h.nombres || ''}`));
        setText(`Fecha de Nacimiento${rowSuffix.replace('_2', '')}`, normalizeDate(h.fecha_nacimiento)); // el map reporta "NacimientoRow1" (no _2)
        setText(`No Documento de Identidad${rowSuffix.replace('_2', '')}`, h.identificacion);
        setText(`Género${rowSuffix.replace('_2', '')}`, normalizeText(h.genero).substring(0, 1)); // M o F
        setText(`Vive con el Trabajador SN${rowSuffix.replace('_2', '')}`, h.vive_con_usted === 'Si' ? 'SI' : 'NO');
        setText(`Estudia en la Fundación SN${rowSuffix.replace('_2', '')}`, 'NO'); // Default
        setText(`Ocupación EstudiaTrabaja${rowSuffix.replace('_2', '')}`, normalizeText(h.ocupacion));
      });

      // ======== 10. PADRES (Sección Extendida en el PDF) ========
      // Según el JSON, la sección extendida de hijos comparte filas Row1..Row6 en Nivel Educativo / Padre
      const padres = cand?.padres_conyuge?.filter((p: any) => p.es_padre === 'Padre' || p.es_padre === 'Madre') || [];
      padres.slice(0, 2).forEach((p: any, i: number) => {
        const rIndex = i + 1; // Row1, Row2
        setText(`Nivel EducativoRow${rIndex}`, normalizeText(p.ocupacion)); // Adaptado
        setText(`Es Empleado de la Compañía SNRow${rIndex}`, 'NO');
        setText(`Nombre Otro PadreRow${rIndex}`, normalizeText(`${p.nombres} ${p.apellidos}`));
        setText(`Documento Identidad Otro PadreRow${rIndex}`, p.identificacion);
      });

      // ======== 11. EXPECTATIVAS DE VIDA ========
      const exp = cand?.estudio_socioeconomico?.expectativas || [];
      const hasExp = (val: string) => exp.includes(val) ? 'X' : '';
      setText('Educación PropiaRow1', hasExp('EDUCACION PROPIA'));
      setText('Educación de los hijosRow1', hasExp('EDUCACION HIJOS'));
      setText('Compra de ViviendaRow1', hasExp('COMPRA VIVIENDA'));
      setText('Compra de AutomóvilRow1', hasExp('COMPRA AUTOMOVIL') || hasExp('VEHICULO'));
      setText('ViajarRow1', hasExp('VIAJAR'));
      setText('Otro CuálRow1', cand?.estudio_socioeconomico?.expectativasOtro ?? '');

      // ======== 12. METADATOS Y FIRMAS ========
      const now = new Date();
      const txtFecha = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      setText('fechaactual', txtFecha);
      setText('nombre_empresa_usuaria', normalizeText(this.vacante?.empresaUsuariaSolicita || this.empresa || 'LA EMPRESA'));

      // FIRMAS Y SELLOS (Imágenes)
      try {
        const paginas = pdfDoc.getPages();
        const ultimaPag = paginas[paginas.length - 1]; // Firmas suelen ir al final

        // Firma Candidato -> image11_af_image se reemplaza por inyección manual donde iba la caja "firma_af_image"
        const firmaCandBytes = await this.fetchAsArrayBufferOrNull(this.firma);
        if (firmaCandBytes) {
          const fieldFirma = form.getTextField('firma_af_image');
          if (fieldFirma) {
            const widget = fieldFirma.acroField.getWidgets()[0];
            const rect = widget.getRectangle();
            const bytesArray = new Uint8Array(firmaCandBytes) as any;
            const isJpg = bytesArray[0] === 0xFF;
            const img = isJpg ? await pdfDoc.embedJpg(bytesArray) : await pdfDoc.embedPng(bytesArray);
            // Asignar en la coordenada PDF original
            ultimaPag.drawImage(img, {
              x: rect.x, y: rect.y, width: rect.width, height: rect.height
            });
          }
        }

        // Firma Administrativa
        const firmaAdminBytes = await this.fetchAsArrayBufferOrNull(this.firmaPersonalAdministrativo);
        if (firmaAdminBytes) {
          const fieldAdcFirma = form.getTextField('firma_administrativa');
          if (fieldAdcFirma) {
            const widget2 = fieldAdcFirma.acroField.getWidgets()[0];
            const rect2 = widget2.getRectangle();
            const bytesArray2 = new Uint8Array(firmaAdminBytes) as any;
            const isJpg = bytesArray2[0] === 0xFF;
            const img2 = isJpg ? await pdfDoc.embedJpg(bytesArray2) : await pdfDoc.embedPng(bytesArray2);
            ultimaPag.drawImage(img2, {
              x: rect2.x, y: rect2.y, width: rect2.width, height: rect2.height
            });
          }
        }

      } catch (e) {
        console.error('Error inyectando firmas biometría Ficha Social', e);
      }

      form.flatten(); // Evitar que siga siendo editable

      const resultBytes = await pdfDoc.save();
      const file = new File([resultBytes as any], 'FICHA_SOCIAL.pdf', { type: 'application/pdf' });
      this.uploadedFiles['FICHA_SOCIAL'] = { file, fileName: 'FICHA_SOCIAL.pdf' };
      this.verPDF({ titulo: 'FICHA_SOCIAL' });

    } catch (error) {
      console.error('Error generando FICHA_SOCIAL:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al generar la Ficha Social.' });
    }
  }

  generarAutorizacionDatos() {
    const EMP_APOYO = 'APOYO LABORAL TS S.A.S';
    const EMP_TA = 'TU ALIANZA SAS';

    // Normaliza nombre de empresa
    let empresaSeleccionada = (this.empresa || '').trim();
    if (empresaSeleccionada === 'APOYO LABORAL SAS' || empresaSeleccionada === 'APOYO LABORAL TS SAS') {
      empresaSeleccionada = EMP_APOYO;
    }

    // Logo + NIT
    let logoPath = '';
    let nit = '';
    if (empresaSeleccionada === EMP_APOYO) {
      logoPath = 'logos/Logo_AL.png';
      nit = 'NIT: 900.814.587-1';
    } else if (empresaSeleccionada === EMP_TA) {
      logoPath = 'logos/Logo_TA.png';
      nit = 'NIT: 900.864.596-1';
    } else {
      return;
    }

    // Documento
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    doc.setProperties({
      title: `${empresaSeleccionada}_Autorizacion_Datos.pdf`,
      author: empresaSeleccionada,
      creator: empresaSeleccionada,
    });

    // Encabezado (logo + NIT)
    const imgWidth = 27, imgHeight = 10, marginTop = 5, marginLeft = 7;
    doc.addImage(logoPath, 'PNG', marginLeft, marginTop, imgWidth, imgHeight);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(nit, marginLeft, marginTop + imgHeight + 3);
    doc.setFont('helvetica', 'normal');

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(
      'AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES DE CANDIDATOS',
      pageWidth / 2,
      30,
      { align: 'center' }
    );

    // Márgenes y área de texto (reservamos 30 mm para firmas)
    const margenIzquierdo = 9;
    const margenDerecho = 9;
    const margenSuperior = 39; // arranca texto debajo del título
    const margenInferior = 30; // espacio fijo para firmas
    const anchoTexto = pageWidth - margenIzquierdo - margenDerecho;

    // Texto por empresa
    let parrafos: string[] = [];
    if (empresaSeleccionada === EMP_APOYO) {
      parrafos = [
        `APOYO LABORAL TS S.A.S, tratará sus datos personales, consistentes en, pero sin limitarse a, su nombre, información de contacto, fecha y lugar de nacimiento, número de identificación, estado civil, dependientes, fotografía, antecedentes de educación y empleo, referencias personales y laborales, información sobre visas y antecedentes judiciales ("Información Personal") con el fin de (1) evaluarlo como potencial empleado de APOYO LABORAL TS S.A.S; (2) evaluar y corroborar la información contenida en su hoja de vida e información sobre la experiencia profesional y trayectoria académica (3) almacenar y clasificar su Información Personal para facilitar su acceso;`,
        `(4) proporcionar información a las autoridades competentes cuando medie requerimiento de dichas autoridades en ejercicio de sus funciones y facultades legales, en cumplimiento de un deber legal o para proteger los derechos de APOYO LABORAL TS S.A.S; (5) proporcionar información a auditores internos o externos en el marco de las finalidades aquí descritas; (6) dar a conocer la realización de eventos de interés o de nuevas convocatorias para otros puestos de trabajo; (7) verificar la información aportada y adelantar todas las actuaciones necesarias, incluida la revisión de la información aportada por usted en las distintas listas de riesgos para prevenir los riesgos para APOYO LABORAL TS S.A.S a lavado de activos, financiación del terrorismo y asuntos afines, dentro del marco de implementación de su SAGRILAFT; y todas las demás actividades que sean compatibles con estas finalidades.`,
        `Para poder cumplir con las finalidades anteriormente expuestas, APOYO LABORAL TS S.A.S requiere tratar los siguientes datos personales suyos que son considerados como sensibles: género, datos biométricos y datos relacionados con su salud (“Información Personal Sensible”). Usted tiene derecho a autorizar o no la recolección y tratamiento de su Información Personal Sensible por parte de APOYO LABORAL TS S.A.S y sus encargados. No obstante, si usted no autoriza a APOYO LABORAL TS S.A.S a recolectar y hacer el tratamiento de esta Información Personal Sensible, APOYO LABORAL TS S.A.S no podrá cumplir con las finalidades del tratamiento descritas anteriormente.`,
        `Asimismo, usted entiende y autoriza a APOYO LABORAL TS S.A.S para que verifique, solicite y/o consulte su Información Personal en listas de riesgo, incluidas restrictivas y no restrictivas, así como vinculantes y no vinculantes para Colombia, a través de cualquier motor de búsqueda tales como, pero sin limitarse a, las plataformas de los entes Administradores del Sistema de Seguridad Social Integral, las Autoridades Judiciales y de Policía Nacional, la Procuraduría General de la República, la Contraloría General de la Nación o cualquier otra fuente de información legalmente constituida y/o a través de otros motores de búsqueda diseñados con miras a verificar su situación laboral actual, sus aptitudes académicas y demás información pertinente para los fines antes señalados. APOYO LABORAL TS S.A.S realizará estas gestiones directamente, o a través de sus filiales o aliados estratégicos con quienes acuerde realizar estas actividades. APOYO LABORAL TS S.A.S podrá adelantar el proceso de consulta, a partir de su Información Personal, a través de la base de datos de la Policía Nacional, Contraloría General de la República, Contraloría General de la Nación, OFAC Sanctions List Search y otras similares.`,
        `Dentro de las obligaciones que establece la ley, APOYO LABORAL TS S.A.S debe establecer si sus candidatos o sus familiares califican como Persona Expuesta Políticamente ("PEP"). Por lo anterior, en caso de que usted o algún familiar suyo ostente la calidad de PEP, o llegue a adquirirla, usted deberá comunicar tal situación a APOYO LABORAL TS S.A.S, indicando los datos de identificación de dicho familiar, el parentesco que tiene con usted, y el cargo que desempeña o desempeñó dentro de los dos (2) años anteriores. De igual forma, usted certifica que entiende a qué se refiere la palabra PEP y certifica que ni usted ni sus familiares califican como PEP y que, en caso de calificar en dicha categoría, declara haber informado tal situación a APOYO LABORAL TS S.A.S. En los casos en los que APOYO LABORAL TS S.A.S deba llevar a cabo el tratamiento de datos personales de terceros proporcionados por usted, ya sea por ser referencia suya o PEP asociado a usted, entre otros motivos, usted certifica que tal información fue suministrada con la debida autorización de esas personas para que esta fuera entregada a APOYO LABORAL TS S.A.S y tratada de conformidad su Política de Tratamiento de Datos Personales.`,
        `Asimismo, usted entiende que APOYO LABORAL TS S.A.S podrá transmitir su Información Personal e Información Personal Sensible, a (i) otras oficinas del mismo grupo corporativo de APOYO LABORAL TS S.A.S, incluso radicadas en diferentes jurisdicciones que no comporten niveles de protección de datos equivalentes a los de la legislación colombiana y a (ii) terceros a los que APOYO LABORAL TS S.A.S les encargue el tratamiento de su Información Personal e Información Personal Sensible.`,
        `De igual forma, como titular de su Información Personal e Información Personal Sensible, usted tiene derecho, entre otras, a conocer, actualizar, rectificar y a solicitar la supresión de la misma, así como a solicitar prueba de esta autorización, en cualquier tiempo, y mediante comunicación escrita dirigida al correo electrónico: protecciondedatos@tsservicios.co de acuerdo al procedimiento previsto en los artículos 14 y 15 de la Ley 1581 de 2012.`,
        `En virtud de lo anterior, con su firma, APOYO LABORAL TS S.A.S podrá recolectar, almacenar, usar y en general realizar el tratamiento de su Información Personal e Información Personal Sensible, para las finalidades anteriormente expuestas, en desarrollo de la Política de Tratamiento de Datos Personales de la Firma, la cual puede ser solicitada a través de: correo electrónico protecciondedatos@tsservicios.co.`
      ];
    } else {
      // Tu Alianza (sin cláusula PEP)
      parrafos = [
        `${empresaSeleccionada}, tratará sus datos personales, consistentes en, pero sin limitarse a, su nombre, información de contacto, fecha y lugar de nacimiento, número de identificación, estado civil, dependientes, fotografía, antecedentes de educación y empleo, referencias personales y laborales, información sobre visas y antecedentes judiciales ("Información Personal") con el fin de (1) evaluarlo como potencial empleado de ${empresaSeleccionada}; (2) evaluar y corroborar la información contenida en su hoja de vida e información sobre la experiencia profesional y trayectoria académica (3) almacenar y clasificar su Información Personal para facilitar su acceso;`,
        `(4) proporcionar información a las autoridades competentes cuando medie requerimiento de dichas autoridades en ejercicio de sus funciones y facultades legales, en cumplimiento de un deber legal o para proteger los derechos de ${empresaSeleccionada}; (5) proporcionar información a auditores internos o externos en el marco de las finalidades aquí descritas; (6) dar a conocer la realización de eventos de interés o de nuevas convocatorias para otros puestos de trabajo; (7) verificar la información aportada y adelantar todas las actuaciones necesarias, incluida la revisión de la información aportada por usted en las distintas listas de riesgos para prevenir los riesgos para ${empresaSeleccionada} a lavado de activos, financiación del terrorismo y asuntos afines, dentro del marco de implementación de su SAGRILAFT; y todas las demás actividades que sean compatibles con estas finalidades.`,
        `Para poder cumplir con las finalidades anteriormente expuestas, ${empresaSeleccionada} requiere tratar los siguientes datos personales suyos que son considerados como sensibles: género, datos biométricos y datos relacionados con su salud (“Información Personal Sensible”). Usted tiene derecho a autorizar o no la recolección y tratamiento de su Información Personal Sensible por parte de ${empresaSeleccionada} y sus encargados. No obstante, si usted no autoriza a ${empresaSeleccionada} a recolectar y hacer el tratamiento de esta Información Personal Sensible, ${empresaSeleccionada} no podrá cumplir con las finalidades del tratamiento descritas anteriormente.`,
        `Asimismo, usted entiende y autoriza a ${empresaSeleccionada} para que verifique, solicite y/o consulte su Información Personal en listas de riesgo, incluidas restrictivas y no restrictivas, así como vinculantes y no vinculantes para Colombia, a través de cualquier motor de búsqueda tales como, pero sin limitarse a, las plataformas de los entes Administradores del Sistema de Seguridad Social Integral, las Autoridades Judiciales y de Policía Nacional, la Procuraduría General de la República, la Contraloría General de la Nación o cualquier otra fuente de información legalmente constituida y/o a través de otros motores de búsqueda diseñados con miras a verificar su situación laboral actual, sus aptitudes académicas y demás información pertinente para los fines antes señalados. ${empresaSeleccionada} realizará estas gestiones directamente, o a través de sus filiales o aliados estratégicos con quienes acuerde realizar estas actividades. ${empresaSeleccionada} podrá adelantar el proceso de consulta, a partir de su Información Personal, a través de la base de datos de la Policía Nacional, Contraloría General de la República, Contraloría General de la Nación, OFAC Sanctions List Search y otras similares.`,
        `Asimismo, usted entiende que ${empresaSeleccionada} podrá transmitir su Información Personal e Información Personal Sensible, a (i) otras oficinas del mismo grupo corporativo de ${empresaSeleccionada}, incluso radicadas en diferentes jurisdicciones que no comporten niveles de protección de datos equivalentes a los de la legislación colombiana y a (ii) terceros a los que ${empresaSeleccionada} les encargue el tratamiento de su Información Personal e Información Personal Sensible.`,
        `De igual forma, como titular de su Información Personal e Información Personal Sensible, usted tiene derecho, entre otras, a conocer, actualizar, rectificar y a solicitar la supresión de la misma, así como a solicitar prueba de esta autorización, en cualquier tiempo, y mediante comunicación escrita dirigida al correo electrónico: protecciondedatos@tsservicios.co de acuerdo al procedimiento previsto en los artículos 14 y 15 de la Ley 1581 de 2012.`,
        `En virtud de lo anterior, con su firma, ${empresaSeleccionada} podrá recolectar, almacenar, usar y en general realizar el tratamiento de su Información Personal e Información Personal Sensible, para las finalidades anteriormente expuestas, en desarrollo de la Política de Tratamiento de Datos Personales de la Firma, la cual puede ser solicitada a través de: correo electrónico protecciondedatos@tsservicios.co.`
      ];
    }

    // ================== CONFIG RÁPIDA (tamaño e interlineado) ==================
    const FONT_SIZE_PT = 8.2;      // Tamaño de letra (prueba 8.0–8.8)
    const LEADING = 1.40;          // Interlineado: 1.00 (muy compacto) – 1.20 (más aire)
    const PARAGRAPH_GAP_MM = 1.5;  // Espacio entre párrafos en mm

    // Auto-ajuste opcional para forzar 1 hoja
    const ENABLE_AUTO_FIT = false; // true: reduce tamaño/interlineado si no cabe
    const MIN_FONT_PT = 6.8;
    const MIN_LEADING = 1.00;

    // ================== Helpers de composición ==================
    const MM_PER_PT = 0.352777778;
    const calcLineHeight = (fs: number, lf: number) => fs * MM_PER_PT * lf;

    // Negrita para MAYÚSCULAS, (1), (2), y nombre de empresa
    const esPalabraNegrita = (pal: string, empresa: string) =>
      pal === empresa || /^[A-ZÁÉÍÓÚÜÑ]+$/.test(pal) || /^\(\d+\)$/.test(pal);

    const renderizarLineaJustificada = (
      linea: string,
      empresa: string,
      y: number,
      anchoDisponible: number,
      ultima: boolean,
      margenX: number
    ) => {
      const palabras = linea.split(' ');
      let anchoPalabras = 0;
      const piezas = palabras.map(p => {
        const limpio = p.replace(/[.,]/g, '').trim();
        const bold = esPalabraNegrita(limpio, empresa);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        const w = doc.getTextWidth(p);
        anchoPalabras += w;
        return { p, bold, w };
      });

      const espacios = piezas.length - 1;
      const wEsp = doc.getTextWidth(' ');
      let x = margenX;

      if (ultima || espacios <= 0) {
        piezas.forEach((it, i) => {
          doc.setFont('helvetica', it.bold ? 'bold' : 'normal');
          doc.text(it.p, x, y);
          x += it.w + (i < espacios ? wEsp : 0);
        });
      } else {
        const extra = (anchoDisponible - anchoPalabras) / espacios;
        piezas.forEach((it, i) => {
          doc.setFont('helvetica', it.bold ? 'bold' : 'normal');
          doc.text(it.p, x, y);
          x += it.w + extra;
        });
      }
      doc.setFont('helvetica', 'normal');
    };

    const dividirYMedir = (fs: number, lf: number) => {
      doc.setFontSize(fs);
      let totalLineas = 0;
      parrafos.forEach(p => {
        const lines = doc.splitTextToSize(p.trim().replace(/\s+/g, ' '), anchoTexto);
        totalLineas += lines.length;
      });
      const extraParrafos = Math.max(parrafos.length - 1, 0);
      const totalAlto = totalLineas * calcLineHeight(fs, lf) + extraParrafos * PARAGRAPH_GAP_MM;
      return totalAlto;
    };

    // === Ajuste de tamaño/interlineado (solo si ENABLE_AUTO_FIT === true) ===
    let fontSize = FONT_SIZE_PT;
    let leading = LEADING;

    if (ENABLE_AUTO_FIT) {
      const altoDisponible = pageHeight - margenSuperior - margenInferior;
      let totalAlto = dividirYMedir(fontSize, leading);
      while (totalAlto > altoDisponible && (fontSize > MIN_FONT_PT || leading > MIN_LEADING)) {
        if (leading > MIN_LEADING) {
          leading = Math.max(MIN_LEADING, parseFloat((leading - 0.02).toFixed(2)));
        } else {
          fontSize = Math.max(MIN_FONT_PT, parseFloat((fontSize - 0.2).toFixed(1)));
        }
        totalAlto = dividirYMedir(fontSize, leading);
      }
    }

    // Render de párrafos
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    const lineHeight = calcLineHeight(fontSize, leading);
    let cursorY = margenSuperior;

    const renderizarParrafo = (texto: string) => {
      const lines: string[] = doc.splitTextToSize(texto.trim().replace(/\s+/g, ' '), anchoTexto);
      lines.forEach((ln, idx) => {
        const ultima = idx === lines.length - 1;
        renderizarLineaJustificada(ln, empresaSeleccionada, cursorY, anchoTexto, ultima, margenIzquierdo);
        cursorY += lineHeight;
      });
      cursorY += PARAGRAPH_GAP_MM; // gap entre párrafos
    };

    parrafos.forEach(renderizarParrafo);

    // ===== Bloque de firmas (fijo en la misma hoja, sin solapar) =====
    const yFirmaBase = pageHeight - 24; // línea de firma
    doc.line(10, yFirmaBase, 100, yFirmaBase);

    if (this.firma !== '') {
      const firmaConPrefijo = this.firma;
      doc.addImage(firmaConPrefijo, 'PNG', 10, yFirmaBase - 30, 80, 28);
    } else {
      //Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró la firma' });
      //return;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Firma de Autorización', 10, yFirmaBase + 3);
    doc.setFont('helvetica', 'normal');

    doc.text(`Número de Identificación: ${this.cedula}`, 10, yFirmaBase + 7);


    const fechaActual = new Date();
    const opcionesFormato: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const fechaFormateada = fechaActual.toLocaleDateString('es-ES', opcionesFormato);
    doc.text(`Fecha de Autorización: ${fechaFormateada}`, 10, yFirmaBase + 11);

    // Guardar y mostrar
    const pdfBlob = doc.output('blob');
    const fileName = `${empresaSeleccionada}_Autorizacion_Datos.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    this.uploadedFiles['Autorización de datos'] = { file: pdfFile, fileName };
    this.verPDF({ titulo: 'Autorización de datos' });
  }

  // Función para renderizar una línea justificada y subrayarla
  renderJustifiedLineEntregaDocs(doc: jsPDF, linea: string, x: number, y: number, maxWidth: number, isLastLine: boolean) {
    const palabras = linea.split(' ');
    const totalSpaces = palabras.length - 1;

    // Medir ancho total de las palabras
    let totalWordsWidth = 0;
    palabras.forEach((word) => {
      doc.setFont('helvetica', 'normal');
      const w = this.roundTo(doc.getTextWidth(word), 3);
      totalWordsWidth += w;
    });

    let spaceWidth = this.roundTo(doc.getTextWidth(' '), 3);
    let extraSpace = spaceWidth;

    // Ajustar espacios si no es la última línea y hay más de una palabra
    if (!isLastLine && totalSpaces > 0) {
      extraSpace = (maxWidth - totalWordsWidth) / totalSpaces;
    }

    let currentX = x;
    palabras.forEach((word, i) => {
      doc.setFont('helvetica', 'normal');
      doc.text(word, currentX, y);
      if (i < totalSpaces) {
        currentX += doc.getTextWidth(word) + extraSpace;
      } else {
        currentX += doc.getTextWidth(word);
      }
    });

    // Subrayar la línea completa desde el inicio al final del texto impreso
    doc.line(x, y + 1, currentX, y + 1);
  }

  // Formatea el texto, detectando palabras en mayúsculas
  formatText(texto: string): { text: string; bold: boolean }[] {
    const words = texto.split(/(\s+)/); // Divide en palabras y espacios
    return words.map(word => {
      if (word === word.toUpperCase() && word.match(/[A-Z]/)) {
        return { text: word, bold: true };
      }
      return { text: word, bold: false };
    });
  }

  // Función para formatear la fecha actual
  obtenerFechaActual() {
    const meses = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const hoy = new Date();
    const dia = hoy.getDate().toString().padStart(2, '0'); // Añadir 0 si es necesario
    const mes = meses[hoy.getMonth()]; // Obtener nombre del mes
    const anio = hoy.getFullYear().toString().slice(-2); // Últimos 2 dígitos del año

    return `${mes} ${dia}-${anio}`;
  }

  private roundTo(num: number, decimals: number) {
    return Math.round(num * (10 ** decimals)) / (10 ** decimals);
  }

  private isBoldWord(word: string) {
    return word === word.toUpperCase() && /[A-ZÁÉÍÓÚÜÑ]/.test(word);
  }

  renderJustifiedText(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    justifyLastLine: boolean = true
  ): number {
    const pageHeight =
      (doc as any)?.internal?.pageSize?.height ??
      (doc as any)?.internal?.pageSize?.getHeight?.() ??
      279;

    // ✅ Normaliza números para evitar NaN
    x = Number(x);
    y = Number(y);
    maxWidth = Number(maxWidth);
    lineHeight = Number(lineHeight);

    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 10;
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) maxWidth = 180;
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = 4;

    // ✅ Normaliza texto (evita undefined/null)
    text = String(text ?? '').replace(/\r/g, '').trim().replace(/\s+/g, ' ');
    if (!text) return y; // nada que pintar

    const words = text.split(' ');
    const boldWords = words.map(w => !!this.isBoldWord(w));

    // Medición consistente de espacio
    doc.setFont('helvetica', 'normal');
    const spaceWidthNormal = doc.getTextWidth(' '); // sin roundTo para evitar NaN

    // Medir cada palabra con su estilo real (y blindar NaN)
    const wordWidths: number[] = [];
    for (let i = 0; i < words.length; i++) {
      doc.setFont('helvetica', boldWords[i] ? 'bold' : 'normal');
      const w = doc.getTextWidth(words[i]);
      wordWidths.push(Number.isFinite(w) ? w : 0);
    }

    let currentLine: { word: string; width: number; bold: boolean }[] = [];
    let currentLineWidth = 0;

    for (let i = 0; i < words.length; i++) {
      const word = String(words[i] ?? '');
      const width = Number(wordWidths[i]);
      const bold = boldWords[i];

      const safeWidth = Number.isFinite(width) ? width : 0;
      const additionalSpace = currentLine.length > 0 ? spaceWidthNormal : 0;
      const testWidth = currentLineWidth + safeWidth + additionalSpace;

      if (testWidth > maxWidth && currentLine.length > 0) {
        // Línea completa: justificar
        this.renderJustifiedLine(doc, currentLine, x, y, maxWidth, false);
        y += lineHeight;

        if (y > pageHeight - 10) {
          doc.addPage();
          y = 10;
        }

        currentLine = [{ word, width: safeWidth, bold }];
        currentLineWidth = safeWidth;
      } else {
        currentLine.push({ word, width: safeWidth, bold });
        currentLineWidth = testWidth;
      }
    }

    // Última línea (justificar si se pide)
    if (currentLine.length > 0) {
      const canJustifyLast = justifyLastLine && currentLine.length > 1;
      this.renderJustifiedLine(doc, currentLine, x, y, maxWidth, !canJustifyLast);
    }

    return Number.isFinite(y) ? y : 10;
  }

  private renderJustifiedLine(
    doc: jsPDF,
    lineData: { word: string; width: number; bold: boolean }[],
    x: number,
    y: number,
    maxWidth: number,
    isLastLine = false
  ) {
    // ✅ Blindaje números
    x = Number(x);
    y = Number(y);
    maxWidth = Number(maxWidth);

    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 10;
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) maxWidth = 180;

    // ✅ Espacio normal
    doc.setFont('helvetica', 'normal');
    const normalSpaceWidth = doc.getTextWidth(' ');

    // ✅ Normaliza widths para que nunca sean NaN
    const safeLine = lineData.map(it => ({
      word: String(it.word ?? ''),
      bold: !!it.bold,
      width: Number.isFinite(Number(it.width)) ? Number(it.width) : 0
    }));

    const totalTextWidth = safeLine.reduce((sum, w) => sum + w.width, 0);
    const totalSpaces = safeLine.length - 1;

    // ✅ SOLO justificar si realmente hay espacio extra (si no, NO justificar)
    const extra = maxWidth - totalTextWidth;
    const shouldJustify = !isLastLine && totalSpaces > 0 && Number.isFinite(extra) && extra > 0;

    const justifySpaceWidth = shouldJustify
      ? extra / totalSpaces
      : normalSpaceWidth;

    let currentX = x;

    // ✅ Asegura última palabra alineada solo si vamos a justificar
    const lastWordWidth = safeLine[safeLine.length - 1]?.width ?? 0;
    const xLastWord = shouldJustify ? (x + maxWidth - lastWordWidth) : 0;

    for (let index = 0; index < safeLine.length; index++) {
      const item = safeLine[index];

      if (!Number.isFinite(currentX)) currentX = x;

      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      doc.text(item.word, currentX, y);

      if (index < totalSpaces) {
        if (shouldJustify && index === totalSpaces - 1) {
          currentX = Number.isFinite(xLastWord) ? xLastWord : (currentX + item.width + justifySpaceWidth);
        } else {
          currentX += item.width + justifySpaceWidth;
        }
      } else {
        currentX += item.width;
      }
    }

    doc.setFont('helvetica', 'normal');
  }





  // Helper pequeño para HTML-safe en mensajes
  private escapeHtml(s: string): string {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  private toSafeArrayBuffer(u8: Uint8Array): ArrayBuffer {
    const ab = new ArrayBuffer(u8.byteLength);
    new Uint8Array(ab).set(u8);
    return ab;
  }

  // --- Helpers ---
  private norm(s: any): string {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private getRutaInfo(oficinas: Array<{ nombre?: string; ruta?: boolean }>, sede: string) {
    const arr = Array.isArray(oficinas) ? oficinas : [];
    const match = arr.find(o => this.norm(o?.nombre) === this.norm(sede));
    const nombreRuta = match?.nombre ?? (sede ?? '');
    const usaRuta = match == null ? '' : (match.ruta ? 'SI' : 'NO');
    return { nombreRuta, usaRuta };
  }



  // Función para convertir una cadena Base64 (con o sin prefijo) a Uint8Array
  base64ToUint8Array(base64: string): Uint8Array {
    // Verifica si la cadena contiene el prefijo y lo elimina si está presente
    const base64Data = base64.includes('data:image')
      ? base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
      : base64;

    // Decodifica la cadena base64 en un binario
    const binaryString = atob(base64Data);
    const len = binaryString.length;

    // Convierte el binario en un Uint8Array
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Detecta PNG o JPEG por firma binaria
  private sniffImageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
    if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
      return 'image/png';
    }
    if (bytes.length >= 3 &&
      bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image/jpeg';
    }
    return null;
  }

  /** Quita headers data: y duplicados, y retorna base64 “limpio” */
  private cleanBase64(raw?: string | null): string | null {
    if (!raw) return null;
    let s = String(raw).trim();
    if (!s) return null;
    // si ya viene como dataURL, separa en header + cuerpo
    if (s.startsWith('data:')) {
      const idx = s.indexOf(',');
      if (idx >= 0) s = s.slice(idx + 1);
    }
    // por si el cuerpo vuelve a empezar con data:
    s = s.replace(/^data:[^,]+,/, '');
    // quitar espacios y saltos
    s = s.replace(/\s+/g, '');
    return s;
  }

  /** Convierte base64 limpio a bytes */
  private b64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Detecta tipo de imagen por “magic numbers” */
  private sniffImg(bytes: Uint8Array): 'png' | 'jpg' | null {
    if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
    if (bytes.length >= 2 &&
      bytes[0] === 0xFF && bytes[1] === 0xD8) return 'jpg';
    return null;
  }

  /** Embebe cualquier imagen (base64/dataURL/bytes) como PNG o JPG según corresponda */
  private async embedAnyImage(
    pdfDoc: PDFDocument,
    input: string | Uint8Array | ArrayBuffer | null | undefined
  ) {
    if (!input) return null;

    let bytes: Uint8Array | null = null;
    if (typeof input === 'string') {
      const b64 = this.cleanBase64(input);
      if (!b64) return null;
      bytes = this.b64ToBytes(b64);
    } else if (input instanceof Uint8Array) {
      bytes = input;
    } else if (input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input);
    }

    if (!bytes?.length) return null;

    const kind = this.sniffImg(bytes);
    try {
      if (kind === 'png') return await pdfDoc.embedPng(bytes);
      if (kind === 'jpg') return await pdfDoc.embedJpg(bytes);
      // desconocido: intento PNG y luego JPG
      try { return await pdfDoc.embedPng(bytes); }
      catch { return await pdfDoc.embedJpg(bytes); }
    } catch (e) {
      console.error('embedAnyImage failed:', e);
      return null;
    }
  }

  // === Helpers universales (puedes dejarlos como privados en la clase) ===
  private safe<T>(v: T | null | undefined, fallback = ''): string {
    return v == null ? fallback : String(v);
  }

  parseDateToDDMMYYYY(v: any): string {
    if (v === null || v === undefined) return '';

    // Si llega como string
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return '';

      // ✅ corta hora: "YYYY-MM-DDTHH:mm:ss" o "YYYY-MM-DD HH:mm:ss"
      const datePart = s.split('T')[0].split(' ')[0].trim();

      // Si viene "YYYY-MM-DD"
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;

      // Si ya viene "DD/MM/YYYY"
      const m2 = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(datePart);
      if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;

      // Fallback: intenta parsear igual (por si viene ISO raro)
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }

      return '';
    }

    // Si llega Date
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      const dd = String(v.getDate()).padStart(2, '0');
      const mm = String(v.getMonth() + 1).padStart(2, '0');
      const yyyy = v.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    // Si llega timestamp numérico
    if (typeof v === 'number') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    }

    return '';
  }


  private formatLongDateES(input?: string | null): string {
    if (!input) return '';
    const s = String(input).trim();
    let d: Date | null = null;

    // dd/mm/yyyy -> local
    const mDMY = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (mDMY) {
      const [, dd, mm, yyyy] = mDMY;
      d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }

    // yyyy-mm-dd -> local (evita UTC)
    const mYMD = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!d && mYMD) {
      const [, yyyy, mm, dd] = mYMD;
      d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }

    // ISO con tiempo/zonas -> conserva el día del string ignorando hora/offset
    const mISO = /^(\d{4})-(\d{2})-(\d{2})[T\s].*$/.exec(s);
    if (!d && mISO) {
      const [, yyyy, mm, dd] = mISO;
      d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }

    // Fallback (último recurso)
    if (!d) d = new Date(s);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  private formatMoneyCOP(n?: string | number | null): string {
    if (n == null || n === '') return '';
    const val = typeof n === 'string' ? Number(n) : n;
    if (isNaN(val)) return '';
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(val);
  }

  // Tamaño por defecto para TODOS los campos
  private readonly PDF_FONT_SIZE = 7;

  private setText(form: any, fieldName: string, value: string, font?: any, size?: number) {
    try {
      const f = form.getTextField(fieldName);
      f.setText(value ?? '');
      // Fuerza 10pt si no te pasan otro tamaño
      f.setFontSize(size ?? this.PDF_FONT_SIZE);
      if (font) f.updateAppearances(font);
    } catch {
      // campo no existe en el PDF, ignorar
    }
  }


  private setXIf(form: any, fieldName: string, cond: boolean) {
    this.setText(form, fieldName, cond ? 'X' : '');
  }

  private async fetchAsArrayBufferOrNull(url?: string): Promise<ArrayBuffer | null> {
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch { return null; }
  }


  private getEmpresaInfo(): { logoPath?: string; firmaPath?: string; persona?: string; nombreEmpresa?: string } {
    // Deriva desde centro de costos o empresa usuaria (usa SOLO datoSeleccion/datoContratacion)
    const temporal = this.vacante?.temporal;

    if (temporal.includes('APOYO LABORAL')) {
      return {
        logoPath: 'logos/Logo_AL.png',
        firmaPath: 'firma/FirmaAndreaSD.png',
        nombreEmpresa: 'APOYO LABORAL TS S.A.S.',
      };
    }
    if (temporal.includes('TU ALIANZA')) {
      return {
        logoPath: 'logos/Logo_TA.png',
        firmaPath: 'firma/FirmaAndreaSD.png',
        nombreEmpresa: 'TU ALIANZA S.A.S.',
      };
    }
    // Por defecto: sin logo/firma, pero mantiene el centro/usuaria como nombre visible
    return {
      logoPath: undefined,
      firmaPath: undefined,
      persona: '',
      nombreEmpresa: ''
    };
  }

  private hijosTop5(): any[] {
    const arr: any[] = Array.isArray(this.candidato?.hijos) ? this.candidato.hijos : [];
    // filtra vacíos por nombre
    return arr.filter(h => (this.safe(h?.nombre).trim() !== '')).slice(0, 5);
  }



  // Generar documento de entrega de documentos de apoyo
  async generarEntregaDocsApoyo() {
    // ───────── Helpers ─────────
    const H_CENTER = 'center' as const;
    const BOLD = 'bold' as const;
    const ITALIC = 'italic' as const;

    // Carga URL → DataURL (necesario para doc.addImage en navegador)
    const toDataURL = async (url?: string): Promise<string | null> => {
      if (!url) return null;
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error('fetch fail');
        const b = await r.blob();
        return await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(new Error('reader fail'));
          fr.readAsDataURL(b);
        });
      } catch {
        return null; // si no carga, omitimos la imagen
      }
    };

    const renderJustifiedLine = (
      doc: jsPDF,
      linea: string,
      x: number,
      y: number,
      anchoDisponible: number,
      ultimaLinea: boolean
    ) => {
      const palabras = linea.split(' ').filter(Boolean);
      if (palabras.length <= 1 || ultimaLinea) { doc.text(linea, x, y); return; }
      const widths = palabras.map(p => doc.getTextWidth(p));
      const totalPalabras = widths.reduce((a, b) => a + b, 0);
      const espacios = palabras.length - 1;
      const extra = (anchoDisponible - totalPalabras) / espacios;
      let cursorX = x;
      palabras.forEach((p, i) => {
        doc.text(p, cursorX, y);
        if (i < espacios) cursorX += widths[i] + extra;
      });
    };

    // ───────── PDF base y layout ─────────
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    doc.setProperties({
      title: 'Apoyo_Laboral_Entrega_Documentos.pdf',
      author: this.empresa,
      creator: this.empresa,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const leftMargin = 10;
    const rightMargin = 10;
    const contentWidth = pageWidth - leftMargin - rightMargin;

    let y = 10; // cursor vertical global
    const marginLeft = leftMargin;

    // ───────── Encabezado (logo + tabla) ─────────
    const startX = leftMargin;
    const startY = y;
    const headerHeight = 13;
    const logoBoxWidth = 50;
    const tableWidth = contentWidth;

    // Cuadro de logo/NIT
    doc.setLineWidth(0.1);
    doc.rect(startX, startY, logoBoxWidth, headerHeight);

    // Logo (si no carga, se omite)
    const logoData = await toDataURL('logos/Logo_AL.png');
    if (logoData) {
      doc.addImage(logoData, 'PNG', startX + 2, startY + 1.5, 27, 10);
    }

    // NIT
    doc.setFontSize(7);

    // Tabla derecha del encabezado
    const tableStartX = startX + logoBoxWidth;
    const rightHeaderWidth = tableWidth - logoBoxWidth;
    doc.rect(tableStartX, startY, rightHeaderWidth, headerHeight);

    doc.setFont('helvetica', 'bold');
    doc.text('PROCESO DE CONTRATACIÓN', tableStartX + 54, startY + 3);
    doc.text('ENTREGA DE DOCUMENTOS Y AUTORIZACIONES', tableStartX + 44, startY + 7);

    // Líneas y columnas
    const h1Y = startY + 4;
    const h2Y = startY + 8;
    doc.line(tableStartX, h1Y, tableStartX + rightHeaderWidth, h1Y);
    doc.line(tableStartX, h2Y, tableStartX + rightHeaderWidth, h2Y);

    const col1 = tableStartX + 30;
    const col2 = tableStartX + 50;
    const col3 = tableStartX + 110;

    doc.line(col1, h2Y, col1, startY + headerHeight);
    doc.line(col2, h2Y, col2, startY + headerHeight);
    doc.line(col3, h2Y, col3, startY + headerHeight);

    // Contenido columnas
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Código: AL CO-RE-6', tableStartX + 2, startY + 11.5);
    doc.text('Versión: 23', col1 + 2, startY + 11.5);
    doc.text('Fecha Emisión: Julio 9-25', col2 + 5, startY + 11.5);
    doc.text('Página: 1 de 1', col3 + 6, startY + 11.5);

    y = startY + headerHeight + 7;

    // ───────── Intro ─────────
    doc.setFontSize(8).setFont('helvetica', 'normal');
    const maxWidth = contentWidth;
    const intro = 'Reciba un cordial saludo, por medio del presente documento afirmo haber recibido, leído y comprendido los documentos relacionados a continuación:';
    doc.text(intro, marginLeft, y, { maxWidth });
    doc.setFontSize(7);
    y += 4;

    // Lista 1) 2)
    const lista = [
      'Copia del Contrato individual de Trabajo',
      'Inducción General de nuestra Compañía e Información General de la Empresa Usuaria el cual incluye información sobre:'
    ];
    lista.forEach((item, index) => {
      const numero = `${index + 1}) `;
      doc.setFont('helvetica', 'bold'); doc.text(numero, marginLeft, y);
      doc.setFont('helvetica', 'normal');
      const numW = doc.getTextWidth(numero);
      doc.text(item, marginLeft + numW, y);
      y += 5;
    });

    // Subtítulo tabla
    doc.setFontSize(8).setFont('helvetica', 'bold');
    doc.text(
      'Fechas de Pago de Nómina y Valor del almuerzo que es descontado por Nómina o Liquidación final:',
      marginLeft + 20,
      y
    );
    const startYForTable = y + 3;

    // ───────── Tabla (autotable) ─────────
    const head: RowInput[] = [[
      { content: 'EMPRESA USUARIA', styles: { halign: H_CENTER, fontStyle: BOLD, fillColor: [255, 128, 0], textColor: 255 } },
      { content: 'FECHA DE PAGO', styles: { halign: H_CENTER, fontStyle: BOLD, fillColor: [255, 128, 0], textColor: 255 } },
      { content: 'SERVICIO DE CASINO', styles: { halign: H_CENTER, fontStyle: BOLD, fillColor: [255, 128, 0], textColor: 255 } }
    ]];

    const body: RowInput[] = [
      [
        { content: 'The Elite Flower S.A.S C.I *\nFundación Fernando Borrero Caicedo', styles: { fontStyle: ITALIC, fontSize: 6.5, halign: H_CENTER } },
        { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } },
        { content: 'Valor de Almuerzo $ 1,945\nDescuento quincenal por nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: H_CENTER } }
      ],
      [
        { content: 'Luisiana Farms S.A.S.', styles: { fontStyle: ITALIC, fontSize: 6.5, halign: H_CENTER } },
        { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } },
        { content: 'Valor de Almuerzo $ 3,700\nDescuento quincenal por nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: H_CENTER } }
      ],
      [
        { content: 'Petalia S.A.S', styles: { fontStyle: ITALIC, fontSize: 6.5, halign: H_CENTER } },
        { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } },
        { content: 'No cuenta con servicio de casino, se debe llevar el almuerzo', styles: { fontSize: 6.5, halign: H_CENTER } }
      ],
      [
        { content: 'Fantasy Flower S.A.S. \nMercedes S.A.S. \nWayuu Flowers S.A.S', styles: { fontStyle: ITALIC, fontSize: 6.5, halign: H_CENTER } },
        { content: '06 y 21 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } },
        { content: 'Valor de Almuerzo $ 1,945 \n Descuento quincenal por nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: H_CENTER } }
      ]
    ];

    autoTable(doc, {
      head, body,
      startY: startYForTable,
      theme: 'grid',
      margin: { left: leftMargin, right: rightMargin },
      styles: { font: 'helvetica', fontSize: 6.5, cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 } },
      headStyles: { lineWidth: 0.2, lineColor: [120, 120, 120] },
      bodyStyles: { lineWidth: 0.2, lineColor: [180, 180, 180], valign: 'middle' },
      columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 45 }, 2: { cellWidth: 'auto' as const } },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? (startYForTable + 30);
    doc.setDrawColor(0).setLineWidth(0.2);
    doc.line(leftMargin, finalY, pageWidth - rightMargin, finalY);

    y = finalY + 4;

    // Notas
    doc.setFontSize(7).setFont('helvetica', 'normal');
    const noteMaxW = contentWidth;
    const nota1 = 'Nota: * Para los centros de costo de la empresa usuaria The Elite Flower S.A.S. C.I.: Carnations, Florex, Jardines de Colombia Normandía, Tinzuque, Tikya, Chuzacá; su fecha de pago son 06 y 21 de cada mes.';
    const nota2 = '** Para los centros de costo de la empresa usuaria Wayuu Flowers S.A.S.: Pozo Azul, Postcosecha Excellence, Belchite; su fecha de pago son 01 y 16 de cada mes.';

    const l1 = doc.splitTextToSize(nota1, noteMaxW) as string[];
    doc.text(l1, marginLeft, y); y += l1.length * 4;

    const l2 = doc.splitTextToSize(nota2, noteMaxW) as string[];
    doc.text(l2, marginLeft, y); y += l2.length * 4;

    // Autorización casino
    doc.setFontSize(8).setFont('helvetica', 'bold');
    doc.text('Teniendo en cuenta la anterior información, autorizo descuento de casino:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text('SI (  X  )', 130, y);
    doc.text('NO (     )', 155, y);
    doc.text('No aplica (     )', 175, y);

    // Forma de pago
    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(7);
    doc.text('3) FORMA DE PAGO:', marginLeft, y);
    y += 5;

    const contrato = this.candidato?.entrevistas?.[0]?.proceso?.contrato || {};
    const formaPagoSeleccionada: string = contrato?.forma_de_pago ?? '';
    const numeroPagos: string = contrato?.numero_para_pagos ?? '';

    const opciones = [
      { nombre: 'Daviplata', x: marginLeft, y: y },
      { nombre: 'Davivienda cta ahorros', x: marginLeft + 20, y: y },
      { nombre: 'Davivienda Tarjeta Master', x: marginLeft + 60, y: y },
      { nombre: 'Otra', x: marginLeft + 105, y: y },
    ];

    opciones.forEach((op) => {
      doc.rect(op.x, op.y - 3, 4, 4);
      doc.setFont('helvetica', 'normal').text(op.nombre, op.x + 6, op.y);
      if (formaPagoSeleccionada === op.nombre) {
        doc.setFont('helvetica', 'bold').text('X', op.x + 1, op.y);
      }
    });

    doc.text('¿Cuál?', 130, y);
    doc.line(140, y, 200, y);
    if (formaPagoSeleccionada === 'Otra') {
      doc.text('Especificar aquí...', 150, y + 10);
    }

    // Número TJT / Código
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold').text('Número TJT ó Celular:', marginLeft, y);
    doc.text('Código de Tarjeta:', 110, y);
    doc.setFont('helvetica', 'normal');
    if (formaPagoSeleccionada === 'Daviplata') {
      doc.text(numeroPagos, 60, y);
    } else {
      doc.text(numeroPagos, 150, y);
    }

    // IMPORTANTE (justificado)
    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(7);
    const importante =
      'IMPORTANTE: Recuerde que si usted cuenta con su forma de pago Daviplata, cualquier cambio realizado en la misma debe ser notificado a la Emp. Temporal. También tenga presente que la entrega de la tarjeta Master por parte de la Emp. Temporal es provisional, y se reemplaza por la forma de pago DAVIPLATA; tan pronto Davivienda nos informa que usted activó su DAVIPLATA, se le genera automáticamente el cambio de forma de pago. CUIDADO! El manejo de estas cuentas es responsabilidad de usted como trabajador, por eso son personales e intransferibles.';
    const anchoJust = contentWidth, margenJust = marginLeft, lineHeight = 3;
    doc.setFont('helvetica', 'normal');
    const lineas = doc.splitTextToSize(importante.trim().replace(/\s+/g, ' '), anchoJust) as string[];
    lineas.forEach((ln, i) => {
      const last = i === lineas.length - 1;
      renderJustifiedLine(doc, ln, margenJust, y, anchoJust, last);
      y += lineHeight;
    });

    // Acepto cambio
    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('ACEPTO CAMBIO SIN PREVIO AVISO YA QUE HE SIDO INFORMADO (A):', marginLeft, y - 4);
    doc.setFont('helvetica', 'normal');
    doc.text('SI (  x  )', 170, y - 4);
    doc.text('NO (     )', 190, y - 4);
    doc.setFontSize(6.5);

    // Contenido final numerado
    const contenidoFinal = [
      { numero: '4)', texto: 'Entrega y Manejo del Carné de la Empresa de Servicios Temporales APOYO LABORAL TS S.A.S.' },
      { numero: '5)', texto: 'Capacitación de Ley 1010 DEL 2006 (Acosos laboral) y mecanismo para interponer una queja general o frente al acoso.' },
      { numero: '6)', texto: 'Socialización de las políticas vigentes y aplicables de la Empresa Temporal.' },
      { numero: '7)', texto: 'Curso de Seguridad y Salud en el Trabajo "SST" de la Empresa Temporal.' },
      {
        numero: '8)',
        texto: 'Se hace entrega de la documentación requerida para la vinculación de beneficiarios a la Caja de Compensación Familiar y se establece compromiso de 15 días para la entrega sobre la documentación para afiliación de beneficiarios a la Caja de Compensación y EPS si aplica.\nDe lo contrario se entenderá que usted no desea recibir este beneficio, recuerde que es su responsabilidad el registro de los mismos.'
      },
      {
        numero: '9)',
        texto: 'Plan funeral Coorserpark: AUTORIZO la afiliación y descuento VOLUNTARIO al plan, por un valor de $4.095 descontados quincenalmente por Nómina. La afiliación se hace efectiva a partir del primer descuento.'
      }
    ];

    const bottomSafe = 12;
    const ensureSpace = (need: number) => {
      if (y + need > pageHeight - bottomSafe) { doc.addPage(); y = 15; }
    };

    doc.setFontSize(7);
    contenidoFinal.forEach((item) => {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold').text(item.numero, marginLeft, y);
      doc.setFont('helvetica', 'normal');
      const textoLineas = doc.splitTextToSize(item.texto, contentWidth) as string[];
      doc.text(textoLineas, marginLeft + 10, y);
      y += textoLineas.length * 4 + 1;
    });

    // SI / NO del seguro
    const seguro = !!contrato?.seguro_funerario;
    console.log('Seguro funerario?', seguro);
    if (seguro) {
      doc.text('SI (  x  )', 170, y - 4);
      doc.text('NO (     )', 190, y - 4);
    } else {
      doc.text('SI (     )', 170, y - 4);
      doc.text('NO (  x  )', 190, y - 4);
    }

    // Nota
    doc.setFont('helvetica', 'bold').text('Nota:', marginLeft, y + 1);
    doc.setFont('helvetica', 'normal').setFontSize(7).text(
      'Si usted autorizó este descuento debe presentar una carta en la oficina de la Temporal solicitando el retiro, para la desafiliación de este plan.',
      marginLeft + 10,
      y + 1,
      { maxWidth: contentWidth - 10 }
    );

    // Banner "Recuerde que:"
    y += 5;
    ensureSpace(10);
    doc.setFillColor(230, 230, 230);
    doc.rect(marginLeft, y - 2, contentWidth, 5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(0, 0, 0);
    doc.text('Recuerde que:', marginLeft + 2, y + 1);
    doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0);
    doc.text('Puede encontrar esta información disponible en:', marginLeft + 25, y + 1);
    doc.setTextColor(0, 0, 255);
    doc.textWithLink('http://www.apoyolaboralts.com/', marginLeft + 95, y + 1, { url: 'http://www.apoyolaboralts.com/' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Ingresando la clave:', marginLeft + 145, y + 1);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('9876', marginLeft + 180, y + 1);

    // DEL COLABORADOR
    y += 8;
    ensureSpace(20);

    const contenidoFinalColaborador = [
      { numero: 'a)', texto: 'Por medio de la presente manifiesto que recibí lo anteriormente mencionado y que acepto el mismo.' },
      { numero: 'b)', texto: 'Leí y comprendí  el curso de inducción General y de Seguridad y Salud en el Trabajo, así como  el contrato laboral   y todas las cláusulas y condiciones establecidas.' },
      { numero: 'c)', texto: 'Información Condiciones de Salud: Manifiesto que conozco los resultados de mis exámenes médicos de ingreso y las recomendaciones dadas por el médico ocupacional.' },
    ];

    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('DEL COLABORADOR:', marginLeft, y);
    y += 5;

    doc.setFontSize(7.5);
    const lh = 4;
    const gapAfterItem = 1;

    doc.setFont('helvetica', 'bold');
    const bulletBoxWidth =
      Math.max(doc.getTextWidth('a) '), doc.getTextWidth('b) '), doc.getTextWidth('c) ')) + 1.5;

    const xBullet = marginLeft;
    const xText = xBullet + bulletBoxWidth;
    const availWidth = pageWidth - rightMargin - xText;

    contenidoFinalColaborador.forEach(({ numero, texto }) => {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.text(numero, xBullet, y);

      doc.setFont('helvetica', 'normal');
      const parrafos = String(texto).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const partes = parrafos.length ? parrafos : [''];

      partes.forEach((p, pi) => {
        const lines = doc.splitTextToSize(p, availWidth) as string[];
        lines.forEach((ln) => {
          ensureSpace(lh);
          doc.text(ln, xText, y);
          y += lh;
        });
        if (pi < partes.length - 1) y += 1.5;
      });

      y += gapAfterItem;
    });

    // Firma + datos
    y += 10;
    ensureSpace(30);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.line(marginLeft, y, marginLeft + 60, y);
    doc.text('Firma de Aceptación', marginLeft, y + 4);

    const firmaData = await toDataURL(this.firma);
    if (firmaData) {
      doc.addImage(firmaData, 'PNG', marginLeft, y - 18, 50, 20);
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la firma' });
    }

    y += 8;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text(`No de Identificación: ${this.cedula ?? ''}`, marginLeft, y);
    doc.text(`Fecha de Recibido: ${new Date().toISOString().split('T')[0]}`, marginLeft, y + 4);

    // Tabla de huella (solo Índice Derecho)
    const huellaData = await toDataURL(this.huella);
    const huellaTableWidth = 82, huellaTableHeight = 30, huellaHeaderHeight = 8;
    const huellaStartX = pageWidth - rightMargin - huellaTableWidth;
    const huellaStartY = y - 10;

    doc.setFillColor(230, 230, 230);
    doc.rect(huellaStartX, huellaStartY, huellaTableWidth / 2, huellaHeaderHeight, 'F');
    doc.setDrawColor(0);
    doc.rect(huellaStartX, huellaStartY, huellaTableWidth / 2, huellaHeaderHeight);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('Huella Indice Derecho', huellaStartX + 5, huellaStartY + 5);
    doc.rect(huellaStartX, huellaStartY + huellaHeaderHeight, huellaTableWidth / 2, huellaTableHeight);

    if (huellaData) {
      const imageWidth = huellaTableWidth / 2 - 10;
      const imageHeight = huellaTableHeight - 3;
      doc.addImage(huellaData, 'PNG', huellaStartX + 5, huellaStartY + huellaHeaderHeight + 2, imageWidth, imageHeight);
    }

    // Sello / imagen final (si existe local)
    const selloData = await toDataURL('firma/FirmaEntregaDocApoyo.png');
    if (selloData) {
      y += 5;
      doc.addImage(selloData, 'PNG', marginLeft, y, 95, 10);
    }

    // ───────── Exportar y previsualizar ─────────
    const pdfBlob = doc.output('blob');
    const fileName = `${this.empresa || 'Apoyo_Laboral'}_Entrega_de_documentos.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    this.uploadedFiles['Entrega de documentos'] = { file: pdfFile, fileName };
    this.verPDF({ titulo: 'Entrega de documentos' });
  }



  // Generar contrato de trabajo
  generarContratoTrabajo() {
    // Determinar la ruta del logo y el NIT
    let logoPath = '';
    let nit = '';
    let domicilio = '';
    let codigo = '';
    let version = '';
    let fechaEmision = '';

    if (this.empresa === 'APOYO LABORAL SAS') {
      logoPath = 'logos/Logo_AL.png';
      nit = '900.814.587-1';
      domicilio = 'CARRERA 2 # 8 - 156 FACATATIVÁ C/MARCA';
      codigo = 'AL CO-RE-1';
      version = '07';
      fechaEmision = 'Enero 06-21';
    } else if (this.empresa === 'TU ALIANZA SAS') {
      logoPath = 'logos/Logo_TA.png';
      nit = '900.864.596-1';
      domicilio = 'CLL 7 4 49 Madrid, Cundinamarca';
      codigo = 'TA CO-RE-1';
      version = '06';
      fechaEmision = 'Mayo 02-2022';
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Empresa no reconocida para generar el contrato',
      });
      return;
    }

    // Crear el documento PDF en formato vertical
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    doc.setProperties({
      title: 'Contrato_Trabajo.pdf',
      creator: this.empresa,
      author: this.empresa,
    });


    // Posiciones iniciales
    const startX = 5;
    const startY = 5;
    const tableWidth = 205;

    // **Cuadro para el logo y NIT**
    doc.setLineWidth(0.1);
    doc.rect(startX, startY, 50, 13); // Cuadro del logo y NIT

    // Agregar logo
    doc.addImage(logoPath, 'PNG', startX + 2, startY + 1.5, 27, 10);

    // Agregar NIT
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("NIT", startX + 32, startY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(nit, startX + 32, startY + 10);

    // **Tabla al lado del logo**
    let tableStartX = startX + 50; // Inicio de la tabla al lado del cuadro
    doc.rect(tableStartX, startY, tableWidth - 50, 13); // Borde exterior de la tabla

    // Encabezados
    doc.setFont('helvetica', 'bold');
    doc.text("PROCESO DE CONTRATACIÓN", tableStartX + 55, startY + 3);
    doc.text(this.codigoContratacion, tableStartX + 130, startY + 3);
    doc.text("CONTRATO DE TRABAJO POR OBRA O LABOR", tableStartX + 43, startY + 7);

    // Líneas divisoras
    let col1 = tableStartX + 30;
    let col2 = tableStartX + 50;
    let col3 = tableStartX + 110;

    doc.line(tableStartX, startY + 4, tableStartX + tableWidth - 50, startY + 4); // Línea horizontal bajo el título
    doc.line(tableStartX, startY + 8, tableStartX + tableWidth - 50, startY + 8); // Línea horizontal bajo el título
    doc.line(col1, startY + 8, col1, startY + 13); // Línea vertical 1
    doc.line(col2, startY + 8, col2, startY + 13); // Línea vertical 2
    doc.line(col3, startY + 8, col3, startY + 13); // Línea vertical 3

    // **Contenido de las columnas**
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("Código: " + codigo, tableStartX + 2, startY + 11.5);
    doc.text("Versión: " + version, col1 + 2, startY + 11.5); // Ajustar dentro de columna
    doc.text(`Fecha Emisión: ${fechaEmision}`, col2 + 5, startY + 11.5);
    doc.text("Página: 1 de 3", col3 + 6, startY + 11.5); // Ajustar dentro de columna

    // Representado por
    doc.setFontSize(7);

    const fechaISO = this.vacante.fechaIngreso; // '2024-12-04T05:00:00.000Z'

    // Convertir la fecha ISO a un objeto Date
    const fecha = new Date(fechaISO);

    // Formatear al formato dd/mm/yyyy
    const fechaFormateada = [
      String(fecha.getDate()).padStart(2, '0'),  // dd
      String(fecha.getMonth() + 1).padStart(2, '0'),  // mm
      fecha.getFullYear()  // yyyy
    ].join('/');

    // Datos de titulos
    const datos = [
      { titulo: 'Representado por', valor: 'MAYRA HUAMANÍ LÓPEZ' },
      { titulo: 'Nombre del Trabajador', valor: this.candidato.primer_nombre + ' ' + (this.candidato.segundo_nombre ?? '') + ' ' + this.candidato.primer_apellido + ' ' + (this.candidato.segundo_apellido ?? '') },
      { titulo: 'Fecha de Nacimiento', valor: this.candidato.fecha_nacimiento },
      { titulo: 'Domicilio del Trabajador', valor: this.candidato.residencia.direccion + ' ' + this.candidato.residencia.barrio + ' ' + 'BOGOTÁ' },
      { titulo: 'Fecha de Iniciación', valor: this.candidato?.entrevistas?.[0]?.proceso?.contrato?.fecha_ingreso ?? '' },
      { titulo: 'Salario Mensual Ordinario', valor: 'S.M.M.L.V. $1.423.500 — Un millón cuatrocientos veintitrés mil quinientos pesos M/C.' },
      { titulo: 'Periódo de Pago Salario', valor: 'Quincenal' },
      { titulo: 'Subsidio de Transporte', valor: 'SE PAGA EL LEGAL VIGENTE  O SE SUMINISTRA EL TRANSPORTE' },
      { titulo: 'Forma de Pago', valor: 'Banca Móvil,  Cuenta de Ahorro o Tarjeta Monedero' },
      { titulo: 'Nombre Empresa Usuria', valor: this.vacante.empresaUsuariaSolicita },
      { titulo: 'Cargo', valor: this.vacante.cargo },
      { titulo: 'Descripción de la Obra/Motivo Temporada', valor: this.vacante.descripcion },
      { titulo: 'Domicilio del patrono', valor: domicilio },
      { titulo: 'Tipo y No de Identificación', valor: this.candidato.tipo_doc + '        ' + this.cedula },
      { titulo: 'Email', valor: this.candidato.contacto.email },
    ];
    // Configuración de columnas
    const columnWidth = 110; // Ancho de cada columna
    const rowSpacing = 3;    // Espaciado entre filas
    const columnMargin = 10; // Margen entre columnas
    const columnStartX = 5;  // Posición inicial X
    const columnStartY = startY + 17; // Posición inicial Y
    const rowsPerColumn = 12; // Número exacto de filas por columna

    // Iteración para generar el texto
    datos.forEach((item, index) => {
      const currentColumn = Math.floor(index / rowsPerColumn); // Columna actual (cada 12 filas)
      const rowInColumn = index % rowsPerColumn; // Fila dentro de la columna actual

      const x = columnStartX + currentColumn * (columnWidth + columnMargin);
      const y = columnStartY + rowInColumn * rowSpacing;

      // Establecer el título en fuente normal
      doc.setFont('helvetica', 'normal');
      doc.text(`${item.titulo}:`, x, y);

      if (index > 11) {
        // Establecer el valor en fuente negrita
        doc.setFont('helvetica', 'bold');
        doc.text(item.valor, x + 30.2, y);
      }
      else {
        // Establecer el valor en fuente negrita
        doc.setFont('helvetica', 'bold');
        doc.text(item.valor ?? '', x + 48, y);
      }
    });

    // Restaurar la fuente a la normal después del bucle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    let y = columnStartY + rowsPerColumn * rowSpacing + 2; // Posición vertical después de los datos
    // Texto adicional
    let texto = 'Entre el EMPLEADOR y el TRABAJADOR arriba indicados, se ha celebrado el contrato regulado por las cláusulas que adelante se indican, aparte de la ley, siendo ellas las siguientes: PRIMERA. El Trabajador, a partir de la fecha de iniciación, se obliga para con el EMPLEADOR a ejecutar la obra arriba indicada, sometiéndose durante su realización en todo a las órdenes de éste. Declara por consiguiente el TRABAJADOR completa y total disponibilidad para con el EMPLEADOR para ejecutar las obras indicadas en el encabezamiento, siempre que así le sean exigidas por sus clientes al EMPLEADOR. Teniendo en cuenta que, la EMPRESA USUARIA, desarrolla su actividad productiva y comercial a nivel nacional, las partes convienen en que la EMPRESA USUARIA podrá trasladar la base de operaciones de EL TRABAJADOR, en cualquier tiempo, a cualquier otro lugar donde desarrolle tales actividades sin que por ello se opere desmejora o modificación sustancial de las condiciones de trabajo ni de la categoría del TRABAJADOR, consideradas en el momento de la suscripción de este contrato. SEGUNDA. DURACIÓN DEL CONTRATO: La necesaria para la realización de la obra o labor contratada y conforme a las necesidades del patrono o establecimiento que requiera la ejecución de la obra, todo conforme a lo previsto en el Art. 45 del CST y teniendo en cuenta la fecha de iniciación de la obra; y la índole de la misma, circunstancias una y otra ya anotadas. PARÁGRAFO PRIMERO: Las partes acuerdan que por ser el TRABAJADOR contratado como trabajador en misión para ser enviado a la empresa la duración de la obra o labor no podrá superar el tiempo establecido en el Art. 77 de la Ley 50 de 1990 en su numeral 3°. PARÁGRAFO SEGUNDO: El término de duración del presente contrato es de carácter temporal por ser el EMPLEADOR una empresa de servicios temporales, y por tanto tendrá vigencia hasta la realización de la obra o labor contratada que sea indicada por las Empresas Usuarias del EMPLEADOR en este contrato, acordando las partes que para todos los efectos legales, la obra o labor contratada termina en la fecha en que la EMPRESA USUARIA, a la que será enviado el TRABAJADOR, comunique la terminación de la misma. PARÁGRAFO TERCERO: La labor se realizará de manera personal en las instalaciones de la EMPRESA.';
    // this.vacante.empresaUsuariaSolicita + CENTRO DE COSTOS + this.vacante.finca + DIR. + this.vacante.direccion
    doc.setFont('helvetica', 'normal');
    // Construir texto dinámico sin null ni undefined
    const partes = [
      this.vacante?.empresaUsuariaSolicita,
      'CENTRO DE COSTOS',
      this.vacante?.finca || '',
      this.vacante?.direccion ? `DIR. ${this.vacante.direccion}` : ''
    ].filter(Boolean); // elimina los vacíos o null

    const textoLinea = partes.join(' ').replace(/\s+/g, ' ').trim();

    // negrita
    doc.setFont('helvetica', 'bold');
    doc.text(textoLinea, 5, y + 41.3, { maxWidth: 195 });
    doc.setFont('helvetica', 'normal');

    let x = 5; // Margen izquierdo
    const lineHeight = 3.4;
    const maxWidth = 205;

    doc.setFontSize(6.5);

    // Renderizar texto justificado usando `y` como posición inicial
    y = this.renderJustifiedText(doc, texto, x, y, maxWidth, lineHeight);
    // Centro de costo en negrita, tamaño 10, si se pasa de la página, se ajusta a la siguiente
    y += 3; // Espacio adicional después del contenido
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    //doc.text(this.cedulaPersonalAdministrativo.centroCosto, 7, y + 1);

    // Segundo parrago
    y += 5; // Espacio adicional después del contenido
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    let texto2 = 'TERCERA. El salario como contraprestación del servicio será el indicado arriba, según la clasificación de oficios y tarifas determinados por el EMPLEADOR, la cual hace parte de este contrato; sometida sí en su eficiencia a que el valor a recibir corresponda al oficio respectivo efectivamente contratado con el usuario, según el tiempo laborado en la respectiva jornada, inferior a la máxima legal; éste regirá en proporción al número de horas respectivamente trabajadas y en él están los valores incluidos correspondientes a dominicales y festivos reconocidos por la ley como descanso remunerado. PARÁGRAFO PRIMERO: El patrono manifiesta expresamente que el TRABAJADOR tendrá derecho a todas las prestaciones sociales consagradas en la ley 50 de 1990 y demás estipulaciones previstas en el CST. Tales como compensación monetaria por vacaciones y prima de servicios proporcional al tiempo laborado, cualquiera que este sea. PARÁGRAFO SEGUNDO: Se conviene por las partes, que en caso de que el TRABAJADOR devengue comisiones o cualquiera otra modalidad de salario variable, el 82.5 % de dichos ingresos constituyen remuneración ordinaria y el 17.5 % restante está destinado a remunerar el descanso en días dominicales y festivos de que tratan los capítulos I y II del título VII del CST. CUARTA. EL TRABAJADOR, se someterá al horario de trabajo que señale el EMPLEADOR de acuerdo con las especificaciones del Usuario. QUINTA. PERÍODO DE PRUEBA: el período de prueba no excederá de dos (2) meses ni podrá ser superior a la quinta parte del término pactado, si el contrato tuviere una duración inferior a un año. SEXTA. EL TRABAJADOR y EL EMPLEADOR podrán convenir en repartir las horas de la jornada diaria en los términos del Art. 164 del CST., teniendo en cuenta que el descanso entre las secciones de la jornada no se computa dentro de la misma, según el art. 167 del estatuto Ibídem. Así mismo todo trabajador extra, suplementario o festivo, solo será reconocido en caso de ser exigido o autorizado a trabajar por el EMPLEADOR a solicitud de la entidad con la cual aquel tenga acuerdo de realización de trabajo o servicio. SÉPTIMA. Son justas causas para dar por terminado este contrato, además de las previstas en el art.7° del decreto 2351, las disposiciones concordantes y las consignadas en el reglamento interno del trabajo del EMPLEADOR, así como las siguientes: 1ª La terminación por cualquier causa, del contrato de prestación de servicios suscritos entre el EMPLEADOR y el USUARIO en donde prestará servicios el TRABAJADOR. 2ª El que la EMPRESA USUARIA en donde prestará servicios el TRABAJADOR, solicite el cambio de este por cualquier causa. 3ª El que la EMPRESA USUARIA en donde prestará servicios el TRABAJADOR, comunique la terminación de la obra o labor contratada. 4ª Que la EMPRESA USUARIA comunique al EMPLEADOR el incumplimiento leve de cualquiera de las obligaciones por parte del TRABAJADOR en TRES oportunidades, dos de las cuales hayan generado SANCIÓN AL TRABAJADOR. OCTAVA. Las partes acuerdan que NO CONSTITUYEN SALARIO, las sumas que ocasionalmente y por mera liberalidad reciba el TRABAJADOR del EMPLEADOR, como auxilios, gratificaciones, bonificaciones, primas extralegales, premios, bonos ocasionales, gastos de transporte adicionales y representación que el EMPLEADOR otorgue o llegue a otorgar en cualquier tiempo al TRABAJADOR, como tampoco no constituyen salario en dinero o en especie, cualquier alimentación, habitación o vestuario que entregue el EMPLEADOR, o un TERCERO al TRABAJADOR, durante la vigencia de este contrato.Tampoco constituirá salario, conforme a los términos del artículo 128 del Código Sustantivo del trabajo, cualquier bonificación o auxilio habitual, que se llegaren a acordar convencional o habitualmente entre las partes. Estos dineros, no se computarán como parte de salario para efectos de prestaciones sociales liquidables o BASE1 de éste. Al efecto el TRABAJADOR y el EMPLEADOR, así lo pactan expresamente en los términos del artículo 128 del C.S. del T. en C. Con. Con el articulo quince (15) de la ley cincuenta (50) de 1990. PARÁGRAFO PRIMERO: Las partes acuerdan que el EMPLEADOR, a su arbitrio y liberalidad podrá en cualquier momento cancelar o retirar el pago de bonificaciones habituales o esporádicas que en algún momento reconozca o hubiese reconocido al trabajador diferentes a su salario, sin que esto constituya desmejora de sus condiciones laborales; toda vez que como salario y retribución directa a favor del trabajador derivada de su actividad o fuerza laboral únicamente se pacta la suma establecida en la caratula del presente contrato. NOVENA. En caso que el TRABAJADOR requiera ausentarse de su lugar de trabajo, deberá avisar por lo menos con 24 horas de anticipación a la EMPRESA USUARIA o según lo establecido en el Reglamento Interno de la misma. DÉCIMA. CONFIDENCIALIDAD: El TRABAJADOR en virtud del presente contrato se compromete a 1) Manejar de manera confidencial la información que como tal sea presentada y entregada, y toda aquella que se genere en torno a ella como fruto de la prestación de sus servicios. 2) Guardar confidencialidad sobre esta información y no emplearla en beneficio propio o de terceros mientras conserve sus características de confidencialidad y que pueda perjudicar los intereses del EMPLEADOR o de la EMPRESA USUARIA. 3) Solicitar previamente y por escrito autorización para cualquier publicación relacionada con el tema de contrato, autorización que debe solicitarse ante el empleador. DÉCIMA PRIMERA. AUTORIZACION TRATAMIENTO DE DATOS PERSONALES, 1). De acuerdo a lo establecido en la ley 1581 de 2012, la Constitución Nacional y a las políticas establecidas por el EMPLEADOR para el caso en particular, el trabajador debe guardar reserva respecto a la protección de datos de los clientes, proveedores, compañeros, directivos del EMPLEADOR Y EMPRESA USUARIA, salvo que medie autorización expresa de cada persona para divulgar la información. 2). Guardar completa reserva sobre las operaciones, negocios y procedimientos industriales y comerciales, o cualquier otra clase de datos acerca del EMPLEADOR Y EMPRESA USUARIA que conozca por razón de sus funciones o de sus relaciones con ella, lo que no obsta para denunciar delitos comunes o violaciones del contrato de trabajo o de las normas legales de trabajo ante las autoridades competentes. DÉCIMA SEGUNDA. DECLARACIONES: Autorización Tratamiento Datos Personales “Ley de Protección de Datos 1581 de 2012 – decreto 1733 de 2013” Declaro que he sido informado que conozco y acepto la Política de Uso de Datos Personales e Información del EMPLEADOR, y que la información proporcionada es veraz, completa, exacta, actualizada y verificable. Mediante la firma del presente documento, manifiesto que conoce y acepto que cualquier consulta o reclamación relacionada con el Tratamiento de sus datos personales podrá ser elevada por escrito ante el EMPLEADOR; (¡) Que la Empresa APOYO LABORAL TS S.A.S con NIT. 900.814.586-1, con domicilio principal en la Calle 7 No. 7– 49 de Madrid, para efectos de lo dispuesto en la ley Estatutaria 1581 de 2012, el Decreto 1733 de 2013, y demás normas que lo adicionen o modifiquen relativas a la Protección de Datos Personales, es responsable del tratamiento de los datos PERSONALES QUE LE HE SUMINISTRADO. (¡¡).Que, para el ejercicio de mis derechos relacionados con mis datos personales, el EMPLEADOR ha puesto a mi disposición la línea de atención: Afiliados marcando a Bogotá 6017444002; a través del correo electrónico protecciondedatos@tsservicios.co; las oficinas del EMPLEADOR a nivel nacional o en la Carrera 112ª # 18ª 05 de Bogotá. En todo caso, he sido informado que sólo podré elevar queja por infracciones a lo dispuesto en las normas sobre Protección de Datos ante la Superintendencia de Industria y Comercio una vez haya agotado el trámite ante el EMPLEADOR o sus encargados. Conozco que la normatividad de Protección de Datos Personales tiene por objeto el desarrollo del derecho constitucional de todas las personas a conocer, actualizar y rectificar de forma gratuita la información que se recaude sobre ellas en bases de datos o archivos, y los derechos, libertades y garantías a los que se refieren el artículo 15 y 20 de la Constitución Política de Colombia. Autorizo también, de manera expresa, el envío de mensajes a través de cualquier medio que he registrado a mi EMPLEADOR el día de la contratación, para remitir comunicados internos sobre información concerniente a Seguridad Social, así como también, la notificaciones sobre licencias, permisos, cartas laborales, cesantías, citaciones, memorandos, y todos aquellos procesos internos que conlleven a la comunicación entre el EMPLEADOR y el EMPLEADO. (iii) Notificación sobre desprendibles de pagos de Nómina y/o liquidación final. En adición y complemento de las autorizaciones previamente otorgadas, autorizo de manera expresa y previa sin lugar a pagos ni retribuciones al EMPLEADOR, a sus sucesores, cesionarios a cualquier título o a quien represente los derechos, para que efectúe el Tratamiento de mis Datos Personales de la  manera y para las finalidades que se señalan a continuación. Para efectos de la presente autorización, se entiende por “Datos Personales” la información personal que suministre por cualquier medio, incluyendo, pero sin limitarse a, aquella de carácter financiero, crediticio, ';
    y = this.renderJustifiedText(doc, texto2, x, y, maxWidth, lineHeight);

    doc.setFontSize(7);
    // Añadir otra pagina
    doc.addPage();
    y = 5; // Posición vertical al inicio de la página
    // **Cuadro para el logo y NIT**
    doc.setLineWidth(0.1);
    doc.rect(startX, startY, 50, 13); // Cuadro del logo y NIT

    // Agregar logo
    doc.addImage(logoPath, 'PNG', startX + 2, startY + 1.5, 27, 10);

    // Agregar NIT
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("NIT", startX + 32, startY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(nit, startX + 32, startY + 10);

    // **Tabla al lado del logo**
    tableStartX = startX + 50; // Inicio de la tabla al lado del cuadro
    doc.rect(tableStartX, startY, tableWidth - 50, 13); // Borde exterior de la tabla

    // Encabezados
    doc.setFont('helvetica', 'bold');
    doc.text("PROCESO DE CONTRATACIÓN", tableStartX + 55, startY + 3);
    doc.text(this.codigoContratacion, tableStartX + 130, startY + 3);
    doc.text("CONTRATO DE TRABAJO POR OBRA O LABOR", tableStartX + 43, startY + 7);

    // Líneas divisoras
    col1 = tableStartX + 30;
    col2 = tableStartX + 50;
    col3 = tableStartX + 110;

    doc.line(tableStartX, startY + 4, tableStartX + tableWidth - 50, startY + 4); // Línea horizontal bajo el título
    doc.line(tableStartX, startY + 8, tableStartX + tableWidth - 50, startY + 8); // Línea horizontal bajo el título
    doc.line(col1, startY + 8, col1, startY + 13); // Línea vertical 1
    doc.line(col2, startY + 8, col2, startY + 13); // Línea vertical 2
    doc.line(col3, startY + 8, col3, startY + 13); // Línea vertical 3

    // **Contenido de las columnas**
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("Código: AL CO-RE-1", tableStartX + 2, startY + 11.5);
    doc.text("Versión: 07", col1 + 2, startY + 11.5); // Ajustar dentro de columna
    doc.text(`Fecha Emisión: Enero 06-21`, col2 + 5, startY + 11.5);
    doc.text("Página: 2 de 3", col3 + 6, startY + 11.5); // Ajustar dentro de columna

    // texto adicional
    y = columnStartY; // Posición inicial Y
    doc.setFontSize(6.5);
    let texto3 = 'comercial, profesional, sensible (tales como mis huellas, imagen, voz, entre otros), técnico y administrativo, privada, semiprivada o de cualquier naturaleza pasada, presente o futura, contenida en cualquier medio físico, digital o electrónico, entre otros y sin limitarse a documentos, fotos, memorias USB, grabaciones, datos biométricos, correos electrónicos y video grabaciones. Así mismo, se entiende por “Tratamiento” el recolectar, consultar, recopilar, evaluar, catalogar, clasificar, ordenar, grabar, almacenar, actualizar, modificar, aclarar, reportar, informar, analizar, utilizar, compartir, circular, suministrar, suprimir, procesar, solicitar, verificar, intercambiar, retirar, trasferir, transmitir, o divulgar, y en general, efectuar cualquier operación o conjunto de operaciones sobre mis Datos Personales en medio físicos, digitales, electrónicos, o por cualquier otro medio. La autorización que otorgo por el presente medio para el Tratamiento de mis Datos Personales tendrá las siguientes finalidades: a. Promocionar, comercializar u ofrecer, de manera individual o conjunta productos y/o servicios propios u ofrecidos en alianza comercial, a través de cualquier medio o canal, o para complementar, optimizar o profundizar el portafolio de productos y/o servicios actualmente ofrecidos. Esta autorización para el Tratamiento de mis Datos Personales se hace extensiva a las entidades subordinadas de EL EMPLEADOR, o ante cualquier sociedad en la que éstas tengan participación accionaria directa o indirectamente (en adelante “LAS ENTIDADES AUTORIZADAS”). a. autoriza explícitamente al EMPLEADOR, en forma previa, expresa e informada, para que directamente o a través de sus empleados, asesores, consultores, empresas usuarias, proveedores de servicios de selección, contratación, exámenes ocupacionales, estudios de seguridad, dotación y elementos de protección personal, capacitaciones, cursos, Fondos de empleados, Fondos funerarios, Empresas del Sistema de Seguridad Social: Fondos de Pensiones, EPS, Administradoras de Riesgos Laborales, Cajas de Compensación Familiar, entre otros: 1. A realizar cualquier operación que tenga una finalidad lícita, tales como la recolección, el almacenamiento, el uso, la circulación, supresión, transferencia y  transmisión (el “Tratamiento”) de los datos personales relacionados con su vinculación laboral y con la ejecución, desarrollo y terminación del presente contrato de trabajo, cuya finalidad incluye, pero no se limita, a los procesos verificación de la aptitud física del TRABAJADOR para desempeñar en  forma eficiente  las labores sin impactar negativamente  su salud o la  de terceros, las afiliaciones del TRABAJADOR y sus beneficiarios al Sistema general de seguridad social y parafiscales, la remisión del TRABAJADOR para que realice apertura de cuenta de nómina, archivo y procesamiento de nómina, gestión y archivo de procesos disciplinarios, archivo de documentos soporte de su vinculación contractual, reporte ante autoridades administrativas, laborales, fiscales o judiciales, entre otras, así como el cumplimiento de obligaciones legales o contractuales del EMPLEADOR con terceros, la debida ejecución del Contrato de trabajo, el cumplimiento de las políticas internas del EMPLEADOR, la verificación del cumplimiento de las obligaciones del TRABAJADOR, la administración de sus sistemas de información y comunicaciones, la generación de copias y archivos de seguridad de la información en los equipos proporcionados por EL EMPLEADOR. Además,  la información personal se recibirá y utilizará para efectos de administración del factor humano en temas de capacitación laboral, bienestar social, cumplimiento de normas de seguridad laboral y seguridad social, siendo necesario, en algunos eventos, recibir información sensible sobre estados de salud e información de menores de edad beneficiarios de esquemas de seguridad social, así como la información necesaria para el cumplimiento de obligaciones laborales de orden legal y extralegal. Toda la anterior información se tratará conforme a las exigencias legales en cada caso. 2. EL TRABAJADOR conoce el carácter facultativo de entregar o no al EMPLEADOR sus datos sensibles. 3. EL TRABAJADOR autoriza al responsable del tratamiento de manera expresa a dar tratamiento a los datos sensibles del titular, siendo esto datos los siguientes: origen racial o étnico, orientación sexual, filiación política o religiosa, datos referentes a la salud, datos biométricos, actividad en organizaciones sindicales o de derechos humanos, 4.EL TRABAJADOR da autorización expresa al responsable del tratamiento para que capture y use la información personal y sensible de sus hijos menores de edad. b.  Como elemento de análisis en etapas pre-contractuales, contractuales, y post-contractuales para establecer y/o mantener cualquier relación contractual, incluyendo como parte de ello, los siguientes propósitos: (i). Actualizar bases de datos y tramitar la apertura y/o servicios en EL EMPLEADOR o en cualquiera de las ENTIDADES AUTORIZADAS, (ii). Evaluar riesgos derivados de la relación contractual potencial, vigente o concluida. (iii). Realizar, validar,   autorizar o verificar transacciones incluyendo, cuando sea requerido, la consulta y reproducción de datos sensibles tales como la huella, imagen o la voz. (iv). Obtener conocimiento del perfil comercial o transaccional del titular, el nacimiento, modificación, celebración y/ o extinción de obligaciones directas, contingentes o indirectas, el incumplimiento de las obligaciones que adquiera con EL EMPLEADOR  o con cualquier tercero, así como cualquier novedad en relación con tales obligaciones, hábitos de pago y comportamiento  crediticio con EL EMPLEADOR y/o terceros. (v). Conocer información acerca de mi manejo de cuentas corrientes, ahorros, depósitos, tarjetas de crédito, comportamiento comercial, laboral y demás productos o servicios y, en general, del cumplimiento y manejo de mis créditos y obligaciones, cualquiera que sea su naturaleza. Esta autorización comprende información referente al manejo, estado, cumplimiento de las relaciones, contratos y servicios, hábitos de pago, incluyendo aportes al sistema de seguridad social, obligaciones y las deudas vigentes, vencidas sin cancelar, procesos, o la utilización indebida de servicios financieros. (vi). Dar cumplimiento a sus obligaciones legales y contractuales. (vii). Ejercer sus derechos, incluyendo los referentes a actividades de cobranza judicial y extrajudicial y las gestiones conexas para obtener el pago de las obligaciones a cargo del titular o de su empleador, si es el caso. (viii). Implementación de software y servicios tecnológicos. Para efectos de lo dispuesto en el presente literal b, EL EMPLEADOR  en lo que resulte aplicable, podrá efectuar el Tratamiento de mis Datos Personales  ante entidades de consulta, que manejen o administren bases de datos para los fines legalmente definidos, domiciliadas en Colombia o en el exterior, sean personas naturales o jurídicas, colombianas o extranjeras. c. Realizar ventas cruzadas de productos y/o servicios ofrecidos por EL EMPLEADOR o por cualquiera de LAS ENTIDADES  AUTORIZADAS o sus aliados comerciales, incluyendo la celebración de convenios de marca compartida. d. Elaborar y reportar información estadística, encuestas de satisfacción, estudios y análisis de mercado, incluyendo la posibilidad de contactarme para dichos propósitos. e. Enviar mensajes, notificaciones o alertas a través de cualquier medio para remitir extractos, divulgar información legal, de seguridad, promociones, campañas comerciales, publicitarias, de mercadeo, institucionales o de educación financiera, sorteos, eventos u otros beneficios e informar al titular acerca de las innovaciones efectuadas en sus productos y/o servicios, dar a conocer las mejoras o cambios en sus canales de atención, así como dar a conocer otros servicios y/o productos ofrecidos por EL EMPLEADOR;  LAS ENTIDADES AUTORIZADAS o sus aliados comerciales. f.  Llevar  a  cabo  las  gestiones  pertinentes,  incluyendo  la  recolección  y  entrega  de  información ante autoridades públicas o privadas, nacionales o extranjeras con competencia sobre EL EMPLEADOR, LAS ENTIDADES  AUTORIZADAS o sobre sus actividades, productos y /o servicios, cuando se requiera para dar cumplimiento a sus deberes legales o reglamentarios, incluyendo dentro de estos, aquellos referentes a la prevención de la evasión fiscal, lavado de activos y financiación del terrorismo u otros propósitos similares emitidas por autoridades competentes,  g. validar información con las diferentes bases de datos de EL EMPLEADOR, de LAS ENTIDADES AUTORIZADAS, de autoridades y/o entidades estatales y de terceros tales como  operadores de información y demás entidades que formen parte del Sistema de Seguridad Social Integral, empresas prestadoras de servicios públicos  y de telefonía móvil, entre otras, para desarrollar las actividades propias de objeto social principal y conexo y/o cumplir con obligaciones legales. h. Para que mis datos Personales puedan ser utilizados como medio de prueba. Los Datos Personales suministrados podrán circular y transferirse a la totalidad de las áreas de EL EMPLEADOR incluyendo proveedores de servicios, usuarios de red, redes de distribución y personas que realicen la promoción de sus productos y servicios, incluidos call centers, domiciliados en Colombia o en el exterior, sean personas naturales o jurídicas, colombianas o extranjeros a su fuerza comercial, equipos de telemercadeo y/o procesadores de datos que trabajen en nombre de EL EMPLEADOR, incluyendo pero sin limitarse, contratistas, delegados, outsourcing, tercerización, red de oficinas o aliados, con el objeto de desarrollar servicios de alojamiento de sistemas, de mantenimiento, servicios de análisis, servicios de mensajería por e-mail o correo físico, servicios de entrega, gestión de transacciones de pago, cobranza, entre otros. En consecuencia, el titular entiendepara  gastos  o  viajes,  así  como  el  valor de los tiquetes aéreos no devueltos; las sumas que llegaren a faltar en cumplimiento de mis funciones y a mi cargo previa liquidación y verificación de las mismas, Compra de Flor y/o servicio de alimentación suministrado a través de la Empresa Usuaria de manera quincenal y por el monto de  y acepta que mediante la presentación autorización concede a estos terceros, autorización para acceder a sus Datos Personales en la medida en que así lo requieren  para la prestación de los servicios para los cuales fueron contratados y sujeto al cumplimiento de los deberes que les correspondan como encargados del Tratamiento de mis Datos Personales. Igualmente, a EL EMPLEADOR para compartir mis datos Personales con las entidades gremiales a las que pertenezca la entidad, para fines comerciales, estadísticos y de estudio y análisis de mercadeo. Es entendido que las personas naturales y jurídicas, nacionales y extranjeras mencionadas anteriormente ante las cuales EL EMPLEADOR puede llevar a cabo el Tratamiento de mis Datos Personales, también cuentan con mi autorización para permitir dicho Tratamiento. Adicionalmente, mediante el otorgamiento de la presente autorización, manifiesto: (i) que los Datos Personales suministrados son veraces, verificables y completos, (ii) que conozco y entiendo que el suministro de la presente autorización es voluntaria, razón por la cual no me encuentro obligado a otorgar la presenta autorización, (iii) que conozco y entiendo que mediante la simple presentación de una comunicación escrita puedo limitar en todo o en parte el alcance de la presente autorización  para que, entre otros, la misma se otorgue únicamente frente a EL EMPLEADOR pero no frente a LAS ENTIDADES AUTORIZADAS y (iv) haber sido informado  sobre mis derechos a conocer, actualizar y rectificar mis Datos Personales, el carácter facultativo de mis respuestas a las preguntas que sean hechas cuando versen sobre datos sensibles o sobre datos de los niños, niñas o adolescentes, solicitar prueba de la autorización otorgada para su tratamiento, ser informado sobre el uso que se ha dado a los mismo, presentar quejas ante la autoridad competente por infracción a la ley una vez haya agotado el trámite de consulta o reclamo ante EL EMPLEADOR, revocar la presentación autorización, solicitar la supresión de sus datos en los casos en que sea procedente y ejercer en forma gratuita mis derechos y garantías constitucionales y legales. EL EMPLEADOR informa que el tratamiento de sus Datos Personales se efectuará de acuerdo con la Política de la entidad en esta materia, la cual puede ser consultada en sus instalaciones. DÉCIMA  TERCERA. AUTORIZACIÓN DE DESCUENTOS: El TRABAJADOR autoriza expresamente al EMPLEADOR para que se descuenten de mi salario y  prestaciones o cualquier otro concepto las sumas que por error  haya recibido, permitiendo que el EMPLEADOR compense del valor de los salarios, prestaciones legales o extralegales, indemnizaciones y otro tipo de dinero a pagar al momento de la Nómina y/o liquidación las sumas que yo como TRABAJADOR esté  debiendo al EMPLEADOR Y EMPRESA USUARIA por los siguientes conceptos: Préstamos debidamente autorizados por escrito; valor de los elementos de trabajo y mercancías extraviadas bajo mi responsabilidad y que llegaren a faltar al momento de hacer entrega del inventario; los valores que se me hubieren confiado para mi manejo y que hayan sido dispuestos abusivamente para otros propósitos en perjuicio del EMPLEADOR; los anticipos o sumas no legalizadas con las facturas o comprobantes requeridos que me fueron entregadas alimentación establecido, todo lo que exceda de valores aprobados (Celulares, Tarjetas de Crédito, etc.), modificaciones en las Bases de Datos sin el soporte correspondiente, errores de digitación y procedimientos internos que por mi culpa afecten económicamente a la empresa y cualquier pago que me haya sido realizado y que no me corresponda.  De  igual  forma,  en  caso  de  recibir  Subsidio  de Transporte y  Bonificaciones,  autorizo  la deducción  cuando se  causen ausencias al trabajo por cualquier motivo en el mes por el cual recibí pago completo. Por lo anterior, autorizo expresamente al EMPLEADOR para que retenga y cobre de mi salario y liquidación final, de cualquier otro concepto a mi favor, ';
    y = this.renderJustifiedText(doc, texto3, x, y, maxWidth, lineHeight);

    // agregar pagina
    doc.addPage();

    y = 5; // Posición vertical al inicio de la página
    doc.setFontSize(7);
    // **Cuadro para el logo y NIT**
    doc.setLineWidth(0.1);
    doc.rect(startX, startY, 50, 13); // Cuadro del logo y NIT

    // Agregar logo
    doc.addImage(logoPath, 'PNG', startX + 2, startY + 1.5, 27, 10);

    // Agregar NIT
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("NIT", startX + 32, startY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(nit, startX + 32, startY + 10);

    // **Tabla al lado del logo**
    tableStartX = startX + 50; // Inicio de la tabla al lado del cuadro
    doc.rect(tableStartX, startY, tableWidth - 50, 13); // Borde exterior de la tabla

    // Encabezados
    doc.setFont('helvetica', 'bold');
    doc.text("PROCESO DE CONTRATACIÓN", tableStartX + 55, startY + 3);
    doc.text(this.codigoContratacion, tableStartX + 130, startY + 3);
    doc.text("CONTRATO DE TRABAJO POR OBRA O LABOR", tableStartX + 43, startY + 7);

    // Líneas divisoras
    col1 = tableStartX + 30;
    col2 = tableStartX + 50;
    col3 = tableStartX + 110;

    doc.line(tableStartX, startY + 4, tableStartX + tableWidth - 50, startY + 4); // Línea horizontal bajo el título
    doc.line(tableStartX, startY + 8, tableStartX + tableWidth - 50, startY + 8); // Línea horizontal bajo el título
    doc.line(col1, startY + 8, col1, startY + 13); // Línea vertical 1
    doc.line(col2, startY + 8, col2, startY + 13); // Línea vertical 2
    doc.line(col3, startY + 8, col3, startY + 13); // Línea vertical 3

    // **Contenido de las columnas**
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("Código: AL CO-RE-1", tableStartX + 2, startY + 11.5);
    doc.text("Versión: 07", col1 + 2, startY + 11.5); // Ajustar dentro de columna
    doc.text(`Fecha Emisión: Enero 06-21`, col2 + 5, startY + 11.5);
    doc.text("Página: 3 de 3", col3 + 6, startY + 11.5); // Ajustar dentro de columna

    y = columnStartY; // Posición inicial Y
    doc.setFontSize(6.5);
    let texto4 = 'de mis Cesantías consignadas en el fondo de Cesantías los saldos que esté adeudando por los conceptos anteriormente citados.  DÉCIMA CUARTA. Las prestaciones sociales se liquidarán y pagaran una vez el TRABAJADOR haya diligenciado el Paz y Salvo en la compañía donde labore en misión y se pagarán en las fechas estipuladas según la  ley.  DÉCIMA QUINTA. AUTORIZACIÓN CONSIGNACION DE PAGO DE LIQUIDACIÓN FINAL O DEFINITIVA, A través del presente documento y en pleno uso de mis facultades legales e intelectuales, doy la autorización a mi EMPLEADOR,  para que me consigne el valor que corresponda a mi liquidación final o definitiva en la misma forma de pago asignada para mi Nómina, dentro de las fechas establecidas y otorgadas por la empresa; De igual manera autoriza al EMPLEADOR, en el evento en que se niegue o no sea posible recibirla directamente, para que deposite en la mencionada cuenta el monto de su liquidación final de contrato de trabajo. Autorizo también, para que me sea notificado mediante correo electrónico, mensaje de texto, whatsapp o cualquier medio registrado, el desprendible de mi liquidación definitiva con la descripción del pago y todos los documentos correspondientes a mi desvinculación laboral. DÉCIMA SEXTA. CONSENTIMIENTO INFORMADO. Exámenes toxicológicos: manifiesto que conozco la política de prevención de consumo de alcohol, y otras sustancias psicoactivas de la Empresa Usuaria, así como también la Política de la Empresa  de Servicios Temporales APOYO LABORAL TS S.A.S., (en adelante E.S.T.) Por lo tanto, sé que no debo presentarme en sus instalaciones a ejecutar las actividades para las cuales fui contratado en calidad de trabajador en misión por la E.S.T. bajo los efectos de alguna de estas sustancias o en su defecto, consumirlas durante el tiempo que dure mi permanencia ya que pongo en riesgo mi salud, mi seguridad y la de las personas que se encuentren presentes en las instalaciones. Por lo anterior, autorizo para que se me practiquen cuestionarios y/o pruebas (incluso médicas y de laboratorio), de manera preventiva, aleatoria o por confirmación, toda vez que ya me encuentre laborando dentro de las instalaciones de la empresa,  con el objeto de determinar mi aptitud física y mental para llevar a cabo las actividades contratadas, en virtud de la investigación disciplinaria que realice la Empresa y que lo amerite, o en cualquier momento cuando así lo estime pertinente la Compañía, y que los podrá utilizar como pruebas para los mismos fines. Dichas pruebas y exámenes podrán incluir las relativas al consumo de alcohol y sustancias psicoactivas, las cuales se practicarán con la metodología que la empresa usuaria establezca. En el evento en que alguna de las pruebas tenga resultado “positivo” para consumo o en caso de comprobarse el incumplimiento de las obligaciones a mi cargo en relación con esta política, la empresa usuaria informará de dicha situación a la E.S.T. a la cual me encuentro vinculado, quien es mi verdadero empleador y de manera adicional, podrá solicitar mi retiro de sus instalaciones. Autorizo que la empresa usuaria, conserve el documento que contiene los resultados, siempre y cuando lo haga con la debida reserva. La decisión que aquí manifiesto la he tomado de manera autónoma  , libre  y  voluntaria  y  por  tanto, no considero que las mencionadas pruebas y las atribuciones que aquí acepto para la empresa constituyan injerencias indebidas e inconsultas sobre mis derechos a la intimidad y al libre desarrollo de mi personalidad. DÉCIMA SEPTIMA. ENTREGA Y ACEPTACIÓN DEL CARGO Y  FUNCIONES ASIGNADAS. En   forma   atenta   le   informamos   que   en   el   ejercicio   de   su   cargo  asignado para la  Empresa Usuaria donde ingresa como trabajador en misión,  usted desarrollará  algunas de las siguientes funciones según su cargo: * Operario de Cultivo y/o Oficios Varios: Labores de Cultivo que incluyen Corte de Flor, Limpieza de Camas y Plantas, Labores Culturales, Riego, Fumigación (1),  Monitoreo, Pesaje de Productos, Transporte de Flor, Control y Calidad, erradicaciones, Enmalle, Desbotone y todas las labores de Mantenimiento de los Cultivos. *Operario de Poscosecha y/o Oficios Varios: Labores de Poscosecha como Clasificación, Boncheo, Encapuchado, Empaque, Recepción, Manejo de inventarios, Cuarto frío,  Control y Calidad y/ oficios varios. *Operario Mantenimiento: Labores de Mantenimiento, Poda de Prado, Manejo de Maquinaria Agrícola, Electricista, Electromecánico, Soldador, Maestro de Construcción, Ayudante de Construcción, Mantenimiento de Cubiertas Plásticas e Infraestructura y Redes (2) *Labores de Conducción, Auxiliar de Conducción, Logística e Inventarios y/ Oficios Varios*Apoyo/Reemplazos Administrativos: Asistente de Producción, Asistente de Poscosecha, Asistente de Gestión Humana,  Comerciales y/ Oficios Varios*Todas las demás labores asignadas por la Empresa Usuaria y que contemple el cargo para el cuál fue contratado. Igualmente, le indicamos que el incumplimiento a las funciones antes relacionadas, será calificado como falta grave y por tanto como justa causa para la finalización del contrato de trabajo, de conformidad con lo previsto en el artículo 7) literal a) numeral 6) del Decreto 2351 de 1965, norma que subrogó el artículo 62 del código Sustantivo de Trabajo,  en concordancia con lo previsto el numeral 1° del artículo 58 del mismo Estatuto. PARÁGRAFO PRIMERO. El TRABAJADOR, deberá responder por todos y cada uno de los elementos de trabajo que le entregue EL EMPLEADOR y/o la EMPRESA USUARIA para el desempeño de su cargo. DÉCIMA OCTAVA. El TRABAJADOR, debe registrar en las oficinas del EMPLEADOR, su dirección, número de teléfono y domicilio y dar aviso inmediato en cualquier cambio que ocurra. DÉCIMA NOVENA. El TRABAJADOR, debe respetar y someterse al Reglamento de Trabajo vigente de ambas empresas en todas sus partes, cuyo texto manifiesta conocer en todas sus partes. VIGÉSIMA. EL TRABAJADOR acepta, entiende y conoce que EL EMPLEADOR, tiene la obligación legal de prevenir y controlar el lavado de activos y la financiación del terrorismo, por tanto, expresa de manera voluntaria e inequívoca, que no se encuentra vinculado  ni ha sido condenado por parte de las autoridades nacionales e internacionales en cualquier tipo de investigación por delitos de narcotráfico, terrorismo, secuestro, lavado de activos, financiación del terrorismo y administración de recursos relacionados con actividades terroristas  y/o cualquier delito colateral o subyacente a estos; ni se encuentra incluido en listas para el control de lavado de activos  y financiación del terrorismo, administradas por cualquier autoridad nacional o extranjera. Convienen las partes, conforme a lo establecido en el numeral 6º del artículo séptimo del decreto 2351 de 1.965, que la inexactitud en la manifestación del EL TRABAJADOR contenida en la presente adición al contrato de trabajo, constituye falta grave y dará lugar a la terminación del contrato de trabajo por justa causa de despido. VIGÉSIMA PRIMERA. INCAPACIDADES MÉDICAS: Si EL TRABAJADOR, por causa de enfermedad o accidente, no asistiere a su trabajo, deberá presentar a EL EMPLEADOR, a la mayor brevedad, la respectiva incapacidad, a cuyo efecto se establece que exclusivamente será válida la expedida por los médicos de la respectiva Entidad Promotora de Salud, para justificar las ausencias antedichas. VIGÉSIMA SEGUNDA. AUTORIZACIÓN DE ACCESO A HISTÓRIA CLÍNICA: De acuerdo con lo establecido en el artículo 34 de la Ley 23 de 1981 y la Resolución 1995 de 1999 expedida por el Ministerio de Salud, EL TRABAJADOR autoriza expresamente a EL EMPLEADOR para que tenga acceso y copia de su historia clínica, así como de todos aquellos datos que en aquélla se registren o lleguen a ser registrados, con el fin de adelantar todos los trámites que sean necesarios ante entidades como Empresas Promotoras de Salud (EPS),  Administradoras de Riesgos laborales (ARL), Administradoras de Fondos de Pensiones (AFP), Instituciones Prestadoras de Salud (IPS), médicos particulares y demás entidades de la Seguridad Social. VIGÉSIMA TERCERA. REGLAMENTO DE TRABAJO Y DE HIGIENE Y SEGURIDAD INDUSTRIAL. El TRABAJADOR deja constancia de que conoce y acepta el Reglamento de Trabajo y el Reglamento de Higiene y Seguridad Industrial del TRABAJADOR. VIGÉSIMA CUARTA. El TRABAJADOR ha leído, entiende y acepta de manera íntegra todo el contenido del presente contrato y manifiesta bajo la gravedad de juramento, que no sufre de problemas de alcoholismo, drogadicción, enfermedad infectocontagiosa, ni consumidor habitual de sustancias alucinógenas, ni drogas enervantes.  PARÁGRADO PRIMERO. Las partes declaran que no reconocerán validas las estipulaciones anteriores a este contrato de trabajo, que este es el único vigente entre ellas reempazando y que desconocen cualquier otro verbal o escrito anterior, el cual tendrá vigencia a partir de la FECHA DE INICIACION, y para lo cual el TRABAJADOR inicia su vinculación laboral con el EMPLEADOR.; pudiendo las partes convenir por escrito modificaciones al mismo, las que formarán parte integrante de este contrato. El presente contrato se ANULARÁ si el TRABAJADOR no se presenta a laborar el día que corresponde o si la EMPRESA USUARIA desiste de la Contratación. Previa la declaración de que a él se tienen incorporadas todas las disposiciones del reglamento interno que rige en la EMPRESA EMPLEADORA. El TRABAJADOR deja expresa constancia de que al suscribir el presente contrato recibió copia del mismo'
    y = this.renderJustifiedText(doc, texto4, x, y, maxWidth, lineHeight);


    // Numerales (1) y (2) con notas al pie
    y += lineHeight; // Añadir espacio
    doc.setFont('helvetica', 'bold');
    doc.text('(1)', 5, y + lineHeight);
    doc.text('(2)', 5, y + lineHeight * 2);
    doc.setFont('helvetica', 'normal');
    doc.text('Las labores de Fumigación sólo aplican para el personal masculino mayor de edad. ', 10, y + lineHeight);
    doc.text('Estas labores se realizarán previa aprobación de requisitos del S.G.-S.S.T. de la Empresa Usuaria.', 10, y + lineHeight * 2);

    // Para constancia se firma ante testigos el día _____________________________En el Municipio de Madrid
    y += 15; // Añadir espacio
    let dia = new Date().getDate().toString().padStart(2, '0'); // Añadir 0 si es necesario
    doc.setFont('helvetica', 'bold');
    doc.text('Para constancia se firma ante testigos el día ' + dia + ' En el Municipio de ' + this.sede, 5, y);

    // Firma
    const firmaPath = 'firma/FirmaMayra.png';
    doc.addImage(firmaPath, 'PNG', 5, y + 10, 20, 20);
    doc.setFont('helvetica', 'bold');
    // El Empleador
    doc.text('EL EMPLEADOR', 5, y + 35);
    // MAYRA HUAMANÍ L.
    doc.text('MAYRA HUAMANÍ L.', 5, y + 38);
    doc.text('C.E. 332318', 5, y + 41);
    doc.setFont('helvetica', 'normal');
    // linea de firma larga
    doc.setLineWidth(0.1);
    doc.line(40, y + 20, 200, y + 20);
    // Firma del trabajador
    doc.text('Firma del trabajador', 41, y + 23);
    doc.text(this.cedula, 110, y + 18);
    doc.text('Número de Identificación del Trabajador', 110, y + 23);
    if (this.firma !== '') {
      // Asegúrate de que this.firma solo sea el base64 sin el 'data:image/png;base64,'
      const firmaConPrefijo = this.firma;

      doc.addImage(firmaConPrefijo, 'PNG', 42, 207, 50, 20);
    } else {
      /*Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró la firma',
      });
      return;*/
    }


    doc.line(40, y + 40, 200, y + 40);
    const firmaAndrea = 'firma/FirmaAndreaS.png';
    doc.addImage(firmaAndrea, 'PNG', 82, y + 22, 18, 18);
    doc.setFont('helvetica', 'bold');
    doc.text('Testigo 1 Nombre y No de CC', 41, y + 43);
    doc.text('Andrea Sotelo', 80, y + 43);
    doc.text('C.C. 1.019.034.641', 80, y + 46);

    // Testigo 2
    doc.text('Testigo 2 Nombre y No de CC', 110, y + 43);
    doc.text(this.nombreCompletoLogin, 150, y + 43);
    doc.text('C.C.' + this.user.numero_de_documento, 150, y + 46);

    if (this.firmaPersonalAdministrativo !== '') {
      // Asegúrate de que this.firmaPersonalAdministrativo solo sea el base64 sin el 'data:image/png;base64,'
      const firmaPersonalAdministrativoConPrefijo = this.firmaPersonalAdministrativo;
      doc.addImage(firmaPersonalAdministrativoConPrefijo, 'PNG', 150, 230, 48, 15);
    }

    // Convertir a Blob y guardar en uploadedFiles
    const pdfBlob = doc.output('blob');
    const fileName = `${this.empresa}_Contrato.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    this.uploadedFiles['Contrato'] = { file: pdfFile, fileName };

    this.verPDF({ titulo: 'Contrato' });
  }


  // Generar contrato de trabajo
  async generarContratoTrabajoTuAlianza() {
    const respContratacion: any = await firstValueFrom(
      this.contratacionService.buscarEncontratacion(this.cedula).pipe(
        take(1),
        catchError((err) => {
          console.error('Error buscando contratación:', err);
          return of({ data: [] });
        })
      )
    );

    console.log('Datos de contratación recibidos:', respContratacion);
    const datoContratacion = respContratacion?.data?.[0] ?? {};
    console.log('Dato de contratación para ficha técnica Tu Alianza:', datoContratacion);
    // Determinar la ruta del logo y el NIT
    let logoPath = '';
    let nit = '';
    let domicilio = '';
    let codigo = '';
    let version = '';
    let fechaEmision = '';

    if (this.empresa === 'TU ALIANZA SAS') {
      logoPath = 'logos/Logo_TA.png';
      nit = '900.864.596-1';
      domicilio = 'CLL 7 4 49 Madrid, Cundinamarca';
      codigo = 'TA CO-RE-1';
      version = '06';
      fechaEmision = 'Mayo 02-2022';
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Empresa no reconocida para generar el contrato',
      });
      return;
    }

    // Crear el documento PDF en formato vertical
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    doc.setProperties({
      title: 'Contrato_Trabajo.pdf',
      creator: this.empresa,
      author: this.empresa,
    });


    // Posiciones iniciales
    const startX = 7;
    const startY = 7;
    const tableWidth = 203;

    // **Cuadro para el logo y NIT**
    doc.setLineWidth(0.1);
    doc.rect(startX, startY, 50, 13); // Cuadro del logo y NIT

    // Agregar logo
    doc.addImage(logoPath, 'PNG', startX + 2, startY + 1.5, 27, 10);

    // Agregar NIT
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("NIT", startX + 32, startY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(nit, startX + 32, startY + 10);

    // **Tabla al lado del logo**
    let tableStartX = startX + 50; // Inicio de la tabla al lado del cuadro
    doc.rect(tableStartX, startY, tableWidth - 50, 13); // Borde exterior de la tabla

    // Encabezados
    doc.setFont('helvetica', 'bold');
    doc.text("PROCESO DE CONTRATACIÓN", tableStartX + 55, startY + 3);
    // doc.text(this.codigoContratacion, tableStartX + 130, startY + 3);
    doc.text("CONTRATO DE TRABAJO POR OBRA O LABOR", tableStartX + 43, startY + 7);

    // Líneas divisoras
    let col1 = tableStartX + 30;
    let col2 = tableStartX + 50;
    let col3 = tableStartX + 110;

    doc.line(tableStartX, startY + 4, tableStartX + tableWidth - 50, startY + 4); // Línea horizontal bajo el título
    doc.line(tableStartX, startY + 8, tableStartX + tableWidth - 50, startY + 8); // Línea horizontal bajo el título
    doc.line(col1, startY + 8, col1, startY + 13); // Línea vertical 1
    doc.line(col2, startY + 8, col2, startY + 13); // Línea vertical 2
    doc.line(col3, startY + 8, col3, startY + 13); // Línea vertical 3

    // **Contenido de las columnas**
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("Código: " + codigo, tableStartX + 2, startY + 11.5);
    doc.text("Versión: " + version, col1 + 2, startY + 11.5); // Ajustar dentro de columna
    doc.text(`Fecha Emisión: ${fechaEmision}`, col2 + 5, startY + 11.5);
    doc.text("Página: 1 de 3", col3 + 6, startY + 11.5); // Ajustar dentro de columna

    // Representado por
    doc.setFontSize(7);

    const fechaISO = this.vacante.fechaIngreso; // '2024-12-04T05:00:00.000Z'

    // Convertir la fecha ISO a un objeto Date
    const fecha = new Date(fechaISO);

    // Formatear al formato dd/mm/yyyy
    const fechaFormateada = [
      String(fecha.getDate()).padStart(2, '0'),  // dd
      String(fecha.getMonth() + 1).padStart(2, '0'),  // mm
      fecha.getFullYear()  // yyyy
    ].join('/');
    // helper: primer valor NO vacío (null/undefined/''/'   ' => ignora)
    const pickText = (...vals: any[]) => {
      for (const v of vals) {
        const t = (v ?? '').toString().trim();
        if (t) return t;
      }
      return '';
    };

    // helper: solo fecha (si viene con hora, recorta) y la deja en YYYY-MM-DD
    const onlyDate = (v: any) => {
      const s = pickText(v);
      if (!s) return '';
      return s.split('T')[0].split(' ')[0].trim();
    };

    // ✅ úsalo en tu arreglo
    // =========================================================
    // ✅ Helpers: T = título normal, V = valor en MAYÚSCULAS
    // ✅ + Normaliza textos con letras/dígitos separados: "C A R A" -> "CARA", "3 0 3 4" -> "3034"
    // =========================================================
    // =========================================================
    // ✅ FIX: Domicilio del Trabajador quedaba con letras separadas ("C A R A ...")
    // ✅ Solución: normalizar tokens separados (letras sueltas y números sueltos)
    // =========================================================

    // =========================================================
    // ✅ FIX REAL (2 cosas):
    // 1) Limpia caracteres invisibles (ZWSP, etc.) y une letras/dígitos separados.
    // 2) Resetea charSpacing de jsPDF a 0 antes de pintar texto (si quedó “pegado” de otra parte).
    // =========================================================

    // =========================================================
    // ✅ FIX DEFINITIVO:
    // 1) Normaliza el texto (quita invisibles/espacios raros, une letras/dígitos sueltos).
    // 2) Fuerza charSpace: 0 EN CADA doc.text() (no depende del estado global).
    //    (jsPDF soporta options.charSpace en doc.text) :contentReference[oaicite:1]{index=1}
    // =========================================================

    // ✅ Helpers: T = título normal, V = valor en MAYÚSCULAS (normalizado)
    const T = (v: any) => String(v ?? '').trim();

    const normalizeText = (v: any): string => {
      let s = String(v ?? '');

      // Normaliza unicode (por si vienen combinaciones raras)
      if (typeof (s as any).normalize === 'function') {
        s = s.normalize('NFKD');
      }

      // Elimina invisibles típicos (ZWSP/ZWNJ/ZWJ/BOM/WJ/soft-hyphen, etc.)
      s = s.replace(/[\u200B-\u200D\uFEFF\u2060-\u2064\u00AD]/g, '');

      // Quita marcas combinantes (tildes “separadas”)
      // (si no soporta \p{M}, cae sin problema porque la mayoría no trae esto)
      try {
        s = s.replace(/\p{M}+/gu, '');
      } catch {
        // fallback: rango común de diacríticos combinantes
        s = s.replace(/[\u0300-\u036F]+/g, '');
      }

      // Espacios raros -> espacio normal
      s = s.replace(/[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

      // Colapsa whitespace
      s = s.replace(/\s+/g, ' ').trim();
      if (!s) return '';

      const tokens = s.split(' ');
      const out: string[] = [];

      let buf = '';
      let kind: 'L' | 'D' | null = null;

      const flush = () => {
        if (buf) out.push(buf);
        buf = '';
        kind = null;
      };

      const isSingleLetter = (t: string) => {
        // unicode letter si está disponible
        try { return /^\p{L}$/u.test(t); } catch { return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]$/.test(t); }
      };

      for (const t of tokens) {
        if (!t) continue;

        if (isSingleLetter(t)) {
          if (kind && kind !== 'L') flush();
          kind = 'L';
          buf += t;
          continue;
        }

        if (/^\d$/.test(t)) {
          if (kind && kind !== 'D') flush();
          kind = 'D';
          buf += t;
          continue;
        }

        flush();
        out.push(t);
      }

      flush();
      return out.join(' ');
    };

    const V = (v: any) => normalizeText(v).toUpperCase();

    const datos = [
      { titulo: T('Representado por'), valor: V('HEIDY JACKELINE TORRES SOTELO') },

      {
        titulo: T('Nombre del Trabajador'),
        valor: V([
          this.candidato?.primer_apellido,
          this.candidato?.segundo_apellido,
          this.candidato?.primer_nombre,
          this.candidato?.segundo_nombre,
        ].filter(x => String(x ?? '').trim()).join(' '))
      },

      {
        titulo: T('Fecha de Nacimiento'),
        valor: V(onlyDate(pickText(this.candidato?.fecha_nacimiento, datoContratacion?.fecha_nacimiento)))
      },

      {
        titulo: T('Domicilio del Trabajador'),
        valor: V(
          [
            (this.candidato?.residencia?.direccion ?? datoContratacion.direccion_residencia),
            this.candidato?.residencia?.barrio,
            datoContratacion.municipio
          ]
            .filter(x => String(x ?? '').trim())
            .join(' - ')
        )
      },

      { titulo: T('Fecha de Iniciación'), valor: V(this.candidato?.entrevistas?.[0]?.proceso?.contrato?.fecha_ingreso ?? '') },

      {
        titulo: T('Salario Mensual Ordinario'),
        valor: V('S.M.M.L.V $ 1.750.905 UN MILLÓN SETECIENTOS CINCUENTA MIL NOVECIENTOS CINCO PESOS M/C')
      },

      { titulo: T('Periódo de Pago Salario'), valor: V('Quincenal') },

      { titulo: T('Subsidio de Transporte'), valor: V('SE PAGA EL LEGAL VIGENTE O SE SUMINISTRA EL TRANSPORTE') },

      { titulo: T('Forma de Pago'), valor: V('Banca Móvil, Cuenta de Ahorro o Tarjeta Monedero') },

      { titulo: T('Nombre Empresa Usuria'), valor: V(this.vacante?.empresaUsuariaSolicita) },

      { titulo: T('Cargo'), valor: V(this.vacante?.cargo) },

      { titulo: T('Descripción de la Obra/Motivo Temporada '), valor: V(this.vacante?.descripcion) },

      { titulo: T('Domicilio del patrono'), valor: V(domicilio) },

      { titulo: T('Tipo y No de Identificación'), valor: V(`${this.candidato?.tipo_doc ?? ''}        ${this.cedula ?? ''}`) },

      { titulo: T('Email'), valor: V(pickText(this.candidato?.contacto?.email, datoContratacion?.primercorreoelectronico)) },
    ];

    // =========================================================
    // Render en PDF (FORZANDO charSpace = 0 en CADA texto)
    // =========================================================
    const columnWidth = 110;
    const rowSpacing = 3;
    const columnMargin = 10;
    const columnStartX = 7;
    const columnStartY = startY + 17;
    const rowsPerColumn = 15;

    datos.forEach((item, index) => {
      const currentColumn = Math.floor(index / rowsPerColumn);
      const rowInColumn = index % rowsPerColumn;

      const x = columnStartX + currentColumn * (columnWidth + columnMargin);
      const y = (columnStartY + rowInColumn * rowSpacing) + 3;

      // (opcional) también resetea estado global
      if (typeof (doc as any).setCharSpace === 'function') {
        (doc as any).setCharSpace(0);
      }

      // ✅ Título normal (charSpace forzado a 0)
      doc.setFont('helvetica', 'normal');
      (doc as any).text(`${item.titulo}:`, x, y, { charSpace: 0 });

      // ✅ Valor negrita (charSpace forzado a 0)
      doc.setFont('helvetica', 'bold');
      const valueText = String(item.valor ?? '').trim();

      if (index > 14) {
        (doc as any).text(valueText, x + 30.2, y, { charSpace: 0 });
      } else {
        (doc as any).text(valueText, x + 48, y, { charSpace: 0 });
      }
    });



    // Restaurar la fuente a la normal después del bucle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    let y = columnStartY + rowsPerColumn * rowSpacing + 2; // Posición vertical después de los datos
    // Texto adicional
    let texto = 'Entre  el  EMPLEADOR  y  el   TRABAJADOR  arriba indicados,  se  ha celebrado el contrato  regulado  por  las cláusulas  que  adelante  se  indican,  aparte  de  la  ley,  siendo  ellas las  siguientes:  PRIMERA.  El Trabajador,  a  partir  de  la  fecha  de  iniciación,  se  obliga  para  con  e l  EMPLEADOR   a ejecutar  la  obra arriba  indicada  sometiéndose  durante  su realización  en  todo  a  las  órdenes  de  éste. Declara  por  consiguiente e l TRABAJADOR completa y total  disponibilidad para con  el  EMPLEADOR   para  ejecutar  las  obras  indicadas  en  el  encabezamiento,  siempre  que así  le  sean  exigidas  por  sus clientes  al   EMPLEADOR,   sin  que  por  ello  se  opere  desmejora  o  modificación  sustancial  de las  condiciones de trabajo tenidas  en  cuenta en  el  momento  de  la  suscripción  de  este  contrato.   SEGUNDA.   DURACIÓN DEL CONTRATO:   La necesaria  para  la  realización de la obra o labor contratada  y  conforme  a  las  necesidades  del  patrono  o  establecimiento  que  requiera  la  ejecución  de  la  obra,  todo  conforme a lo previsto en el Art. 45 del CST y teniendo en cuenta  la  fecha  de  iniciación  de  la  obra;  y  la  índole  de  la  misma,  circunstancias  una  y  otra  ya  anotadas.  PARÁGRAFO PRIMERO:  Las  partes  acuerdan  que  por  ser  el TRABAJADOR contratado como trabajador en misión para ser enviado a la empresa la duración de la obra o labor no podrá superar el tiempo establecido en el Art. 77 de la Ley 50 de 1990 en su numeral 3°. PARÁGRAFO SEGUNDO: El término de duración del presente contrato es de carácter temporal por ser el EMPLEADOR una  empresa  de  servicios temporales,  y  por  tanto tendrá  vigencia  hasta la realización  de  la  obra o  labor  contratada  que  sea  indicada  por  las  Empresas  Usuarias  del  EMPLEADOR  en  este  contrato, acordando  las  partes  que  para  todos  los  efectos  legales,  la  obra  o  labor  contratada  termina  en  la  fecha  en  que  la  EMPRESA  USUARIA, a la que será  enviado el  TRABAJADOR, comunique la terminación de la misma. PARÁGRAFO TERCERO: La labor se  realizará  en  las  instalaciones de la EMPRESA ';
    // this.vacante.empresaUsuariaSolicita + CENTRO DE COSTOS + this.vacante.finca + DIR. + this.vacante.direccion
    doc.setFont('helvetica', 'normal');
    let x = 7;
    const lineHeight = 3.4;
    const maxWidth = 203;

    doc.setFontSize(6.5);
    // Renderizar texto justificado usando `y` como posición inicial
    y = this.renderJustifiedText(doc, texto, x, y + 5, maxWidth, lineHeight);
    // Centro de costo en negrita, tamaño 10, si se pasa de la página, se ajusta a la siguiente
    doc.setFontSize(6.5);
    // Construir texto dinámico sin null ni undefined
    const partes = [
      this.vacante?.empresaUsuariaSolicita,
      'CENTRO DE COSTOS',
      this.vacante?.finca || '',
      this.vacante?.direccion ? `DIR. ${this.vacante.direccion}` : ''
    ].filter(Boolean); // elimina los vacíos o null

    const textoLinea = partes.join(' ').replace(/\s+/g, ' ').trim();

    // negrita
    doc.setFont('helvetica', 'bold');
    doc.text(textoLinea, 15, y + 5, { maxWidth: 195 });
    doc.setFont('helvetica', 'normal');

    // Segundo parrago
    y += 10; // Espacio adicional después del contenido
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    let texto2 = 'TERCERA. El salario como contraprestación del servicio será el indicado arriba, según la clasificación de oficios y tarifas determinados por el EMPLEADOR, la cual hace parte de este contrato; sometida sí en su eficiencia a que el valor a recibir corresponda al oficio respectivo efectivamente contratado con el usuario, según el tiempo laborado en la respectiva jornada, inferior a la máxima legal; éste regirá en proporción al número de horas respectivamente trabajadas y en él están los valores incluidos correspondientes a dominicales y festivos reconocidos por la ley como descanso remunerado. PARÁGRAFO PRIMERO: El patrono manifiesta expresamente que el TRABAJADOR tendrá derecho a todas las prestaciones sociales consagradas en la ley 50 de 1990 y demás estipulaciones previstas en el CST. Tales como compensación monetaria por vacaciones y prima de  servicios  proporcional al tiempo laborado, cualquiera que este sea. PARÁGRAFO SEGUNDO: Se conviene por las partes, que en caso de que el TRABAJADOR devengue comisiones o cualquiera otra modalidad de salario variable, el 82.5 % de dichos ingresos constituyen remuneración ordinaria y el 17.5 % restante  está  destinado  a  remunerar  el  descanso  en  días  dominicales y festivos de que tratan los capítulos I y II del título VII del CST. CUARTA. EL TRABAJADOR, se someterá al horario de trabajo que señale el EMPLEADOR de acuerdo con las especificaciones del Usuario. QUINTA. PERÍODO DE PRUEBA: el período de prueba no excederá de dos (2) meses ni podrá ser superior a la quinta parte del término pactado, si el contrato tuviere una duración inferior a un año. SEXTA. EL TRABAJADOR y EL EMPLEADOR podrán convenir en repartir las horas de la jornada diaria en los términos del Art. 164 del CST., teniendo en cuenta que el descanso entre las secciones de la jornada no se computa dentro de la misma, según el art. 167 del estatuto Ibídem.  Así  mismo  todo  trabajador  extra,  suplementario  o  festivo, solo  será reconocido en caso de ser exigido o autorizado a trabajar por el EMPLEADOR a solicitud de la entidad con la cual aquel tenga acuerdo de realización de trabajo o servicio. SÉPTIMA. Son justas causas para dar por terminado este contrato, además de las previstas en el art.7° del decreto 2351, las disposiciones concordantes y las consignadas en el reglamento interno del trabajo del EMPLEADOR, así como las siguientes: 1ª La terminación por cualquier causa, del contrato de prestación de servicios suscritos entre el EMPLEADOR y el USUARIO en donde prestará servicios el TRABAJADOR. 2ª El que la EMPRESA USUARIA en donde prestará servicios el TRABAJADOR, solicite el cambio de este por cualquier causa. 3ª El que la EMPRESA USUARIA en donde prestará servicios el TRABAJADOR, comunique la terminación de la obra o labor contratada. 4ª Que la EMPRESA USUARIA comunique al EMPLEADOR el incumplimiento leve de cualquiera de las obligaciones por parte del TRABAJADOR en TRES oportunidades, dos de las cuales hayan generado SANCIÓN AL TRABAJADOR. OCTAVA. Las partes acuerdan que NO CONSTITUYEN SALARIO, las sumas que ocasionalmente y por mera liberalidad reciba el TRABAJADOR del EMPLEADOR, como auxilios, gratificaciones, bonificaciones, primas extralegales, premios, bonos ocasionales, gastos de transporte adicionales y representación que el EMPLEADOR otorgue o llegue a otorgar en cualquier tiempo al TRABAJADOR, como tampoco no constituyen salario en dinero o en especie, cualquier alimentación, habitación o vestuario que entregue el EMPLEADOR, o un TERCERO al TRABAJADOR, durante la vigencia de este contrato. Tampoco constituirá salario, conforme a los términos del artículo 128 del Código Sustantivo del trabajo, cualquier bonificación o auxilio habitual, que se llegaren a acordar convencional o habitualmente entre las partes. Estos dineros, no se computarán como parte de salario para efectos de prestaciones sociales liquidables o BASE1 de éste. Al efecto el TRABAJADOR y el EMPLEADOR, así lo pactan expresamente en los términos del artículo 128 del C.S. del T. en C. Con. Con el articulo quince (15) de la ley cincuenta (50) de 1990. PARÁGRAFO PRIMERO: Las partes acuerdan que el EMPLEADOR, a su arbitrio y liberalidad podrá en cualquier momento cancelar o retirar el pago de bonificaciones habituales o esporádicas que en algún momento reconozca o hubiese reconocido al trabajador diferentes a su salario, sin que esto constituya desmejora de sus condiciones laborales; toda vez que como salario y retribución directa a favor del trabajador derivada de su actividad o fuerza laboral únicamente se pacta la suma establecida en la caratula del presente contrato. NOVENA.  En caso que el TRABAJADOR requiera ausentarse de su lugar de trabajo, deberá avisar por lo menos con 24 horas de anticipación a la EMPRESA USUARIA o según lo establecido en el Reglamento Interno de la misma.  DÉCIMA. CONFIDENCIALIDAD: El TRABAJADOR en virtud del presente contrato se compromete a 1) Manejar de manera confidencial la información que como tal sea presentada y entregada, y toda aquella que se genere en torno a ella como fruto de la prestación de sus servicios. 2) Guardar confidencialidad sobre esta información y no emplearla en beneficio propio o de terceros mientras conserve sus características de confidencialidad y que pueda perjudicar los intereses del EMPLEADOR o de la EMPRESA USUARIA. 3) Solicitar previamente y por escrito autorización para cualquier publicación relacionada con el tema de contrato, autorización que debe solicitarse ante el empleador. DÉCIMA PRIMERA. AUTORIZACION TRATAMIENTO DE DATOS PERSONALES, 1). De acuerdo a lo establecido en la ley 1581 de 2012, la Constitución Nacional y a las políticas establecidas por el EMPLEADOR para el caso en particular, el trabajador debe guardar reserva respecto a la protección de datos de los clientes, proveedores, compañeros, directivos del EMPLEADOR Y EMPRESA USUARIA, salvo que medie autorización expresa de cada persona para divulgar la información. 2). Guardar completa reserva sobre las operaciones, negocios y procedimientos industriales y comerciales, o cualquier otra clase de datos acerca del EMPLEADOR Y EMPRESA USUARIA que conozca por razón de sus funciones o de sus relaciones con ella, lo que no obsta para denunciar delitos comunes o violaciones del contrato de trabajo o de las normas legales de trabajo ante las autoridades competentes. DÉCIMA SEGUNDA. DECLARACIONES: Autorización Tratamiento Datos Personales “Ley de Protección de Datos 1581 de 2012 – decreto 1733 de 2013” Declaro que he sido informado que conozco y acepto la Política de Uso de Datos Personales e Información del EMPLEADOR, y que la información proporcionada es veraz, completa, exacta, actualizada y verificable. Mediante la firma del presente documento, manifiesto que conoce y acepto que cualquier consulta o reclamación relacionada con el Tratamiento de sus datos personales podrá ser elevada por escrito ante el EMPLEADOR; (¡) Que la Empresa TU ALIANZA S.A.S con NIT. 900.864.596-1, con domicilio principal en la Calle 7 No. 7– 49 de Madrid,  para efectos  de  lo  dispuesto  en  la ley  Estatutaria  1581  de  2012,  el  Decreto  1733  de  2013,  y  demás  normas  que  lo adicionen o modifiquen relativas a la Protección de Datos Personales, es responsable del tratamiento de los datos PERSONALES QUE LE HE SUMINISTRADO. (¡¡). Que, para el ejercicio de mis derechos relacionados con mis datos personales, el EMPLEADOR ha puesto a mi disposición la línea de atención: Afiliados marcando a Bogotá 6017444002; a través del correo electrónico protecciondedatos@tsservicios.co; las oficinas del EMPLEADOR a nivel nacional o en la Carrera 112ª # 18ª 05 de  Bogotá.  En  todo  caso,  he  sido  informado  que  sólo  podré  elevar  queja  por infracciones a lo dispuesto en las normas sobre Protección de Datos ante la Superintendencia de Industria y Comercio una vez haya agotado el trámite ante el EMPLEADOR o sus encargados. Conozco que la normatividad de Protección de Datos Personales tiene por  objeto  el  desarrollo  del  derecho  constitucional  de  todas  las  personas  a  conocer,  actualizar  y  rectificar  de  forma  gratuita  la  información  que  se  recaude  sobre  ellas  en'
    y = this.renderJustifiedText(doc, texto2, x, y, maxWidth, lineHeight);

    doc.setFontSize(7);
    // Añadir otra pagina
    doc.addPage();
    y = 5; // Posición vertical al inicio de la página
    // **Cuadro para el logo y NIT**
    doc.setLineWidth(0.1);
    doc.rect(startX, startY, 50, 13); // Cuadro del logo y NIT

    // Agregar logo
    doc.addImage(logoPath, 'PNG', startX + 2, startY + 1.5, 27, 10);

    // Agregar NIT
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("NIT", startX + 32, startY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(nit, startX + 32, startY + 10);

    // **Tabla al lado del logo**
    tableStartX = startX + 50; // Inicio de la tabla al lado del cuadro
    doc.rect(tableStartX, startY, tableWidth - 50, 13); // Borde exterior de la tabla

    // Encabezados
    doc.setFont('helvetica', 'bold');
    doc.text("PROCESO DE CONTRATACIÓN", tableStartX + 55, startY + 3);
    //doc.text(this.codigoContratacion, tableStartX + 130, startY + 3);
    doc.text("CONTRATO DE TRABAJO POR OBRA O LABOR", tableStartX + 43, startY + 7);

    // Líneas divisoras
    col1 = tableStartX + 30;
    col2 = tableStartX + 50;
    col3 = tableStartX + 110;

    doc.line(tableStartX, startY + 4, tableStartX + tableWidth - 50, startY + 4); // Línea horizontal bajo el título
    doc.line(tableStartX, startY + 8, tableStartX + tableWidth - 50, startY + 8); // Línea horizontal bajo el título
    doc.line(col1, startY + 8, col1, startY + 13); // Línea vertical 1
    doc.line(col2, startY + 8, col2, startY + 13); // Línea vertical 2
    doc.line(col3, startY + 8, col3, startY + 13); // Línea vertical 3

    // **Contenido de las columnas**
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text("Código: " + codigo, tableStartX + 2, startY + 11.5);
    doc.text("Versión: " + version, col1 + 2, startY + 11.5); // Ajustar dentro de columna
    doc.text(`Fecha Emisión: ${fechaEmision}`, col2 + 5, startY + 11.5);
    doc.text("Página: 2 de 3", col3 + 6, startY + 11.5); // Ajustar dentro de columna

    // texto adicional
    y = columnStartY; // Posición inicial Y
    doc.setFontSize(6.5);
    let texto3 = 'bases de datos o archivos, y los derechos, libertades y garantías a los que se refieren el artículo 15 y 20 de la Constitución Política de Colombia. Autorizo también, de manera expresa, el envío de mensajes a través de cualquier medio que he registrado a mi EMPLEADOR el día de la contratación, para remitir comunicados internos sobre información concerniente a Seguridad Social, así como también, la notificaciones sobre licencias, permisos, cartas laborales, cesantías, citaciones, memorandos, y todos aquellos procesos internos que conlleven a la comunicación entre el EMPLEADOR y el EMPLEADO. (iii) Notificación sobre desprendibles de pagos de Nómina y/ o liquidación final. En adición y complemento de las autorizaciones previamente otorgadas, autorizo de manera expresa y previa sin lugar a pagos ni retribuciones al EMPLEADOR, a sus sucesores, cesionarios a cualquier título o a quien represente los derechos, para que efectúe el Tratamiento de mis Datos Personales de la manera y para las finalidades que se señalan a continuación. Para efectos de la presente autorización, se entiende por “Datos Personales” la información personal que suministre por cualquier medio, incluyendo, pero sin limitarse a, aquella de carácter financiero, crediticio, comercial, profesional, sensible (tales como mis huellas, imagen, voz, entre otros), técnico y administrativo, privada, semiprivada o de cualquier naturaleza pasada, presente o futura, contenida en cualquier medio físico, digital o electrónico, entre otros y sin limitarse a documentos, fotos, memorias USB, grabaciones, datos biométricos, correos electrónicos y video grabaciones. Así mismo, se entiende por “Tratamiento” el recolectar, consultar, recopilar, evaluar, catalogar, clasificar, ordenar, grabar, almacenar, actualizar, modificar, aclarar, reportar, informar, analizar, utilizar, compartir, circular, suministrar, suprimir, procesar, solicitar, verificar, intercambiar, retirar, trasferir, transmitir, o divulgar, y en general, efectuar cualquier operación o conjunto de operaciones sobre mis Datos Personales en medio físicos, digitales, electrónicos, o por cualquier otro medio. La autorización que otorgo por el presente medio para el Tratamiento de mis Datos Personales tendrá las siguientes finalidades: a. Promocionar, comercializar u ofrecer, de manera individual o conjunta productos y/o servicios propios u ofrecidos en alianza comercial, a través de cualquier medio o canal, o para complementar, optimizar o profundizar el portafolio de productos y/o servicios actualmente ofrecidos. Esta autorización para el Tratamiento de mis Datos Personales se hace extensiva a las entidades subordinadas de EL EMPLEADOR, o ante cualquier sociedad en la que éstas tengan participación accionaria directa o indirectamente (en adelante “LAS ENTIDADES AUTORIZADAS”). a. autoriza explícitamente al EMPLEADOR , en forma previa, expresa e informada, para que directamente o a través de sus empleados, asesores, consultores, empresas usuarias, proveedores de servicios de selección, contratación, exámenes ocupacionales, estudios de seguridad, dotación y elementos de protección personal, capacitaciones, cursos, Fondos de empleados, Fondos funerarios, Empresas del Sistema de Seguridad Social: Fondos de Pensiones, EPS, Administradoras de Riesgos Laborales, Cajas de Compensación Familiar, entre otros: 1. A realizar cualquier operación que tenga una finalidad lícita, tales como la recolección, el almacenamiento, el uso, la circulación, supresión, transferencia y transmisión (el “Tratamiento”) de los datos personales relacionados con su vinculación laboral y con la ejecución, desarrollo y terminación del presente contrato de trabajo, cuya finalidad incluye, pero no se limita, a los procesos verificación de la aptitud física del TRABAJADOR para desempeñar en forma eficiente las labores sin impactar negativamente su salud o la de terceros, las afiliaciones del TRABAJADOR y sus beneficiarios al Sistema general de seguridad social y parafiscales, la remisión del TRABAJADOR para que realice apertura de cuenta de nómina, archivo y procesamiento de nómina, gestión y archivo de procesos disciplinarios, archivo de documentos soporte de su vinculación contractual, reporte ante autoridades administrativas, laborales, fiscales o judiciales, entre otras, así como el cumplimiento de obligaciones legales o contractuales del EMPLEADOR con terceros, la debida ejecución del Contrato de trabajo, el cumplimiento de las políticas internas del EMPLEADOR, la verificación del cumplimiento de las obligaciones del TRABAJADOR, la administración de sus sistemas de información y comunicaciones, la generación de copias y archivos de seguridad de la información en los equipos proporcionados por EL EMPLEADOR. Además, la información personal se recibirá y utilizará para efectos de administración del factor humano en temas de capacitación laboral, bienestar social, cumplimiento de normas de seguridad laboral y seguridad social, siendo necesario, en algunos eventos, recibir información sensible sobre estados de salud e información de menores de edad beneficiarios de esquemas de seguridad social, así como la información necesaria para el cumplimiento de obligaciones laborales de orden legal y extralegal. Toda la anterior información se tratará conforme a las exigencias legales en cada caso. 2. EL TRABAJADOR conoce el carácter facultativo de entregar o no al EMPLEADOR sus datos sensibles. 3. EL TRABAJADOR autoriza al responsable del tratamiento de manera expresa a dar tratamiento a los datos sensibles del titular, siendo esto datos los siguientes: origen racial o étnico, orientación sexual, filiación política o religiosa, datos referentes a la salud, datos biométricos, actividad en organizaciones sindicales o de derechos humanos, 4.EL TRABAJADOR da autorización expresa al responsable del tratamiento para que capture y use la información personal y sensible de sus hijos menores de edad. b. Como elemento de análisis en etapas pre-contractuales, contractuales, y post- contractuales para establecer y/o mantener cualquier relación contractual, incluyendo como parte de ello, los siguientes propósitos: (i). Actualizar bases de datos y tramitar la apertura y/o servicios en EL EMPLEADOR o en cualquiera de las ENTIDADES AUTORIZADAS, (ii). Evaluar riesgos derivados de la relación contractual potencial, vigente o concluida. (iii). Realizar, validar, autorizar o verificar transacciones incluyendo, cuando sea requerido, la consulta y reproducción de datos sensibles tales como la huella, imagen o la voz. (iv). Obtener conocimiento del perfil comercial o transaccional del titular, el nacimiento, modificación, celebración y/ o extinción de obligaciones directas, contingentes o indirectas, el incumplimiento de las obligaciones que adquiera con EL EMPLEADOR o con cualquier tercero, así como cualquier novedad en relación con tales obligaciones, hábitos de pago y comportamiento crediticio con EL EMPLEADOR y/o terceros. (v). Conocer información acerca de mi manejo de cuentas corrientes, ahorros, depósitos, tarjetas de crédito, comportamiento comercial, laboral y demás productos o servicios y, en general, del cumplimiento y manejo de mis créditos y obligaciones, cualquiera que sea su naturaleza. Esta autorización comprende información referente al manejo, estado, cumplimiento de las relaciones, contratos y servicios, hábitos de pago, incluyendo aportes al sistema de seguridad social, obligaciones y las deudas vigentes, vencidas sin cancelar, procesos, o la utilización indebida de servicios financieros. (vi). Dar cumplimiento a sus obligaciones legales y contractuales. (vii). Ejercer sus derechos, incluyendo los referentes a actividades de cobranza judicial y extrajudicial y las gestiones conexas para obtener el pago de las obligaciones a cargo del titular o de su empleador, si es el caso. (viii). Implementación de software y servicios tecnológicos. Para efectos de lo dispuesto en el presente literal b, EL EMPLEADOR en lo que resulte aplicable, podrá efectuar el Tratamiento de mis Datos Personales ante entidades de consulta, que manejen o administren bases de datos para los fines legalmente definidos, domiciliadas en Colombia o en el exterior, sean personas naturales o jurídicas, colombianas o extranjeras. c. Realizar ventas cruzadas de productos y/o servicios ofrecidos por EL EMPLEADOR o por cualquiera de LAS ENTIDADES AUTORIZADAS o sus aliados comerciales, incluyendo la celebración de convenios de marca compartida. d. Elaborar y reportar información estadística, encuestas de satisfacción, estudios y análisis de mercado, incluyendo la posibilidad de contactarme para dichos propósitos. e. Enviar mensajes, notificaciones o alertas a través de cualquier medio para remitir extractos, divulgar información legal, de seguridad, promociones, campañas comerciales, publicitarias, de mercadeo, institucionales o de educación financiera, sorteos, eventos u otros beneficios e informar al titular acerca de las innovaciones efectuadas en sus productos y/o servicios, dar a conocer las mejoras o cambios en sus canales de atención, así como dar a conocer otros servicios y/o productos ofrecidos por EL EMPLEADOR; LAS ENTIDADES AUTORIZADAS o sus aliados comerciales. f. Llevar a cabo las gestiones pertinentes, incluyendo la recolección y entrega de información ante autoridades públicas o privadas, nacionales o extranjeras con competencia sobre EL EMPLEADOR, LAS ENTIDADES AUTORIZADAS o sobre sus actividades, productos y /o servicios, cuando se requiera para dar cumplimiento a sus deberes legales o reglamentarios, incluyendo dentro de estos, aquellos referentes a la prevención de la evasión fiscal, lavado de activos y financiación del terrorismo u otros propósitos similares emitidas por autoridades competentes, g. validar información con las diferentes bases de datos de EL EMPLEADOR, de LAS ENTIDADES AUTORIZADAS, de autoridades y/o entidades estatales y de terceros tales como operadores de información y demás entidades que formen parte del Sistema de Seguridad Social Integral, empresas prestadoras de servicios públicos y de telefonía móvil, entre otras, para desarrollar las actividades propias de objeto social principal y conexo y/o cumplir con obligaciones legales. h. Para que mis datos Personales puedan ser utilizados como medio de prueba. Los Datos Personales suministrados podrán circular y transferirse a la totalidad de las áreas de EL EMPLEADOR incluyendo proveedores de servicios, usuarios de red, redes de distribución y personas que realicen la promoción de sus productos y servicios, incluidos call centers, domiciliados en Colombia o en el exterior, sean personas naturales o jurídicas, colombianas o extranjeros a su fuerza comercial, equipos de telemercadeo y/o procesadores de datos que trabajen en nombre de EL EMPLEADOR, incluyendo pero sin limitarse, contratistas, delegados, outsourcing, tercerización, red de oficinas o aliados, con el objeto de desarrollar servicios de alojamiento de sistemas, de mantenimiento, servicios de análisis, servicios de mensajería por e- mail o correo físico, servicios de entrega, gestión de transacciones de pago, cobranza, entre otros. En consecuencia, el titular entiende y acepta que mediante la presentación autorización concede a estos terceros, autorización para acceder a sus Datos Personales en la medida en que así lo requieren para la prestación de los servicios para los cuales fueron contratados y sujeto al cumplimiento de los deberes que les correspondan como encargados del Tratamiento de mis Datos Personales. Igualmente, a EL EMPLEADOR para compartir mis datos Personales con las entidades gremiales a las que pertenezca la entidad, para fines comerciales, estadísticos y de estudio y análisis de mercadeo. Es entendido que las personas naturales y jurídicas, nacionales y extranjeras mencionadas anteriormente ante las cuales EL EMPLEADOR puede llevar a cabo el Tratamiento de mis Datos Personales, también cuentan con mi autorización para permitir dicho Tratamiento. Adicionalmente, mediante el otorgamiento de la presente autorización, manifiesto: (i) que los Datos Personales suministrados son veraces, verificables y completos, (ii) que conozco y entiendo que el suministro de la presente autorización es voluntaria, razón por la cual no me encuentro obligado a otorgar la presenta autorización, (iii) que conozco y entiendo que mediante la simple presentación de una comunicación escrita puedo limitar en todo o en parte el alcance de la presente autorización para que, entre otros, la misma se otorgue únicamente frente a EL EMPLEADOR pero no frente a LAS ENTIDADES AUTORIZADAS y (iv) haber sido informado sobre mis derechos a conocer, actualizar y rectificar mis Datos Personales, el carácter facultativo de mis respuestas a las preguntas que sean hechas cuando versen sobre datos sensibles o sobre datos de los niños, niñas o adolescentes, solicitar prueba de la autorización otorgada para su tratamiento, ser informado sobre el uso que se ha dado a los mismo, presentar quejas ante la autoridad competente por infracción a la ley una vez haya agotado el trámite de consulta o reclamo ante EL EMPLEADOR, revocar la presentación autorización, solicitar la supresión de sus datos en los casos en que sea procedente y ejercer en forma gratuita mis derechos y garantías constitucionales y legales. EL EMPLEADOR informa que el tratamiento de sus Datos Personales se efectuará de acuerdo con la Política de la entidad en esta materia, la cual puede ser consultada en sus instalaciones. DÉCIMA TERCERA. AUTORIZACIÓN DE DESCUENTOS: El TRABAJADOR autoriza expresamente al EMPLEADOR para que se descuenten de mi salario y prestaciones o cualquier otro concepto las sumas que por error haya recibido, permitiendo que el EMPLEADOR compense del valor de los salarios, prestaciones legales o extralegales, indemnizaciones y otro tipo de dinero a pagar al momento de la Nómina y/o liquidación las sumas que yo como TRABAJADOR esté debiendo al EMPLEADOR Y EMPRESA USUARIA por'
    y = this.renderJustifiedText(doc, texto3, x, y, maxWidth, lineHeight);

    // Convertir a Blob y guardar en uploadedFiles
    const pdfBlob = doc.output('blob');
    const fileName = `${this.empresa}_Contrato.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    this.uploadedFiles['Contrato'] = { file: pdfFile, fileName };

    this.verPDF({ titulo: 'Contrato' });
  }

  async generarFichaTecnica() {
    try {
      // =========================================================
      // 0) Helpers de imagen (PDF-lib) - robustos como en jsPDF
      // =========================================================
      const bytesCache = new Map<string, Promise<ArrayBuffer | null>>();

      const isHttp = (u: string) => /^https?:\/\//i.test(u);
      const isDataUrl = (u: string) => /^data:image\//i.test(u);

      const normalizeUrl = (u: string) => {
        const s = String(u ?? '').trim();
        if (!s) return '';
        if (isHttp(s) || isDataUrl(s)) return s;

        const clean = s.replace(/^\/+/, '');
        // Si ya viene con assets/, lo dejamos
        if (clean.startsWith('assets/')) return clean;

        // Muchos de tus recursos parecen estar como "logos/.." o "firma/.." o "Docs/.."
        // En Angular normalmente deben ir bajo assets/
        return `assets/${clean}`;
      };

      const dataUrlToBytes = (dataUrl: string): ArrayBuffer | null => {
        try {
          const [meta, b64] = dataUrl.split(',');
          if (!meta || !b64) return null;
          const bin = atob(b64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
          return bytes.buffer;
        } catch {
          return null;
        }
      };

      const detectImageType = (ab: ArrayBuffer): 'png' | 'jpg' | null => {
        const b = new Uint8Array(ab);
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (
          b.length >= 8 &&
          b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
          b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A
        ) return 'png';

        // JPG: FF D8 FF
        if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';

        return null;
      };

      const fetchBytesOrNull = async (urlOrData?: string): Promise<ArrayBuffer | null> => {
        const raw = String(urlOrData ?? '').trim();
        if (!raw) return null;

        // data:image/*
        if (isDataUrl(raw)) return dataUrlToBytes(raw);

        const url = normalizeUrl(raw);
        if (!url) return null;

        // cache por URL para no descargar varias veces
        if (bytesCache.has(url)) return await bytesCache.get(url)!;

        const p = (async () => {
          // 1) Intenta con tu helper (si ya está armado con headers, baseUrl, etc.)
          try {
            const ab = await this.fetchAsArrayBufferOrNull(url);
            if (ab) return ab;
          } catch { }

          // 2) Intento extra: si por alguna razón normalizeUrl “rompió” tu path,
          //    probamos el raw original (solo cuando era relativo)
          if (!isHttp(raw) && !raw.startsWith('assets/') && !isDataUrl(raw)) {
            try {
              const ab2 = await this.fetchAsArrayBufferOrNull(raw);
              if (ab2) return ab2;
            } catch { }
          }

          return null;
        })();

        bytesCache.set(url, p);
        return await p;
      };

      const embedImageOrNull = async (pdfDoc: PDFDocument, urlOrData?: string) => {
        const ab = await fetchBytesOrNull(urlOrData);
        if (!ab) return null;

        const kind = detectImageType(ab);
        if (!kind) return null;

        try {
          const u8 = new Uint8Array(ab);
          return kind === 'png' ? await pdfDoc.embedPng(u8) : await pdfDoc.embedJpg(u8);
        } catch {
          return null;
        }
      };

      const setButtonImageSafe = async (
        pdfDoc: PDFDocument,
        form: any,
        buttonName: string,
        urlOrData?: string
      ) => {
        const img = await embedImageOrNull(pdfDoc, urlOrData);
        if (!img) return false;
        try {
          form.getButton(buttonName).setImage(img);
          return true;
        } catch {
          return false;
        }
      };

      // =========================================================
      // 1) Normalización desde this.candidato y this.vacante
      // =========================================================
      const cand: any = this.candidato ?? {};
      const vac: any = this.vacante ?? {};

      const contacto: any = cand.contacto ?? {};
      const residencia: any = cand.residencia ?? {};
      const infoCc: any = cand.info_cc ?? {};

      const entrevista: any = Array.isArray(cand.entrevistas) ? cand.entrevistas[0] : null;
      const proceso: any = entrevista?.proceso ?? {};
      const contrato: any = proceso?.contrato ?? {};
      const antecedentes: any[] = Array.isArray(proceso?.antecedentes) ? proceso.antecedentes : [];

      const norm = (v: any) => String(v ?? '').trim().toUpperCase();

      const findAnte = (nombre: string) => antecedentes.find(a => norm(a?.nombre) === norm(nombre));

      const eps = String(findAnte('EPS')?.observacion ?? '');
      const afp = String(findAnte('AFP')?.observacion ?? '');

      const mapEstadoCivil = (code: any): string => {
        const c = norm(code);
        if (c === 'SO' || c === 'SOLTERO' || c === 'S') return 'SO';
        if (c === 'CA' || c === 'CASADO') return 'CA';
        if (c === 'UN' || c === 'UL' || c === 'UNION LIBRE' || c === 'UNIÓN LIBRE') return 'UN';
        if (c === 'SE' || c === 'SEP' || c === 'SEPARADO') return 'SE';
        if (c === 'VI' || c === 'VIUDO') return 'VI';
        return c || '';
      };

      const nombreCompleto = [
        cand.primer_nombre,
        cand.segundo_nombre,
        cand.primer_apellido,
        cand.segundo_apellido,
      ]
        .map((x: any) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' ');

      const codigoContrato = String(contrato?.codigo_contrato ?? proceso?.contrato_codigo ?? '').trim();

      const fechaIngreso = String(vac?.fechadeIngreso ?? '').trim(); // "2025-12-12"
      const salario = vac?.salario ?? proceso?.vacante_salario ?? '';

      const formacion0: any = Array.isArray(cand.formaciones) ? cand.formaciones[0] : null;
      const exp0: any = Array.isArray(cand.experiencias) ? cand.experiencias[0] : null;

      // dv = "datoPersonal" esperado por tu PDF
      const dv: any = {
        primer_apellido: cand.primer_apellido ?? '',
        segundo_apellido: cand.segundo_apellido ?? '',
        primer_nombre: cand.primer_nombre ?? '',
        segundo_nombre: cand.segundo_nombre ?? '',

        tipodedocumento: cand.tipo_doc ?? '',
        numerodeceduladepersona: cand.numero_documento ?? '',

        fecha_expedicion_cc: infoCc?.fecha_expedicion ?? '',
        departamento_expedicion_cc: infoCc?.depto_expedicion ?? '',
        municipio_expedicion_cc: infoCc?.mpio_expedicion ?? '',

        genero: cand.sexo ?? '',
        fecha_nacimiento: cand.fecha_nacimiento ?? '',
        lugar_nacimiento_departamento: infoCc?.depto_nacimiento ?? '',
        lugar_nacimiento_municipio: infoCc?.mpio_nacimiento ?? '',

        estado_civil: mapEstadoCivil(cand.estado_civil),

        direccion_residencia: residencia?.direccion ?? '',
        barrio: residencia?.barrio ?? '',
        municipio: (vac?.municipio?.[0] ?? entrevista?.oficina ?? '').toString(),
        departamento: '', // no viene en el JSON

        celular: contacto?.celular ?? '',
        primercorreoelectronico: contacto?.email ?? '',

        rh: cand.rh ?? '',
        zurdo_diestro: cand.zurdo_diestro ?? '',

        escolaridad: formacion0?.nivel ?? '',
        nombre_institucion: formacion0?.institucion ?? '',
        titulo_obtenido: formacion0?.titulo_obtenido ?? '',
        ano_finalizacion: formacion0?.anio_finalizacion ?? '',

        nombre_expe_laboral1_empresa: exp0?.empresa ?? '',
        direccion_empresa1: exp0?.direccion ?? '',
        telefonos_empresa1: exp0?.telefonos ?? '',
        nombre_jefe_empresa1: exp0?.nombre_jefe ?? '',
        cargo_empresa1: exp0?.cargo ?? '',
        fecha_retiro_empresa1: exp0?.fecha_retiro ?? '',
        motivo_retiro_empresa1: exp0?.motivo_retiro ?? '',
      };

      // ds = "datoSeleccion"
      const ds: any = {
        fechaIngreso,
        salario,
        eps,
        afp,
        cargo: vac?.cargo ?? '',
        centro_costo_entrevista: entrevista?.oficina ?? '',
        empresa_usuario: vac?.empresaUsuariaSolicita ?? '',
      };

      // datoInfoContratacion
      const datoInfoContratacion: any = {
        codigo_contrato: codigoContrato,
        forma_pago: contrato?.forma_de_pago ?? '',
        numero_pagos: contrato?.numero_para_pagos ?? '',
        porcentaje_arl: contrato?.porcentaje_arl ?? '',
        cesantias: contrato?.cesantias ?? '',
        centro_de_costos: contrato?.Ccentro_de_costos ?? contrato?.centro_de_costos ?? '',
        subCentroCostos: contrato?.subcentro_de_costos ?? '',
        categoria: contrato?.categoria ?? '',
        operacion: contrato?.operacion ?? '',
        grupo: contrato?.grupo ?? '',
        horas_extras:
          contrato?.horas_extras === true ? 'SI' :
            contrato?.horas_extras === false ? 'NO' :
              (contrato?.horas_extras ?? ''),
        semanas_cotizadas: '0',
      };

      // URLs biometría (NO base64)
      const firmaUrl = cand?.biometria?.firma?.file_url ?? cand?.biometria?.firma?.file ?? '';
      const fotoUrl = cand?.biometria?.foto?.file_url ?? cand?.biometria?.foto?.file ?? '';
      const huellaUrl = cand?.biometria?.huella?.file_url ?? cand?.biometria?.huella?.file ?? '';

      // =========================================================
      // 2) Cargar PDF base y setear campos
      // =========================================================
      const pdfUrl = 'Docs/Ficha tecnica.pdf';
      const arrayBuffer = await this.fetchAsArrayBufferOrNull(pdfUrl);
      if (!arrayBuffer) throw new Error('No se pudo cargar el PDF base.');

      const pdfDoc = await PDFDocument.load(arrayBuffer);
      pdfDoc.registerFontkit(fontkit as any);

      const fontBytes = await this.fetchAsArrayBufferOrNull('fonts/Roboto-Regular.ttf');
      const customFont = fontBytes ? await pdfDoc.embedFont(fontBytes) : undefined;

      const form = pdfDoc.getForm();

      // Branding Apoyo Laboral
      const { logoPath, nombreEmpresa } = this.getEmpresaInfo();
      const empUsuaria = this.safe(vac.empresaUsuariaSolicita);

      await setButtonImageSafe(pdfDoc, form, 'Image16_af_image', logoPath);
      await setButtonImageSafe(pdfDoc, form, 'Image18_af_image', logoPath);

      // Cabecera / contrato
      this.setText(form, 'CodContrato', this.safe(codigoContrato), customFont, 7.2);
      this.setText(form, 'sede', this.safe(this.user?.sede?.nombre), customFont, 7.2);

      // Identificación
      this.setText(form, '1er ApellidoRow1', this.safe(dv.primer_apellido), customFont);
      this.setText(form, '2do ApellidoRow1', this.safe(dv.segundo_apellido), customFont);
      this.setText(form, 'NombresRow1', [this.safe(dv.primer_nombre), this.safe(dv.segundo_nombre)].filter(Boolean).join(' '), customFont);
      this.setText(form, 'Tipo Documento IdentificaciónRow1', this.safe(dv.tipodedocumento), customFont);
      this.setText(form, 'Número de IdentificaciónRow1', this.safe(dv.numerodeceduladepersona), customFont);

      // Expedición
      this.setText(form, 'Fecha de ExpediciónRow1', this.parseDateToDDMMYYYY(dv.fecha_expedicion_cc), customFont);
      this.setText(form, 'Departamento de ExpediciónRow1', this.safe(dv.departamento_expedicion_cc), customFont);
      this.setText(form, 'Municipio de ExpediciónRow1', this.safe(dv.municipio_expedicion_cc), customFont);

      // Nacimiento
      this.setText(form, 'GeneroRow1', this.safe(dv.genero), customFont);
      this.setText(form, 'Fecha de NacimientoRow1', this.parseDateToDDMMYYYY(dv.fecha_nacimiento), customFont);
      this.setText(form, 'Departamento de NacimientoRow1', this.safe(dv.lugar_nacimiento_departamento), customFont);
      this.setText(form, 'Municipio de NacimientoRow1', this.safe(dv.lugar_nacimiento_municipio), customFont);

      // Estado civil (X)
      const ec = this.safe(dv.estado_civil).toUpperCase();
      this.setXIf(form, 'SolteroEstado Civil', ['SO', 'SOLTERO', 'S'].includes(ec));
      this.setXIf(form, 'CasadoEstado Civil', ['CA', 'CASADO'].includes(ec));
      this.setXIf(form, 'Unión LibreEstado Civil', ['UN', 'UL', 'UNION LIBRE', 'UNIÓN LIBRE'].includes(ec));
      this.setXIf(form, 'SeparadoEstado Civil', ['SE', 'SEP', 'SEPARADO'].includes(ec));
      this.setXIf(form, 'ViudoEstado Civil', ['VI', 'VIUDO'].includes(ec));
      this.setXIf(form, 'OtroEstado Civil', !['SO', 'SOLTERO', 'S', 'CA', 'CASADO', 'UN', 'UL', 'UNION LIBRE', 'UNIÓN LIBRE', 'SE', 'SEP', 'SEPARADO', 'VI', 'VIUDO'].includes(ec) && ec !== '');

      // Contacto / residencia
      this.setText(form, 'Dirección de DomicilioRow1', this.safe(dv.direccion_residencia), customFont);
      this.setText(form, 'BarrioRow1', this.safe(dv.barrio), customFont);
      this.setText(form, 'Ciudad DomicilioRow1', this.safe(dv.municipio), customFont);
      this.setText(form, 'DepartamentoRow1', this.safe(dv.departamento), customFont);
      this.setText(form, 'CelularRow1', this.safe(dv.celular), customFont);
      this.setText(form, 'Correo ElectrónicoRow1', this.safe(dv.primercorreoelectronico), customFont);

      // RH / mano
      const mano = this.safe(dv.zurdo_diestro).toUpperCase();
      this.setXIf(form, 'Diestro', mano.includes('DIESTRO'));
      this.setXIf(form, 'Zurdo', !mano.includes('DIESTRO') && mano !== '');

      // Empresa / Laboral
      this.setText(form, 'Fecha de Ingreso', this.parseDateToDDMMYYYY(ds.fechaIngreso) || ds.fechaIngreso, customFont);
      this.setText(form, 'Sueldo Básico', this.formatMoneyCOP(ds.salario), customFont);

      const rutaInfo = this.getRutaInfo(vac.oficinasQueContratan, ds.centro_costo_entrevista || '');
      this.setText(form, 'Nombre de la RutaUsa Ruta', rutaInfo.usaRuta, customFont);
      this.setText(form, 'Nombre de la RutaAuxilio Trasporte', this.safe(vac.auxilioTransporte), customFont);
      this.setText(form, 'Horas extras', this.safe(datoInfoContratacion.horas_extras), customFont);

      this.setText(form, 'Banco', this.safe(datoInfoContratacion.forma_pago), customFont);
      this.setText(form, 'Cuenta', this.safe(datoInfoContratacion.numero_pagos), customFont);

      this.setText(form, 'EPS SaludRow1', this.safe(ds.eps), customFont);
      this.setText(form, 'AFP PensiónRow1', this.safe(ds.afp), customFont);
      this.setText(form, 'AFC CesantiasRow1', this.safe(datoInfoContratacion.cesantias), customFont);
      this.setText(form, 'Porcentaje ARLARL SURA', this.safe(datoInfoContratacion.porcentaje_arl), customFont);

      // Educación
      this.setText(form, 'Seleccione el Grado de Escolaridad', this.safe(dv.escolaridad), customFont);
      this.setText(form, 'Institución', this.safe(dv.nombre_institucion), customFont);
      this.setText(form, 'Titulo Obtenido o Ultimo año Cursado', this.safe(dv.titulo_obtenido), customFont);
      this.setText(form, 'Año Finalización', this.parseDateToDDMMYYYY(dv.ano_finalizacion), customFont);

      // Info Relacional Familiar
      const mapVive = (v: any) => v === true || norm(v) === 'SI' ? 'SI' : (v === false || norm(v) === 'NO' ? 'NO' : '');
      const familiares: any[] = Array.isArray(cand.familiares) ? cand.familiares : [];

      const padre = familiares.find(f => norm(f.parentesco).includes('PADRE') || norm(f.parentesco) === 'PA') ?? {};
      const madre = familiares.find(f => norm(f.parentesco).includes('MADRE') || norm(f.parentesco) === 'MA') ?? {};
      const conyuge = familiares.find(f => norm(f.parentesco).includes('CONYUG') || norm(f.parentesco) === 'COMPAÑER' || norm(f.parentesco) === 'ESPOS') ?? {};

      // Padre
      this.setText(form, 'Nombre y Apellido PadreRow1', this.safe(padre.nombre_completo ?? padre.nombres ?? ''), customFont);
      this.setText(form, 'ViveRow1', mapVive(padre.vive), customFont);
      this.setText(form, 'OcupaciónRow1', this.safe(padre.ocupacion), customFont);
      this.setText(form, 'DirecciónRow1', this.safe(padre.direccion), customFont);
      this.setText(form, 'TeléfonoRow1', this.safe(padre.telefono_celular ?? padre.telefono), customFont);
      this.setText(form, 'BarrioMunicipioRow1', this.safe(padre.barrio ?? padre.municipio), customFont);

      // Madre
      this.setText(form, 'Nombre y Apellido MadreRow1', this.safe(madre.nombre_completo ?? madre.nombres ?? ''), customFont);
      this.setText(form, 'ViveRow1_2', mapVive(madre.vive), customFont);
      this.setText(form, 'OcupaciónRow1_2', this.safe(madre.ocupacion), customFont);
      this.setText(form, 'DirecciónRow1_2', this.safe(madre.direccion), customFont);
      this.setText(form, 'TeléfonoRow1_2', this.safe(madre.telefono_celular ?? madre.telefono), customFont);
      this.setText(form, 'BarrioMunicipioRow1_2', this.safe(madre.barrio ?? madre.municipio), customFont);

      // Cónyuge
      this.setText(form, 'Nombre y ApellidoconyugeRow1', this.safe(conyuge.nombre_completo ?? conyuge.nombres ?? ''), customFont);
      this.setText(form, 'ViveRow1_3', mapVive(conyuge.vive), customFont);
      this.setText(form, 'OcupaciónRow1_3', this.safe(conyuge.ocupacion), customFont);
      this.setText(form, 'DirecciónRow1_3', this.safe(conyuge.direccion), customFont);
      this.setText(form, 'TeléfonoRow1_3', this.safe(conyuge.telefono_celular ?? conyuge.telefono), customFont);
      this.setText(form, 'BarrioMunicipioRow1_3', this.safe(conyuge.barrio ?? conyuge.municipio), customFont);

      // Hijos
      const hijos = familiares.filter(f => norm(f.parentesco).includes('HIJ') || norm(f.parentesco) === 'HI');
      for (let i = 0; i < Math.min(6, hijos.length); i++) {
        const h = hijos[i];
        const idx = i + 1;
        this.setText(form, `Apellidos y Nombres${idx}`, this.safe(h.nombre_completo ?? h.nombres ?? ''), customFont);
        this.setText(form, `F de Nacimiento${idx}`, this.parseDateToDDMMYYYY(h.fecha_nacimiento), customFont);
        this.setText(form, ` de Identificación${idx}`, this.safe(h.numero_documento), customFont);
        this.setText(form, `Gen${idx}`, this.safe(h.sexo ?? h.genero), customFont);
        this.setText(form, `Vive con el Trabajador${idx}`, mapVive(h.vive_con_candidato ?? h.vive), customFont);
        this.setText(form, `Estudia en la Fundación SN${idx}`, mapVive(h.estudia), customFont);
        this.setText(form, `Ocupación${idx}`, this.safe(h.ocupacion), customFont);
        this.setText(form, `Curso${idx}`, this.safe(h.nivel_escolaridad ?? h.curso), customFont);
      }

      // Contacto de Emergencia
      const emerg = cand.contacto_emergencia ?? cand.contacto ?? {};
      this.setText(form, 'Apellidos y NombresRow1', this.safe(emerg.nombres ?? emerg.nombre_contacto ?? ''), customFont);
      this.setText(form, 'Número de ContactoRow1', this.safe(emerg.telefono ?? emerg.celular_contacto ?? emerg.celular ?? ''), customFont);

      // Experiencia
      this.setText(form, 'Nombre Empresa 1Row1', this.safe(dv.nombre_expe_laboral1_empresa), customFont);
      this.setText(form, 'Dirección EmpresaRow1', this.safe(dv.direccion_empresa1), customFont);
      this.setText(form, 'TeléfonosRow1', this.safe(dv.telefonos_empresa1), customFont);
      this.setText(form, 'Jefe InmediatoRow1', this.safe(dv.nombre_jefe_empresa1), customFont);
      this.setText(form, 'CargoRow1', this.safe(dv.cargo_empresa1), customFont);
      this.setText(form, 'F de RetiroRow1', this.parseDateToDDMMYYYY(dv.fecha_retiro_empresa1), customFont);
      this.setText(form, 'Motivo de RetiroRow1', this.safe(dv.motivo_retiro_empresa1), customFont);

      // Referencias Personales y Familiares
      const referencias: any[] = Array.isArray(cand.referencias) ? cand.referencias : [];
      const refPer = referencias.filter(r => norm(r.tipo_referencia_nombre ?? r.tipo).includes('PERSONAL'));
      const refFam = referencias.filter(r => norm(r.tipo_referencia_nombre ?? r.tipo).includes('FAMILIAR'));

      if (refPer[0]) {
        this.setText(form, 'Nombre Referencia 1Row1', this.safe(refPer[0].nombre_completo ?? refPer[0].nombre), customFont);
        this.setText(form, 'TeléfonosRow1_3', this.safe(refPer[0].celular ?? refPer[0].telefono), customFont);
        this.setText(form, 'OcupaciónRow1_4', this.safe(refPer[0].profesion ?? refPer[0].ocupacion), customFont);
        this.setText(form, 'PersonaRefencia1P', this.safe(refPer[0].nombre_completo ?? refPer[0].nombre), customFont);
        this.setText(form, 'Comentarios de las Referencias Pesonales 1', this.safe(refPer[0].observacion), customFont);
      }
      if (refPer[1]) {
        this.setText(form, 'Nombre Referencia 2Row1', this.safe(refPer[1].nombre_completo ?? refPer[1].nombre), customFont);
        this.setText(form, 'TeléfonosRow1_4', this.safe(refPer[1].celular ?? refPer[1].telefono), customFont);
        this.setText(form, 'OcupaciónRow1_5', this.safe(refPer[1].profesion ?? refPer[1].ocupacion), customFont);
        this.setText(form, 'PersonaRefencia2P', this.safe(refPer[1].nombre_completo ?? refPer[1].nombre), customFont);
        this.setText(form, 'Comentarios de las Referencias Pesonales 2', this.safe(refPer[1].observacion), customFont);
      }
      if (refFam[0]) {
        this.setText(form, 'Nombre Referencia 1Row1_2', this.safe(refFam[0].nombre_completo ?? refFam[0].nombre), customFont);
        this.setText(form, 'TeléfonosRow1_5', this.safe(refFam[0].celular ?? refFam[0].telefono), customFont);
        this.setText(form, 'OcupaciónRow1_6', this.safe(refFam[0].profesion ?? refFam[0].ocupacion), customFont);
        this.setText(form, 'PersonaRefencia1F', this.safe(refFam[0].nombre_completo ?? refFam[0].nombre), customFont);
        this.setText(form, 'Comentario referencia Familiar', this.safe(refFam[0].observacion), customFont);
      }
      if (refFam[1]) {
        this.setText(form, 'Nombre Referencia 1Row1_3', this.safe(refFam[1].nombre_completo ?? refFam[1].nombre), customFont);
        this.setText(form, 'TeléfonosRow1_6', this.safe(refFam[1].celular ?? refFam[1].telefono), customFont);
        this.setText(form, 'OcupaciónRow1_7', this.safe(refFam[1].profesion ?? refFam[1].ocupacion), customFont);
        this.setText(form, 'PersonaRefencia2F', this.safe(refFam[1].nombre_completo ?? refFam[1].nombre), customFont);
        this.setText(form, 'Comentario referencia Familiar 2', this.safe(refFam[1].observacion), customFont);
      }

      // Dotación / Tallas
      const tallas = cand.informacion_tallas_dotacion ?? cand.tallas ?? {};
      this.setText(form, 'TALLA CHAQUETARow1', this.safe(tallas.talla_camisa ?? tallas.chaqueta), customFont);
      this.setText(form, 'TALLA PANTALONRow1', this.safe(tallas.talla_pantalon ?? tallas.pantalon), customFont);
      this.setText(form, 'TALLA OVEROLRow1', this.safe(tallas.talla_overol ?? tallas.overol), customFont);
      this.setText(form, 'No calzadoRow1', this.safe(tallas.talla_zapatos ?? tallas.calzado), customFont);
      this.setText(form, 'No Botas de CauchoRow1', this.safe(tallas.botas_caucho), customFont);
      this.setText(form, 'No ZapatonesRow1', this.safe(tallas.zapatones), customFont);
      this.setText(form, 'No Botas MaterialRow1', this.safe(tallas.botas_material), customFont);

      // Textos Especiales / Autorización Empresa
      const nombreCand = [this.safe(dv.primer_nombre), this.safe(dv.segundo_nombre), this.safe(dv.primer_apellido), this.safe(dv.segundo_apellido)].filter(Boolean).join(' ');

      this.setText(form, 'AutorizacionDeEstudiosSeguridad2',
        empUsuaria ? `estudios de seguridad. De conformidad con lo dispuesto en la ley 1581 de 2012 y el decreto reglamentario 1377 de 2013 autorizo a ${empUsuaria} a consultar en cualquier momento ante las centrales de riesgo la información comercial a mi nombre.` : '',
        customFont, 6
      );
      this.setText(form, 'empresa', empUsuaria, customFont);
      this.setText(form, 'CedulaAutorizacion', this.safe(dv.numerodeceduladepersona), customFont);

      this.setText(form, 'TEXTOCARNET', `me comprometo a presentar ante ${empUsuaria} fotocopia del denuncio correspondiente y en el caso de aparecer el carnet perdido lo devolveré a la empresa para su respectiva anulación.`, customFont, 6);

      let tipoDoc = this.safe(dv.tipodedocumento).toUpperCase();
      if (tipoDoc.includes('CC') || tipoDoc.includes('CIUDADAN')) tipoDoc = 'Cedula de Ciudadania';
      else if (tipoDoc.includes('CE') || tipoDoc.includes('EXTRANJE')) tipoDoc = 'Cedula de Extranjeria';
      else if (tipoDoc.includes('PEP')) tipoDoc = 'Permiso Especial de Permanencia';
      else if (tipoDoc.includes('PA')) tipoDoc = 'Pasaporte';

      this.setText(form, 'TEXTOLOCKER5', `Yo, ${nombreCand} identificado(a) con ${tipoDoc} No ${this.safe(dv.numerodeceduladepersona)} declaro haber recibido el Loker relacionado abajo y me comprometo a seguir las recomendaciones y políticas de uso y cuidado de estós, y a devolver el Loker en el mismo estado en que me fue asignado al momento de la finalización de mi relación laboral y antes de la entrega de la liquidación de contrato`, customFont, 6);

      // Firmas Biométricas y Administrativas
      this.setText(form, 'Persona que firma', this.safe(`${this.user?.datos_basicos?.nombres ?? ''} ${this.user?.datos_basicos?.apellidos ?? ''}`.trim()), customFont);

      await setButtonImageSafe(pdfDoc, form, 'Image15_af_image', this.firmaPersonalAdministrativo);
      await setButtonImageSafe(pdfDoc, form, 'Image11_af_image', firmaUrl);
      await setButtonImageSafe(pdfDoc, form, 'Image10_af_image', huellaUrl);
      await setButtonImageSafe(pdfDoc, form, 'Image17_af_image', fotoUrl);

      // Bloquear campos
      form.getFields().forEach((f: any) => { try { f.enableReadOnly(); } catch { } });

      // Guardar PDF
      const pdfBytes = await pdfDoc.save();
      const ab = this.toSafeArrayBuffer(pdfBytes);
      const file = new File([ab], 'Ficha tecnica.pdf', { type: 'application/pdf' });

      this.uploadedFiles['Ficha técnica'] = { file, fileName: 'Ficha tecnica.pdf' };
      this.verPDF({ titulo: 'Ficha técnica' });
    } catch (error) {
      console.error('Error generando ficha técnica:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al generar la ficha técnica.' });
    }
  }

  // Asegúrate de tener estos imports en el archivo:
  // import { firstValueFrom, of } from 'rxjs';
  // import { catchError, take } from 'rxjs/operators';

  async generarFichaTecnicaTuAlianza() {
    let datoContratacion: any = {};

    try {
      // =========================================================
      // 0) ESPERAR a que llegue la contratación ANTES de continuar
      // =========================================================
      const numeroDoc = String(this.candidato?.numero_documento ?? '').trim();
      if (!numeroDoc) throw new Error('El candidato no tiene número de documento.');

      const respContratacion: any = await firstValueFrom(
        this.contratacionService.buscarEncontratacion(numeroDoc).pipe(
          take(1),
          catchError((err) => {
            console.error('Error buscando contratación:', err);
            return of({ data: [] });
          })
        )
      );

      console.log('Datos de contratación recibidos:', respContratacion);
      datoContratacion = respContratacion?.data?.[0] ?? {};
      console.log('Dato de contratación para ficha técnica Tu Alianza:', datoContratacion);

      // =========================================================
      // 0) Helpers de imagen (PDF-lib) - robustos + NO SE VOLTEA
      // =========================================================
      const bytesCache = new Map<string, Promise<ArrayBuffer | null>>();

      const isHttp = (u: string) => /^https?:\/\//i.test(u);
      const isDataUrl = (u: string) => /^data:image\//i.test(u);

      const normalizeUrl = (u: string) => {
        const s = String(u ?? '').trim();
        if (!s) return '';
        if (isHttp(s) || isDataUrl(s)) return s;

        const clean = s.replace(/^\/+/, '');
        if (clean.startsWith('assets/')) return clean;

        return `assets/${clean}`;
      };

      const dataUrlToBytes = (dataUrl: string): ArrayBuffer | null => {
        try {
          const [meta, b64] = dataUrl.split(',');
          if (!meta || !b64) return null;
          const bin = atob(b64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
          return bytes.buffer;
        } catch {
          return null;
        }
      };

      const detectImageType = (ab: ArrayBuffer): 'png' | 'jpg' | null => {
        const b = new Uint8Array(ab);
        if (
          b.length >= 8 &&
          b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
          b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A
        ) return 'png';

        if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';

        return null;
      };

      const fetchBytesOrNull = async (urlOrData?: string): Promise<ArrayBuffer | null> => {
        const raw = String(urlOrData ?? '').trim();
        if (!raw) return null;

        if (isDataUrl(raw)) return dataUrlToBytes(raw);

        const url = normalizeUrl(raw);
        if (!url) return null;

        if (bytesCache.has(url)) return await bytesCache.get(url)!;

        const p = (async () => {
          try {
            const ab = await this.fetchAsArrayBufferOrNull(url);
            if (ab) return ab;
          } catch { }

          if (!isHttp(raw) && !raw.startsWith('assets/') && !isDataUrl(raw)) {
            try {
              const ab2 = await this.fetchAsArrayBufferOrNull(raw);
              if (ab2) return ab2;
            } catch { }
          }

          return null;
        })();

        bytesCache.set(url, p);
        return await p;
      };

      type ImgFixOpts = {
        forcePortrait?: boolean; // si viene horizontal, lo gira para que quede vertical
        jpegQuality?: number;    // 0..1
      };

      const fixImageBytesForPdf = async (
        ab: ArrayBuffer,
        kind: 'png' | 'jpg',
        opts?: ImgFixOpts
      ): Promise<{ bytes: Uint8Array; outKind: 'png' | 'jpg' }> => {
        const forcePortrait = opts?.forcePortrait ?? false;
        const jpegQuality = opts?.jpegQuality ?? 0.92;

        try {
          const mime = kind === 'png' ? 'image/png' : 'image/jpeg';
          const blob = new Blob([ab], { type: mime });

          // 1) Decodifica respetando EXIF cuando el browser lo soporta
          let bitmap: ImageBitmap | null = null;
          try {
            bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
          } catch {
            bitmap = await createImageBitmap(blob).catch(() => null);
          }

          // 2) Fuente para dibujar (bitmap o <img>)
          const getSource = async (): Promise<{
            w: number;
            h: number;
            draw: (ctx: CanvasRenderingContext2D) => void;
            close?: () => void;
          } | null> => {
            if (bitmap) {
              const w = bitmap.width;
              const h = bitmap.height;
              return {
                w,
                h,
                draw: (ctx) => ctx.drawImage(bitmap as ImageBitmap, 0, 0),
                close: () => bitmap?.close?.()
              };
            }

            const url = URL.createObjectURL(blob);
            try {
              const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = reject;
                el.src = url;
              });

              const w = img.naturalWidth || img.width;
              const h = img.naturalHeight || img.height;
              return { w, h, draw: (ctx) => ctx.drawImage(img, 0, 0) };
            } finally {
              URL.revokeObjectURL(url);
            }
          };

          const src = await getSource();
          if (!src) return { bytes: new Uint8Array(ab), outKind: kind };

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            src.close?.();
            return { bytes: new Uint8Array(ab), outKind: kind };
          }

          // 3) ✅ FORZAR “VERTICAL” si viene horizontal
          if (forcePortrait && src.w > src.h) {
            canvas.width = src.h;
            canvas.height = src.w;
            ctx.translate(canvas.width, 0);
            ctx.rotate(Math.PI / 2);
            src.draw(ctx);
          } else {
            canvas.width = src.w;
            canvas.height = src.h;
            src.draw(ctx);
          }

          src.close?.();

          // 4) Exporta al mismo formato (png/png, jpg/jpg)
          const outMime = kind === 'png' ? 'image/png' : 'image/jpeg';
          const outBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
              outMime,
              outMime === 'image/jpeg' ? jpegQuality : undefined
            );
          });

          return { bytes: new Uint8Array(await outBlob.arrayBuffer()), outKind: kind };
        } catch {
          return { bytes: new Uint8Array(ab), outKind: kind };
        }
      };

      const embedImageOrNull = async (
        pdfDoc: PDFDocument,
        urlOrData?: string,
        opts?: ImgFixOpts
      ) => {
        const ab = await fetchBytesOrNull(urlOrData);
        if (!ab) return null;

        const kind = detectImageType(ab);
        if (!kind) return null;

        try {
          const fixed = await fixImageBytesForPdf(ab, kind, opts);
          return fixed.outKind === 'png'
            ? await pdfDoc.embedPng(fixed.bytes)
            : await pdfDoc.embedJpg(fixed.bytes);
        } catch {
          return null;
        }
      };

      const setButtonImageSafe = async (
        pdfDoc: PDFDocument,
        form: any,
        buttonName: string,
        urlOrData?: string,
        opts?: ImgFixOpts
      ) => {
        const img = await embedImageOrNull(pdfDoc, urlOrData, opts);
        if (!img) return false;
        try {
          form.getButton(buttonName).setImage(img);
          return true;
        } catch {
          return false;
        }
      };

      // =========================================================
      // 1) Normalización desde this.candidato y this.vacante
      // =========================================================
      const cand: any = this.candidato ?? {};
      console.log('Candidato para ficha técnica Tu Alianza:', cand);
      const vac: any = this.vacante ?? {};
      console.log('Vacante para ficha técnica Tu Alianza:', vac);

      const contacto: any = cand.contacto ?? {};
      const residencia: any = cand.residencia ?? {};
      const infoCc: any = cand.info_cc ?? {};

      const entrevista: any = Array.isArray(cand.entrevistas) ? cand.entrevistas[0] : null;
      const proceso: any = entrevista?.proceso ?? {};
      const contrato: any = proceso?.contrato ?? {};
      const antecedentes: any[] = Array.isArray(proceso?.antecedentes) ? proceso.antecedentes : [];

      const norm = (v: any) => String(v ?? '').trim().toUpperCase();
      const findAnte = (nombre: string) => antecedentes.find(a => norm(a?.nombre) === norm(nombre));

      const eps = String(findAnte('EPS')?.observacion ?? '');
      const afp = String(findAnte('AFP')?.observacion ?? '');

      const mapEstadoCivil = (code: any): string => {
        const c = norm(code);
        if (c === 'SO' || c === 'SOLTERO' || c === 'S') return 'SO';
        if (c === 'CA' || c === 'CASADO') return 'CA';
        if (c === 'UN' || c === 'UL' || c === 'UNION LIBRE' || c === 'UNIÓN LIBRE') return 'UN';
        if (c === 'SE' || c === 'SEP' || c === 'SEPARADO') return 'SE';
        if (c === 'VI' || c === 'VIUDO') return 'VI';
        return c || '';
      };

      const nombreCompleto = [
        cand.primer_nombre,
        cand.segundo_nombre,
        cand.primer_apellido,
        cand.segundo_apellido,
      ]
        .map((x: any) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' ');

      const codigoContrato = String(contrato?.codigo_contrato ?? proceso?.contrato_codigo ?? '').trim();

      const fechaIngreso = String(vac?.fechadeIngreso ?? '').trim();
      const salario = vac?.salario ?? proceso?.vacante_salario ?? '';

      const formacion0: any = Array.isArray(cand.formaciones) ? cand.formaciones[0] : null;
      const exp0: any = Array.isArray(cand.experiencias) ? cand.experiencias[0] : null;

      const dv: any = {
        primer_apellido: cand.primer_apellido ?? '',
        segundo_apellido: cand.segundo_apellido ?? '',
        primer_nombre: cand.primer_nombre ?? '',
        segundo_nombre: cand.segundo_nombre ?? '',

        tipodedocumento: cand.tipo_doc ?? '',
        numerodeceduladepersona: cand.numero_documento ?? '',

        fecha_expedicion_cc: infoCc?.fecha_expedicion ?? '',
        departamento_expedicion_cc: infoCc?.depto_expedicion ?? '',
        municipio_expedicion_cc: infoCc?.mpio_expedicion ?? '',

        genero: cand.sexo ?? '',
        fecha_nacimiento: cand.fecha_nacimiento ?? '',
        lugar_nacimiento_departamento: infoCc?.depto_nacimiento ?? '',
        lugar_nacimiento_municipio: infoCc?.mpio_nacimiento ?? '',

        estado_civil: mapEstadoCivil(cand.estado_civil),

        direccion_residencia: residencia?.direccion ?? '',
        barrio: residencia?.barrio ?? '',
        municipio: (vac?.municipio?.[0] ?? entrevista?.oficina ?? '').toString(),
        departamento: '',

        celular: contacto?.celular ?? '',
        primercorreoelectronico: contacto?.email ?? '',

        rh: cand.rh ?? '',
        zurdo_diestro: cand.zurdo_diestro ?? '',

        escolaridad: formacion0?.nivel ?? '',
        nombre_institucion: formacion0?.institucion ?? '',
        titulo_obtenido: formacion0?.titulo_obtenido ?? '',
        ano_finalizacion: formacion0?.anio_finalizacion ?? '',

        nombre_expe_laboral1_empresa: exp0?.empresa ?? '',
        direccion_empresa1: exp0?.direccion ?? '',
        telefonos_empresa1: exp0?.telefonos ?? '',
        nombre_jefe_empresa1: exp0?.nombre_jefe ?? '',
        cargo_empresa1: exp0?.cargo ?? '',
        fecha_retiro_empresa1: exp0?.fecha_retiro ?? '',
        motivo_retiro_empresa1: exp0?.motivo_retiro ?? '',
      };

      const ds: any = {
        fechaIngreso,
        salario,
        eps,
        afp,
        cesantias: entrevista?.proceso?.contrato?.cesantias ?? '',
        cargo: vac?.cargo ?? '',
        centro_costo_entrevista: entrevista?.oficina ?? '',
        empresa_usuario: vac?.empresaUsuariaSolicita ?? '',
      };

      // =========================================================
      // 2) Cargar PDF base y setear campos
      // =========================================================
      const pdfUrl = 'Docs/FICHA FORANEOS TU ALIANZA.pdf';
      const arrayBuffer = await this.fetchAsArrayBufferOrNull(pdfUrl);
      if (!arrayBuffer) throw new Error('No se pudo cargar el PDF base.');

      const pdfDoc = await PDFDocument.load(arrayBuffer);
      pdfDoc.registerFontkit(fontkit as any);

      const fontBytes = await this.fetchAsArrayBufferOrNull('fonts/Roboto-Regular.ttf');
      const customFont = fontBytes ? await pdfDoc.embedFont(fontBytes) : undefined;

      const form = pdfDoc.getForm();

      // ✅ Imagen: nunca se voltea, siempre vertical
      await setButtonImageSafe(pdfDoc, form, 'Imagen1_af_image', this.foto, { forcePortrait: true });

      this.setText(form, '1er Apellido', this.safe(dv.primer_apellido), customFont);
      this.setText(form, '2do apellido', this.safe(dv.segundo_apellido), customFont);
      this.setText(
        form,
        'Nombres',
        [this.safe(dv.primer_nombre), this.safe(dv.segundo_nombre)].filter(Boolean).join(' '),
        customFont
      );
      this.setText(form, 'num-identificacion', this.safe(dv.numerodeceduladepersona), customFont);
      this.setText(form, 'No de Hijos', this.safe(datoContratacion?.num_hijos_dependen_economicamente ?? ''), customFont);
      this.setText(form, 'Email', this.safe(datoContratacion?.primercorreoelectronico), customFont);

      // helpers
      const pickText = (...vals: any[]) => {
        for (const v of vals) {
          const t = this.safe(v).trim();
          if (t) return t;
        }
        return '';
      };

      const pickDateDDMM = (...vals: any[]) => {
        for (const v of vals) {
          const d = this.parseDateToDDMMYYYY(v);
          const t = this.safe(d).trim();
          if (t) return t;
        }
        return '';
      };

      // Fecha y lugar de Expedición
      const expFecha = pickDateDDMM(dv?.fecha_expedicion_cc, datoContratacion?.fecha_expedicion_cc);
      const expLugar = pickText(dv?.municipio_expedicion_cc, datoContratacion?.municipio_expedicion_cc);

      this.setText(
        form,
        'Fecha y lugar de Expediciòn',
        [expFecha, expLugar].filter(Boolean).join(' '),
        customFont
      );

      // Fecha y lugar de Nacimiento
      const nacFecha = pickDateDDMM(dv?.fecha_nacimiento, datoContratacion?.fecha_nacimiento);
      const nacLugar = pickText(dv?.lugar_nacimiento_municipio, datoContratacion?.lugar_nacimiento_municipio);

      this.setText(
        form,
        'Fecha y lugar de Nacimiento',
        [nacFecha, nacLugar].filter(Boolean).join(' '),
        customFont
      );

      // Dirección
      this.setText(
        form,
        'Dirección',
        pickText(dv?.direccion_residencia, datoContratacion?.direccion_residencia),
        customFont
      );

      // Mun + Barrio
      const munVal = pickText(dv?.municipio, datoContratacion?.municipio);
      const barVal = pickText(dv?.barrio, datoContratacion?.barrio);
      this.setText(form, 'Mun Bar', [munVal, barVal].filter(Boolean).join(' - '), customFont);

      // Dies/Zurd
      this.setText(
        form,
        'DiesZurd',
        pickText(dv?.zurdo_diestro, datoContratacion?.zurdo_diestro),
        customFont
      );

      // RH
      this.setText(
        form,
        'RH',
        pickText(dv?.rh, datoContratacion?.rh),
        customFont
      );

      // PlanFunerario
      const siNo = this.candidato?.entrevistas?.[0]?.proceso?.contrato?.seguro_funerario ? 'SI' : 'NO';
      this.setText(form, 'PlanFunerario', `Desea afiliarse al plan funerario : ${siNo}`, customFont, 6);

      this.setText(form, 'Celular', this.safe(dv.celular), customFont);
      this.setText(form, 'Estado Civil', this.safe(dv.estado_civil), customFont);
      this.setText(form, 'Correo Electrónico', this.safe(dv.primercorreoelectronico), customFont);
      this.setText(form, 'EPS', this.safe(ds.eps), customFont);
      this.setText(form, 'AFP', this.safe(ds.afp), customFont);
      this.setText(form, 'AFC', this.safe(ds.cesantias ?? ''), customFont);

      // escolaridad
      this.setText(form, 'escolaridad', this.safe(datoContratacion?.escolaridad ?? ''), customFont);
      this.setText(form, 'Nombre de la Instit', this.safe(datoContratacion?.nombre_institucion ?? ''), customFont);
      this.setText(form, 'UniversidadAño Finalización', this.safe(datoContratacion?.ano_finalizacion ?? ''), customFont);
      this.setText(form, 'Titulo Obtenido o Ultimo Cursado', this.safe(datoContratacion?.titulo_obtenido ?? ''), customFont);

      // info familiar
      this.setText(form, 'Nombre y apellido padre', this.safe(datoContratacion?.nombre_padre ?? ''), customFont);
      this.setText(form, 'Vive', this.safe(datoContratacion?.vive_padre ?? ''), customFont);
      this.setText(form, 'Ocupación', this.safe(datoContratacion?.ocupacion_padre ?? ''), customFont);
      this.setText(form, 'Dirección_2', this.safe(datoContratacion?.direccion_padre ?? ''), customFont);
      this.setText(form, 'Teléfono', this.safe(datoContratacion?.telefono_padre ?? ''), customFont);
      this.setText(form, 'BarrioMunicipio', this.safe(datoContratacion?.barrio_padre ?? ''), customFont);

      this.setText(form, 'Nombre y apellido madre', this.safe(datoContratacion?.nombre_madre ?? ''), customFont);
      this.setText(form, 'Vive_2', this.safe(datoContratacion?.vive_madre ?? ''), customFont);
      this.setText(form, 'Ocupación_2', this.safe(datoContratacion?.ocupacion_madre ?? ''), customFont);
      this.setText(form, 'Dirección_3', this.safe(datoContratacion?.direccion_madre ?? ''), customFont);
      this.setText(form, 'Teléfono_2', this.safe(datoContratacion?.telefono_madre ?? ''), customFont);
      this.setText(form, 'BarrioMunicipio_2', this.safe(datoContratacion?.barrio_madre ?? ''), customFont);

      this.setText(
        form,
        'Nombreyapellidoconyuge',
        this.safe(`${datoContratacion?.nombre_conyugue ?? ''} ${datoContratacion?.apellido_conyugue ?? ''}`.trim()),
        customFont
      );
      this.setText(form, 'Ocupación_3', this.safe(datoContratacion?.ocupacion_conyugue ?? ''), customFont);
      this.setText(form, 'Dirección_4', this.safe(datoContratacion?.direccion_conyugue ?? ''), customFont);
      this.setText(form, 'Teléfono_3', this.safe(datoContratacion?.telefono_conyugue ?? ''), customFont);
      this.setText(form, 'BarrioMunicipio_3', this.safe(datoContratacion?.barrio_municipio_conyugue ?? ''), customFont);

      this.setText(form, 'Familiar en caso de Emergencia', this.safe(datoContratacion?.familiar_emergencia ?? ''), customFont);
      this.setText(form, 'Parentesco', this.safe(datoContratacion?.parentesco_familiar_emergencia ?? ''), customFont);
      this.setText(form, 'Ocupación_4', this.safe(datoContratacion?.ocupacion_familiar_emergencia ?? ''), customFont);
      this.setText(form, 'Dirección_5', this.safe(datoContratacion?.direccion_familiar_emergencia ?? ''), customFont);
      this.setText(form, 'Teléfono_4', this.safe(datoContratacion?.telefono_familiar_emergencia ?? ''), customFont);
      this.setText(form, 'BarrioMunicipio_4', this.safe(datoContratacion?.barrio_familiar_emergencia ?? ''), customFont);

      const hijos = Array.isArray(datoContratacion?.hijos) ? datoContratacion!.hijos : [];

      const parseYmd = (ymd: string) => {
        const [y, m, d] = ymd.split('-').map(n => Number(n));
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d);
      };
      const formatDate = (ymd: string) => {
        const dt = parseYmd(ymd);
        if (!dt) return '';
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yyyy = dt.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };
      const calcAge = (ymd: string) => {
        const birth = parseYmd(ymd);
        if (!birth) return '';
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age < 0 ? '' : String(age);
      };

      for (let i = 0; i < 5; i++) {
        const idx = i + 1;
        const h = hijos[i] ?? {};

        const nombre = norm((h as any).nombre);
        const sexo = norm((h as any).sexo);
        const fechaRaw = String((h as any).fecha_nacimiento ?? '').trim();
        const noDoc = norm((h as any).no_documento);
        const ocupacion = norm((h as any).estudia_o_trabaja);
        const curso = norm((h as any).curso);

        this.setText(form, `nombre_hijo_${idx}`, this.safe(nombre), customFont);
        this.setText(form, `fecha_nac_hijo_${idx}`, this.safe(formatDate(fechaRaw)), customFont);
        this.setText(form, `no_iden_hijo_${idx}`, this.safe(noDoc), customFont);
        this.setText(form, `sexo_hijo_${idx}`, this.safe(sexo), customFont);
        this.setText(form, `edad_hijo_${idx}`, this.safe(calcAge(fechaRaw)), customFont);
        this.setText(form, `ocupacion_hijo_${idx}`, this.safe(ocupacion), customFont);
        this.setText(form, `curso_hijo_${idx}`, this.safe(curso), customFont);
      }

      this.setText(form, 'TALLA CHAQUETA', this.safe(datoContratacion.chaqueta ?? ''), customFont);
      this.setText(form, 'TALLA PANTALON', this.safe(datoContratacion.pantalon ?? ''), customFont);
      this.setText(form, 'TALLA OVEROL', this.safe(datoContratacion.camisa ?? ''), customFont);
      this.setText(form, 'No calzado', this.safe(datoContratacion.calzado ?? ''), customFont);
      this.setText(form, 'No Botas de Caucho', this.safe(datoContratacion.calzado ?? ''), customFont);
      this.setText(form, 'No Zapatones', this.safe(datoContratacion.calzado ?? ''), customFont);
      this.setText(form, 'No Botas Material', this.safe(datoContratacion.calzado ?? ''), customFont);
      this.setText(form, 'No Botas Material', this.safe(datoContratacion.calzado ?? ''), customFont);

      this.setText(form, 'Nombre Empresa', this.safe(datoContratacion.nombre_expe_laboral1_empresa ?? ''), customFont);
      this.setText(form, 'Dirección Empresa', this.safe(datoContratacion.direccion_empresa1 ?? ''), customFont);
      this.setText(form, 'Teléfonos', this.safe(datoContratacion.telefonos_empresa1 ?? ''), customFont);
      this.setText(form, 'Jefe Inmediato', this.safe(datoContratacion.nombre_jefe_empresa1 ?? ''), customFont);
      this.setText(form, 'Cargo', this.safe(datoContratacion.cargo_empresa1 ?? ''), customFont);
      this.setText(form, 'F de Retiro', this.safe(datoContratacion.fecha_retiro_empresa1 ?? ''), customFont);
      this.setText(
        form,
        'motivoretiro',
        this.safe(`Motivo de retiro: ${datoContratacion?.motivo_retiro_empresa1 ?? ''}`),
        customFont
      );

      // referencias personales
      this.setText(form, '1', this.safe(datoContratacion.nombre_referencia_personal1 ?? ''), customFont);
      this.setText(form, 'Teléfonos1', this.safe(datoContratacion.telefono_referencia_personal1 ?? ''), customFont);
      this.setText(form, 'Ocupación1', this.safe(datoContratacion.ocupacion_referencia_personal1 ?? ''), customFont);

      this.setText(form, '2', this.safe(datoContratacion.nombre_referencia_personal2 ?? ''), customFont);
      this.setText(form, 'Teléfonos2', this.safe(datoContratacion.telefono_referencia_personal2 ?? ''), customFont);
      this.setText(form, 'Ocupación2', this.safe(datoContratacion.ocupacion_referencia_personal2 ?? ''), customFont);

      // referencias familiares
      this.setText(form, '1_2', this.safe(datoContratacion.nombre_referencia_familiar1 ?? ''), customFont);
      this.setText(form, 'Teléfonos1_2', this.safe(datoContratacion.telefono_referencia_familiar1 ?? ''), customFont);
      this.setText(form, 'Ocupación1_2', this.safe(datoContratacion.ocupacion_referencia_familiar1 ?? ''), customFont);

      this.setText(form, '2_2', this.safe(datoContratacion.nombre_referencia_familiar2 ?? ''), customFont);
      this.setText(form, 'Teléfonos2_2', this.safe(datoContratacion.telefono_referencia_familiar2 ?? ''), customFont);
      this.setText(form, 'Ocupación2_2', this.safe(datoContratacion.ocupacion_referencia_familiar2 ?? ''), customFont);

      this.setText(form, 'nombre-referencia-peronal1', this.safe(datoContratacion.nombre_referencia_personal1 ?? ''), customFont);
      this.setText(form, 'nombre-referencia-peronal2', this.safe(datoContratacion.nombre_referencia_personal2 ?? ''), customFont);
      this.setText(form, 'nombre-referencia-familiar1', this.safe(datoContratacion.nombre_referencia_familiar1 ?? ''), customFont);
      this.setText(form, 'nombre-referencia-familiar2', this.safe(datoContratacion.nombre_referencia_familiar2 ?? ''), customFont);

      // aleatorios descripciones (robusto y sin repetidos en el par)
      const normalize = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ');

      const pickTwoDistinct = (arr: readonly string[]): [string, string] => {
        const unique = Array.from(new Set((arr ?? []).map(normalize).filter(v => v.length > 0)));
        if (unique.length === 0) return ['', ''];
        if (unique.length === 1) return [unique[0], ''];
        const i = Math.floor(Math.random() * unique.length);
        const j = (i + 1 + Math.floor(Math.random() * (unique.length - 1))) % unique.length;
        return [unique[i], unique[j]];
      };

      const [personal1, personal2] = pickTwoDistinct(this.referenciasA);
      this.setText(form, 'descripcion-personal1', personal1, customFont);
      this.setText(form, 'descripcion-personal2', personal2, customFont);

      const [familiar1, familiar2] = pickTwoDistinct(this.referenciasF);
      this.setText(form, 'descripcion-familiar1', familiar1, customFont);
      this.setText(form, 'descripcion-familiar2', familiar2, customFont);

      // firmado
      console.log('Usuario que firma ficha técnica Tu Alianza:', this.nombreCompletoLogin);
      console.log('Cédula usuario que firma ficha técnica Tu Alianza:', this.cedulaPersonalAdministrativo);
      this.setText(
        form,
        'fimado',
        `C.C. ${this.safe(this.cedulaPersonalAdministrativo)} ${this.nombreCompletoLogin}`,
        customFont
      );

      // Bloquear campos
      form.getFields().forEach((f: any) => { try { f.enableReadOnly(); } catch { } });

      // Guardar PDF
      const pdfBytes = await pdfDoc.save();
      const ab = this.toSafeArrayBuffer(pdfBytes);
      const file = new File([ab], 'Ficha tecnica.pdf', { type: 'application/pdf' });

      this.uploadedFiles['Ficha técnica'] = { file, fileName: 'Ficha tecnica.pdf' };
      this.verPDF({ titulo: 'Ficha técnica' });
    } catch (error) {
      console.error('Error generando ficha técnica:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al generar la ficha técnica.' });
    }
  }


  async generarFichaTecnicaTuAlianzaCompleta() {
    let datoContratacion: any = {};

    try {
      // =========================================================
      // 0) ESPERAR a que llegue la contratación ANTES de continuar
      // =========================================================
      const numeroDoc = String(this.candidato?.numero_documento ?? '').trim();
      if (!numeroDoc) throw new Error('El candidato no tiene número de documento.');

      const respContratacion: any = await firstValueFrom(
        this.contratacionService.buscarEncontratacion(numeroDoc).pipe(
          take(1),
          catchError((err) => {
            console.error('Error buscando contratación:', err);
            return of({ data: [] });
          })
        )
      );

      console.log('Datos de contratación recibidos:', respContratacion);
      datoContratacion = respContratacion?.data?.[0] ?? {};
      console.log('Dato de contratación para ficha técnica Tu Alianza:', datoContratacion);

      // =========================================================
      // 0) Helpers de imagen (PDF-lib) - robustos como en jsPDF
      // =========================================================
      const bytesCache = new Map<string, Promise<ArrayBuffer | null>>();

      const isHttp = (u: string) => /^https?:\/\//i.test(u);
      const isDataUrl = (u: string) => /^data:image\//i.test(u);

      const normalizeUrl = (u: string) => {
        const s = String(u ?? '').trim();
        if (!s) return '';
        if (isHttp(s) || isDataUrl(s)) return s;

        const clean = s.replace(/^\/+/, '');
        if (clean.startsWith('assets/')) return clean;

        return `assets/${clean}`;
      };

      const dataUrlToBytes = (dataUrl: string): ArrayBuffer | null => {
        try {
          const [meta, b64] = dataUrl.split(',');
          if (!meta || !b64) return null;
          const bin = atob(b64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
          return bytes.buffer;
        } catch {
          return null;
        }
      };

      const detectImageType = (ab: ArrayBuffer): 'png' | 'jpg' | null => {
        const b = new Uint8Array(ab);
        if (
          b.length >= 8 &&
          b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
          b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A
        ) return 'png';

        if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';

        return null;
      };

      const fetchBytesOrNull = async (urlOrData?: string): Promise<ArrayBuffer | null> => {
        const raw = String(urlOrData ?? '').trim();
        if (!raw) return null;

        if (isDataUrl(raw)) return dataUrlToBytes(raw);

        const url = normalizeUrl(raw);
        if (!url) return null;

        if (bytesCache.has(url)) return await bytesCache.get(url)!;

        const p = (async () => {
          try {
            const ab = await this.fetchAsArrayBufferOrNull(url);
            if (ab) return ab;
          } catch { }

          if (!isHttp(raw) && !raw.startsWith('assets/') && !isDataUrl(raw)) {
            try {
              const ab2 = await this.fetchAsArrayBufferOrNull(raw);
              if (ab2) return ab2;
            } catch { }
          }

          return null;
        })();

        bytesCache.set(url, p);
        return await p;
      };

      const embedImageOrNull = async (pdfDoc: PDFDocument, urlOrData?: string) => {
        const ab = await fetchBytesOrNull(urlOrData);
        if (!ab) return null;

        const kind = detectImageType(ab);
        if (!kind) return null;

        try {
          const u8 = new Uint8Array(ab);
          return kind === 'png' ? await pdfDoc.embedPng(u8) : await pdfDoc.embedJpg(u8);
        } catch {
          return null;
        }
      };

      const setButtonImageSafe = async (
        pdfDoc: PDFDocument,
        form: any,
        buttonName: string,
        urlOrData?: string
      ) => {
        const img = await embedImageOrNull(pdfDoc, urlOrData);
        if (!img) return false;
        try {
          form.getButton(buttonName).setImage(img);
          return true;
        } catch {
          return false;
        }
      };

      // =========================================================
      // 1) Normalización desde this.candidato y this.vacante
      // =========================================================
      const cand: any = this.candidato ?? {};
      console.log('Candidato para ficha técnica Tu Alianza:', cand);
      const vac: any = this.vacante ?? {};
      console.log('Vacante para ficha técnica Tu Alianza:', vac);

      const contacto: any = cand.contacto ?? {};
      const residencia: any = cand.residencia ?? {};
      const infoCc: any = cand.info_cc ?? {};

      const entrevista: any = Array.isArray(cand.entrevistas) ? cand.entrevistas[0] : null;
      const proceso: any = entrevista?.proceso ?? {};
      const contrato: any = proceso?.contrato ?? {};
      const antecedentes: any[] = Array.isArray(proceso?.antecedentes) ? proceso.antecedentes : [];

      const norm = (v: any) => String(v ?? '').trim().toUpperCase();
      const findAnte = (nombre: string) => antecedentes.find(a => norm(a?.nombre) === norm(nombre));

      const eps = String(findAnte('EPS')?.observacion ?? '');
      const afp = String(findAnte('AFP')?.observacion ?? '');

      const mapEstadoCivil = (code: any): string => {
        const c = norm(code);
        if (c === 'SO' || c === 'SOLTERO' || c === 'S') return 'SO';
        if (c === 'CA' || c === 'CASADO') return 'CA';
        if (c === 'UN' || c === 'UL' || c === 'UNION LIBRE' || c === 'UNIÓN LIBRE') return 'UN';
        if (c === 'SE' || c === 'SEP' || c === 'SEPARADO') return 'SE';
        if (c === 'VI' || c === 'VIUDO') return 'VI';
        return c || '';
      };

      const nombreCompleto = [
        cand.primer_nombre,
        cand.segundo_nombre,
        cand.primer_apellido,
        cand.segundo_apellido,
      ]
        .map((x: any) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' ');

      const codigoContrato = String(contrato?.codigo_contrato ?? proceso?.contrato_codigo ?? '').trim();

      const fechaIngreso = String(vac?.fechadeIngreso ?? '').trim();
      const salario = vac?.salario ?? proceso?.vacante_salario ?? '';

      const formacion0: any = Array.isArray(cand.formaciones) ? cand.formaciones[0] : null;
      const exp0: any = Array.isArray(cand.experiencias) ? cand.experiencias[0] : null;

      const dv: any = {
        primer_apellido: cand.primer_apellido ?? '',
        segundo_apellido: cand.segundo_apellido ?? '',
        primer_nombre: cand.primer_nombre ?? '',
        segundo_nombre: cand.segundo_nombre ?? '',

        tipodedocumento: cand.tipo_doc ?? '',
        numerodeceduladepersona: cand.numero_documento ?? '',

        fecha_expedicion_cc: infoCc?.fecha_expedicion ?? '',
        departamento_expedicion_cc: infoCc?.depto_expedicion ?? '',
        municipio_expedicion_cc: infoCc?.mpio_expedicion ?? '',

        genero: cand.sexo ?? '',
        fecha_nacimiento: cand.fecha_nacimiento ?? '',
        lugar_nacimiento_departamento: infoCc?.depto_nacimiento ?? '',
        lugar_nacimiento_municipio: infoCc?.mpio_nacimiento ?? '',

        estado_civil: mapEstadoCivil(cand.estado_civil),

        direccion_residencia: residencia?.direccion ?? '',
        barrio: residencia?.barrio ?? '',
        municipio: (vac?.municipio?.[0] ?? entrevista?.oficina ?? '').toString(),
        departamento: '',

        celular: contacto?.celular ?? '',
        primercorreoelectronico: contacto?.email ?? '',

        rh: cand.rh ?? '',
        zurdo_diestro: cand.zurdo_diestro ?? '',

        escolaridad: formacion0?.nivel ?? '',
        nombre_institucion: formacion0?.institucion ?? '',
        titulo_obtenido: formacion0?.titulo_obtenido ?? '',
        ano_finalizacion: formacion0?.anio_finalizacion ?? '',

        nombre_expe_laboral1_empresa: exp0?.empresa ?? '',
        direccion_empresa1: exp0?.direccion ?? '',
        telefonos_empresa1: exp0?.telefonos ?? '',
        nombre_jefe_empresa1: exp0?.nombre_jefe ?? '',
        cargo_empresa1: exp0?.cargo ?? '',
        fecha_retiro_empresa1: exp0?.fecha_retiro ?? '',
        motivo_retiro_empresa1: exp0?.motivo_retiro ?? '',
      };

      const ds: any = {
        fechaIngreso,
        salario,
        eps,
        afp,
        cesantias: entrevista.proceso?.contrato?.cesantias ?? '',
        cargo: vac?.cargo ?? '',
        centro_costo_entrevista: entrevista?.oficina ?? '',
        empresa_usuario: vac?.empresaUsuariaSolicita ?? '',
      };

      // =========================================================
      // 2) Cargar PDF base y setear campos
      // =========================================================
      const pdfUrl = 'Docs/FICHA FORANEOS TU ALIANZA COMPLETA.pdf';
      const arrayBuffer = await this.fetchAsArrayBufferOrNull(pdfUrl);
      if (!arrayBuffer) throw new Error('No se pudo cargar el PDF base.');

      const pdfDoc = await PDFDocument.load(arrayBuffer);
      pdfDoc.registerFontkit(fontkit as any);

      const fontBytes = await this.fetchAsArrayBufferOrNull('fonts/Roboto-Regular.ttf');
      const customFont = fontBytes ? await pdfDoc.embedFont(fontBytes) : undefined;

      const form = pdfDoc.getForm();

      // Imagen1_af_image
      await setButtonImageSafe(pdfDoc, form, 'Imagen1_af_image', this.foto);

      this.setText(form, '1er Apellido', this.safe(dv.primer_apellido), customFont);
      this.setText(form, '2do apellido', this.safe(dv.segundo_apellido), customFont);
      this.setText(
        form,
        'Nombres',
        [this.safe(dv.primer_nombre), this.safe(dv.segundo_nombre)].filter(Boolean).join(' '),
        customFont
      );
      // num-identificacion
      this.setText(form, 'num-identificacion', this.safe(dv.numerodeceduladepersona), customFont);
      // No de Hijos
      this.setText(form, 'No de Hijos', this.safe(datoContratacion?.num_hijos_dependen_economicamente ?? ''), customFont);
      // primercorreoelectronico
      this.setText(form, 'Email', this.safe(datoContratacion?.primercorreoelectronico), customFont);

      // helpers
      const pickText = (...vals: any[]) => {
        for (const v of vals) {
          const t = this.safe(v).trim();
          if (t) return t;
        }
        return '';
      };

      const pickDateDDMM = (...vals: any[]) => {
        for (const v of vals) {
          const d = this.parseDateToDDMMYYYY(v);
          const t = this.safe(d).trim();
          if (t) return t;
        }
        return '';
      };

      // ===============================
      // Fecha y lugar de Expedición
      // ===============================
      const expFecha = pickDateDDMM(dv?.fecha_expedicion_cc, datoContratacion?.fecha_expedicion_cc);
      const expLugar = pickText(dv?.municipio_expedicion_cc, datoContratacion?.municipio_expedicion_cc);

      this.setText(
        form,
        'Fecha y lugar de Expediciòn',
        [expFecha, expLugar].filter(Boolean).join(' '),
        customFont
      );

      // ===============================
      // Fecha y lugar de Nacimiento
      // ===============================
      const nacFecha = pickDateDDMM(dv?.fecha_nacimiento, datoContratacion?.fecha_nacimiento);
      const nacLugar = pickText(dv?.lugar_nacimiento_municipio, datoContratacion?.lugar_nacimiento_municipio);

      this.setText(
        form,
        'Fecha y lugar de Nacimiento',
        [nacFecha, nacLugar].filter(Boolean).join(' '),
        customFont
      );

      // Dirección (dv si tiene contenido; si no, candidato)
      this.setText(
        form,
        'Dirección',
        pickText(dv?.direccion_residencia, datoContratacion?.direccion_residencia),
        customFont
      );


      // Mun + Barrio: fallback por campo (dv->candidato) y luego une
      const munVal = pickText(dv?.municipio, datoContratacion?.municipio);
      const barVal = pickText(dv?.barrio, datoContratacion?.barrio);
      this.setText(form, 'Mun Bar', [munVal, barVal].filter(Boolean).join(' - '), customFont);

      // Dies/Zurd (dv si no está vacío; si no, candidato)
      this.setText(
        form,
        'DiesZurd',
        pickText(dv?.zurdo_diestro, datoContratacion?.zurdo_diestro),
        customFont
      );

      // RH (dv si no está vacío; si no, candidato)
      this.setText(
        form,
        'RH',
        pickText(dv?.rh, datoContratacion?.rh),
        customFont
      );


      // PlanFunerario
      const siNo = this.candidato?.entrevistas?.[0]?.proceso?.contrato?.seguro_funerario ? 'SI' : 'NO';

      this.setText(
        form,
        'PlanFunerario',
        `Desea afiliarse al plan funerario : ${siNo}`,
        customFont,
        6
      );

      this.setText(form, 'Celular', this.safe(dv.celular), customFont);
      this.setText(form, 'Estado Civil', this.safe(dv.estado_civil), customFont);
      this.setText(form, 'Correo Electrónico', this.safe(dv.primercorreoelectronico), customFont);
      this.setText(form, 'EPS', this.safe(ds.eps), customFont);
      this.setText(form, 'AFP', this.safe(ds.afp), customFont);
      this.setText(form, 'AFC', this.safe(ds.cesantias ?? ''), customFont);

      // escolaridad
      this.setText(form, 'escolaridad', this.safe(datoContratacion?.escolaridad ?? ''), customFont);
      this.setText(form, 'Nombre de la Instit', this.safe(datoContratacion?.nombre_institucion ?? ''), customFont);
      this.setText(form, 'UniversidadAño Finalización', this.safe(datoContratacion?.ano_finalizacion ?? ''), customFont);
      this.setText(form, 'Titulo Obtenido o Ultimo Cursado', this.safe(datoContratacion?.titulo_obtenido ?? ''), customFont);

      // info familiar
      this.setText(form, 'Nombre y apellido padre', this.safe(datoContratacion?.nombre_padre ?? ''), customFont);
      this.setText(form, 'Vive', this.safe(datoContratacion?.vive_padre ?? ''), customFont);
      this.setText(form, 'Ocupación', this.safe(datoContratacion?.ocupacion_padre ?? ''), customFont);
      this.setText(form, 'Dirección_2', this.safe(datoContratacion?.direccion_padre ?? ''), customFont);
      this.setText(form, 'Teléfono', this.safe(datoContratacion?.telefono_padre ?? ''), customFont);
      this.setText(form, 'BarrioMunicipio', this.safe(datoContratacion?.barrio_padre ?? ''), customFont);

      this.setText(form, 'Nombre y apellido madre', this.safe(datoContratacion?.nombre_madre ?? ''), customFont);
      this.setText(form, 'Vive_2', this.safe(datoContratacion?.vive_madre ?? ''), customFont);
      this.setText(form, 'Ocupación_2', this.safe(datoContratacion?.ocupacion_madre ?? ''), customFont);
      this.setText(form, 'Dirección_3', this.safe(datoContratacion?.direccion_madre ?? ''), customFont);
      this.setText(form, 'Teléfono_2', this.safe(datoContratacion?.telefono_madre ?? ''), customFont);
      this.setText(form, 'BarrioMunicipio_2', this.safe(datoContratacion?.barrio_madre ?? ''), customFont);

      this.setText(
        form,
        'Nombreyapellidoconyuge',
        this.safe(`${datoContratacion?.nombre_conyugue ?? ''} ${datoContratacion?.apellido_conyugue ?? ''}`.trim()),
        customFont
      );
      this.setText(form, 'Ocupación_3', this.safe(datoContratacion?.ocupacion_conyugue ?? ''), customFont);
      this.setText(form, 'Dirección_4', this.safe(datoContratacion?.direccion_conyugue ?? ''), customFont);
      this.setText(form, 'Teléfono_3', this.safe(datoContratacion?.telefono_conyugue ?? ''), customFont);
      this.setText(form, 'BarrioMunicipio_3', this.safe(datoContratacion?.barrio_municipio_conyugue ?? ''), customFont);

      this.setText(form, 'Familiar en caso de Emergencia', this.safe(datoContratacion?.familiar_emergencia ?? ''), customFont);
      this.setText(form, 'Parentesco', this.safe(datoContratacion?.parentesco_familiar_emergencia ?? ''), customFont);
      this.setText(form, 'Ocupación_4', this.safe(datoContratacion?.ocupacion_familiar_emergencia ?? ''), customFont);
      this.setText(form, 'Dirección_5', this.safe(datoContratacion?.direccion_familiar_emergencia ?? ''), customFont);
      this.setText(form, 'Teléfono_4', this.safe(datoContratacion?.telefono_familiar_emergencia ?? ''), customFont);
      this.setText(form, 'BarrioMunicipio_4', this.safe(datoContratacion?.barrio_familiar_emergencia ?? ''), customFont);


      const hijos = Array.isArray(datoContratacion?.hijos) ? datoContratacion!.hijos : [];

      const parseYmd = (ymd: string) => {
        // espera "YYYY-MM-DD"
        const [y, m, d] = ymd.split('-').map(n => Number(n));
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d); // local, evita desfases
      };
      const formatDate = (ymd: string) => {
        const dt = parseYmd(ymd);
        if (!dt) return '';
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yyyy = dt.getFullYear();
        return `${dd}/${mm}/${yyyy}`; // cambia si tu PDF quiere YYYY-MM-DD
      };
      const calcAge = (ymd: string) => {
        const birth = parseYmd(ymd);
        if (!birth) return '';
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age < 0 ? '' : String(age);
      };

      for (let i = 0; i < 5; i++) {
        const idx = i + 1;
        const h = hijos[i] ?? {};

        const nombre = norm((h as any).nombre);
        const sexo = norm((h as any).sexo);
        const fechaRaw = norm((h as any).fecha_nacimiento);
        const noDoc = norm((h as any).no_documento);
        const ocupacion = norm((h as any).estudia_o_trabaja);
        const curso = norm((h as any).curso);

        this.setText(form, `nombre_hijo_${idx}`, this.safe(nombre), customFont);
        this.setText(form, `fecha_nac_hijo_${idx}`, this.safe(formatDate(fechaRaw)), customFont);
        this.setText(form, `no_iden_hijo_${idx}`, this.safe(noDoc), customFont);
        this.setText(form, `sexo_hijo_${idx}`, this.safe(sexo), customFont);
        this.setText(form, `edad_hijo_${idx}`, this.safe(calcAge(fechaRaw)), customFont);
        this.setText(form, `ocupacion_hijo_${idx}`, this.safe(ocupacion), customFont);
        this.setText(form, `curso_hijo_${idx}`, this.safe(curso), customFont);
      }


      this.setText(form, 'TALLA CHAQUETA', this.safe(datoContratacion.chaqueta ?? ''), customFont);
      this.setText(form, 'TALLA PANTALON', this.safe(datoContratacion.pantalon ?? ''), customFont);
      this.setText(form, 'TALLA OVEROL', this.safe(datoContratacion.camisa ?? ''), customFont);
      this.setText(form, 'No calzado', this.safe(datoContratacion.calzado ?? ''), customFont);
      this.setText(form, 'No Botas de Caucho', this.safe(datoContratacion.calzado ?? ''), customFont);
      this.setText(form, 'No Zapatones', this.safe(datoContratacion.calzado ?? ''), customFont);
      this.setText(form, 'No Botas Material', this.safe(datoContratacion.calzado ?? ''), customFont);
      this.setText(form, 'No Botas Material', this.safe(datoContratacion.calzado ?? ''), customFont);

      this.setText(form, 'Nombre Empresa', this.safe(datoContratacion.nombre_expe_laboral1_empresa ?? ''), customFont);
      this.setText(form, 'Dirección Empresa', this.safe(datoContratacion.direccion_empresa1 ?? ''), customFont);
      this.setText(form, 'Teléfonos', this.safe(datoContratacion.telefonos_empresa1 ?? ''), customFont);
      this.setText(form, 'Jefe Inmediato', this.safe(datoContratacion.nombre_jefe_empresa1 ?? ''), customFont);
      this.setText(form, 'Cargo', this.safe(datoContratacion.cargo_empresa1 ?? ''), customFont);
      this.setText(form, 'F de Retiro', this.safe(datoContratacion.fecha_retiro_empresa1 ?? ''), customFont);
      // motivoretiro
      this.setText(
        form,
        'motivoretiro',
        this.safe(`Motivo de retiro: ${datoContratacion?.motivo_retiro_empresa1 ?? ''}`),
        customFont
      );

      // referencias personales
      this.setText(form, '1', this.safe(datoContratacion.nombre_referencia_personal1 ?? ''), customFont);
      this.setText(form, 'Teléfonos1', this.safe(datoContratacion.telefono_referencia_personal1 ?? ''), customFont);
      this.setText(form, 'Ocupación1', this.safe(datoContratacion.ocupacion_referencia_personal1 ?? ''), customFont);

      this.setText(form, '2', this.safe(datoContratacion.nombre_referencia_personal2 ?? ''), customFont);
      this.setText(form, 'Teléfonos2', this.safe(datoContratacion.telefono_referencia_personal2 ?? ''), customFont);
      this.setText(form, 'Ocupación2', this.safe(datoContratacion.ocupacion_referencia_personal2 ?? ''), customFont);

      // referencias familiares
      this.setText(form, '1_2', this.safe(datoContratacion.nombre_referencia_familiar1 ?? ''), customFont);
      this.setText(form, 'Teléfonos1_2', this.safe(datoContratacion.telefono_referencia_familiar1 ?? ''), customFont);
      this.setText(form, 'Ocupación1_2', this.safe(datoContratacion.ocupacion_referencia_familiar1 ?? ''), customFont);

      this.setText(form, '2_2', this.safe(datoContratacion.nombre_referencia_familiar2 ?? ''), customFont);
      this.setText(form, 'Teléfonos2_2', this.safe(datoContratacion.telefono_referencia_familiar2 ?? ''), customFont);
      this.setText(form, 'Ocupación2_2', this.safe(datoContratacion.ocupacion_referencia_familiar2 ?? ''), customFont);

      this.setText(form, 'nombre-referencia-peronal1', this.safe(datoContratacion.nombre_referencia_personal1 ?? ''), customFont);
      this.setText(form, 'nombre-referencia-peronal2', this.safe(datoContratacion.nombre_referencia_personal2 ?? ''), customFont);
      this.setText(form, 'nombre-referencia-familiar1', this.safe(datoContratacion.nombre_referencia_familiar1 ?? ''), customFont);
      this.setText(form, 'nombre-referencia-familiar2', this.safe(datoContratacion.nombre_referencia_familiar2 ?? ''), customFont);

      // aleatorios descripciones (robusto y sin repetidos en el par)
      const normalize = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ');

      const pickTwoDistinct = (arr: readonly string[]): [string, string] => {
        // 1) Normaliza, limpia vacíos y elimina duplicados reales
        const unique = Array.from(
          new Set((arr ?? []).map(normalize).filter(v => v.length > 0))
        );

        // 2) Casos límite
        if (unique.length === 0) return ['', ''];
        if (unique.length === 1) return [unique[0], '']; // ✅ NUNCA repite

        // 3) Selección aleatoria sin while infinito
        const i = Math.floor(Math.random() * unique.length);
        const j = (i + 1 + Math.floor(Math.random() * (unique.length - 1))) % unique.length;

        return [unique[i], unique[j]];
      };

      const [personal1, personal2] = pickTwoDistinct(this.referenciasA);
      this.setText(form, 'descripcion-personal1', personal1, customFont);
      this.setText(form, 'descripcion-personal2', personal2, customFont);

      const [familiar1, familiar2] = pickTwoDistinct(this.referenciasF);
      this.setText(form, 'descripcion-familiar1', familiar1, customFont);
      this.setText(form, 'descripcion-familiar2', familiar2, customFont);


      this.setText(form, 'finca_a', this.vacante.finca, customFont);
      this.setText(form, 'nombres_y_apellidos', datoContratacion.primer_nombre + ' ' + datoContratacion.segundo_nombre + ' ' + datoContratacion.primer_apellido + ' ' + datoContratacion.segundo_apellido, customFont);
      this.setText(form, 'numero_identificacion', this.cedula, customFont);

      // URLs biometría (NO base64)
      const firmaUrl = cand?.biometria?.firma?.file_url ?? cand?.biometria?.firma?.file ?? '';
      const fotoUrl = cand?.biometria?.foto?.file_url ?? cand?.biometria?.foto?.file ?? '';
      const huellaUrl = cand?.biometria?.huella?.file_url ?? cand?.biometria?.huella?.file ?? '';

      await setButtonImageSafe(pdfDoc, form, 'firma', firmaUrl);
      await setButtonImageSafe(pdfDoc, form, 'huella', huellaUrl);


      if (this.firma !== '') {
        setButtonImageSafe(pdfDoc, form, 'firma', this.firma);
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró la firma' });
        return;
      }


      this.setText(
        form,
        'fimado',
        `C.C. ${this.safe(this.cedulaPersonalAdministrativo)} ${this.nombreCompletoLogin}`,
        customFont
      );

      // Bloquear campos
      form.getFields().forEach((f: any) => { try { f.enableReadOnly(); } catch { } });

      // Guardar PDF
      const pdfBytes = await pdfDoc.save();
      const ab = this.toSafeArrayBuffer(pdfBytes);
      const file = new File([ab], 'Ficha tecnica.pdf', { type: 'application/pdf' });

      this.uploadedFiles['Ficha técnica'] = { file, fileName: 'Ficha tecnica.pdf' };
      this.verPDF({ titulo: 'Ficha técnica' });
    } catch (error) {
      console.error('Error generando ficha técnica:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al generar la ficha técnica.' });
    }
  }


  // =========================================================
  // ENTREGA_CARNETS_FLORES_ANDES (typeId 95)
  // Template: Docs/entrega_carnets.pdf
  // Campos: Nombre Trabajador, numero_identificacion, firma_af_image, fecha_ingreso
  // =========================================================
  async generarEntregaCarnets() {
    try {
      const cand: any = this.candidato ?? {};
      const vac: any = this.vacante ?? {};

      // ── Helpers locales de imagen (mismo patrón que generarFichaTecnicaTuAlianzaCompleta) ──
      const isDataUrl = (u: string) => /^data:image\//i.test(u);

      const dataUrlToBytes = (dataUrl: string): ArrayBuffer | null => {
        try {
          const [meta, b64] = dataUrl.split(',');
          if (!meta || !b64) return null;
          const bin = atob(b64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
          return bytes.buffer;
        } catch { return null; }
      };

      const detectImageType = (ab: ArrayBuffer): 'png' | 'jpg' | null => {
        const b = new Uint8Array(ab);
        if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
          b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return 'png';
        if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
        return null;
      };

      const fetchBytesOrNull = async (urlOrData?: string): Promise<ArrayBuffer | null> => {
        const raw = String(urlOrData ?? '').trim();
        if (!raw) return null;
        if (isDataUrl(raw)) return dataUrlToBytes(raw);
        try { return await this.fetchAsArrayBufferOrNull(raw); } catch { return null; }
      };

      const embedImageOrNull = async (pdfDoc: PDFDocument, urlOrData?: string) => {
        const ab = await fetchBytesOrNull(urlOrData);
        if (!ab) return null;
        const kind = detectImageType(ab);
        if (!kind) return null;
        try {
          const u8 = new Uint8Array(ab);
          return kind === 'png' ? await pdfDoc.embedPng(u8) : await pdfDoc.embedJpg(u8);
        } catch { return null; }
      };

      const setButtonImageSafe = async (
        pdfDoc: PDFDocument, form: any, buttonName: string, urlOrData?: string
      ) => {
        const img = await embedImageOrNull(pdfDoc, urlOrData);
        if (!img) return false;
        try { form.getButton(buttonName).setImage(img); return true; }
        catch { return false; }
      };
      // ── Fin helpers ──

      // Nombre completo: apellidos luego nombres
      const nombreTrabajador = [
        cand.primer_apellido, cand.segundo_apellido,
        cand.primer_nombre, cand.segundo_nombre,
      ].map((x: any) => String(x ?? '').trim()).filter(Boolean).join(' ').toUpperCase();

      const numIdentificacion = String(cand.numero_documento ?? '').trim();

      // Fecha de ingreso dd/mm/yyyy
      const fechaRaw = String(
        vac?.fechadeIngreso ?? vac?.fechaIngreso ?? cand?.entrevistas?.[0]?.proceso?.contrato?.fecha_ingreso ?? ''
      ).trim();
      let fechaIngreso = '';
      if (fechaRaw) {
        const d = new Date(fechaRaw);
        if (!isNaN(d.getTime())) {
          fechaIngreso = [
            String(d.getDate()).padStart(2, '0'),
            String(d.getMonth() + 1).padStart(2, '0'),
            d.getFullYear(),
          ].join('/');
        }
      }

      // 1) Cargar PDF plantilla
      const pdfUrl = 'Docs/entrega_carnets.pdf';
      const arrayBuffer = await this.fetchAsArrayBufferOrNull(pdfUrl);
      if (!arrayBuffer) throw new Error('No se pudo cargar el PDF de entrega de carnets.');

      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const form = pdfDoc.getForm();

      // 2) Llenar campos de texto
      this.setText(form, 'Nombre Trabajador', nombreTrabajador);
      this.setText(form, 'numero_identificacion', numIdentificacion);
      this.setText(form, 'fecha_ingreso', fechaIngreso);

      // 3) Firma → botón de imagen
      await setButtonImageSafe(pdfDoc, form, 'firma_af_image', this.firma);
      await setButtonImageSafe(pdfDoc, form, 'firma_trabajador_af_image', this.firmaPersonalAdministrativo);

      // 4) Bloquear campos y guardar
      form.getFields().forEach((f: any) => { try { f.enableReadOnly(); } catch { } });

      const pdfBytes = await pdfDoc.save();
      const ab = this.toSafeArrayBuffer(pdfBytes);
      const file = new File([ab], 'Entrega_carnets.pdf', { type: 'application/pdf' });

      this.uploadedFiles['Entrega carnets'] = { file, fileName: 'Entrega_carnets.pdf' };
      this.verPDF({ titulo: 'Entrega carnets' });
    } catch (error) {
      console.error('Error generando Entrega de Carnets:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al generar la Entrega de Carnets.' });
    }
  }


  // =========================================================
  // INDUCCION_CAPACITACION_FLORES_ANDES (typeId 96)
  // Template: Docs/induccion_capacitacion_andes.pdf
  // Campos: numero_documento, nombre_completo, fecha_ingreso, firma_af_image
  // =========================================================
  async generarInduccionCapacitacion() {
    try {
      const cand: any = this.candidato ?? {};
      const vac: any = this.vacante ?? {};

      // ── Helpers locales de imagen (mismo patrón que generarFichaTecnicaTuAlianzaCompleta) ──
      const isDataUrl = (u: string) => /^data:image\//i.test(u);

      const dataUrlToBytes = (dataUrl: string): ArrayBuffer | null => {
        try {
          const [meta, b64] = dataUrl.split(',');
          if (!meta || !b64) return null;
          const bin = atob(b64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
          return bytes.buffer;
        } catch { return null; }
      };

      const detectImageType = (ab: ArrayBuffer): 'png' | 'jpg' | null => {
        const b = new Uint8Array(ab);
        if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
          b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return 'png';
        if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
        return null;
      };

      const fetchBytesOrNull = async (urlOrData?: string): Promise<ArrayBuffer | null> => {
        const raw = String(urlOrData ?? '').trim();
        if (!raw) return null;
        if (isDataUrl(raw)) return dataUrlToBytes(raw);
        try { return await this.fetchAsArrayBufferOrNull(raw); } catch { return null; }
      };

      const embedImageOrNull = async (pdfDoc: PDFDocument, urlOrData?: string) => {
        const ab = await fetchBytesOrNull(urlOrData);
        if (!ab) return null;
        const kind = detectImageType(ab);
        if (!kind) return null;
        try {
          const u8 = new Uint8Array(ab);
          return kind === 'png' ? await pdfDoc.embedPng(u8) : await pdfDoc.embedJpg(u8);
        } catch { return null; }
      };

      const setButtonImageSafe = async (
        pdfDoc: PDFDocument, form: any, buttonName: string, urlOrData?: string
      ) => {
        const img = await embedImageOrNull(pdfDoc, urlOrData);
        if (!img) return false;
        try { form.getButton(buttonName).setImage(img); return true; }
        catch { return false; }
      };
      // ── Fin helpers ──

      const numeroDocumento = String(cand.numero_documento ?? '').trim();

      const nombreCompleto = [
        cand.primer_apellido, cand.segundo_apellido,
        cand.primer_nombre, cand.segundo_nombre,
      ].map((x: any) => String(x ?? '').trim()).filter(Boolean).join(' ').toUpperCase();

      // Fecha de ingreso dd/mm/yyyy
      const fechaRaw = String(
        vac?.fechadeIngreso ?? vac?.fechaIngreso ?? cand?.entrevistas?.[0]?.proceso?.contrato?.fecha_ingreso ?? ''
      ).trim();
      let fechaIngreso = '';
      if (fechaRaw) {
        const d = new Date(fechaRaw);
        if (!isNaN(d.getTime())) {
          fechaIngreso = [
            String(d.getDate()).padStart(2, '0'),
            String(d.getMonth() + 1).padStart(2, '0'),
            d.getFullYear(),
          ].join('/');
        }
      }

      // 1) Cargar PDF plantilla
      const pdfUrl = 'Docs/induccion_capacitacion_andes.pdf';
      const arrayBuffer = await this.fetchAsArrayBufferOrNull(pdfUrl);
      if (!arrayBuffer) throw new Error('No se pudo cargar el PDF de inducción y capacitación.');

      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const form = pdfDoc.getForm();

      // 2) Llenar campos de texto (tamaño 12)
      this.setText(form, 'numero_documento', numeroDocumento, undefined, 12);
      this.setText(form, 'nombre_completo', nombreCompleto, undefined, 12);
      this.setText(form, 'fecha_ingreso', fechaIngreso, undefined, 12);

      // 3) Firma → botón de imagen
      await setButtonImageSafe(pdfDoc, form, 'firma_af_image', this.firma);
      await setButtonImageSafe(pdfDoc, form, 'firma_trabajador_af_image', this.firmaPersonalAdministrativo);

      // 4) Bloquear campos y guardar
      form.getFields().forEach((f: any) => { try { f.enableReadOnly(); } catch { } });

      const pdfBytes = await pdfDoc.save();
      const ab = this.toSafeArrayBuffer(pdfBytes);
      const file = new File([ab], 'Induccion_capacitacion.pdf', { type: 'application/pdf' });

      this.uploadedFiles['Inducción capacitación'] = { file, fileName: 'Induccion_capacitacion.pdf' };
      this.verPDF({ titulo: 'Inducción capacitación' });
    } catch (error) {
      console.error('Error generando Inducción y Capacitación:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al generar la Inducción y Capacitación.' });
    }
  }


  // =========================================================
  // ✅ Imagen robusta (URL / base64 / dataURL / bytes)
  // =========================================================
  private isDataImageUrl(s: string): boolean {
    return /^data:image\/(png|jpe?g);base64,/i.test(s.trim());
  }

  private isLikelyUrl(s: string): boolean {
    const v = s.trim();
    return (
      /^https?:\/\//i.test(v) ||
      /^blob:/i.test(v) ||
      v.startsWith('/') ||
      v.startsWith('assets/') ||
      v.startsWith('Docs/')
    );
  }

  private isLikelyBase64(s: string): boolean {
    const v = s.trim();
    if (!v) return false;
    if (this.isLikelyUrl(v)) return false;
    if (v.includes('://') || v.includes('.') || v.includes('?') || v.includes('&')) return false;

    const clean = v.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/=_-]+$/.test(clean)) return false;
    return clean.length > 80;
  }

  private normalizeBase64(b64: string): string {
    let s = (b64 ?? '').trim();

    const m = s.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.*)$/i);
    if (m?.[1]) s = m[1];

    s = s.replace(/\s+/g, '');
    s = s.replace(/-/g, '+').replace(/_/g, '/');

    const pad = s.length % 4;
    if (pad) s += '='.repeat(4 - pad);

    return s;
  }


  // ==============================
  //  FORMATO SOLICITUD FLORES ANDES (typeId 97)
  // ==============================
  async generarFormatoSolicitud() {
    try {
      const cand: any = this.candidato ?? {};
      const vac: any = this.vacante ?? {};

      // ── Helpers locales de imagen ──
      const isDataUrl = (u: string) => /^data:image\//i.test(u);

      const dataUrlToBytes = (dataUrl: string): ArrayBuffer | null => {
        try {
          const [meta, b64] = dataUrl.split(',');
          if (!meta || !b64) return null;
          const bin = atob(b64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
          return bytes.buffer;
        } catch { return null; }
      };

      const detectImageType = (ab: ArrayBuffer): 'png' | 'jpg' | null => {
        const b = new Uint8Array(ab);
        if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
          b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return 'png';
        if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
        return null;
      };

      const fetchBytesOrNull = async (urlOrData?: string): Promise<ArrayBuffer | null> => {
        const raw = String(urlOrData ?? '').trim();
        if (!raw) return null;
        if (isDataUrl(raw)) return dataUrlToBytes(raw);
        try { return await this.fetchAsArrayBufferOrNull(raw); } catch { return null; }
      };

      const embedImageOrNull = async (pdfDoc: PDFDocument, urlOrData?: string) => {
        const ab = await fetchBytesOrNull(urlOrData);
        if (!ab) return null;
        const kind = detectImageType(ab);
        if (!kind) return null;
        try {
          const u8 = new Uint8Array(ab);
          return kind === 'png' ? await pdfDoc.embedPng(u8) : await pdfDoc.embedJpg(u8);
        } catch { return null; }
      };

      const setButtonImageSafe = async (
        pdfDoc: PDFDocument, form: any, buttonName: string, urlOrData?: string
      ) => {
        const img = await embedImageOrNull(pdfDoc, urlOrData);
        if (!img) return false;
        try { form.getButton(buttonName).setImage(img); return true; }
        catch { return false; }
      };
      // ── Fin helpers ──

      const norm = (v: any) => String(v ?? '').trim().toUpperCase();

      // ── Datos del candidato ──
      const contacto: any = cand.contacto ?? {};
      const residencia: any = cand.residencia ?? {};
      const infoCc: any = cand.info_cc ?? {};
      const vivienda: any = cand.vivienda ?? {};

      const entrevista: any = Array.isArray(cand.entrevistas) ? cand.entrevistas[0] : null;
      const proceso: any = entrevista?.proceso ?? {};
      const contrato: any = proceso?.contrato ?? {};
      const antecedentes: any[] = Array.isArray(proceso?.antecedentes) ? proceso.antecedentes : [];

      const findAnte = (nombre: string) => antecedentes.find((a: any) => norm(a?.nombre) === norm(nombre));

      const apellidos = [cand.primer_apellido, cand.segundo_apellido]
        .map((x: any) => String(x ?? '').trim()).filter(Boolean).join(' ').toUpperCase();
      const nombres = [cand.primer_nombre, cand.segundo_nombre]
        .map((x: any) => String(x ?? '').trim()).filter(Boolean).join(' ').toUpperCase();
      const numeroCedula = String(cand.numero_documento ?? '').trim();
      const lugarExpedicion = String(infoCc?.mpio_expedicion ?? '').trim().toUpperCase();

      // Fecha de nacimiento
      const fechaNacRaw = String(cand.fecha_nacimiento ?? '').trim();
      let diaNac = '', mesNac = '', anioNac = '';
      if (fechaNacRaw) {
        const d = new Date(fechaNacRaw);
        if (!isNaN(d.getTime())) {
          diaNac = String(d.getDate()).padStart(2, '0');
          mesNac = String(d.getMonth() + 1).padStart(2, '0');
          anioNac = String(d.getFullYear());
        }
      }

      const lugarNacimiento = String(infoCc?.mpio_nacimiento ?? '').trim().toUpperCase();

      // Fecha de ingreso dd/mm/yyyy
      const fechaRaw = String(
        vac?.fechadeIngreso ?? vac?.fechaIngreso ?? contrato?.fecha_ingreso ?? ''
      ).trim();
      let fechaIngreso = '';
      if (fechaRaw) {
        const d = new Date(fechaRaw);
        if (!isNaN(d.getTime())) {
          fechaIngreso = [
            String(d.getDate()).padStart(2, '0'),
            String(d.getMonth() + 1).padStart(2, '0'),
            d.getFullYear(),
          ].join('/');
        }
      }

      // Género
      const sexo = norm(cand.sexo ?? cand.genero ?? '');
      const esMasculino = sexo === 'M' || sexo === 'MASCULINO';
      const esFemenino = sexo === 'F' || sexo === 'FEMENINO';

      // ── Obtener datos de contratación ──
      let datoContratacion: any = {};
      try {
        const numeroDoc = numeroCedula;
        if (numeroDoc) {
          const respContratacion: any = await firstValueFrom(
            this.contratacionService.buscarEncontratacion(numeroDoc).pipe(
              take(1),
              catchError((err) => {
                console.error('[FormatoSolicitud] Error buscando contratación:', err);
                return of({ data: [] });
              })
            )
          );
          datoContratacion = respContratacion?.data?.[0] ?? {};
        }
      } catch (e) {
        console.error('[FormatoSolicitud] Error obteniendo contratación:', e);
      }

      // Tallas
      const tallaCamiseta = String(datoContratacion?.camisa ?? '').trim();
      const tallaCalzado = String(datoContratacion?.calzado ?? '').trim();
      const numHijos = String(datoContratacion?.num_hijos_dependen_economicamente ?? '').trim();

      // Estado civil
      const estadoCivil = norm(cand.estado_civil ?? '');

      // Vivienda
      const tipoViviendaAlt = norm(vivienda?.tipo_vivienda_alt ?? datoContratacion?.tipo_vivienda_alt ?? '');
      const tipoVivienda = norm(vivienda?.tipo_vivienda ?? datoContratacion?.tipo_vivienda ?? '');

      // Quién cuida los hijos
      const cuidadorHijos = String(vivienda?.responsable_hijos ?? datoContratacion?.responsable_hijos ?? '').trim();

      // Dirección y barrio
      const direccion = String(residencia?.direccion ?? datoContratacion?.direccion_residencia ?? '').trim();
      const barrio = String(residencia?.barrio ?? datoContratacion?.barrio ?? '').trim();
      const direccionCompleta = [direccion, barrio].filter(Boolean).join(' - ');

      // Teléfono
      const telefono = String(contacto?.celular ?? contacto?.telefono ?? datoContratacion?.celular ?? '').trim();

      // Ciudad (municipio de residencia)
      const ciudad = String(residencia?.municipio ?? datoContratacion?.municipio ?? '').trim().toUpperCase();

      // Experiencias laborales (hasta 3)
      const experiencias: any[] = Array.isArray(cand.experiencias) ? cand.experiencias : [];

      // Cómo supo del trabajo
      const comoSeEntero = String(entrevista?.como_se_entero ?? datoContratacion?.como_se_entero ?? '').trim();

      // EPS / AFP / Cesantías
      const eps = String(findAnte('EPS')?.observacion ?? '').trim();
      const afp = String(findAnte('AFP')?.observacion ?? '').trim();
      const cesantias = String(contrato?.cesantias ?? '').trim();

      // ── Cargar PDF ──
      const pdfUrl = 'Docs/formato_empleo_andes.pdf';
      const arrayBuffer = await this.fetchAsArrayBufferOrNull(pdfUrl);
      if (!arrayBuffer) throw new Error('No se pudo cargar el PDF formato solicitud.');

      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const form = pdfDoc.getForm();

      // ── Campos de texto ──
      this.setText(form, 'Fecha de Ingreso', fechaIngreso);
      this.setText(form, 'Apellidos', apellidos);
      this.setText(form, 'Nombres', nombres);
      this.setText(form, 'Numero Cédula', numeroCedula);
      this.setText(form, 'Lugar Expedición', lugarExpedicion);

      this.setText(form, 'Día', diaNac);
      this.setText(form, 'Mes', mesNac);
      this.setText(form, 'Año', anioNac);

      this.setText(form, 'Lugar de Nac', lugarNacimiento);

      this.setText(form, 'Talla', tallaCamiseta);
      this.setText(form, 'Calzado', tallaCalzado);
      this.setText(form, 'Numero de Hijos', numHijos);

      this.setText(form, 'Quien cuida de sus hijos', cuidadorHijos);
      this.setText(form, 'Dirección de Vivienda y Barrio', direccionCompleta);
      this.setText(form, 'Teléfono', telefono);
      this.setText(form, 'Ciudad', ciudad);

      // ── Género (X en campo correspondiente) ──
      if (esMasculino) this.setText(form, 'masculino', 'X');
      if (esFemenino) this.setText(form, 'Femenino', 'X');

      // ── Estado civil checkboxes (X en campo correspondiente) ──
      const ecMap: { [key: string]: string } = {
        SO: 'Solteroa', SOLTERO: 'Solteroa', S: 'Solteroa',
        CA: 'Casadoa', CASADO: 'Casadoa', CASADA: 'Casadoa',
        UL: 'Unión Libre', UNION_LIBRE: 'Unión Libre', UN: 'Unión Libre',
        SE: 'Separadoa', SEPARADO: 'Separadoa', SEPARADA: 'Separadoa',
        VI: 'Viudoa', VIUDO: 'Viudoa', VIUDA: 'Viudoa',
      };
      const ecField = ecMap[estadoCivil];
      if (ecField) this.setText(form, ecField, 'X');

      // ── Tipo vivienda alt (propiedad): Propia / Familiar / Arriendo ──
      if (tipoViviendaAlt === 'PROPIA') this.setText(form, 'propia', 'X');
      else if (tipoViviendaAlt === 'FAMILIAR' || tipoViviendaAlt === 'AMIGOS') this.setText(form, 'Familiar', 'X');
      else if (tipoViviendaAlt === 'ARRIENDO') this.setText(form, 'Arriendo', 'X');

      // ── Tipo vivienda (estructura) ──
      const tvNorm = tipoVivienda.replace(/[,\s]+/g, ' ').trim();
      if (tvNorm.includes('CASA') && tvNorm.includes('LOTE')) this.setText(form, 'Casa Lote', 'X');
      else if (tvNorm.includes('APARTAMENTO')) this.setText(form, 'Apartamento', 'X');
      else if (tvNorm.includes('HABITACIÓN') || tvNorm.includes('HABITACION') || tvNorm === 'PIEZA') this.setText(form, 'Pieza', 'X');
      else if (tvNorm.includes('FINCA') || tvNorm.includes('LOTE')) this.setText(form, 'Lote con Cimientos', 'X');
      else if (tvNorm.includes('CASA')) this.setText(form, 'Casa', 'X');

      // ── Experiencias laborales (hasta 3 filas) ──
      for (let i = 0; i < 3; i++) {
        const exp = experiencias[i] ?? {};
        const rowSuffix = `Row${i + 1}`;
        this.setText(form, `Nombre de la Empresa${rowSuffix}`, String(exp.empresa ?? '').trim());
        this.setText(form, `Tiempo Laborado${rowSuffix}`, String(exp.tiempo_trabajado ?? exp.tiempo ?? '').trim());
        this.setText(form, `Cargo${rowSuffix}`, String(exp.cargo ?? '').trim());
        this.setText(form, `Sueldo${rowSuffix}`, String(exp.sueldo ?? '').trim());
        this.setText(form, `Motivo del Retiro${rowSuffix}`, String(exp.motivo_retiro ?? '').trim());
      }

      // ── Cómo supo del trabajo ──
      this.setText(form, 'Como supo del trabajo', comoSeEntero);

      // ── EPS / Fondo de Pensiones / Cesantías ──
      this.setText(form, 'Nombre de EPS', eps);
      this.setText(form, 'Nombre de Fondo de Pensiones', afp);
      this.setText(form, 'Nombre de Fondo de Cesantías', cesantias);

      // ── Firmas ──
      await setButtonImageSafe(pdfDoc, form, 'Firma del Trabajador_af_image', this.firma);
      await setButtonImageSafe(pdfDoc, form, 'Firma de RRHH_af_image', this.firmaPersonalAdministrativo);

      // ── Bloquear campos y guardar ──
      form.getFields().forEach((f: any) => { try { f.enableReadOnly(); } catch { } });

      const pdfBytes = await pdfDoc.save();
      const ab = this.toSafeArrayBuffer(pdfBytes);
      const file = new File([ab], 'Formato_solicitud.pdf', { type: 'application/pdf' });

      this.uploadedFiles['Formato solicitud'] = { file, fileName: 'Formato_solicitud.pdf' };
      this.verPDF({ titulo: 'Formato solicitud' });
    } catch (error) {
      console.error('Error generando Formato Solicitud:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al generar el Formato de Solicitud.' });
    }
  }


}
