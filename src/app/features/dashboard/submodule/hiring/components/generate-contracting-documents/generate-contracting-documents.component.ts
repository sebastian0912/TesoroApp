import { SharedModule } from '@/app/shared/shared.module';
import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import Swal from 'sweetalert2';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { HiringService } from '../../service/hiring.service';
import * as fontkit from 'fontkit';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable, { FontStyle, RowInput } from 'jspdf-autotable';
import { Router } from '@angular/router';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { catchError, of, forkJoin, take, finalize, map, switchMap } from 'rxjs';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

type UploadedInfo = {
  file: File;
  fileName: string;
  previewUrl?: string; // URL creada con URL.createObjectURL
};

@Component({
  selector: 'app-generate-contracting-documents',
  imports: [
    SharedModule
  ],
  templateUrl: './generate-contracting-documents.component.html',
  styleUrl: './generate-contracting-documents.component.css'
})

export class GenerateContractingDocumentsComponent implements OnInit {
  isSidebarHidden = false;
  empresa: string = '';
  cedula: string = '';
  nombreCompletoLogin: string = '';
  // Propiedades para almacenar los formularios
  codigoContratacion: any = '';
  firma: any = '';
  huellaIndiceDerecho: any;
  firmaPersonalAdministrativo: any = '';
  user: any = {};
  sede: any = '';
  cedulaPersonalAdministrativo: any = {};
  idVacante: any;
  idInfoAndrea: any;

  datoPersonal: any;
  datoSeleccion: any;
  datoContratacion: any;
  datoVacante: any;
  datoInfoContratacion: any;

  documentos = [
    { titulo: 'Autorización de datos' },
    { titulo: 'Entrega de documentos' },
    { titulo: 'Ficha técnica' },
    { titulo: 'Contrato' },
    { titulo: 'Cedula' },
    { titulo: 'ARL' },
    { titulo: 'Figura Humana' },
    { titulo: 'EPS' },
    { titulo: 'CAJA' },
    { titulo: 'PAGO SEGURIDAD SOCIAL' },
  ];

  nombreCompleto = '';

  referenciasA: string[] = [
    "AMIGO LO CONOCE HACE 5 AÑOS LO REFIERE COMO ESTRATEGICA",
    "AMIGO LO CONOCE HACE 10 AÑOS LO REFIERE COMO RESPONSABLE",
    "AMIGO LO CONOCE HACE 3 AÑOS LO REFIERE COMO HONESTA",
    "AMIGO LO CONOCE HACE 9 AÑOS LO REFIERE COMO CARISMATICO",
    "AMIGO LO CONOCE HACE 2 AÑOS LO REFIERE COMO PERSEVERANTE",
    "AMIGO LO CONOCE HACE 3 AÑOS LO REFIERE COMO PERSONA COHERENTE",
    "AMIGO LO CONOCE HACE 7 AÑOS LO REFIERE COMO PERSONA AGRADECIDA",
    "AMIGO LO CONOCE HACE 1 AÑO LO REFIERE COMO PERSONA TOLERANTE",
    "AMIGO LO CONOCE HACE 13 AÑOS LO REFIERE COMO PERSONA EFICAZ",
    "AMIGO LO CONOCE HACE 4 AÑOS LO REFIERE COMO PERSONA OBJETIVA",
    "AMIGO LO CONOCE HACE 15 AÑOS LO REFIERE COMO PERSONA SENCILLA",
    "AMIGO LO CONOCE HACE 6 AÑOS LO REFIERE COMO PERSONA ESPONTANEA",
    "AMIGO LO CONOCE HACE 5 AÑOS LO REFIERE COMO PERSONA ANALITICA",
    "AMIGO LO CONOCE HACE 16 AÑOS LO REFIERE COMO PERSONA REALISTA",
    "AMIGO LO CONOCE HACE 8 AÑOS LO REFIERE COMO PERSONA LUCHADORA",
    "AMIGO LO CONOCE HACE 11 AÑOS LO REFIERE COMO PERSONA DINAMICA",
    "AMIGO LO CONOCE HACE 4 AÑOS LO REFIERE COMO PERSONA TRANQUILA",
    "AMIGO LO CONOCE HACE 7 AÑOS LO REFIERE COMO PERSONA SOLIDARIA",
    "AMIGO LO CONOCE HACE 12 AÑOS LO REFIERE COMO PERSONA OBJETIVA",
    "AMIGO LO CONOCE HACE 18 AÑOS LO REFIERE COMO PERSONA EXIGENTE",
    "AMIGO LO CONOCE HACE 15 AÑOS LO REFIERE COMO PERSONA PERSEVERANTE",
    "AMIGO LO CONOCE HACE 7 AÑOS LO REFIERE COMO PERSONA COLABORADORA"
  ];

  referenciasF: string[] = [
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA HONESTA",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA AMBICIOSA",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA PUNTUAL",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA PUNTUAL",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA CARISMATICA",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA TOLERANTE",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA PACIENTE",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA ACERTADA",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA OPTIMISTA",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA AGIL",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA EXPERTA",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA ORIENTADA",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA PERSISTENTE",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA COLABORADOR",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA TRABAJADOR",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA TRABAJADOR",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA SOBRESALIENTE",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA SOBRESALIENTE",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA INTEGRA",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA INTEGRA",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA AGRADABLE",
    "LO CONOCE DE TODA LA VIDA LO REFIERE COMO PERSONA BONDADOSA"
  ];


  // Evita repetir inmediatamente el mismo ítem (opcional)
  private _lastPick: { A?: number; F?: number } = {};

  // Random index usando WebCrypto si existe; si no, Math.random()
  // ─────────────────────────────────────────────────────────────
  // RNG seguro (usa Web Crypto si existe; de lo contrario, fallback)
  // ─────────────────────────────────────────────────────────────
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
    Contrato: 25,
    "Autorización de datos": 26,
    "Entrega de documentos": 27,
    'Ficha técnica': 34,
    Cedula: 29,
    ARL: 30,
    'Figura Humana': 31,
    EPS: 36,
    CAJA: 37,
    'PAGO SEGURIDAD SOCIAL': 38
  };


  async ngOnInit(): Promise<void> {
    // Loader inicial
    Swal.fire({
      icon: 'info',
      title: 'Cargando datos...',
      text: 'Por favor, espera un momento.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    await this.recuperarFormulariosDesdeLocalStorage();

    // Cargar datos del localStorage (solo en navegador)
    if (!isPlatformBrowser(this.platformId)) {
      this.user = {};
      Swal.close();
      return;
    }

    try {
      this.user = this.UtilityServiceService.getUser();
      const cedulaL = localStorage.getItem('cedula');
      this.cedula = cedulaL || '';
      this.sede = this.user.sede.nombre || '';
    } catch {
      this.user = {};
    }
    console.log('Usuario cargado:', this.user);

    if (!this.cedula) {
      Swal.close();
      Swal.fire('Sin datos', 'No hay cédula en sesión.', 'info');
      return;
    }

    // --- Streams ---
    const datoVacante$ = this.contratacionService.buscarEncontratacion(this.cedula).pipe(
      take(1),
      map((res: any) => res?.data?.[0] ?? null),
      catchError(err => { return of(null); })
    );

    const datoAdministrativo$ = this.contratacionService.buscarEncontratacion(this.user.numero_de_documento).pipe(
      take(1),
      catchError(err => { return of(null); })
    );

    const seleccionTop$ = this.seleccionService.getSeleccion(this.cedula).pipe(
      take(1),
      catchError(err => { return of(null); }),
      map((contratacion: any) => {
        if (!contratacion) return null;
        const procesos: any[] = Array.isArray(contratacion)
          ? contratacion
          : (Array.isArray(contratacion?.procesoSeleccion) ? contratacion.procesoSeleccion : [contratacion]);
        if (!procesos.length) return null;
        return procesos.reduce((max, item) => {
          const idMax = Number(max?.id ?? -Infinity);
          const idCur = Number(item?.id ?? -Infinity);
          return idCur > idMax ? item : max;
        }, procesos[0]);
      })
    );

    const datoContratacion$ = this.seleccionService.buscarEncontratacion(this.cedula).pipe(
      take(1),
      catchError(err => { return of(null); })
    );

    const datoInfoContratacion$ = this.contratacionService.traerDatosContratacion(this.cedula, this.codigoContratacion).pipe(
      take(1),
      catchError(err => { return of(null); })
    );

    forkJoin({
      personal: datoVacante$,
      administrativo: datoAdministrativo$,
      procesoTop: seleccionTop$,
      contratacion: datoContratacion$,
      infoContratacion: datoInfoContratacion$
    })
      .pipe(
        switchMap(({ personal, administrativo, procesoTop, contratacion, infoContratacion }) => {
          // Set de estado local
          this.datoPersonal = personal;
          console.log('Dato Personal:', this.datoPersonal);
          this.huellaIndiceDerecho = this.datoPersonal?.huellaIndiceDerecho || '';
          this.firmaPersonalAdministrativo = administrativo?.data?.[0]?.firmaSolicitante || '';
          this.nombreCompleto = this.datoPersonal.primer_nombre + ' ' +this.datoPersonal?.segundo_nombre + ' ' + this.datoPersonal?.primer_apellido + ' ' + this.datoPersonal?.segundo_apellido || '';

          this.datoSeleccion = procesoTop;
          console.log('Proceso Top:', this.datoSeleccion);
          this.datoContratacion = contratacion;
          console.log('Dato Contratacion:', this.datoContratacion);
          this.datoInfoContratacion = infoContratacion;
          console.log('Dato Info Contratacion:', this.datoInfoContratacion);

          this.firma = this.datoPersonal?.firmaSolicitante || '';
          // Feedback mínimo si algo falta (opcional, sin interrumpir flujo)
          if (!personal) console.warn('Sin datoPersonal para la cédula:', this.cedula);
          if (!procesoTop) console.warn('Sin procesoTop de selección para la cédula:', this.cedula);

          // Obtener la descripción/empresa de la vacante si hay id
          const vacanteId =
            this.idVacante ??
            procesoTop?.vacante ??          // en tu ejemplo viene así: 33
            procesoTop?.vacanteId ??        // fallback si tu backend usa otra key
            procesoTop?.vacante?.id ?? null;

          if (!vacanteId) return of(null);

          return this.vacantesService.obtenerVacante(vacanteId).pipe(
            take(1),
            catchError(err => { return of(null); })
          );
        }),
        finalize(() => Swal.close())
      )
      .subscribe((vac: any) => {
        if (vac && Object.keys(vac).length > 0) {
          this.datoVacante = vac;
          console.log('Dato Vacante:', this.datoVacante);
          this.empresa = vac.temporal || '';
        } else {
          // Si quieres mostrar aviso cuando no hay vacante:
          // Swal.fire('Sin datos', 'No se encontraron datos de la vacante.', 'info');
        }
      }, _ => {
        Swal.fire('Error', 'Ocurrió un error al cargar información.', 'error');
      });
  }


  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private contratacionService: HiringService,
    private gestionDocumentalService: GestionDocumentalService,
    private infoVacantesService: InfoVacantesService,
    private vacantesService: VacantesService,
    private seleccionService: SeleccionService,
    private UtilityServiceService: UtilityServiceService,
    private router: Router
  ) { }

  toggleSidebar() {
    this.isSidebarHidden = !this.isSidebarHidden;
  }

  isSubirPDF(doc: any): boolean {
    // Devuelve true si el título corresponde a Cedula, ARL o Figura Humana
    return ['Cedula', 'ARL', 'Figura Humana'].includes(doc.titulo);
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
    const iframe: HTMLIFrameElement | null = document.querySelector('#pdfPreview');
    if (iframe) {
      iframe.src = url;
    }
  }
  // Método para reiniciar el input en el DOM
  private resetInput(input: HTMLInputElement): void {
    const newInput = input.cloneNode(true) as HTMLInputElement;
    input.parentNode?.replaceChild(newInput, input);
  }

  devolvercontratacion() {
    this.router.navigate(['/dashboard/hiring/recruitment-pipeline']);
  }

  verPDF(doc: { titulo: string }) {
    const fileData = this.uploadedFiles[doc.titulo];
    if (fileData?.file) {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        const blob = new Blob([fileReader.result as ArrayBuffer], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(blob);
        const iframe: HTMLIFrameElement | null = document.querySelector('#pdfPreview');
        if (iframe) {
          iframe.src = pdfUrl;
        }
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


  generarPDF(documento: string) {
    // si es Autorización de datos
    if (documento === 'Autorización de datos') {
      this.generarAutorizacionDatos();
    }
    else if (documento === 'Entrega de documentos') {
      if (this.empresa === 'APOYO LABORAL SAS') {
        this.generarEntregaDocsApoyo();
      }
      else if (this.empresa === 'TU ALIANZA SAS') {
        this.generarEntregaDocsAlianza();
      }
    }
    // contrato
    else if (documento === 'Contrato') {
      this.generarContratoTrabajo();
    }
    // Ficha técnica
    else if (documento === 'Ficha técnica') {
      this.generarFichaTecnica();
    }
  }

  async recuperarFormulariosDesdeLocalStorage() {
    // Verificar si está en el navegador
    if (isPlatformBrowser(this.platformId)) {
      const formularios = localStorage.getItem('formularios');
      if (formularios) {
        const data = JSON.parse(formularios);
        this.idVacante = data.vacante || '';
        this.idInfoAndrea = data.entrevista_andrea || '';
        this.codigoContratacion = localStorage.getItem('codigoContrato') || '';

      } else {
        Swal.fire('Error', 'No se encontraron formularios en el almacenamiento local', 'error');
      }
    } else {
      Swal.fire('Error', 'No se puede acceder a localStorage en este entorno', 'error');
    }
  }

  // Generar autorización de datos para Apoyo Laboral TS S.A.S y Tu Alianza
  // Generar autorización de datos para Apoyo Laboral TS S.A.S y Tu Alianza (todo en 1 hoja)
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
      doc.addImage(firmaConPrefijo, 'PNG', 10, yFirmaBase - 20, 50, 18);
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró la firma' });
      return;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Firma de Autorización', 10, yFirmaBase + 3);
    doc.setFont('helvetica', 'normal');

    if (this.datoPersonal?.numerodeceduladepersona) {
      doc.text(`Número de Identificación: ${this.datoPersonal.numerodeceduladepersona}`, 10, yFirmaBase + 7);
    } else {
      doc.text('Número de Identificación: No especificado', 10, yFirmaBase + 7);
    }

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
    lineHeight: number
  ): number {
    const pageHeight = doc.internal.pageSize.height;

    // Preprocesar el texto: eliminar espacios extras
    text = text.trim().replace(/\s+/g, ' ');

    const words = text.split(' ');
    const boldWords = words.map(w => this.isBoldWord(w));

    // Preparar las palabras con sus anchos pre-calculados
    // Mide cada palabra con la fuente que le corresponde (bold o normal)
    const spaceWidthNormal = this.roundTo(doc.getTextWidth(' '), 3);
    const wordWidths: number[] = [];
    words.forEach((word, i) => {
      doc.setFont('helvetica', boldWords[i] ? 'bold' : 'normal');
      const w = this.roundTo(doc.getTextWidth(word), 3);
      wordWidths.push(w);
    });

    let currentLine: { word: string; width: number; bold: boolean }[] = [];
    let currentLineWidth = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const width = wordWidths[i];
      const bold = boldWords[i];

      // Si no es la primera palabra de la línea, se añade un espacio
      const additionalSpace = currentLine.length > 0 ? spaceWidthNormal : 0;
      const testWidth = currentLineWidth + width + additionalSpace;

      if (testWidth > maxWidth && currentLine.length > 0) {
        // Renderizar la línea actual justificada
        this.renderJustifiedLine(doc, currentLine, x, y, maxWidth, false);
        y += lineHeight;

        // Verificar salto de página
        if (y > pageHeight - 10) {
          doc.addPage();
          y = 10;
        }

        currentLine = [{ word, width, bold }];
        currentLineWidth = width;
      } else {
        currentLine.push({ word, width, bold });
        currentLineWidth = testWidth;
      }
    }

    // Renderizar última línea (alineada a la izquierda)
    if (currentLine.length > 0) {
      this.renderJustifiedLine(doc, currentLine, x, y, maxWidth, true);
    }

    return y;
  }

  private renderJustifiedLine(
    doc: jsPDF,
    lineData: { word: string; width: number; bold: boolean }[],
    x: number,
    y: number,
    maxWidth: number,
    isLastLine = false
  ) {
    const totalTextWidth = lineData.reduce((sum, w) => sum + w.width, 0);
    const totalSpaces = lineData.length - 1;

    // Calcular ancho de espacio
    let spaceWidth = doc.getTextWidth(' ');
    // Redondear
    spaceWidth = this.roundTo(spaceWidth, 3);

    if (!isLastLine && totalSpaces > 0) {
      // Ajustar el espacio para justificar completamente la línea
      const extraSpace = (maxWidth - totalTextWidth) / totalSpaces;
      spaceWidth = this.roundTo(extraSpace, 3);
    }

    let currentX = x;

    lineData.forEach((item, index) => {
      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      doc.text(item.word, currentX, y);

      if (index < totalSpaces) {
        currentX += item.width + spaceWidth;
      } else {
        // Última palabra
        currentX += item.width;
      }
    });

    // Restaurar la fuente a normal después de la línea
    doc.setFont('helvetica', 'normal');
  }

  cargarpdf() {
    // Mostrar Swal de carga
    Swal.fire({
      title: 'Cargando...',
      text: 'Por favor, espera mientras se suben los archivos.',
      icon: 'info',
      allowOutsideClick: false, // Evitar que el usuario cierre el Swal
      didOpen: () => {
        Swal.showLoading(); // Mostrar el indicador de carga
      }
    });

    // Subir los archivos
    this.subirTodosLosArchivos().then((allFilesUploaded) => {
      if (allFilesUploaded) {
        Swal.close(); // Cerrar el Swal de carga
        // Mostrar mensaje de éxito
        Swal.fire({
          title: '¡Éxito!',
          text: 'Datos y archivos guardados exitosamente.',
          icon: 'success',
          confirmButtonText: 'Ok'
        });
      }
    }).catch((error) => {
      // Cerrar el Swal de carga y mostrar el mensaje de error en caso de fallo al subir archivos
      Swal.close(); // Asegurar que se cierre el Swal de carga antes de mostrar el error
      Swal.fire({
        title: 'Error',
        text: `Hubo un error al subir los archivos: ${error}`,
        icon: 'error',
        confirmButtonText: 'Ok'
      });
    });
  }

  // Método para subir todos los archivos almacenados en uploadedFiles
  subirTodosLosArchivos(): Promise<boolean> {
    return new Promise((resolve) => {
      const archivosAEnviar = Object.keys(this.uploadedFiles)
        .filter((key) => (key in this.typeMap) && this.uploadedFiles[key]?.file)
        .map((key) => ({
          key,
          ...this.uploadedFiles[key],
          typeId: this.typeMap[key],
        }));

      if (archivosAEnviar.length === 0) {
        resolve(true);
        return;
      }

      // Una promesa por archivo
      const promesasDeSubida = archivosAEnviar.map(({ key, file, fileName, typeId }) =>
        new Promise<{ key: string }>((resolveSubida, rejectSubida) => {
          this.gestionDocumentalService
            .guardarDocumento(fileName, this.cedula, typeId, file, this.codigoContratacion)
            .pipe(take(1))
            .subscribe({
              next: () => resolveSubida({ key }),
              error: (error) => rejectSubida({ key, error: error?.message || 'Error desconocido' })
            });
        })
      );

      // Procesar todas (exitosas y fallidas)
      Promise.allSettled(promesasDeSubida)
        .then((results) => {
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

          // Mostrar resumen si hubo fallos
          if (fallidos.length) {
            const htmlFallidos = `
            <ul style="text-align:left;margin:0;padding-left:18px">
              ${fallidos.map(f => `<li><b>${f.key}</b>: ${this.escapeHtml(f.error)}</li>`).join('')}
            </ul>`;
            Swal.fire({
              icon: 'warning',
              title: 'Algunos archivos no se subieron',
              html: htmlFallidos
            });
          }

          // Continuar con las acciones posteriores aunque haya fallos
          // ¿Se subió "Contrato"?
          const contratoIncluido = archivosAEnviar.some(a => a.key === 'Contrato' || a.typeId === this.typeMap['Contrato']);

          if (!contratoIncluido) {
            resolve(fallidos.length === 0);
            return;
          }

          // IDs necesarios
          const idVacanteAplicante = Number(this.idVacante);
          const idPublicacion = Number(this.idInfoAndrea);

          const llamadas = [];

          if (idVacanteAplicante) {
            llamadas.push(
              this.infoVacantesService
                .setEstadoVacanteAplicante(idPublicacion, 'contratado', true)
                .pipe(catchError(err => {
                  Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el estado del aplicante en la información de vacantes.' });
                  return of(null);
                }))
            );
          }

          if (idPublicacion) {
            llamadas.push(
              this.vacantesService
                .setEstadoVacanteAplicante(idVacanteAplicante, 'contratado', this.cedula)
                .pipe(catchError(err => {
                  Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el estado del aplicante en la vacante.' });
                  return of(null);
                }))
            );
          }

          if (!llamadas.length) {
            resolve(fallidos.length === 0);
            return;
          }

          forkJoin(llamadas).pipe(take(1)).subscribe({
            next: () => resolve(fallidos.length === 0),
            error: (err) => {
              resolve(fallidos.length === 0); // no bloqueamos
            }
          });
        })
        .catch((err) => {
          Swal.fire({ icon: 'error', title: 'Error al subir archivos', text: String(err) });
          resolve(false);
        });
    });
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

private getRutaInfo(oficinas: Array<{nombre?: string; ruta?: boolean}>, sede: string) {
  const arr = Array.isArray(oficinas) ? oficinas : [];
  const match = arr.find(o => this.norm(o?.nombre) === this.norm(sede));
  const nombreRuta = match?.nombre ?? (sede ?? '');
  const usaRuta = match == null ? '' : (match.ruta ? 'SI' : 'NO');
  return { nombreRuta, usaRuta };
}



  // === Método principal SOLO con datoVacante, datoSeleccion, datoContratacion ===
  async generarFichaTecnica() {
    try {
      const pdfUrl = 'Docs/Ficha tecnica.pdf';
      const arrayBuffer = await this.fetchAsArrayBufferOrNull(pdfUrl);
      if (!arrayBuffer) throw new Error('No se pudo cargar el PDF base.');

      const pdfDoc = await PDFDocument.load(arrayBuffer);
      pdfDoc.registerFontkit(fontkit as any);

      const fontBytes = await this.fetchAsArrayBufferOrNull('fonts/Roboto-Regular.ttf');
      const customFont = fontBytes ? await pdfDoc.embedFont(fontBytes) : undefined;

      const form = pdfDoc.getForm();

      // --- Branding de empresa desde los objetos permitidos ---
      const { logoPath, firmaPath, persona, nombreEmpresa } = this.getEmpresaInfo();

      const logoBytes = await this.fetchAsArrayBufferOrNull(logoPath);
      if (logoBytes) {
        try {
          const logoImg = await pdfDoc.embedPng(logoBytes);
          try { form.getButton('Image16_af_image').setImage(logoImg); } catch { }
          try { form.getButton('Image18_af_image').setImage(logoImg); } catch { }
        } catch { }
      }
      const user = this.UtilityServiceService.getUser();

      // === Campos de cabecera / contrato ===
      this.setText(form, 'CodContrato', this.safe(this.datoContratacion?.codigo_contrato), customFont, 7.2);
      this.setText(form, 'sede', user.sede.nombre, customFont, 7.2); // NO DISPONIBLE -> vacío
      this.setText(form, 'empresa', this.safe(nombreEmpresa), customFont);

      // === Identificación principal (datoPersonal) ===
      const dv = this.datoPersonal ?? {};
      this.setText(form, '1er ApellidoRow1', this.safe(dv.primer_apellido), customFont);
      this.setText(form, '2do ApellidoRow1', this.safe(dv.segundo_apellido), customFont);
      this.setText(form, 'NombresRow1', [this.safe(dv.primer_nombre), this.safe(dv.segundo_nombre)].filter(Boolean).join(' '), customFont);
      this.setText(form, 'Tipo Documento IdentificaciónRow1', this.safe(dv.tipodedocumento), customFont);
      this.setText(form, 'Número de IdentificaciónRow1', this.safe(dv.numerodeceduladepersona), customFont);


      // fechas básicas
      this.setText(form, 'Fecha de ExpediciónRow1', this.parseDateToDDMMYYYY(dv.fecha_expedicion_cc), customFont);
      this.setText(form, 'Departamento de ExpediciónRow1', this.safe(dv.departamento_expedicion_cc), customFont);
      this.setText(form, 'Municipio de ExpediciónRow1', this.safe(dv.municipio_expedicion_cc), customFont);

      // nacimiento
      this.setText(form, 'GeneroRow1', this.safe(dv.genero), customFont);
      this.setText(form, 'Fecha de NacimientoRow1', this.parseDateToDDMMYYYY(dv.fecha_nacimiento), customFont);
      this.setText(form, 'Departamento de NacimientoRow1', this.safe(dv.lugar_nacimiento_departamento), customFont);
      this.setText(form, 'Municipio de NacimientoRow1', this.safe(dv.lugar_nacimiento_municipio), customFont);

      // estado civil (texto 'X')
      const ec = this.safe(dv.estado_civil).toUpperCase();
      this.setXIf(form, 'SolteroEstado Civil', ec === 'SO');
      this.setXIf(form, 'CasadoEstado Civil', ec === 'CA');
      this.setXIf(form, 'Union LibreEstado Civil', ec === 'UN');
      this.setXIf(form, 'SeparadoEstado Civil', ec === 'SE');
      this.setXIf(form, 'ViudoEstado Civil', ec === 'VI');

      // contacto y residencia
      this.setText(form, 'Dirección de DomicilioRow1', this.safe(dv.direccion_residencia), customFont);
      this.setText(form, 'BarrioRow1', this.safe(dv.barrio), customFont);
      this.setText(form, 'Ciudad DomicilioRow1', this.safe(dv.municipio), customFont);
      this.setText(form, 'DepartamentoRow1', this.safe(dv.departamento), customFont);
      this.setText(form, 'CelularRow1', this.safe(dv.celular), customFont);
      this.setText(form, 'Correo ElectrónicoRow1', this.safe(dv.primercorreoelectronico), customFont);

      // RH y zurdo/diestro
      this.setText(form, 'CelularGrupo Sanguineo y RH', this.safe(dv.rh), customFont);
      const mano = this.safe(dv.zurdo_diestro).toUpperCase();
      this.setXIf(form, 'Diestro', mano.includes('DIESTRO')); // si no, marca el otro
      this.setXIf(form, 'PesoZurdo', !mano.includes('DIESTRO'));

      // Empresa Grupo Elite
      this.setText(form, 'Empresa Grupo Elite', this.datoVacante.empresaUsuariaSolicita   ?? '', customFont);
      this.setText(form, 'Código Compañía', this.safe(this.datoVacante.empresaUsuariaSolicita  ?? ''), customFont);
      this.setText(form, 'Sucursal', this.safe(this.datoSeleccion.centro_costo_entrevista ?? ''), customFont);
      this.setText(form, 'Centro de Costo', this.safe(this.datoInfoContratacion.centro_de_costos ?? ''), customFont);
      this.setText(form, 'SubCentro de Costo', this.safe(this.datoInfoContratacion.subCentroCostos ?? ''), customFont);
      this.setText(form, 'CÓDIGOCiudad de Labor', this.safe(this.sede ?? ''), customFont);
      this.setText(form, 'CÓDIGOClasificador 2Categoría', this.safe(this.datoInfoContratacion.categoria ?? ''), customFont);
      this.setText(form, 'CÓDIGOClasificador 3Operación', this.safe(this.datoInfoContratacion.operacion ?? ''), customFont);
      this.setText(form, 'CÓDIGOClasificador 4Sublador', this.safe(this.datoSeleccion.cargo ?? ''), customFont);
      this.setText(form, 'Apoyo Laboral TSClasificador 6Grupo', this.safe(this.datoInfoContratacion.grupo ?? ''), customFont);


      // === Fecha de ingreso y salario (datoSeleccion) ===
      const ds = this.datoSeleccion ?? {};
      this.setText(form, 'Fecha de Ingreso', this.formatLongDateES(this.safe(ds.fechaIngreso) || this.safe(this.datoContratacion?.fechaIngreso)), customFont);
      this.setText(form, 'Sueldo Básico', this.formatMoneyCOP(ds.salario), customFont);

      // Bancos/cuenta/ARL: NO DISPONIBLE -> vacío
      this.setText(form, 'Banco', this.datoInfoContratacion.forma_pago ?? '', customFont);
      this.setText(form, 'Cuenta', this.datoInfoContratacion.numero_pagos ?? '', customFont);
      this.setText(form, 'Porcentaje ARLARL SURA', this.datoInfoContratacion.porcentaje_arl ?? '', customFont);

      // Seguridad social (datoSeleccion)
      this.setText(form, 'EPS SaludRow1', this.safe(ds.eps), customFont);
      this.setText(form, 'AFP PensiónRow1', this.safe(ds.afp), customFont);
      this.setText(form, 'AFC CesantiasRow1', this.safe(this.datoInfoContratacion.cesantias ?? ''), customFont); // si el campo existe y quieres usarlo
      this.setText(form, 'N de Semanas CotizadasPensionado NO', this.safe(this.datoInfoContratacion.semanas_cotizadas) || '0', customFont);
      this.setText(form, 'Nombre de la RutaAuxilio Trasporte', this.safe(this.datoVacante.auxilioTransporte), customFont);
      // Nombre de la RutaUsa Ruta
      const rutaInfo = this.getRutaInfo(this.datoVacante.oficinasQueContratan, this.sede ?? '');
      this.setText(form, 'Nombre de la RutaUsa Ruta', rutaInfo.usaRuta, customFont);
      // === Contacto de emergencia (datoPersonal) ===
      this.setText(form, 'Apellidos y NombresRow1', this.safe(dv.familiar_emergencia), customFont);
      this.setText(form, 'Número de ContactoRow1', this.safe(dv.telefono_familiar_emergencia), customFont);
      // Horas extras
      this.setText(form, 'Horas extras', this.safe(this.datoInfoContratacion.horas_extras), customFont);

      // === Educación (datoPersonal) ===
      this.setText(form, 'Seleccione el Grado de Escolaridad', this.safe(dv.escolaridad ?? dv.nivel_escolaridad), customFont);
      this.setText(form, 'Institución', this.safe(dv.nombre_institucion), customFont);
      this.setText(form, 'Titulo Obtenido o Ultimo año Cursado', this.safe(dv.titulo_obtenido), customFont);
      this.setText(form, 'Año Finalización', this.parseDateToDDMMYYYY(dv.ano_finalizacion), customFont);

      // === Padres (datoPersonal) ===
      this.setText(form, 'Nombre y Apellido PadreRow1', this.safe(dv.nombre_padre), customFont);
      this.setText(form, 'ViveRow1', this.safe(dv.vive_padre), customFont);
      this.setText(form, 'OcupaciónRow1', this.safe(dv.ocupacion_padre), customFont);
      this.setText(form, 'DirecciónRow1', this.safe(dv.direccion_padre), customFont);
      this.setText(form, 'TeléfonoRow1', this.safe(dv.telefono_padre), customFont);
      this.setText(form, 'BarrioMunicipioRow1', this.safe(dv.barrio_padre), customFont);

      this.setText(form, 'Nombre y Apellido MadreRow1', this.safe(dv.nombre_madre), customFont);
      this.setText(form, 'ViveRow1_2', this.safe(dv.vive_madre), customFont);
      this.setText(form, 'OcupaciónRow1_2', this.safe(dv.ocupacion_madre), customFont);
      this.setText(form, 'DirecciónRow1_2', this.safe(dv.direccion_madre), customFont);
      this.setText(form, 'TeléfonoRow1_2', this.safe(dv.telefono_madre), customFont);
      this.setText(form, 'BarrioMunicipioRow1_2', this.safe(dv.barrio_madre), customFont);

      // === Conyugue (datoPersonal) ===
      const nombreConyuge = [this.safe(dv.nombre_conyugue), this.safe(dv.apellido_conyugue)].filter(Boolean).join(' ');
      this.setText(form, 'Nombre y ApellidoconyugeRow1', nombreConyuge, customFont);
      this.setText(form, 'ViveRow1_3', this.safe(dv.vive_con_el_conyugue), customFont);
      this.setText(form, 'OcupaciónRow1_3', this.safe(dv.ocupacion_conyugue), customFont);
      this.setText(form, 'DirecciónRow1_3', this.safe(dv.direccion_conyugue), customFont);
      this.setText(form, 'TeléfonoRow1_3', this.safe(dv.telefono_conyugue), customFont);
      this.setText(form, 'BarrioMunicipioRow1_3', this.safe(dv.barrio_municipio_conyugue), customFont);

      // === Hijos (datoPersonal.hijos) ===
      const hijos = this.hijosTop5();
      const nombreFields = ['Apellidos y Nombres1', 'Apellidos y Nombres2', 'Apellidos y Nombres3', 'Apellidos y Nombres4', 'Apellidos y Nombres5'];
      const fnFields = ['F de Nacimiento1', 'F de Nacimiento2', 'F de Nacimiento3', 'F de Nacimiento4', 'F de Nacimiento5'];
      const idFields = [' de Identificación1', ' de Identificación2', ' de Identificación3', ' de Identificación4', ' de Identificación5'];
      const genFields = ['Gen1', 'Gen2', 'Gen3', 'Gen4', 'Gen5'];
      const ocuFields = ['Ocupación1', 'Ocupación2', 'Ocupación3', 'Ocupación4', 'Ocupación5'];
      const cursoFields = ['Curso1', 'Curso2', 'Curso3', 'Curso4', 'Curso5'];

      for (let i = 0; i < 5; i++) {
        const h = hijos[i] ?? {};
        this.setText(form, nombreFields[i], this.safe(h.nombre), customFont);
        this.setText(form, fnFields[i], this.parseDateToDDMMYYYY(h.fecha_nacimiento), customFont);
        this.setText(form, idFields[i], this.safe(h.no_documento), customFont);
        this.setText(form, genFields[i], this.safe(h.sexo), customFont);
        this.setText(form, ocuFields[i], this.safe(h.estudia_o_trabaja), customFont);
        this.setText(form, cursoFields[i], this.safe(h.curso), customFont);
      }

      // === Tallas dotación (datoPersonal) ===
      this.setText(form, 'TALLA CHAQUETARow1', this.safe(dv.chaqueta), customFont);
      this.setText(form, 'TALLA PANTALONRow1', this.safe(dv.pantalon), customFont);
      this.setText(form, 'TALLA OVEROLRow1', this.safe(dv.chaqueta), customFont);
      this.setText(form, 'No calzadoRow1', this.safe(dv.calzado), customFont);
      this.setText(form, 'No Botas de CauchoRow1', this.safe(dv.calzado), customFont);
      this.setText(form, 'No ZapatonesRow1', this.safe(dv.calzado), customFont);
      this.setText(form, 'No Botas MaterialRow1', this.safe(dv.calzado), customFont);

      // === Experiencia laboral 1 (datoPersonal) ===
      this.setText(form, 'Nombre Empresa 1Row1', this.safe(dv.nombre_expe_laboral1_empresa), customFont);
      this.setText(form, 'Dirección EmpresaRow1', this.safe(dv.direccion_empresa1), customFont);
      this.setText(form, 'TeléfonosRow1', this.safe(dv.telefonos_empresa1), customFont);
      this.setText(form, 'Jefe InmediatoRow1', this.safe(dv.nombre_jefe_empresa1), customFont);
      this.setText(form, 'CargoRow1', this.safe(dv.cargo_empresa1), customFont);
      this.setText(form, 'F de RetiroRow1', this.parseDateToDDMMYYYY(dv.fecha_retiro_empresa1), customFont);
      this.setText(form, 'Motivo de RetiroRow1', this.safe(dv.motivo_retiro_empresa1), customFont);

      // === Referencias (datoPersonal) ===
      this.setText(form, 'Nombre Referencia 1Row1', this.safe(dv.nombre_referencia_personal1), customFont);
      this.setText(form, 'TeléfonosRow1_3', this.safe(dv.telefono_referencia_personal1), customFont);
      this.setText(form, 'OcupaciónRow1_4', this.safe(dv.ocupacion_referencia_personal1), customFont);

      this.setText(form, 'Nombre Referencia 2Row1', this.safe(dv.nombre_referencia_personal2), customFont);
      this.setText(form, 'TeléfonosRow1_4', this.safe(dv.telefono_referencia_personal2), customFont);
      this.setText(form, 'OcupaciónRow1_5', this.safe(dv.ocupacion_referencia_personal2), customFont);

      this.setText(form, 'Nombre Referencia 1Row1_2', this.safe(dv.nombre_referencia_familiar1), customFont);
      this.setText(form, 'TeléfonosRow1_5', this.safe(dv.telefono_referencia_familiar1), customFont);
      this.setText(form, 'OcupaciónRow1_6', this.safe(dv.ocupacion_referencia_familiar1), customFont);

      this.setText(form, 'Nombre Referencia 1Row1_3', this.safe(dv.nombre_referencia_familiar2), customFont);
      this.setText(form, 'TeléfonosRow1_6', this.safe(dv.telefono_referencia_familiar2), customFont);
      // (el PDF tenía un bug: 'OcupaciónRow1_7' con personal2; lo dejo vacío si no corresponde)
      this.setText(form, 'OcupaciónRow1_7', this.safe(dv.ocupacion_referencia_familiar2), customFont);

      // === Autorizaciones / textos (solo variables permitidas) ===
      const centroCostoTexto = this.safe(this.datoVacante?.empresaUsuariaSolicita);
      this.setText(
        form,
        'AutorizacionDeEstudiosSeguridad2',
        centroCostoTexto
          ? `estudios de seguridad. De conformidad con lo dispuesto en la ley 1581 de 2012 y el decreto reglamentario 1377 de 2013 autorizo a ${centroCostoTexto} a consultar en cualquier momento ante las centrales de riesgo la información comercial a mi nombre.`
          : '',
        customFont,
        6
      );

      // Cedula para autorización
      this.setText(form, 'CedulaAutorizacion', this.safe(dv.numerodeceduladepersona), customFont);

      // Comentarios referencias (antes usabas arrays aleatorios -> ahora vacío)
      this.setText(form, 'Comentarios de las Referencias Pesonales 1', '', customFont);
      this.setText(form, 'Comentarios de las Referencias Pesonales 2', '', customFont);
      this.setText(form, 'Comentario referencia Familiar', '', customFont);
      this.setText(form, 'Comentario referencia Familiar 2', '', customFont);

      console.log(user);
      // Persona que firma verificación (derivada de empresa si aplica)
      this.setText(form, 'Persona que firma', this.safe(user.datos_basicos.nombres + ' ' + user.datos_basicos.apellidos + ' ' + user.tipo_documento + ' ' + user.numero_de_documento), customFont);

      // Firma/verificación (si tenemos ruta de firma institucional)
const firmaInstImg = await this.embedAnyImage(pdfDoc, this.firmaPersonalAdministrativo);
if (firmaInstImg) {
  try { form.getButton('Image15_af_image').setImage(firmaInstImg); } catch {}
}


      // Firma del candidato (datoVacante.firma base64) -> en este dataset viene null

const firmaCandImg = await this.embedAnyImage(pdfDoc, this.datoPersonal?.firmaSolicitante || '');
if (firmaCandImg) {
  try { form.getButton('Image11_af_image').setImage(firmaCandImg); } catch {}
}

const fotoImg = await this.embedAnyImage(pdfDoc, this.datoPersonal?.fotoSoliciante || this.datoPersonal?.fotoSolicitante || '');
if (fotoImg) {
  try { form.getButton('Image17_af_image').setImage(fotoImg); } catch {}
}


      // Image10_af_image huella
      if (this.datoPersonal?.huellaIndiceDerecho) {
        const huella = this.decodeBase64Image(this.datoPersonal.huellaIndiceDerecho);
        if (huella?.bytes) {
          try {
            let pdfImg;
            if (huella.mime === 'image/png') {
              pdfImg = await pdfDoc.embedPng(huella.bytes);
            } else if (huella.mime === 'image/jpeg' || huella.mime === 'image/jpg') {
              pdfImg = await pdfDoc.embedJpg(huella.bytes);
            } else {
              // Fallback si el mime no es claro: intentamos PNG y luego JPG
              try { pdfImg = await pdfDoc.embedPng(huella.bytes); }
              catch { pdfImg = await pdfDoc.embedJpg(huella.bytes); }
            }
            form.getButton('Image10_af_image').setImage(pdfImg);
          } catch {
            // silenciar si el campo no existe o la imagen no es soportada
          }
        }
      }


      // PersonaRefencia1P
      this.setText(form, 'PersonaRefencia1P', this.safe(this.datoPersonal.nombre_referencia_personal1), customFont);
      this.setText(form, 'PersonaRefencia2P', this.safe(this.datoPersonal.nombre_referencia_personal2), customFont);

      this.setText(form, 'Comentarios de las Referencias Pesonales 1', this.getReferencia('A'), customFont);
      this.setText(form, 'Comentarios de las Referencias Pesonales 2', this.getReferencia('A'), customFont);

      // PersonaRefencia1F
      this.setText(form, 'PersonaRefencia1F', this.safe(this.datoPersonal.nombre_referencia_familiar1), customFont);
      this.setText(form, 'PersonaRefencia2F', this.safe(this.datoPersonal.nombre_referencia_familiar2), customFont);
      this.setText(form, 'Comentario referencia Familiar', this.getReferencia('F'), customFont);
      this.setText(form, 'Comentario referencia Familiar 2', this.getReferencia('F'), customFont);

      // AutorizacionDeEstudiosSeguridad2
      this.setText(form, 'AutorizacionDeEstudiosSeguridad2', this.safe(this.datoSeleccion.empresa_usuario), customFont, 6);
      this.setText(form, 'Fecha de EntregaINICIAL', this.formatLongDateES(this.safe(ds.fechaIngreso) ), customFont);
      // FechaLocker
      this.setText(form, 'FechaLocker', this.formatLongDateES(this.safe(ds.fechaIngreso)), customFont);
      // TEXTOCARNET
      this.setText(form, 'TEXTOCARNET', 'me comprometo a presentar ante ' + this.datoVacante.empresaUsuariaSolicita + ' fotocopia del denuncio correspondiente y en el caso de aparecer el carnet perdido lo devolveré a la empresa para su respectiva anulación', customFont, 6);
      // TEXTOLOCKER5
      this.setText(form, 'TEXTOLOCKER5', 'Yo,' + this.nombreCompleto + ' identificado(a) con Cedula de Ciudadania No ' + this.datoPersonal.numerodeceduladepersona + ' declaro haber recibido el loker relacionado abajo y me comprometo a seguir las recomendaciones y politicas de uso y cuidado de estós, y a devolverer Loker en el mismo estado en que me fue asignado al momento de la finalizaci6n de mi relación laboral y antes de la entrega de la liquidación de contrato', customFont, 6);
      // Bloquear campos
      form.getFields().forEach((f: any) => { try { f.enableReadOnly(); } catch { } });

      // Guardar el PDF
      const pdfBytes = await pdfDoc.save(); // Uint8Array

      // ✅ Convertir a ArrayBuffer NO-compartido
      const ab = this.toSafeArrayBuffer(pdfBytes);

      // Crear el File desde un ArrayBuffer “clásico”
      const file = new File([ab], 'Ficha tecnica.pdf', { type: 'application/pdf' });

      // (Opcional) si prefieres Blob:
      // const blob = new Blob([ab], { type: 'application/pdf' });
      // const file = new File([blob], 'Ficha tecnica.pdf', { type: 'application/pdf' });

      this.uploadedFiles['Ficha técnica'] = { file, fileName: 'Ficha tecnica.pdf' };
      this.verPDF({ titulo: 'Ficha técnica' });


    } catch (error) {
      console.error('Error generando ficha técnica:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al generar la ficha técnica.',
      });
    }
  }


  async listFormFields() {
    // Asume que tienes un PDF en la carpeta de activos; ajusta la ruta según sea necesario
    const pdfUrl = '/Docs/Ficha tecnica.pdf';
    const arrayBuffer = await fetch(pdfUrl).then((res) => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const form = pdfDoc.getForm();
    const fields = form.getFields();
    let fieldDetails = fields
      .map((field) => {
        const type = field.constructor.name;
        const name = field.getName();
        let additionalDetails = '';

        if (field instanceof PDFTextField) {
          additionalDetails = ` - Value: ${field.getText()}`;
        } else if (field instanceof PDFCheckBox) {
          additionalDetails = ` - Is Checked: ${field.isChecked()}`;
        } // Puedes añadir más condiciones para otros tipos de campos como PDFDropdown, etc.

        return `Field name: ${name}, Field type: ${type}${additionalDetails}`;
      })
      .join('\n');

    // Crear un Blob con los detalles de los campos
    const blob = new Blob([fieldDetails], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // Crear un enlace para descargar el Blob como un archivo
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'pdfFieldsDetails.txt';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
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

  // Decodifica base64 (con o sin prefijo data:) y devuelve bytes + mime (si se pudo determinar)
  private decodeBase64Image(input?: string | null): { bytes: Uint8Array; mime?: string } | null {
    if (!input || typeof input !== 'string') return null;

    let mime: string | undefined;
    let b64 = input.trim();

    // ¿Viene como data URL?
    const m = /^data:([^;]+);base64,(.*)$/i.exec(b64);
    if (m) {
      mime = m[1]?.toLowerCase();
      b64 = m[2] || '';
    }

    // Limpia espacios/nuevas líneas
    b64 = b64.replace(/\s+/g, '');

    // Decodifica a Uint8Array
    let bytes: Uint8Array;
    try {
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return null; // base64 inválido
    }

    // Si no vino MIME, intenta detectar por firma
    if (!mime) {
      const sniff = this.sniffImageMime(bytes);
      if (sniff) mime = sniff;
    }

    return { bytes, mime };
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

  private parseDateToDDMMYYYY(input?: string | null): string {
    if (!input) return '';
    // Si viene como DD/MM/YYYY ya está
    const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (ddmmyyyy.test(input)) return input;
    // ISO o algo que Date entienda
    const d = new Date(input);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
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

  private async setImageButtonFromBytes(pdfDoc: any, form: any, fieldName: string, bytes?: ArrayBuffer | Uint8Array) {
    if (!bytes) return;
    try {
      const img = await pdfDoc.embedPng(bytes);
      const btn = form.getButton(fieldName);
      btn.setImage(img);
    } catch { /* si no existe el botón o la imagen falla, ignorar */ }
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
    const temporal = this.datoVacante?.temporal;

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
    const arr: any[] = Array.isArray(this.datoPersonal?.hijos) ? this.datoPersonal.hijos : [];
    // filtra vacíos por nombre
    return arr.filter(h => (this.safe(h?.nombre).trim() !== '')).slice(0, 5);
  }




  // Generar el documento de entrega de documentos de Tu Alianza
  generarEntregaDocsAlianza() {

    // Crear el documento PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    doc.setProperties({
      title: 'Tu_Alianza_Entrega_Documentos.pdf',
      author: this.empresa,
      creator: this.empresa,
    });

    const logoPath = '/logos/Logo_TA.png';
    const nit = 'NIT: 900.864.596-1';

    // Agregar logo en la esquina superior izquierda
    const imgWidth = 27;
    const imgHeight = 10;
    const marginTop = 5;
    const marginLeft = 7;
    doc.addImage(logoPath, 'PNG', marginLeft, marginTop, imgWidth, imgHeight);

    // Agregar el NIT debajo del logo
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(nit, marginLeft, marginTop + imgHeight + 3);
    doc.setFont('helvetica', 'normal');
    // Dejar TA CO-RE-6 V15 Abril 01-24 en la esquina superior derecha
    doc.setFontSize(8);
    doc.text('TA CO-RE-6 V15 Abril 01-24', 170, 10);

    // Agregar el título centrado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Entrega de Documentos y Autorizaciones', 110, 20, { align: 'center' });

    // Agregar el texto con ajuste de ancho (márgenes)
    const texto =
      'Reciba un cordial saludo, por medio del presente documento afirmo haber recibido, leído y comprendido los documentos relacionados a continuación:';
    const marginLeftText = 10; // margen izquierdo
    const yPos = 25; // posición inicial del texto
    let maxWidth = 190; // ancho máximo del texto (márgenes incluidos)

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(texto, marginLeftText, yPos, { maxWidth });
    doc.setFontSize(7.5);

    // Agregar el listado numerado con negrita en los números
    const lista = [
      'Copia original del contrato Individual de trabajo',
      'Inducción General de nuestra Compañía e Información General de la Empresa Usuaria el cual incluye información sobre:'
    ];

    let y = 33; // Posición inicial después del texto

    lista.forEach((item, index) => {
      const numero = `${index + 1}) `;
      const textPosX = 10; // margen izquierdo

      // Números en negrita
      doc.setFont('helvetica', 'bold');
      doc.text(numero, textPosX, y);

      // Texto normal
      doc.setFont('helvetica', 'normal');
      const textWidth = doc.getTextWidth(numero); // Ancho del número
      doc.text(item, textPosX + textWidth, y);

      y += 5; // Espacio entre líneas
    });

    // otro titulo en negrita Fechas de Pago de Nómina y Valor del almuerzo que es descontado por Nómina o Liquidación final:
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Fechas de Pago de Nómina y Valor del almuerzo que es descontado por Nómina o Liquidación final:', 30, y);

    // Agregar la tabla con autoTable
    const tableData = [
      ['EMPRESA USUARIA', 'FECHAS DE PAGO', 'SERVICIO DE CASINO'],
      ['TURFLOR S.A.S', '15 Y 30 de cada mes', 'NO ofrece servicio de casino, por lo tanto, el trabajador debe llevarlo.'],
      ['COMERCIALIZADORA TS', '03 Y 18 de cada mes', 'NO ofrece servicio de casino, por lo tanto, el trabajador debe llevarlo.'],
      ['FRUITSFULL COMPANY S.A.S', '15 y 30 de cada mes', 'NO ofrece servicio de casino, por lo tanto, el trabajador debe llevarlo.'],
      [
        'EASY PANEL COLOMBIA S.A.S',
        'Las fechas de pago son: Mensuales el último día hábil de cada mes',
        'NO ofrece servicio de casino, por lo tanto, el trabajador debe llevarlo.'
      ]
    ];

    // Dibujar la tabla
    (doc as any).autoTable({
      startY: y + 1, // Posición inicial de la tabla
      head: [tableData[0]],
      body: tableData.slice(1),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [0, 128, 0], // Color verde para la cabecera
        textColor: [255, 255, 255], // Texto blanco
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [240, 240, 240] }, // Fondo gris claro alternativo
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 60 },
        2: { cellWidth: 70 },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10; // Obtener la posición final de la tabla

    // texto  Teniendo en cuenta la anterior información, autorizo descuento de casino: N/A  ( X )
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Teniendo en cuenta la anterior información, autorizo descuento de casino:', 10, y - 7);
    doc.text('N/A  ( X )', 150, y - 7);

    // Forma de Pago
    doc.setFont('helvetica', 'bold').setFontSize(10);
    doc.text('FORMA DE PAGO:', 10, y - 2);

    const formaPagoSeleccionada = this.datoInfoContratacion?.forma_pago || ''; // Valor dinámico de formaPago
    const numeroPagos = this.datoInfoContratacion?.numero_pagos || '';

    const opciones = [
      { nombre: 'Daviplata', x: 10, y: y + 3 },
      { nombre: 'Davivienda cta ahorros', x: 60, y: y + 3 },
      { nombre: 'Colpatria cta ahorros', x: 120, y: y + 3 },
      { nombre: 'Bancolombia', x: 10, y: y + 8 },
      { nombre: 'Otra', x: 60, y: y + 8 },
    ];

    opciones.forEach((opcion) => {
      doc.rect(opcion.x, opcion.y - 3, 4, 4); // Cuadro
      doc.setFont('helvetica', 'normal').text(opcion.nombre, opcion.x + 6, opcion.y);
      if (formaPagoSeleccionada === opcion.nombre) {
        doc.setFont('helvetica', 'bold').text('X', opcion.x + 1, opcion.y);
      }
    });

    doc.text('¿Cuál?', 115, y + 10);
    doc.line(140, y + 10, 200, y + 10); // Línea
    if (formaPagoSeleccionada === 'Otra') {
      doc.text('Especificar aquí...', 150, y + 15);
    }

    // Número TJT ó Celular / Código de Tarjeta
    y += 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold').text('Número TJT ó Celular:', 10, y);
    doc.text('Código de Tarjeta:', 110, y);

    // Colocar el dato de númeroPagos en el lugar correcto
    doc.setFont('helvetica', 'normal');
    if (formaPagoSeleccionada === 'Daviplata') {
      doc.text(numeroPagos, 60, y);
    } else {
      doc.text(numeroPagos, 150, y);
    }
    // IMPORTANTE al final
    y += 6;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    const importanteTexto = 'IMPORTANTE: Recuerde que si usted cuenta con su forma de pago Daviplata, cualquier cambio realizado en la misma debe ser notificado a la Emp. Temporal. También tenga presente que la entrega de la tarjeta Master por parte de la Emp. Temporal es provisional, y se reemplaza por la forma de pago DAVIPLATA; tan pronto Davivienda nos informa que usted activó su DAVIPLATA, se le genera automáticamente el cambio de forma de pago. CUIDADO! El manejo de estas cuentas es responsabilidad de usted como trabajador, por eso son personales e intransferibles.';

    const lineHeight = 5;
    const anchoTexto = 190; // ancho máximo disponible
    const margenIzquierdo = 10;

    // Dividir el texto en líneas que se ajusten al ancho
    const lineasImportante = doc.splitTextToSize(importanteTexto.trim().replace(/\s+/g, ' '), anchoTexto);

    // Renderizar las líneas
    lineasImportante.forEach((linea: string, index: number) => {
      // Verificar si es la última línea del párrafo
      const isLastLine = index === lineasImportante.length - 1;

      // Si quieres justificar también la última línea, pon isLastLine = false siempre
      this.renderJustifiedLineEntregaDocs(doc, linea, margenIzquierdo, y, anchoTexto, isLastLine);

      y += lineHeight;
    });

    // Acepto cambio sin previo aviso, SI / NO en la misma línea
    doc.text('ACEPTO CAMBIO SIN PREVIO AVISO YA QUE HE SIDO INFORMADO (A):', 10, y);
    doc.setFont('helvetica', 'normal');
    doc.text('SI (  x  )', 170, y);
    doc.text('NO (     )', 190, y);
    doc.setFontSize(7.5);
    // Contenido numerado adicional
    const contenidoFinal = [
      { numero: '3)', texto: 'Entrega y Manejo del Carné de la Empresa de Servicios Temporales TU ALIANZA S.A.S.' },
      { numero: '4)', texto: 'Capacitación de Ley 1010 DEL 2006 (Acosos laboral) y mecanismo para interponer una queja general o frente al acoso.' },
      { numero: '5)', texto: 'Socialización Política de Libertad de Asociación Y Política de Igualdad Laboral y No Discriminación.' },
      { numero: '6)', texto: 'Curso de Seguridad y Salud en el Trabajo "SST" de la Empresa Temporal.' },
      {
        numero: '7)',
        texto: 'Se hace entrega de la documentación requerida para la vinculación de beneficiarios a la Caja de Compensación Familiar y se establece compromiso de 15 días para la entrega sobre la documentación para afiliación de beneficiarios a la Caja de Compensación y EPS si aplica. De lo contrario se entenderá que usted no desea recibir este beneficio, recuerde que es su responsabilidad el registro de los mismos.'
      },
      {
        numero: '8)',
        texto: 'Plan funeral Coorserpark: AUTORIZO la afiliación y descuento VOLUNTARIO al plan, por un valor de $4.094,5 descontados quincenalmente por Nómina. La afiliación se hace efectiva a partir del primer descuento.'
      }
    ];

    y += 5; // Posición inicial
    maxWidth = 180; // Ancho máximo del texto
    contenidoFinal.forEach((item) => {
      // Imprimir el número del elemento
      doc.setFont('helvetica', 'bold').text(item.numero, 10, y);

      // Dividir el texto en líneas
      doc.setFont('helvetica', 'normal');
      const textoEnLineas = doc.splitTextToSize(item.texto, maxWidth);

      // Imprimir el texto dividido y ajustar "y"
      doc.text(textoEnLineas, 20, y);
      y += textoEnLineas.length * lineHeight; // Calcular altura total del texto y ajustarla
      // si es el numero 8 -5 y
      if (item.numero === '7)') {
        y -= 4;
      }
    });
    doc.setFont('helvetica', 'bold').setFontSize(7.5);
    if (this.datoInfoContratacion.seguro_funerario == "SI") {
      doc.text('SI (  x  )', 170, y - 6);
      doc.text('NO (     )', 190, y - 6);
    }
    else if (this.datoInfoContratacion.seguro_funerario == "NO") {
      doc.text('SI (     )', 170, y - 6);
      doc.text('NO (  x  )', 190, y - 6);
    }

    // Nota final
    doc.setFont('helvetica', 'bold').text('Nota:', 10, y - 3);
    doc.setFont('helvetica', 'normal').setFontSize(8).text(
      'Si usted autorizó este descuento debe presentar una carta en la oficina de la Temporal solicitando el retiro, para la desafiliación de este plan.',
      20,
      y - 3,
      { maxWidth: 180 }
    );

    // Mensaje con el enlace
    y += 5; // Ajustar la posición vertical
    doc.setFillColor(230, 230, 230); // Fondo gris claro
    doc.rect(10, y - 5, 190, 8, 'F'); // Rectángulo de fondo para el texto "Recuerde que:"

    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(0, 0, 0); // Texto negro
    doc.text('Recuerde que:', 12, y);

    doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0);
    doc.text('Puede encontrar esta información disponible en:', 45, y);

    // Enlace interactivo
    doc.setTextColor(0, 0, 255); // Texto azul para el enlace
    doc.textWithLink('http://tualianza.co/', 120, y, { url: 'http://tualianza.co/' });

    // Resetear color a negro para el resto del texto
    doc.setTextColor(0, 0, 0);

    // Código en negrita
    doc.setFont('helvetica', 'bold');
    doc.text('Ingresando la clave:', 155, y);
    doc.setFont('helvetica', 'bold').setFontSize(10);
    doc.text('9876', 190, y);

    // DEL COLABORADOR:
    y += 8; // Espacio después del mensaje anterior
    doc.setFont('helvetica', 'bold').setFontSize(9);
    doc.setTextColor(0, 0, 0); // Asegurarse de que el texto sea negro
    doc.text('DEL COLABORADOR:', 10, y);

    // Volver a tamaño de texto estándar
    doc.setFontSize(7.5);

    const contenidoFinalColaborador = [
      { numero: 'a)', texto: 'Por medio de la presente manifiesto que recibí lo anteriormente mencionado y que acepto el mismo.' },
      { numero: 'b)', texto: 'Leí y comprendí  el curso de inducción General y de Seguridad y Salud en el Trabajo, así como  el contrato laboral   y todas las cláusulas y condiciones establecidas.' },
      { numero: 'c)', texto: 'Información Condiciones de Salud: Manifiesto que conozco los resultados de mis exámenes médicos de ingreso y las recomendaciones dadas por el médico ocupacional.' },
    ];

    y += 5; // Posición inicial
    maxWidth = 180; // Ancho máximo del texto
    contenidoFinalColaborador.forEach((item) => {
      // Imprimir el número del elemento
      doc.setFont('helvetica', 'bold').text(item.numero, 10, y);

      // Dividir el texto en líneas
      doc.setFont('helvetica', 'normal');
      const textoEnLineas = doc.splitTextToSize(item.texto, maxWidth);

      // Imprimir el texto dividido y ajustar "y"
      doc.text(textoEnLineas, 20, y);
      y += textoEnLineas.length * lineHeight; // Calcular altura total del texto y ajustarla
      // si es numero c) -5 y
      if (item.numero === 'b)') {
        y -= 3;
      }
    });

    y += 10; // Ajusta la posición vertical al final de todo
    //  Firma de Aceptación
    doc.setFont('helvetica', 'bold').setFontSize(8);
    // línea de firma
    doc.line(10, y, 70, y); // Ajusta las coordenadas según el tamaño del documento
    doc.text('Firma de Aceptación', 10, y + 4);
    // Aquí agregamos la firma en base64 con su prefijo
    if (this.firma !== '') {
      // Asegúrate de que this.firma solo sea el base64 sin el 'data:image/png;base64,'
      const firmaConPrefijo = this.firma;

      doc.addImage(firmaConPrefijo, 'PNG', 10, 225, 50, 20);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró la firma',
      });
      return;
    }

    y += 8;
    //  No de Cédula: EN NEGRITA
    doc.setFont('helvetica', 'bold').setFontSize(8);
    // Número de Identificación datosPersonales.numerodeceduladepersona
    doc.text(`No de Cédula: ${this.datoPersonal.numerodeceduladepersona}`, 10, y);

    // Tabla Huellas con encabezados correctamente dentro de un recuadro
    const tableWidth = 82; // Ancho total de la tabla
    const tableHeight = 30; // Altura de la tabla para las huellas
    const headerHeight = 8; // Altura de los encabezados
    const startX = 110; // Posición inicial X de la tabla
    const startY = y - 25; // Posición inicial Y de la tabla

    // Dibujar fondo gris para los encabezados
    doc.setFillColor(230, 230, 230);
    doc.rect(startX, startY, tableWidth / 2, headerHeight, 'F'); // Fondo "Huella Indice Derecho"
    doc.rect(startX + tableWidth / 2, startY, tableWidth / 2, headerHeight, 'F'); // Fondo "Huella pulgar Derecho"

    // Dibujar bordes alrededor de los encabezados
    doc.setDrawColor(0); // Color del borde (negro)
    doc.rect(startX, startY, tableWidth / 2, headerHeight); // Borde "Huella Indice Derecho"
    doc.rect(startX + tableWidth / 2, startY, tableWidth / 2, headerHeight); // Borde "Huella pulgar Derecho"

    // Texto de encabezado
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('Huella Indice Derecho', startX + 5, startY + 5);
    doc.text('Huella pulgar Derecho', startX + tableWidth / 2 + 5, startY + 5);

    // Dibujar áreas para las huellas debajo de los encabezados
    doc.rect(startX, startY + headerHeight, tableWidth / 2, tableHeight); // Área "Huella Indice Derecho"
    doc.rect(startX + tableWidth / 2, startY + headerHeight, tableWidth / 2, tableHeight); // Área "Huella pulgar Derecho"

    // colocar imagen que estan indicederecho en base 64 dentro del cuadro
    // Tamaño de las imágenes dentro de los cuadros
    const imageWidth = tableWidth / 2 - 10; // Un pequeño margen
    const imageHeight = tableHeight - 3;  // Un pequeño margen

    // Posiciones de las imágenes
    const indiceX = startX + 5;
    const indiceY = startY + headerHeight + 2;
    const pulgarX = startX + tableWidth / 2 + 5;
    const pulgarY = startY + headerHeight + 2;

    // Colocar las imágenes si están disponibles
    if (this.huellaIndiceDerecho) {
      doc.addImage(this.huellaIndiceDerecho, 'PNG', indiceX, indiceY, imageWidth, imageHeight);
    }

    // Posición vertical ajustada al final del documento
    y += 1; // Espacio adicional después del contenido final

    // Definir dimensiones de la imagen
    const width = 95;  // Ancho de la imagen
    const height = 10; // Altura de la imagen
    const x2 = 10;      // Posición X de la imagen
    const imagePath = 'firma/FirmaEntregaDocAlianza.png'; // Ruta de la imagen

    // Añadir la imagen de firma
    doc.addImage(imagePath, 'PNG', x2, y, width, height);

    // Convertir a Blob y guardar en uploadedFiles
    const pdfBlob = doc.output('blob');
    const fileName = `${this.empresa}_Entrega_de_documentos.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    this.uploadedFiles['Entrega de documentos'] = { file: pdfFile, fileName };

    this.verPDF({ titulo: 'Entrega de documentos' });
  }

  // Generar documento de entrega de documentos de apoyo
  generarEntregaDocsApoyo() {
    // ---------------- Helpers ----------------
    const H_CENTER = 'center' as const;
    const BOLD = 'bold' as const;
    const ITALIC = 'italic' as const;

    const renderJustifiedLineEntregaDocs = (
      doc: jsPDF,
      linea: string,
      x: number,
      y: number,
      anchoDisponible: number,
      ultimaLinea: boolean
    ) => {
      const palabras = linea.split(' ');
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

    // --------------- PDF base ---------------
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    doc.setProperties({
      title: 'Apoyo_Laboral_Entrega_Documentos.pdf',
      author: this.empresa,
      creator: this.empresa,
    });

    const logoPath = 'logos/Logo_AL.png';
    const nit = 'NIT: 900.864.596-1';

    const imgWidth = 27, imgHeight = 10, marginTop = 5, marginLeft = 7;
    doc.addImage(logoPath, 'PNG', marginLeft, marginTop, imgWidth, imgHeight);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(nit, marginLeft, marginTop + imgHeight + 3);
    doc.setFont('helvetica', 'normal');

    // Código de versión arriba derecha
    doc.setFontSize(8);
    doc.text('TA CO-RE-6 V23 Abril 06-25', 170, 10);

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text('Entrega de Documentos y Autorizaciones', 110, 20, { align: 'center' });

    // Intro
    const marginLeftText = 10;
    let y = 25;
    let maxWidth = 190;

    doc.setFontSize(8).setFont('helvetica', 'normal');
    const intro =
      'Reciba un cordial saludo, por medio del presente documento afirmo haber recibido, leído y comprendido los documentos relacionados a continuación:';
    doc.text(intro, marginLeftText, y, { maxWidth });
    doc.setFontSize(7);
    y = 29;

    // Lista 1) 2)
    const lista = [
      'Copia original del contrato Individual de trabajo',
      'Inducción General de nuestra Compañía e Información General de la Empresa Usuaria el cual incluye información sobre:'
    ];
    lista.forEach((item, index) => {
      const numero = `${index + 1}) `;
      const textPosX = 10;
      doc.setFont('helvetica', 'bold'); doc.text(numero, textPosX, y);
      doc.setFont('helvetica', 'normal');
      const numW = doc.getTextWidth(numero);
      doc.text(item, textPosX + numW, y);
      y += 5;
    });

    // Subtítulo tabla
    doc.setFontSize(8).setFont('helvetica', 'bold');
    doc.text('Fechas de Pago de Nómina y Valor del almuerzo que es descontado por Nómina o Liquidación final:', 30, y);
    const startYForTable = y + 3;

    // -------------------- TABLA --------------------
    const head: RowInput[] = [
      [
        { content: 'EMPRESA USUARIA', styles: { halign: H_CENTER, fontStyle: BOLD, fillColor: [255, 128, 0], textColor: 255 } },
        { content: 'FECHA DE PAGO', styles: { halign: H_CENTER, fontStyle: BOLD, fillColor: [255, 128, 0], textColor: 255 } },
        { content: 'SERVICIO DE CASINO', styles: { halign: H_CENTER, fontStyle: BOLD, fillColor: [255, 128, 0], textColor: 255 } }
      ]
    ];

    const body: RowInput[] = [
      [
        { content: 'The Elite Flower S.A.S C.I *\nFundación Fernando Borrero Caicedo', styles: { fontStyle: ITALIC, fontSize: 6.5 } },
        { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } },
        { content: 'Valor de Almuerzo $ 1,945\nDescuento quincenal por nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: H_CENTER } }
      ],
      [
        { content: 'Luisiana Farms S.A.S.', styles: { fontStyle: ITALIC, fontSize: 6.5 } },
        { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } },
        { content: 'Valor de Almuerzo $ 3,700\nDescuento quincenal por nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: H_CENTER } }
      ],
      [
        { content: 'Petalia S.A.S', styles: { fontStyle: ITALIC, fontSize: 6.5 } },
        { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } },
        { content: 'No cuenta con servicio de casino, se debe llevar el almuerzo', styles: { fontSize: 6.5, halign: H_CENTER } }
      ],
      [
        { content: 'Fantasy Flower S.A.S. \nMercedes S.A.S. \nWayuu Flowers S.A.S', styles: { fontStyle: ITALIC, fontSize: 6.5 } },
        { content: '06 y 21 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } },
        { content: 'Valor de Almuerzo $ 1,945 \n Descuento quincenal por nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: H_CENTER } }
      ]
    ];

    autoTable(doc, {
      head,
      body,
      startY: startYForTable,
      theme: 'grid',
      margin: { left: 10, right: 10 },
      styles: { font: 'helvetica', fontSize: 6.5, cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 } },
      headStyles: { lineWidth: 0.2, lineColor: [120, 120, 120] },
      bodyStyles: { lineWidth: 0.2, lineColor: [180, 180, 180], valign: 'middle' },
      columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 45 }, 2: { cellWidth: 'auto' as const } },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? (startYForTable + 30);

    // Línea inferior
    doc.setDrawColor(0, 0, 0).setLineWidth(0.2);
    doc.line(15, finalY, 10 + 195, finalY);

    y = finalY + 4;

    // Autorización casino
    doc.setFontSize(8).setFont('helvetica', 'bold');
    doc.text('Teniendo en cuenta la anterior información, autorizo descuento de casino:', 10, y);
    doc.text('N/A  ( X )', 150, y);

    // Forma de pago
    doc.setFont('helvetica', 'bold').setFontSize(7);
    doc.text('FORMA DE PAGO:', 10, y + 6);
    y += 5;

    const formaPagoSeleccionada = this.datoInfoContratacion?.forma_pago || '';
    const numeroPagos = this.datoInfoContratacion?.numero_pagos || '';

    const opciones = [
      { nombre: 'Daviplata', x: 10, y: y + 5 },
      { nombre: 'Davivienda cta ahorros', x: 60, y: y + 5 },
      { nombre: 'Colpatria cta ahorros', x: 120, y: y + 5 },
      { nombre: 'Bancolombia', x: 10, y: y + 10 },
      { nombre: 'Otra', x: 60, y: y + 10 },
    ];

    opciones.forEach((op) => {
      doc.rect(op.x, op.y - 3, 4, 4);
      doc.setFont('helvetica', 'normal').text(op.nombre, op.x + 6, op.y);
      if (formaPagoSeleccionada === op.nombre) {
        doc.setFont('helvetica', 'bold').text('X', op.x + 1, op.y);
      }
    });

    doc.text('¿Cuál?', 115, y + 10);
    doc.line(140, y + 10, 200, y + 10);
    if (formaPagoSeleccionada === 'Otra') {
      doc.text('Especificar aquí...', 150, y + 15);
    }

    // Número TJT / Código
    y += 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold').text('Número TJT ó Celular:', 10, y);
    doc.text('Código de Tarjeta:', 110, y);
    doc.setFont('helvetica', 'normal');
    if (formaPagoSeleccionada === 'Daviplata') {
      doc.text(numeroPagos, 60, y);
    } else {
      doc.text(numeroPagos, 150, y);
    }

    // IMPORTANTE (párrafo justificado)
    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(7);
    const importante =
      'IMPORTANTE: Recuerde que si usted cuenta con su forma de pago Daviplata, cualquier cambio realizado en la misma debe ser notificado a la Emp. Temporal. También tenga presente que la entrega de la tarjeta Master por parte de la Emp. Temporal es provisional, y se reemplaza por la forma de pago DAVIPLATA; tan pronto Davivienda nos informa que usted activó su DAVIPLATA, se le genera automáticamente el cambio de forma de pago. CUIDADO! El manejo de estas cuentas es responsabilidad de usted como trabajador, por eso son personales e intransferibles.';
    const anchoJust = 190, margenJust = 10, lineHeight = 3;
    doc.setFont('helvetica', 'normal');
    const lineasImportante = doc.splitTextToSize(importante.trim().replace(/\s+/g, ' '), anchoJust);
    lineasImportante.forEach((ln: string, i: number) => {
      const last = i === lineasImportante.length - 1;
      renderJustifiedLineEntregaDocs(doc, ln, margenJust, y, anchoJust, last);
      y += lineHeight;
    });

    // Acepto cambio
    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('ACEPTO CAMBIO SIN PREVIO AVISO YA QUE HE SIDO INFORMADO (A):', 10, y - 4);
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
        texto: 'Se hace entrega de la documentación requerida para la vinculación de beneficiarios a la Caja de Compensación Familiar y se establece compromiso de 15 días para la entrega sobre la documentación para afiliación de beneficiarios a la Caja de Compensación y EPS si aplica. \nDe lo contrario se entenderá que usted no desea recibir este beneficio, recuerde que es su responsabilidad el registro de los mismos.'
      },
      {
        numero: '9)',
        texto: 'Plan funeral Coorserpark: AUTORIZO la afiliación y descuento VOLUNTARIO al plan, por un valor de $4.095 descontados quincenalmente por Nómina. La afiliación se hace efectiva a partir del primer descuento.'
      }
    ];

    maxWidth = 190;
    contenidoFinal.forEach((item) => {
      doc.setFont('helvetica', 'bold').text(item.numero, 10, y);
      doc.setFont('helvetica', 'normal');
      const textoEnLineas = doc.splitTextToSize(item.texto, maxWidth);
      doc.text(textoEnLineas, 20, y);
      y += textoEnLineas.length * lineHeight;
    });

    // SI / NO del seguro
    if (this?.datoInfoContratacion?.seguro_funerario === 'SI') {
      doc.text('SI (  x  )', 170, y - 4);
      doc.text('NO (     )', 190, y - 4);
    } else if (this?.datoInfoContratacion?.seguro_funerario === 'NO') {
      doc.text('SI (     )', 170, y - 4);
      doc.text('NO (  x  )', 190, y - 4);
    }

    // Nota
    doc.setFont('helvetica', 'bold').text('Nota:', 10, y + 1);
    doc.setFont('helvetica', 'normal').setFontSize(7).text(
      'Si usted autorizó este descuento debe presentar una carta en la oficina de la Temporal solicitando el retiro, para la desafiliación de este plan.',
      20,
      y + 1,
      { maxWidth: 180 }
    );

    // Banner "Recuerde que:"
    y += 5;
    doc.setFillColor(230, 230, 230);
    doc.rect(10, y - 2, 190, 5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(0, 0, 0);
    doc.text('Recuerde que:', 12, y + 1);
    doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0);
    doc.text('Puede encontrar esta información disponible en:', 35, y + 1);
    doc.setTextColor(0, 0, 255);
    doc.textWithLink('http://www.apoyolaboralts.com/', 105, y + 1, { url: 'http://www.apoyolaboralts.com/' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Ingresando la clave:', 155, y + 1);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('9876', 190, y + 1);

    // DEL COLABORADOR
    y += 8;
    // --- DEL COLABORADOR (hanging indent, soporta saltos de línea) ---
    const contenidoFinalColaborador = [
      { numero: 'a)', texto: 'Por medio de la presente manifiesto que recibí lo anteriormente mencionado y que acepto el mismo.' },
      { numero: 'b)', texto: 'Leí y comprendí  el curso de inducción General y de Seguridad y Salud en el Trabajo, así como  el contrato laboral   y todas las cláusulas y condiciones establecidas.' },
      { numero: 'c)', texto: 'Información Condiciones de Salud: Manifiesto que conozco los resultados de mis exámenes médicos de ingreso y las recomendaciones dadas por el médico ocupacional.' },
    ];

    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('DEL COLABORADOR:', marginLeft, y);
    y += 5;

    doc.setFontSize(7.5); // tamaño de texto del bloque

    const lh = 4;             // interlineado (mm)
    const gapAfterItem = 1;   // espacio entre ítems (mm)
    const bottomMargin = 12;  // margen inferior de seguridad

    // Medimos el ancho máximo de los bullets para alinear todo igual
    doc.setFont('helvetica', 'bold');
    const bulletBoxWidth =
      Math.max(doc.getTextWidth('a) '), doc.getTextWidth('b) '), doc.getTextWidth('c) ')) + 1.5;

    const xBullet = marginLeft;
    const xText = xBullet + bulletBoxWidth;
    const availWidth = pageWidth - 9 - xText;

    contenidoFinalColaborador.forEach(({ numero, texto }) => {
      // Asegura página disponible
      if (y > pageHeight - bottomMargin) { doc.addPage(); y = 15; }

      // Dibuja el bullet en negrita alineado a la primera línea del párrafo
      doc.setFont('helvetica', 'bold');
      doc.text(numero, xBullet, y);

      // Texto normal con soporte de saltos de línea explícitos
      doc.setFont('helvetica', 'normal');
      const parrafos = String(texto).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const partes = parrafos.length ? parrafos : [''];

      partes.forEach((p, pi) => {
        const lines = doc.splitTextToSize(p, availWidth) as string[];

        lines.forEach((ln) => {
          if (y > pageHeight - bottomMargin) { doc.addPage(); y = 15; }
          doc.text(ln, xText, y);
          y += lh;
        });

        // Espacio entre párrafos del mismo ítem
        if (pi < partes.length - 1) y += 1.5;
      });

      // Espacio entre ítems
      y += gapAfterItem;
    });


    // Firma + datos
    y += 10;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.line(10, y, 70, y);
    doc.text('Firma de Aceptación', 10, y + 4);

    if (this.firma !== '') {
      const firmaConPrefijo =  this.firma;
      doc.addImage(firmaConPrefijo, 'PNG', 10, 186, 50, 20);
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró la firma' });
      return;
    }

    y += 8;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text(`No de Identificación: ${this.datoPersonal?.numerodeceduladepersona ?? ''}`, 10, y);
    doc.text(`Fecha de Recibido: ${new Date().toISOString().split('T')[0]}`, 10, y + 4);

    // Tabla de huellas
    // ===== Huella (solo Índice Derecho, tamaño de un solo cuadro) =====
    const tableWidth = 82, tableHeight = 30, headerHeight = 8, startX = 165, startY = y - 10;
    const slotWidth = tableWidth / 2;   // ancho de un solo cuadro (no combinado)
    const slotHeight = tableHeight;

    doc.setFillColor(230, 230, 230);

    // Encabezado del único cuadro
    doc.rect(startX, startY, slotWidth, headerHeight, 'F'); // fondo gris
    doc.setDrawColor(0);
    doc.rect(startX, startY, slotWidth, headerHeight);      // borde
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('Huella Indice Derecho', startX + 5, startY + 5);

    // Área para la huella
    doc.rect(startX, startY + headerHeight, slotWidth, slotHeight);

    // Imagen de la huella (si existe)
    const imageWidth = slotWidth - 10;   // pequeño margen interno
    const imageHeight = slotHeight - 3;  // pequeño margen interno
    const indiceX = startX + 5;
    const indiceY = startY + headerHeight + 2;

    if (this.huellaIndiceDerecho) {
      doc.addImage(this.huellaIndiceDerecho, 'PNG', indiceX, indiceY, imageWidth, imageHeight);
    }

    // if (this.huellaPulgarDerecho) doc.addImage(this.huellaPulgarDerecho, 'PNG', pulgarX, pulgarY, imageWidth, imageHeight);

    // Sello / imagen final
    y += 5;
    const imagePath = 'firma/FirmaEntregaDocApoyo.png';
    doc.addImage(imagePath, 'PNG', 10, y, 95, 10);

    // Exportar
    const pdfBlob = doc.output('blob');
    const fileName = `${this.empresa}_Entrega_de_documentos.pdf`;
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
    if (this.empresa === 'APOYO LABORAL SAS') {
      logoPath = 'logos/Logo_AL.png';
      nit = '900.814.587-1';
      domicilio = 'CARRERA 2 # 8 - 156 FACATATIVÁ C/MARCA';
    } else if (this.empresa === 'TU ALIANZA SAS') {
      logoPath = 'logos/Logo_TA.png';
      nit = '900.864.596-1';
      domicilio = 'CLL 7 4 49 Madrid, Cundinamarca';
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
    doc.text("Código: AL CO-RE-1", tableStartX + 2, startY + 11.5);
    doc.text("Versión: 07", col1 + 2, startY + 11.5); // Ajustar dentro de columna
    doc.text(`Fecha Emisión: Enero 06-21`, col2 + 5, startY + 11.5);
    doc.text("Página: 1 de 3", col3 + 6, startY + 11.5); // Ajustar dentro de columna

    // Representado por
    doc.setFontSize(7);

    const fechaISO = this.datoSeleccion.fechaIngreso; // '2024-12-04T05:00:00.000Z'

    // Convertir la fecha ISO a un objeto Date
    const fecha = new Date(fechaISO);

    // Formatear al formato dd/mm/yyyy
    const fechaFormateada = [
      String(fecha.getDate()).padStart(2, '0'),  // dd
      String(fecha.getMonth() + 1).padStart(2, '0'),  // mm
      fecha.getFullYear()  // yyyy
    ].join('/');

    // Normaliza el texto de nombre completo para evitar problemas con caracteres especiales
    const nombreCompletoNormalizado = this.nombreCompleto.normalize('NFC');

    // Datos de titulos
    const datos = [
      { titulo: 'Representado por', valor: 'MAYRA HUAMANÍ LÓPEZ' },
      { titulo: 'Nombre del Trabajador', valor: this.datoPersonal.primer_nombre + ' ' + (this.datoPersonal.segundo_nombre ?? '') + ' ' + this.datoPersonal.primer_apellido + ' ' + (this.datoPersonal.segundo_apellido ?? '') },
      { titulo: 'Fecha de Nacimiento', valor: this.datoPersonal.fecha_nacimiento },
      { titulo: 'Domicilio del Trabajador', valor: this.datoPersonal.direccion_residencia },
      { titulo: 'Fecha de Iniciación', valor: fechaFormateada },
      { titulo: 'Salario Mensual Ordinario', valor: 'S.M.M.L.V. $1.423.500 — Un millón cuatrocientos veintitrés mil quinientos pesos M/C.' },
      { titulo: 'Periódo de Pago Salario', valor: 'Quincenal' },
      { titulo: 'Subsidio de Transporte', valor: 'SE PAGA EL LEGAL VIGENTE  O SE SUMINISTRA EL TRANSPORTE' },
      { titulo: 'Forma de Pago', valor: 'Banca Móvil,  Cuenta de Ahorro o Tarjeta Monedero' },
      { titulo: 'Nombre Empresa Usuria', valor: this.datoSeleccion.centro_costo_entrevista },
      { titulo: 'Cargo', valor: this.datoSeleccion.cargo },
      // { titulo: 'Descripción de la Obra/Motivo Temporada', valor: this.descripcionVacante },
      { titulo: 'Domicilio del patrono', valor: domicilio },
      { titulo: 'Tipo y No de Identificación', valor: this.datoPersonal.tipodedocumento + '        ' + this.datoPersonal.numerodeceduladepersona },
      { titulo: 'Email', valor: this.datoPersonal.direccion_residencia },
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
    // this.datoVacante.empresaUsuariaSolicita + CENTRO DE COSTOS + this.datoVacante.finca + DIR. + this.datoVacante.direccion
    doc.setFont('helvetica', 'normal');
    // Construir texto dinámico sin null ni undefined
    const partes = [
      this.datoVacante?.empresaUsuariaSolicita,
      'CENTRO DE COSTOS',
      this.datoVacante?.finca || '',
      this.datoVacante?.direccion ? `DIR. ${this.datoVacante.direccion}` : ''
    ].filter(Boolean); // elimina los vacíos o null

    const textoLinea = partes.join(' ').replace(/\s+/g, ' ').trim();

    doc.text(textoLinea, 45, y + 41.3, { maxWidth: 195 });

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
    doc.text(this.datoPersonal.numerodeceduladepersona, 110, y + 18);
    doc.text('Número de Identificación del Trabajador', 110, y + 23);
    if (this.firma !== '') {
      // Asegúrate de que this.firma solo sea el base64 sin el 'data:image/png;base64,'
      const firmaConPrefijo =  this.firma;

      doc.addImage(firmaConPrefijo, 'PNG', 42, 207, 50, 20);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró la firma',
      });
      return;
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
    //doc.text('C.C.' + this.cedulaPersonalAdministrativo.cedula, 150, y + 46);


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





}
