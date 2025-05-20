import { SharedModule } from '@/app/shared/shared.module';
import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import Swal from 'sweetalert2';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { HiringService } from '../../service/hiring.service';
import * as fontkit from 'fontkit';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-generate-contracting-documents',
  imports: [
    SharedModule
  ],
  templateUrl: './generate-contracting-documents.component.html',
  styleUrl: './generate-contracting-documents.component.css'
})

export class GenerateContractingDocumentsComponent {
  isSidebarHidden = false;
  empresa: string = '';
  descripcionVacante: string = '';
  cedula: string = '';
  nombreCompletoLogin: string = '';
  // Propiedades para almacenar los formularios
  datosPersonales: any = {};
  datosPersonalesParte2: any = {};
  datosTallas: any = {};
  datosConyugue: any = {};
  datosPadre: any = {};
  datosMadre: any = {};
  datosReferencias: any = {};
  datosExperienciaLaboral: any = {};
  datosHijos: any = {};
  datosParte3Seccion1: any = {};
  datosParte3Seccion2: any = {};
  datosParte4: any = {};
  selecionparte1: any = {};
  selecionparte2: any = {};
  selecionparte3: any = {};
  selecionparte4: any = {};
  pagoTransporte: any = {};
  codigoContratacion: any = '';
  firma: any = '';
  huellaIndiceDerecho: any;
  huellaPulgarDerecho: any;
  firmaPersonalAdministrativo: any = '';
  user: any = {};
  sede: any = '';
  cedulaPersonalAdministrativo: any = {};

  documentos = [
    { titulo: 'Autorización de datos' },
    { titulo: 'Entrega de documentos' },
    { titulo: 'Ficha técnica' },
    { titulo: 'Contrato' },
    { titulo: 'Cedula' },
    { titulo: 'ARL' },
    { titulo: 'Figura Humana' },
  ];
  nombreCompleto = '';

  referenciasA = [
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

  referenciasF = [
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



  uploadedFiles: { [key: string]: { file: File, fileName: string } } = {}; // Almacenar tanto el archivo como el nombre

  typeMap: { [key: string]: number } = {
    Contrato: 25,
    "Autorización de datos": 26,
    "Entrega de documentos": 27,
    'Ficha técnica': 34,
    Cedula: 29,
    ARL: 30,
    'Figura Humana': 31
  };


  async ngOnInit(): Promise<void> {
    // Mostrar Swal de carga desde el inicio
    Swal.fire({
      icon: 'info',
      title: 'Cargando datos...',
      text: 'Por favor, espera un momento.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    await this.recuperarFormulariosDesdeLocalStorage();

    // Cargar datos del localStorage y asignarlos
    if (isPlatformBrowser(this.platformId)) {
      try {
        const storedUser = localStorage.getItem('user');
        const cedulaL = localStorage.getItem('cedula');
        this.cedula = cedulaL || '';
        this.user = storedUser ? JSON.parse(storedUser) : {};
        this.sede = this.user.sucursalde || '';
      } catch (error) {
        this.user = {};
      }
    } else {
      this.user = {};
    }

    // Llamar al servicio para obtener datos biométricos
    this.contratacionService.buscarEncontratacionDatosBiometricos(this.cedula).subscribe(
      (res: any) => {
        // Al terminar la llamada, cerrar el Swal
        Swal.close();

        if (res && Object.keys(res).length > 0) {
          this.firma = res.firmaSolicitante || '';
          // this.huellaIndiceDerecho = res.huellaIndiceDerecho || '';
          // this.huellaPulgarDerecho = res.huellaPulgarDerecho || '';
          this.firmaPersonalAdministrativo = res.firmaPersonalAdministrativo || '';
        } else {
          Swal.fire('Sin datos', 'No se encontraron datos biométricos para esta cédula.', 'info');
        }
      },
      (error) => {
        // En caso de error también cerrar el Swal y notificar
        Swal.close();
        Swal.fire('Error', 'Ocurrió un error al obtener los datos biométricos.', 'error');
      }
    );
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private contratacionService: HiringService,
    private gestionDocumentalService: GestionDocumentalService
  ) { }

  toggleSidebar() {
    this.isSidebarHidden = !this.isSidebarHidden;
  }

  isSubirPDF(doc: any): boolean {
    // Devuelve true si el título corresponde a Cedula, ARL o Figura Humana
    return ['Cedula', 'ARL', 'Figura Humana'].includes(doc.titulo);
  }

  subirArchivo(event: any, campo: string) {
    const input = event.target as HTMLInputElement; // Referencia al input
    const file = input.files?.[0]; // Obtén el archivo seleccionado

    if (file) {
      // Verificar si el nombre del archivo tiene más de 100 caracteres
      if (file.name.length > 100) {
        Swal.fire('Error', 'El nombre del archivo no debe exceder los 100 caracteres', 'error');

        // Limpiar el input
        this.resetInput(input);
        return; // Salir de la función si la validación falla
      }

      // Si la validación es exitosa, almacenar el archivo
      this.uploadedFiles[campo] = { file: file, fileName: file.name }; // Guarda el archivo y el nombre
    }
    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    this.resetInput(input);
  }

  // Método para reiniciar el input en el DOM
  private resetInput(input: HTMLInputElement): void {
    const newInput = input.cloneNode(true) as HTMLInputElement;
    input.parentNode?.replaceChild(newInput, input);
  }

  devolvercontratacion() {
    window.location.href = '/dashboard/hiring/hiring-process';
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
        // Asignar cada formulario a su propiedad correspondiente
        this.datosPersonales = data.datosPersonales || {};
        this.datosPersonalesParte2 = data.datosPersonalesParte2 || {};
        this.datosTallas = data.datosTallas || {};
        this.datosConyugue = data.datosConyugue || {};
        this.datosPadre = data.datosPadre || {};
        this.datosMadre = data.datosMadre || {};
        this.datosReferencias = data.datosReferencias || {};
        this.datosExperienciaLaboral = data.datosExperienciaLaboral || {};
        this.datosHijos = data.datosHijos || {};
        this.datosParte3Seccion1 = data.datosParte3Seccion1 || {};
        this.datosParte3Seccion2 = data.datosParte3Seccion2 || {};
        this.datosParte4 = data.datosParte4 || {};
        this.selecionparte1 = data.selecionparte1 || {};
        this.selecionparte2 = data.selecionparte2 || {};
        this.selecionparte3 = data.selecionparte3 || {};
        this.selecionparte4 = data.selecionparte4 || {};
        this.empresa = data.empresa || '';
        this.pagoTransporte = data.pagoTransporte || {};
        this.cedulaPersonalAdministrativo = data.cedulaPersonalAdministrativo || {};
        this.codigoContratacion = localStorage.getItem('codigoContrato');
        this.descripcionVacante = data.descripcionVacante || '';
        this.huellaIndiceDerecho = data.huellaIndice || '';
        this.huellaPulgarDerecho = data.huellaPulgarDerecho || '';
        // Extraer el objeto del localStorage
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        // Ordenar apellidos primero y luego nombres
        this.nombreCompletoLogin = [
          user.primer_apellido || '',
          user.segundo_apellido || '',
          user.primer_nombre || '',
          user.segundo_nombre || ''
        ].filter(part => part.trim() !== '').join(' ');

        this.nombreCompleto = `${this.datosPersonales.primer_nombre} ${this.datosPersonales.segundo_nombre} ${this.datosPersonales.primer_apellido} ${this.datosPersonales.segundo_apellido}`
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        Swal.fire('Error', 'No se encontraron formularios en el almacenamiento local', 'error');
      }
    } else {
      Swal.fire('Error', 'No se puede acceder a localStorage en este entorno', 'error');
    }
  }

  // Generar autorización de datos para Apoyo Laboral y Tu Alianza
  generarAutorizacionDatos() {
    // Determinar la ruta del logo y el NIT
    let logoPath = '';
    let nit = '';
    if (this.empresa === 'APOYO LABORAL SAS') {
      logoPath = '/logos/Logo_AL.png';
      nit = 'NIT: 900.814.587-1';
    } else if (this.empresa === 'TU ALIANZA SAS') {
      logoPath = '/logos/Logo_TA.png';
      nit = 'NIT: 900.864.596-1';
    } else {
      return;
    }

    // Crear el documento PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    doc.setProperties({
      title: `${this.empresa}_Autorizacion_Datos.pdf`,
      author: this.empresa,
      creator: this.empresa,
    });

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

    // Agregar el título centrado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(
      'AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES DE CANDIDATOS',
      105,
      35,
      { align: 'center' }
    );
    // colocar mas pequeño el texto
    doc.setFontSize(8);
    // Array de párrafos
    const parrafos = [
      `${this.empresa}, tratará sus datos personales, consistentes en, pero sin limitarse a, su nombre, información de contacto, fecha y lugar de nacimiento, número de identificación, estado civil, dependientes, fotografía, antecedentes de educación y empleo, referencias personales y laborales, información sobre visas y antecedentes judiciales ("Información Personal") con el fin de (1) evaluarlo como potencial empleado de ${this.empresa}; (2) evaluar y corroborar la información contenida en su hoja de vida e información sobre la experiencia profesional y trayectoria académica (3) almacenar y clasificar su Información Personal para facilitar su acceso; `,
      `(4) proporcionar información a las autoridades competentes cuando medie requerimiento de dichas autoridades en ejercicio de sus funciones y facultades legales, en cumplimiento de un deber legal o para proteger los derechos de ${this.empresa}; (5) proporcionar información a auditores internos o externos en el marco de las finalidades aquí descritas; (6) dar a conocer la realización de eventos de interés o de nuevas convocatorias para otros puestos de trabajo; (7) verificar la información aportada y adelantar todas las actuaciones necesarias, incluida la revisión de la información aportada por usted en las distintas listas de riesgos para prevenir los riesgos para ${this.empresa} a lavado de activos, financiación del terrorismo y asuntos afines, dentro del marco de implementación de su SAGRILAFT; y todas las demás actividades que sean compatibles con estas finalidades.`,
      `Para poder cumplir con las finalidades anteriormente expuestas, ${this.empresa} requiere tratar los siguientes datos personales suyos que son considerados como sensibles: género, datos biométricos y datos relacionados con su salud (“Información Personal Sensible”). Usted tiene derecho a autorizar o no la recolección y tratamiento de su Información Personal Sensible por parte de ${this.empresa} y sus encargados. No obstante, si usted no autoriza a ${this.empresa} a recolectar y hacer el tratamiento de esta Información Personal Sensible, ${this.empresa} no podrá cumplir con las finalidades del tratamiento descritas anteriormente.`,
      `Asimismo, usted entiende y autoriza a ${this.empresa} para que verifique, solicite y/o consulte su Información Personal en listas de riesgo, incluidas restrictivas y no restrictivas, así como vinculantes y no vinculantes para Colombia, a través de cualquier motor de búsqueda tales como, pero sin limitarse a, las plataformas de los entes Administradores del Sistema de Seguridad Social Integral, las Autoridades Judiciales y de Policía Nacional, la Procuraduría General de la República, la Contraloría General de la Nación o cualquier otra fuente de información legalmente constituida y/o a través de otros motores de búsqueda diseñados con miras a verificar su situación laboral actual, sus aptitudes académicas y demás información pertinente para los fines antes señalados. ${this.empresa} realizará estas gestiones directamente, o a través de sus filiales o aliados estratégicos con quienes acuerde realizar estas actividades. ${this.empresa} podrá adelantar el proceso de consulta, a partir de su Información Personal, a través de la base de datos de la Policía Nacional, Contraloría General de la República, Contraloría General de la Nación, OFAC Sanctions List Search y otras similares. `,
      `Asimismo, usted entiende que ${this.empresa} podrá transmitir su Información Personal e Información Personal Sensible, a (i) otras oficinas del mismo grupo corporativo de ${this.empresa}, incluso radicadas en diferentes jurisdicciones que no comporten niveles de protección de datos equivalentes a los de la legislación colombiana y a (ii) terceros a los que ${this.empresa} les encargue el tratamiento de su Información Personal e Información Personal Sensible. `,
      `De igual forma, como titular de su Información Personal e Información Personal Sensible, usted tiene derecho, entre otras, a conocer, actualizar, rectificar y a solicitar la supresión de la misma, así como a solicitar prueba de esta autorización, en cualquier tiempo, y mediante comunicación escrita dirigida al correo electrónico: protecciondedatos@tsservicios.co de acuerdo al procedimiento previsto en los artículos 14 y 15 de la Ley 1581 de 2012.`,
      `En virtud de lo anterior, con su firma, ${this.empresa} podrá recolectar, almacenar, usar y en general realizar el tratamiento de su Información Personal e Información Personal Sensible, para las finalidades anteriormente expuestas, en desarrollo de la Política de Tratamiento de Datos Personales de la Firma, la cual puede ser solicitada a través de: correo electrónico protecciondedatos@tsservicios.co.`,
    ];

    // Parámetros de página y estilos
    const margenIzquierdo: number = 10;
    const margenDerecho: number = 5;
    const margenSuperior: number = 42;
    const margenInferior: number = 20;
    const anchoTexto: number = 210 - margenIzquierdo - margenDerecho; // A4 Width
    const alturaPagina: number = 297; // A4 Height
    const avanzarLinea: number = 5;  // Espaciado entre líneas
    let cursorY: number = margenSuperior; // Posición inicial en Y

    // Función auxiliar para redondear valores
    const roundTo = (num: number, decimals: number) =>
      Math.round(num * (10 ** decimals)) / (10 ** decimals);

    // Función auxiliar para determinar si una palabra va en negritas
    const esPalabraNegrita = (palabraLimpia: string, empresa: string): boolean => {
      return (
        palabraLimpia === empresa ||
        /^[A-ZÁÉÍÓÚÜÑ]+$/.test(palabraLimpia) || // Palabras en mayúsculas
        /^\(\d+\)$/.test(palabraLimpia)          // Formato (1), (2), etc.
      );
    }

    // Función para renderizar una línea justificada
    const renderizarLineaJustificada = (
      doc: jsPDF,
      linea: string,
      empresa: string,
      y: number,
      anchoDisponible: number,
      ultimaLinea: boolean = false,
      margenIzquierdo: number
    ): void => {
      // Dividir la línea en palabras
      const palabras = linea.split(' ');

      // Medir el ancho de cada palabra con su respectiva fuente (negrita o normal)
      let anchoPalabras = 0;
      const datosPalabras = palabras.map((palabra) => {
        const palabraLimpia = palabra.replace(/[.,]/g, '').trim();
        const bold = esPalabraNegrita(palabraLimpia, empresa);

        // Establecer la fuente antes de medir
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        const palabraWidth = roundTo(doc.getTextWidth(palabra), 3);

        anchoPalabras += palabraWidth;
        return { palabra, bold, width: palabraWidth };
      });

      // Calcular el espacio total que debemos asignar entre palabras
      const totalEspacios = datosPalabras.length - 1;
      let espacioWidth = doc.getTextWidth(' ');
      espacioWidth = roundTo(espacioWidth, 3);

      let cursorX = margenIzquierdo;

      if (ultimaLinea || totalEspacios <= 0) {
        // Última línea o línea con una sola palabra: sin justificación adicional.
        // Dibujamos las palabras separadas por el espacio natural.
        datosPalabras.forEach((item, index) => {
          doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
          doc.text(item.palabra, cursorX, y);
          if (index < totalEspacios) {
            cursorX += item.width + espacioWidth;
          } else {
            cursorX += item.width;
          }
        });
      } else {
        // Línea justificada: calculamos el ancho extra entre palabras.
        const espacioExtra = (anchoDisponible - anchoPalabras) / totalEspacios;

        datosPalabras.forEach((item, index) => {
          doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
          doc.text(item.palabra, cursorX, y);

          if (index < totalEspacios) {
            cursorX += item.width + roundTo(espacioExtra, 3);
          } else {
            cursorX += item.width;
          }
        });
      }

      // Restaurar fuente a normal tras la línea
      doc.setFont('helvetica', 'normal');
    };

    // Función para renderizar un párrafo justificado
    const renderizarParrafoJustificado = (
      doc: jsPDF,
      texto: string,
      empresa: string,
      anchoTexto: number,
      margenIzquierdo: number,
      margenSuperior: number,
      margenInferior: number,
      alturaPagina: number,
      avanzarLinea: number,
      callbackSaltoPagina?: () => void
    ) => {
      const textoDividido: string[] = doc.splitTextToSize(texto.trim().replace(/\s+/g, ' '), anchoTexto);
      let cursorY = margenSuperior;

      textoDividido.forEach((linea: string, index: number) => {
        // Comprobar si hay que agregar nueva página
        if (cursorY > alturaPagina - margenInferior) {
          doc.addPage();
          cursorY = margenSuperior;
          if (callbackSaltoPagina) callbackSaltoPagina();
        }

        const esUltimaLinea = index === textoDividido.length - 1;
        renderizarLineaJustificada(doc, linea, empresa, cursorY, anchoTexto, esUltimaLinea, margenIzquierdo);

        cursorY += avanzarLinea;
      });

      // Espacio adicional entre párrafos
      cursorY += 3;

      return cursorY;
    };


    // Procesar todos los párrafos
    parrafos.forEach((parrafo: string) => {
      cursorY = renderizarParrafoJustificado(
        doc,
        parrafo,
        this.empresa,
        anchoTexto,
        margenIzquierdo,
        cursorY,
        margenInferior,
        alturaPagina,
        avanzarLinea
        // callbackSaltoPagina es opcional, si lo necesitas lo pasas
      );
    });


    // Línea para firma
    doc.line(10, 250, 100, 250); // Ajusta las coordenadas según el tamaño del documento

    // Aquí agregamos la firma en base64 con su prefijo
    if (this.firma !== '') {
      // Asegúrate de que this.firma solo sea el base64 sin el 'data:image/png;base64,'
      const firmaConPrefijo = 'data:image/png;base64,' + this.firma;

      doc.addImage(firmaConPrefijo, 'PNG', 10, 228, 50, 20);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se encontró la firma',
      });
      return;
    }


    // Firma de autorización
    doc.setFont('helvetica', 'bold'); // Asegura que el texto esté en un estilo regular
    doc.text('Firma de Autorización', 10, 253); // Texto alineado con la línea superior
    doc.setFont('helvetica', 'normal'); // Restaura el estilo de fuente normal
    // Número de Identificación
    if (this.datosPersonales?.numerodeceduladepersona) {
      doc.text(
        `Número de Identificación: ${this.datosPersonales.numerodeceduladepersona}`,
        10,
        257
      ); // Espaciado adecuado debajo de "Firma de Autorización"
    } else {
      doc.text('Número de Identificación: No especificado', 10, 257);
    }

    // Fecha de autorización
    const fechaActual = new Date();
    const opcionesFormato: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const fechaFormateada = fechaActual.toLocaleDateString("es-ES", opcionesFormato);

    doc.text(`Fecha de Autorización: ${fechaFormateada}`, 10, 261); // Posicionado más abajo
    // Convertir a Blob y guardar en uploadedFiles
    const pdfBlob = doc.output('blob');
    const fileName = `${this.empresa}_Autorizacion_Datos.pdf`;
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

    const formaPagoSeleccionada = this.pagoTransporte?.formaPago || ''; // Valor dinámico de formaPago
    const numeroPagos = this.pagoTransporte?.numeroPagos || '';

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
    if (this.pagoTransporte.seguroFunerario == "SI") {
      doc.text('SI (  x  )', 170, y - 6);
      doc.text('NO (     )', 190, y - 6);
    }
    else if (this.pagoTransporte.seguroFunerario == "NO") {
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
      const firmaConPrefijo = 'data:image/png;base64,' + this.firma;

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
    doc.text(`No de Cédula: ${this.datosPersonales.numerodeceduladepersona}`, 10, y);

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
    if (this.huellaPulgarDerecho) {
      doc.addImage(this.huellaPulgarDerecho, 'PNG', pulgarX, pulgarY, imageWidth, imageHeight);
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
    // Crear el documento PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    doc.setProperties({
      title: 'Apoyo_Laboral_Entrega_Documentos.pdf',
      author: this.empresa,
      creator: this.empresa,
    });

    const logoPath = '/logos/Logo_AL.png';
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
    doc.setFontSize(6.5);

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
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Fechas de Pago de Nómina y Valor del almuerzo que es descontado por Nómina o Liquidación final:', 30, y);

    // Ajustar el texto y las secciones según tu imagen
    const head = [
      [
        { content: 'EMPRESA USUARIA', styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 128, 0], textColor: 255 } },
        { content: 'FECHAS DE PAGO', styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 128, 0], textColor: 255 } },
        { content: 'SERVICIO DE CASINO', styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 128, 0], textColor: 255 } }
      ]
    ];

    const body = [
      [
        { content: 'THE ELITE FLOWER S.A.S C.I.\nFUNDACIÓN FERNANDO BORRERO CAICEDO', styles: { fontStyle: 'italic', fontSize: 6.5 } },
        { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: 'center' } },
        { content: 'Valor del almuerzo $ 1.849\nDescuento quincenal por Nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: 'center' } }
      ],
      [
        {
          content: 'Para los siguientes centros de costo de la Empresa USUARIA THE ELITE S.A.S C.I:',
          colSpan: 3,
          styles: { fontStyle: 'bold', fontSize: 6.5, fillColor: [255, 255, 240], halign: 'left' }
        }
      ],
      [
        { content: 'Carnation, Florex, Jardines de Colombia, Las delicias, Normandia, Tinzuque, Tikiya, Chuzacá y la Nena', styles: { fontStyle: 'italic', fontSize: 6.5 } },
        { content: '06 y 21 de cada mes', styles: { fontSize: 6.5, halign: 'center' } },
        { content: 'Valor del almuerzo $ 1.849\nDescuento quincenal por Nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: 'center' } }
      ],
      [
        { content: 'FANTASY FLOWER S.A.S', styles: { fontStyle: 'italic', fontSize: 6.5 } },
        { content: '06 y 21 de cada mes', styles: { fontSize: 6.5, halign: 'center' } },
        { content: 'Valor del almuerzo $ 1.849\nDescuento quincenal por Nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: 'center' } }
      ],
      [
        { content: 'MERCEDES S.A.S EN REORGANIZACIÓN (Las mercedes y Rosas Colombianas)', styles: { fontStyle: 'italic', fontSize: 6.5 } },
        { content: '06 y 21 de cada mes', styles: { fontSize: 6.5, halign: 'center' } },
        { content: 'Valor del almuerzo $ 1.849\nDescuento quincenal por Nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: 'center' } }
      ],
      [
        { content: 'WAYUU FLOWERS S.A.S.', styles: { fontStyle: 'italic', fontSize: 6.5 } },
        { content: '06 y 21 de cada mes', styles: { fontSize: 6.5, halign: 'center' } },
        { content: 'Valor del almuerzo $ 1.849\nDescuento quincenal por Nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: 'center' } }
      ],
      [
        {
          content: 'Para los siguientes centros de costo de la Empresa WAYUU FLOWERS S.A.S:',
          colSpan: 3,
          styles: { fontStyle: 'bold', fontSize: 6.5, fillColor: [255, 255, 240], halign: 'left' }
        }
      ],
      [
        { content: 'Pozo azul, Postcosecha excellence, Belchite, Belchite 2.', styles: { fontStyle: 'italic', fontSize: 6.5 } },
        { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: 'center' } },
        { content: 'Valor del almuerzo $ 1.849\nDescuento quincenal por Nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: 'center' } }
      ],
    ];

    // Ajustar las dimensiones de las columnas:
    // - Primera columna: 70 mm
    // - Segunda columna: 30 mm (más angosta)
    // - Tercera columna: 90 mm
    autoTable(doc, {
      startY: y + 1,
      head: head as any,   // 👈 cast
      body: body as any,   // 👈 cast
      theme: 'plain',
      styles: { fontSize: 6.5, cellPadding: 1, font: 'helvetica' },
      headStyles: { fillColor: [0, 128, 0], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      columnStyles: {
        0: { cellWidth: 70, halign: 'left' },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 90, halign: 'center' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    // Dibujar el borde inferior en la última fila:
    // Suponiendo que la tabla inicia en el margen izquierdo (10) y el ancho total es 70+30+90=190
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(15, finalY, 10 + 195, finalY);

    y = finalY + 2;

    // texto  Teniendo en cuenta la anterior información, autorizo descuento de casino: N/A  ( X )
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Teniendo en cuenta la anterior información, autorizo descuento de casino:', 10, y + 2);
    doc.text('N/A  ( X )', 150, y + 2);

    // Forma de Pago
    doc.setFont('helvetica', 'bold').setFontSize(7);
    doc.text('FORMA DE PAGO:', 10, y + 6);
    y += 5;

    const formaPagoSeleccionada = this.pagoTransporte?.formaPago || ''; // Valor dinámico de formaPago
    const numeroPagos = this.pagoTransporte?.numeroPagos || '';

    const opciones = [
      { nombre: 'Daviplata', x: 10, y: y + 5 },
      { nombre: 'Davivienda cta ahorros', x: 60, y: y + 5 },
      { nombre: 'Colpatria cta ahorros', x: 120, y: y + 5 },
      { nombre: 'Bancolombia', x: 10, y: y + 10 },
      { nombre: 'Otra', x: 60, y: y + 10 },
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
    y += 5;
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
    y += 5;

    doc.text('ACEPTO CAMBIO SIN PREVIO AVISO YA QUE HE SIDO INFORMADO (A):', 10, y - 5);
    doc.setFont('helvetica', 'normal');
    doc.text('SI (  x  )', 170, y - 5);
    doc.text('NO (     )', 190, y - 5);
    doc.setFontSize(6.5);
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

    maxWidth = 190; // Ancho máximo del texto
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

    // Opciones SI / NO en la misma línea
    if (this.pagoTransporte.seguroFunerario == "SI") {
      doc.text('SI (  x  )', 170, y - 6);
      doc.text('NO (     )', 190, y - 6);
    }
    else if (this.pagoTransporte.seguroFunerario == "NO") {
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

    y += 5; // Ajustar la posición vertical
    doc.setFillColor(230, 230, 230); // Fondo gris claro
    doc.rect(10, y - 5, 190, 5, 'F'); // Rectángulo de fondo para el texto "Recuerde que:"

    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(0, 0, 0); // Texto negro
    doc.text('Recuerde que:', 12, y - 2);

    doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0);
    doc.text('Puede encontrar esta información disponible en:', 35, y - 2);

    // Enlace interactivo
    doc.setTextColor(0, 0, 255); // Texto azul para el enlace
    doc.textWithLink('http://www.apoyolaboralts.com/', 105, y - 2, { url: 'http://www.apoyolaboralts.com/' });

    // Resetear color a negro para el resto del texto
    doc.setTextColor(0, 0, 0);

    // Código en negrita
    doc.setFont('helvetica', 'bold');
    doc.text('Ingresando la clave:', 155, y - 2);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('9876', 190, y - 2);

    // DEL COLABORADOR:
    y += 4; // Espacio después del mensaje anterior
    doc.setFont('helvetica', 'bold').setFontSize(8);
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
      // si numero es b) -5 y
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
      const firmaConPrefijo = 'data:image/png;base64,' + this.firma;

      doc.addImage(firmaConPrefijo, 'PNG', 10, 227, 50, 20);
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
    doc.text(`No de Identificación: ${this.datosPersonales.numerodeceduladepersona}`, 10, y);
    //  Fecha de Recibido
    doc.text(`Fecha de Recibido: ${new Date().toISOString().split('T')[0]}`, 10, y + 4);

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
    if (this.huellaPulgarDerecho) {
      doc.addImage(this.huellaPulgarDerecho, 'PNG', pulgarX, pulgarY, imageWidth, imageHeight);
    }


    // Posición vertical ajustada al final del documento
    y += 5; // Espacio adicional después del contenido final

    // Definir dimensiones de la imagen
    const width = 95;  // Ancho de la imagen
    const height = 10; // Altura de la imagen
    const x2 = 10;      // Posición X de la imagen
    const imagePath = 'firma/FirmaEntregaDocApoyo.png'; // Ruta de la imagen

    // Añadir la imagen de firma
    doc.addImage(imagePath, 'PNG', x2, y, width, height);

    // Convertir a Blob y guardar en uploadedFiles
    const pdfBlob = doc.output('blob');
    const fileName = `${this.empresa}_Entrega_de_documentos.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    this.uploadedFiles['Entrega de documentos'] = { file: pdfFile, fileName };

    this.verPDF({ titulo: 'Entrega de documentos' });
  }

  // Generar contrato de trabajo
  generarContratoTrabajo() {
    console.log('Generando contrato de trabajo...');
    // Determinar la ruta del logo y el NIT
    let logoPath = '';
    let nit = '';
    let domicilio = '';
    if (this.empresa === 'APOYO LABORAL SAS') {
      logoPath = '/logos/Logo_AL.png';
      nit = '900.814.587-1';
      domicilio = 'CARRERA 2 # 8 - 156 FACATATIVÁ C/MARCA';
    } else if (this.empresa === 'TU ALIANZA SAS') {
      logoPath = '/logos/Logo_TA.png';
      nit = '900.864.596-1';
      domicilio = 'CLL 7 4 49 Madrid, Cundinamarca';
    } else {

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
    let fechaEmision = this.obtenerFechaActual(); // Obtener la fecha actual formateada
    doc.text(`Fecha Emisión: ${fechaEmision}`, col2 + 5, startY + 11.5);
    doc.text("Página: 1 de 3", col3 + 6, startY + 11.5); // Ajustar dentro de columna

    // Representado por
    doc.setFontSize(7);

    const fechaISO = this.selecionparte4.fechaIngreso; // '2024-12-04T05:00:00.000Z'

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
      { titulo: 'Nombre del Trabajador', valor: nombreCompletoNormalizado },
      { titulo: 'Fecha de Nacimiento', valor: this.datosPersonales.fecha_nacimiento },
      { titulo: 'Domicilio del Trabajador', valor: this.datosPersonales.direccion_residencia },
      { titulo: 'Fecha de Iniciación', valor: fechaFormateada },
      { titulo: 'Salario Mensual Ordinario', valor: 'S.M.M.L.V 1.300.000  Un Millon Trescientos mil Pesos M/C' },
      { titulo: 'Periódo de Pago Salario', valor: 'Quincenal' },
      { titulo: 'Subsidio de Transporte', valor: 'SE PAGA EL LEGAL VIGENTE  O SE SUMINISTRA EL TRANSPORTE' },
      { titulo: 'Forma de Pago', valor: 'Banca Móvil,  Cuenta de Ahorro o Tarjeta Monedero' },
      { titulo: 'Nombre Empresa Usuria', valor: this.selecionparte2.centroCosto },
      { titulo: 'Cargo', valor: this.selecionparte2.cargo },
      { titulo: 'Descripción de la Obra/Motivo Temporada', valor: this.descripcionVacante },
      { titulo: 'Domicilio del patrono', valor: domicilio },
      { titulo: 'Tipo y No de Identificación', valor: this.datosPersonales.tipodedocumento + '        ' + this.datosPersonales.numerodeceduladepersona },
      { titulo: 'Email', valor: this.datosPersonales.direccion_residencia },
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
    doc.text(this.cedulaPersonalAdministrativo.centroCosto, 7, y + 1);

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
    fechaEmision = this.obtenerFechaActual(); // Obtener la fecha actual formateada
    doc.text(`Fecha Emisión: ${fechaEmision}`, col2 + 5, startY + 11.5);
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
    fechaEmision = this.obtenerFechaActual(); // Obtener la fecha actual formateada
    doc.text(`Fecha Emisión: ${fechaEmision}`, col2 + 5, startY + 11.5);
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
    doc.text(this.datosPersonales.numerodeceduladepersona, 110, y + 18);
    doc.text('Número de Identificación del Trabajador', 110, y + 23);
    if (this.firma !== '') {
      // Asegúrate de que this.firma solo sea el base64 sin el 'data:image/png;base64,'
      const firmaConPrefijo = 'data:image/png;base64,' + this.firma;

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
    doc.text('C.C.' + this.cedulaPersonalAdministrativo.cedula, 150, y + 46);

    if (this.firmaPersonalAdministrativo !== '') {
      // Asegúrate de que this.firmaPersonalAdministrativo solo sea el base64 sin el 'data:image/png;base64,'
      const firmaPersonalAdministrativoConPrefijo = 'data:image/png;base64,' + this.firmaPersonalAdministrativo;

      doc.addImage(firmaPersonalAdministrativoConPrefijo, 'PNG', 150, 230, 48, 15);
    }


    // Convertir a Blob y guardar en uploadedFiles
    const pdfBlob = doc.output('blob');
    const fileName = `${this.empresa}_Contrato.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    this.uploadedFiles['Contrato'] = { file: pdfFile, fileName };

    this.verPDF({ titulo: 'Contrato' });
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
    return new Promise((resolve, reject) => {
      // Filtrar y preparar los archivos para subir
      const archivosAEnviar = Object.keys(this.uploadedFiles)
        .filter((key) => {
          const fileData = this.uploadedFiles[key];
          // Verificar si la clave tiene un tipo documental válido
          if (!(key in this.typeMap)) {
            return false;
          }
          // Verificar si el archivo es válido
          return fileData && fileData.file;
        })
        .map((key) => ({
          key,
          ...this.uploadedFiles[key],
          typeId: this.typeMap[key], // Asignar el tipo documental correspondiente
        }));

      if (archivosAEnviar.length === 0) {
        resolve(true); // Resolver si no hay archivos
        return;
      }

      // Crear promesas para subir cada archivo
      const promesasDeSubida = archivosAEnviar.map(({ key, file, fileName, typeId }) => {
        return new Promise<void>((resolveSubida, rejectSubida) => {
          this.gestionDocumentalService
            .guardarDocumento(fileName, this.cedula, typeId, file, this.codigoContratacion)
            .subscribe({
              next: () => {
                resolveSubida();
              },
              error: (error) => {
                rejectSubida(`Error al subir archivo "${key}": ${error.message}`);
              },
            });
        });
      });

      // Esperar a que todas las subidas terminen
      Promise.all(promesasDeSubida)
        .then(() => {
          resolve(true);
        })
        .catch((error) => {
          Swal.fire({ icon: 'error', title: 'Error al subir archivos', text: error });
          reject(error);
        });
    });
  }

  async generarFichaTecnica() {
    try {
      // Ruta del PDF base
      const pdfUrl = '/Docs/Ficha tecnica.pdf';

      // Cargar el PDF en formato ArrayBuffer
      const arrayBuffer = await fetch(pdfUrl).then((res) => {
        if (!res.ok) {
          throw new Error('No se pudo cargar el PDF base.');
        }
        return res.arrayBuffer();
      });
      console.log(this.empresa);
      let logoPath = '';
      let personaVerificareferencias = '';
      let firmaVerificareferencias = '';
      let nombreEmpresa = '';
      if (this.empresa === 'APOYO LABORAL SAS') {
        personaVerificareferencias = 'Andrea Sotelo C.C. 1.019.034.641';
        logoPath = '/logos/Logo_AL.png';
        nombreEmpresa = 'APOYO LABORAL TS S.A.S.';
        firmaVerificareferencias = 'firma/FirmaAndreaSD.png';
      } else if (this.empresa === 'TU ALIANZA SAS') {
        nombreEmpresa = 'TU ALIANZA S.A.S.';
        personaVerificareferencias = 'Andrea Sotelo C.C. 1.019.034.641';
        firmaVerificareferencias = 'firma/FirmaAndreaSD.png';
        logoPath = '/logos/Logo_TA.png';
      } else {
        return;
      }
      // Cargar el PDF y su formulario
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      // Registrar fontkit
      pdfDoc.registerFontkit(fontkit as any);

      // Cargar la fuente personalizada (por ejemplo, Roboto)
      const fontUrl = '/fonts/Roboto-Regular.ttf'; // Ruta a la fuente descargada
      const fontBytes = await fetch(fontUrl).then((res) => res.arrayBuffer());
      const customFont = await pdfDoc.embedFont(fontBytes);

      // Obtener el formulario
      const form = pdfDoc.getForm();

      // Image16
      // Cargar la imagen desde la ruta y convertirla en un objeto PDFImage
      const logoImageBytes = await fetch(logoPath).then((res) => {
        if (!res.ok) {
          throw new Error('No se pudo cargar el logo de la empresa.');
        }
        return res.arrayBuffer();
      });
      const logoImage = await pdfDoc.embedPng(logoImageBytes); // Convierte los bytes en un objeto PDFImage
      const referenciaPersonal1 = this.referenciasA[Math.floor(Math.random() * this.referenciasA.length)];
      const referenciaPersonal2 = this.referenciasA[Math.floor(Math.random() * this.referenciasA.length)];
      const referenciaFamiliar = this.referenciasF[Math.floor(Math.random() * this.referenciasF.length)];
      const referenciaFamiliar2 = this.referenciasF[Math.floor(Math.random() * this.referenciasF.length)];
      // Asignar la imagen al botón del formulario
      const image16 = form.getButton('Image16_af_image');
      image16.setImage(logoImage); // Ahora se pasa un PDFImage, no un string

      // Image18_af_image
      const image18 = form.getButton('Image18_af_image');
      image18.setImage(logoImage);

      // Establecer el texto y el tamaño de letra usando la fuente personalizada
      const codContratoField = form.getTextField('CodContrato');
      codContratoField.setText(this.codigoContratacion || '');
      codContratoField.setFontSize(7.2);
      codContratoField.updateAppearances(customFont);

      const sede = form.getTextField('sede');
      sede.setText(this.sede || '');
      sede.setFontSize(7.2);
      sede.updateAppearances(customFont);

      // 1er ApellidoRow1
      const primerApellidoField = form.getTextField('1er ApellidoRow1');
      primerApellidoField.setText(this.datosPersonales.primer_apellido || '');
      primerApellidoField.updateAppearances(customFont);

      // 2do ApellidoRow1
      const segundoApellidoField = form.getTextField('2do ApellidoRow1');
      segundoApellidoField.setText(this.datosPersonales.segundo_apellido || '');
      segundoApellidoField.updateAppearances(customFont);

      // NombresRow1
      const nombresField = form.getTextField('NombresRow1');
      nombresField.setText(
        `${this.datosPersonales.primer_nombre || ''} ${this.datosPersonales.segundo_nombre || ''
        }`
      );
      nombresField.updateAppearances(customFont);

      // Tipo Documento IdentificaciónRow1
      const tipoDocumentoField = form.getTextField('Tipo Documento IdentificaciónRow1');
      tipoDocumentoField.setText(this.datosPersonales.tipodedocumento || '');
      tipoDocumentoField.updateAppearances(customFont);

      // Número de IdentificaciónRow1
      const numeroIdentificacionField = form.getTextField('Número de IdentificaciónRow1');
      numeroIdentificacionField.setText(this.datosPersonales.numerodeceduladepersona || '');
      numeroIdentificacionField.updateAppearances(customFont);

      // Convertir la fecha de expedición al formato dd/mm/yyyy
      const fechaISO = this.datosPersonales.fecha_expedicion_cc || '';
      const fechaExpedicion = fechaISO
        ? new Date(fechaISO).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        : '';

      // Asignar la fecha al campo del formulario
      const fechaExpedicionField = form.getTextField('Fecha de ExpediciónRow1');
      fechaExpedicionField.setText(fechaExpedicion);
      fechaExpedicionField.updateAppearances(customFont);

      // Departamento de ExpediciónRow1
      const departamentoExpedicionField = form.getTextField('Departamento de ExpediciónRow1');
      departamentoExpedicionField.setText(this.datosPersonales.departamento_expedicion_cc || '');
      departamentoExpedicionField.updateAppearances(customFont);

      // Municipio de ExpediciónRow1
      const municipioExpedicionField = form.getTextField('Municipio de ExpediciónRow1');
      municipioExpedicionField.setText(this.datosPersonales.municipio_expedicion_cc || '');
      municipioExpedicionField.updateAppearances(customFont);

      // GeneroRow1
      const generoField = form.getTextField('GeneroRow1');
      generoField.setText(this.datosPersonales.genero || '');
      generoField.updateAppearances(customFont);

      // Fecha de iso 2 Fecha de NacimientoRow1
      const fechaNacimientoISO = this.datosPersonales.fecha_nacimiento || '';
      const fechaNacimiento = fechaNacimientoISO
        ? new Date(fechaNacimientoISO).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        : '';

      // Fecha de Fecha de NacimientoRow1
      const fechaNacimientoField = form.getTextField('Fecha de NacimientoRow1');
      fechaNacimientoField.setText(fechaNacimiento);
      fechaNacimientoField.updateAppearances(customFont);

      //Departamento de NacimientoRow1
      const departamentoNacimientoField = form.getTextField('Departamento de NacimientoRow1');
      departamentoNacimientoField.setText(this.datosPersonales.lugar_nacimiento_departamento || '');
      departamentoNacimientoField.updateAppearances(customFont);

      // Municipio de NacimientoRow1
      const municipioNacimientoField = form.getTextField('Municipio de NacimientoRow1');
      municipioNacimientoField.setText(this.datosPersonales.lugar_nacimiento_municipio || '');
      municipioNacimientoField.updateAppearances(customFont);

      // Estado Civil
      // if estado_civil = SE -> SeparadoEstado Civil CON X
      if (this.datosPersonales.estado_civil === 'SE') {
        const separadoField = form.getTextField('SeparadoEstado Civil');
        separadoField.setText('X');
      }

      // if estado_civil = SO -> SolteroEstado Civil CON X
      if (this.datosPersonales.estado_civil === 'SO') {
        const solteroField = form.getTextField('SolteroEstado Civil');
        solteroField.setText('X');
      }

      // if estado_civil = CA -> CasadoEstado Civil CON X
      if (this.datosPersonales.estado_civil === 'CA') {
        const casadoField = form.getTextField('CasadoEstado Civil');
        casadoField.setText('X');
      }

      // if estado_civil = VI -> ViudoEstado Civil CON X
      if (this.datosPersonales.estado_civil === 'VI') {
        const viudoField = form.getTextField('ViudoEstado Civil');
        viudoField.setText('X');
      }

      // if estado_civil = UN -> Union LibreEstado Civil CON X
      if (this.datosPersonales.estado_civil === 'UN') {
        const unionLibreField = form.getTextField('Union LibreEstado Civil');
        unionLibreField.setText('X');
      }

      // Dirección de DomicilioRow1
      const direccionDomicilioField = form.getTextField('Dirección de DomicilioRow1');
      direccionDomicilioField.setText(this.datosPersonales.direccion_residencia || '');
      direccionDomicilioField.updateAppearances(customFont);

      // BarrioRow1
      const barrioField = form.getTextField('BarrioRow1');
      barrioField.setText(this.datosPersonales.barrio || '');
      barrioField.updateAppearances(customFont);

      // Ciudad DomicilioRow1
      const ciudadDomicilioField = form.getTextField('Ciudad DomicilioRow1');
      ciudadDomicilioField.setText(this.datosPersonales.municipio || '');
      ciudadDomicilioField.updateAppearances(customFont);

      // DepartamentoRow1
      const departamentoField = form.getTextField('DepartamentoRow1');
      departamentoField.setText(this.datosPersonales.departamento || '');
      departamentoField.updateAppearances(customFont);

      // CelularRow1
      const celularField = form.getTextField('CelularRow1');
      celularField.setText(this.datosPersonales.celular || '');
      celularField.updateAppearances(customFont);

      // Correo ElectrónicoRow1
      const correoElectronicoField = form.getTextField('Correo ElectrónicoRow1');
      correoElectronicoField.setText(this.datosPersonales.primercorreoelectronico || '');
      correoElectronicoField.updateAppearances(customFont);

      // CelularGrupo Sanguineo y RH
      const celularGrupoSanguineoField = form.getTextField('CelularGrupo Sanguineo y RH');
      celularGrupoSanguineoField.setText(this.datosPersonales.rh || '');
      celularGrupoSanguineoField.updateAppearances(customFont);

      // if zurdo_diestro = ZU -> Diestro CON X
      if (this.datosPersonales.zurdo_diestro === 'ZU') {
        const diestroField = form.getTextField('Diestro');
        diestroField.setText('X');
      }
      else {
        const zurdoField = form.getTextField('PesoZurdo');
        zurdoField.setText('X');
      }

      // Fecha de Ingreso -> selecionparte4.fechaIngreso en jueves 17 de junio de 2021
      // Convertir la fecha de ingreso al formato "jueves 17 de junio de 2021"
      const fechaISOIngreso = this.selecionparte4.fechaIngreso || '';
      const fechaIngreso = fechaISOIngreso
        ? new Date(fechaISOIngreso).toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        : '';

      // Asignar la fecha al campo del formulario
      const fechaIngresoField = form.getTextField('Fecha de Ingreso');
      fechaIngresoField.setText(fechaIngreso);
      fechaIngresoField.updateAppearances(customFont);


      // Sueldo Básico
      // Formatear el salario al formato con separador de miles
      const salario = this.selecionparte4.salario || '';
      const salarioFormateado = salario
        ? new Intl.NumberFormat('es-ES', {
          minimumFractionDigits: 0, // Sin decimales
          maximumFractionDigits: 0, // Sin decimales
        }).format(Number(salario))
        : '';

      // Asignar el salario formateado al campo del formulario
      const sueldoBasicoField = form.getTextField('Sueldo Básico');
      sueldoBasicoField.setText(salarioFormateado);
      sueldoBasicoField.updateAppearances(customFont);

      // Banco
      const bancoField = form.getTextField('Banco');
      bancoField.setText(this.pagoTransporte.formaPago || '');
      bancoField.updateAppearances(customFont);

      // Cuenta
      const cuentaField = form.getTextField('Cuenta');
      cuentaField.setText(this.pagoTransporte.numeroPagos || '');
      cuentaField.updateAppearances(customFont);

      // EPS SaludRow1
      const epsSaludField = form.getTextField('EPS SaludRow1');
      epsSaludField.setText(this.selecionparte1.eps || '');
      epsSaludField.updateAppearances(customFont);

      // AFP PensiónRow1
      const afpPensionField = form.getTextField('AFP PensiónRow1');
      afpPensionField.setText(this.selecionparte1.afp || '');
      afpPensionField.updateAppearances(customFont);

      /*
      // AFC CesantiasRow1
      const afcCesantiasField = form.getTextField('AFC CesantiasRow1');
      afcCesantiasField.setText(this.selecionparte1.afc || '');
      afcCesantiasField.updateAppearances(customFont);
      */

      // Porcentaje ARLARL SURA
      const porcentajeARLField = form.getTextField('Porcentaje ARLARL SURA');
      porcentajeARLField.setText(this.pagoTransporte.porcentajeARL || '');
      porcentajeARLField.updateAppearances(customFont);

      // Apellidos y NombresRow1 -> de emergercia
      const apellidosNombresField = form.getTextField('Apellidos y NombresRow1');
      apellidosNombresField.setText(this.datosPersonales.familiar_emergencia || '');
      apellidosNombresField.updateAppearances(customFont);

      // Número de ContactoRow1
      const numeroContactoField = form.getTextField('Número de ContactoRow1');
      numeroContactoField.setText(this.datosPersonales.telefono_familiar_emergencia || '');
      numeroContactoField.updateAppearances(customFont);

      // Seleccione el Grado de Escolaridad
      const gradoEscolaridadField = form.getTextField('Seleccione el Grado de Escolaridad');
      gradoEscolaridadField.setText(this.datosPersonalesParte2.escolaridad || '');
      gradoEscolaridadField.updateAppearances(customFont);

      // Institución
      const institucionField = form.getTextField('Institución');
      institucionField.setText(this.datosPersonalesParte2.nombre_institucion || '');
      institucionField.updateAppearances(customFont);

      // Titulo Obtenido o Ultimo año Cursado
      const tituloField = form.getTextField('Titulo Obtenido o Ultimo año Cursado');
      tituloField.setText(this.datosPersonalesParte2.titulo_obtenido || '');
      tituloField.updateAppearances(customFont);

      // Año Finalización
      const anoFinalizacionField = form.getTextField('Año Finalización');
      anoFinalizacionField.setText(this.datosPersonalesParte2.ano_finalizacion || '');
      anoFinalizacionField.updateAppearances(customFont);

      // Nombre y Apellido PadreRow1
      const nombrePadreField = form.getTextField('Nombre y Apellido PadreRow1');
      nombrePadreField.setText(this.datosPadre.nombre_padre || '');
      nombrePadreField.updateAppearances(customFont);

      // ViveRow1
      const viveField = form.getTextField('ViveRow1');
      viveField.setText(this.datosPadre.vive_padre || '');
      viveField.updateAppearances(customFont);

      // OcupaciónRow1
      const ocupacionField = form.getTextField('OcupaciónRow1');
      ocupacionField.setText(this.datosPadre.ocupacion_padre || '');
      ocupacionField.updateAppearances(customFont);

      // DirecciónRow1
      const direccionPadreField = form.getTextField('DirecciónRow1');
      direccionPadreField.setText(this.datosPadre.direccion_padre || '');
      direccionPadreField.updateAppearances(customFont);

      // TeléfonoRow1
      const telefonoPadreField = form.getTextField('TeléfonoRow1');
      telefonoPadreField.setText(this.datosPadre.telefono_padre || '');
      telefonoPadreField.updateAppearances(customFont);

      // BarrioMunicipioRow1
      const barrioPadreField = form.getTextField('BarrioMunicipioRow1');
      barrioPadreField.setText(this.datosPadre.barrio_padre || '');
      barrioPadreField.updateAppearances(customFont);

      // Nombre y Apellido MadreRow1
      const nombreMadreField = form.getTextField('Nombre y Apellido MadreRow1');
      nombreMadreField.setText(this.datosMadre.nombre_madre || '');
      nombreMadreField.updateAppearances(customFont);

      // ViveRow1_2
      const viveMadreField = form.getTextField('ViveRow1_2');
      viveMadreField.setText(this.datosMadre.vive_madre || '');
      viveMadreField.updateAppearances(customFont);

      // OcupaciónRow1_2
      const ocupacionMadreField = form.getTextField('OcupaciónRow1_2');
      ocupacionMadreField.setText(this.datosMadre.ocupacion_madre || '');
      ocupacionMadreField.updateAppearances(customFont);

      // DirecciónRow1_2
      const direccionMadreField = form.getTextField('DirecciónRow1_2');
      direccionMadreField.setText(this.datosMadre.direccion_madre || '');
      direccionMadreField.updateAppearances(customFont);

      // TeléfonoRow1_2
      const telefonoMadreField = form.getTextField('TeléfonoRow1_2');
      telefonoMadreField.setText(this.datosMadre.telefono_madre || '');
      telefonoMadreField.updateAppearances(customFont);

      // BarrioMunicipioRow1_2
      const barrioMadreField = form.getTextField('BarrioMunicipioRow1_2');
      barrioMadreField.setText(this.datosMadre.barrio_madre || '');
      barrioMadreField.updateAppearances(customFont);

      // Nombre y ApellidoconyugeRow1
      const nombreConyugeField = form.getTextField('Nombre y ApellidoconyugeRow1');
      nombreConyugeField.setText(this.datosConyugue.nombre_conyugue || '');
      nombreConyugeField.updateAppearances(customFont);

      // ViveRow1_3
      const viveConyugeField = form.getTextField('ViveRow1_3');
      viveConyugeField.setText(this.datosConyugue.vive_con_el_conyugue || '');
      viveConyugeField.updateAppearances(customFont);

      // OcupaciónRow1_3
      const ocupacionConyugeField = form.getTextField('OcupaciónRow1_3');
      ocupacionConyugeField.setText(this.datosConyugue.ocupacion_conyugue || '');
      ocupacionConyugeField.updateAppearances(customFont);

      // DirecciónRow1_3
      const direccionConyugeField = form.getTextField('DirecciónRow1_3');
      direccionConyugeField.setText(this.datosConyugue.direccion_conyugue || '');
      direccionConyugeField.updateAppearances(customFont);

      // TeléfonoRow1_3
      const telefonoConyugeField = form.getTextField('TeléfonoRow1_3');
      telefonoConyugeField.setText(this.datosConyugue.telefono_conyugue || '');
      telefonoConyugeField.updateAppearances(customFont);

      // BarrioMunicipioRow1_3
      const barrioConyugeField = form.getTextField('BarrioMunicipioRow1_3');
      barrioConyugeField.setText(this.datosConyugue.barrio_conyugue || '');
      barrioConyugeField.updateAppearances(customFont);

      // Apellidos y Nombres1
      const apellidosNombres1Field = form.getTextField('Apellidos y Nombres1');
      apellidosNombres1Field.setText(this.datosHijos.hijosArray[0].nombre || '');
      apellidosNombres1Field.updateAppearances(customFont);

      // Apellidos y Nombres2
      const apellidosNombres2Field = form.getTextField('Apellidos y Nombres2');
      apellidosNombres2Field.setText(this.datosHijos.hijosArray[1].nombre || '');
      apellidosNombres2Field.updateAppearances(customFont);

      // Apellidos y Nombres3
      const apellidosNombres3Field = form.getTextField('Apellidos y Nombres3');
      apellidosNombres3Field.setText(this.datosHijos.hijosArray[2].nombre || '');
      apellidosNombres3Field.updateAppearances(customFont);

      // Apellidos y Nombres4
      const apellidosNombres4Field = form.getTextField('Apellidos y Nombres4');
      apellidosNombres4Field.setText(this.datosHijos.hijosArray[3].nombre || '');
      apellidosNombres4Field.updateAppearances(customFont);

      // Apellidos y Nombres5
      const apellidosNombres5Field = form.getTextField('Apellidos y Nombres5');
      apellidosNombres5Field.setText(this.datosHijos.hijosArray[4].nombre || '');
      apellidosNombres5Field.updateAppearances(customFont);

      /*
      // Apellidos y Nombres6
      const apellidosNombres6Field = form.getTextField('Apellidos y Nombres6');
      apellidosNombres6Field.setText(this.datosHijos.hijosArray[5].nombre || '');
      apellidosNombres6Field.updateAppearances(customFont);
*/
      // F de Nacimiento1
      const fechaNacimiento1Field = form.getTextField('F de Nacimiento1');
      fechaNacimiento1Field.setText(this.datosHijos.hijosArray[0].fecha_nacimiento || '');
      fechaNacimiento1Field.updateAppearances(customFont);

      // F de Nacimiento2
      const fechaNacimiento2Field = form.getTextField('F de Nacimiento2');
      fechaNacimiento2Field.setText(this.datosHijos.hijosArray[1].fecha_nacimiento || '');
      fechaNacimiento2Field.updateAppearances(customFont);

      // F de Nacimiento3
      const fechaNacimiento3Field = form.getTextField('F de Nacimiento3');
      fechaNacimiento3Field.setText(this.datosHijos.hijosArray[2].fecha_nacimiento || '');
      fechaNacimiento3Field.updateAppearances(customFont);

      // F de Nacimiento4
      const fechaNacimiento4Field = form.getTextField('F de Nacimiento4');
      fechaNacimiento4Field.setText(this.datosHijos.hijosArray[3].fecha_nacimiento || '');
      fechaNacimiento4Field.updateAppearances(customFont);

      // F de Nacimiento5
      const fechaNacimiento5Field = form.getTextField('F de Nacimiento5');
      fechaNacimiento5Field.setText(this.datosHijos.hijosArray[4].fecha_nacimiento || '');
      fechaNacimiento5Field.updateAppearances(customFont);

      /*
      // F de Nacimiento6
      const fechaNacimiento6Field = form.getTextField('F de Nacimiento6');
      fechaNacimiento6Field.setText(this.datosHijos.hijosArray[5].fecha_nacimiento || '');
      fechaNacimiento6Field.updateAppearances(customFont);
*/

      //  de Identificación1
      const numeroIdentificacion1Field = form.getTextField(' de Identificación1');
      numeroIdentificacion1Field.setText(this.datosHijos.hijosArray[0].no_documento || '');
      numeroIdentificacion1Field.updateAppearances(customFont);

      //  de Identificación2
      const numeroIdentificacion2Field = form.getTextField(' de Identificación2');
      numeroIdentificacion2Field.setText(this.datosHijos.hijosArray[1].no_documento || '');
      numeroIdentificacion2Field.updateAppearances(customFont);

      //  de Identificación3
      const numeroIdentificacion3Field = form.getTextField(' de Identificación3');
      numeroIdentificacion3Field.setText(this.datosHijos.hijosArray[2].no_documento || '');
      numeroIdentificacion3Field.updateAppearances(customFont);

      //  de Identificación4
      const numeroIdentificacion4Field = form.getTextField(' de Identificación4');
      numeroIdentificacion4Field.setText(this.datosHijos.hijosArray[3].no_documento || '');
      numeroIdentificacion4Field.updateAppearances(customFont);

      //  de Identificación5
      const numeroIdentificacion5Field = form.getTextField(' de Identificación5');
      numeroIdentificacion5Field.setText(this.datosHijos.hijosArray[4].no_documento || '');
      numeroIdentificacion5Field.updateAppearances(customFont);

      /*
      //  de Identificación6
      const numeroIdentificacion6Field = form.getTextField(' de Identificación6');
      numeroIdentificacion6Field.setText(this.datosHijos.hijosArray[5].numero_identificacion || '');
      numeroIdentificacion6Field.updateAppearances(customFont);
*/

      // Gen1
      const genero1Field = form.getTextField('Gen1');
      genero1Field.setText(this.datosHijos.hijosArray[0].sexo || '');
      genero1Field.updateAppearances(customFont);

      // Gen2
      const genero2Field = form.getTextField('Gen2');
      genero2Field.setText(this.datosHijos.hijosArray[1].sexo || '');
      genero2Field.updateAppearances(customFont);

      // Gen3
      const genero3Field = form.getTextField('Gen3');
      genero3Field.setText(this.datosHijos.hijosArray[2].sexo || '');
      genero3Field.updateAppearances(customFont);

      // Gen4
      const genero4Field = form.getTextField('Gen4');
      genero4Field.setText(this.datosHijos.hijosArray[3].sexo || '');
      genero4Field.updateAppearances(customFont);

      // Gen5
      const genero5Field = form.getTextField('Gen5');
      genero5Field.setText(this.datosHijos.hijosArray[4].sexo || '');
      genero5Field.updateAppearances(customFont);

      /*
      // Gen6
      const genero6Field = form.getTextField('Gen6');
      genero6Field.setText(this.datosHijos.hijosArray[5].sexo || '');
      genero6Field.updateAppearances(customFont);
*/

      // Ocupación1
      const ocupacion1Field = form.getTextField('Ocupación1');
      ocupacion1Field.setText(this.datosHijos.hijosArray[0].estudia_o_trabaja || '');
      ocupacion1Field.updateAppearances(customFont);

      // Ocupación2
      const ocupacion2Field = form.getTextField('Ocupación2');
      ocupacion2Field.setText(this.datosHijos.hijosArray[1].estudia_o_trabaja || '');
      ocupacion2Field.updateAppearances(customFont);

      // Ocupación3
      const ocupacion3Field = form.getTextField('Ocupación3');
      ocupacion3Field.setText(this.datosHijos.hijosArray[2].estudia_o_trabaja || '');
      ocupacion3Field.updateAppearances(customFont);

      // Ocupación4
      const ocupacion4Field = form.getTextField('Ocupación4');
      ocupacion4Field.setText(this.datosHijos.hijosArray[3].estudia_o_trabaja || '');
      ocupacion4Field.updateAppearances(customFont);

      // Ocupación5
      const ocupacion5Field = form.getTextField('Ocupación5');
      ocupacion5Field.setText(this.datosHijos.hijosArray[4].estudia_o_trabaja || '');
      ocupacion5Field.updateAppearances(customFont);

      // Curso1
      const curso1Field = form.getTextField('Curso1');
      curso1Field.setText(this.datosHijos.hijosArray[0].curso || '');
      curso1Field.updateAppearances(customFont);

      // Curso2
      const curso2Field = form.getTextField('Curso2');
      curso2Field.setText(this.datosHijos.hijosArray[1].curso || '');
      curso2Field.updateAppearances(customFont);

      // Curso3
      const curso3Field = form.getTextField('Curso3');
      curso3Field.setText(this.datosHijos.hijosArray[2].curso || '');
      curso3Field.updateAppearances(customFont);

      // Curso4
      const curso4Field = form.getTextField('Curso4');
      curso4Field.setText(this.datosHijos.hijosArray[3].curso || '');
      curso4Field.updateAppearances(customFont);

      // Curso5
      const curso5Field = form.getTextField('Curso5');
      curso5Field.setText(this.datosHijos.hijosArray[4].curso || '');
      curso5Field.updateAppearances(customFont);



      // TALLA CHAQUETARow1
      const tallaChaquetaField = form.getTextField('TALLA CHAQUETARow1');
      tallaChaquetaField.setText(this.datosTallas.chaqueta || '');
      tallaChaquetaField.updateAppearances(customFont);

      // TALLA PANTALONRow1
      const tallaPantalonField = form.getTextField('TALLA PANTALONRow1');
      tallaPantalonField.setText(this.datosTallas.pantalon || '');
      tallaPantalonField.updateAppearances(customFont);

      // TALLA OVEROLRow1
      const tallaOverolField = form.getTextField('TALLA OVEROLRow1');
      tallaOverolField.setText(this.datosTallas.chaqueta || '');
      tallaOverolField.updateAppearances(customFont);

      // No calzadoRow1
      const noCalzadoField = form.getTextField('No calzadoRow1');
      noCalzadoField.setText(this.datosTallas.calzado || '');
      noCalzadoField.updateAppearances(customFont);

      // No Botas de CauchoRow1
      const noBotasCauchoField = form.getTextField('No Botas de CauchoRow1');
      noBotasCauchoField.setText(this.datosTallas.calzado || '');
      noBotasCauchoField.updateAppearances(customFont);

      // No ZapatonesRow1
      const noZapatonesField = form.getTextField('No ZapatonesRow1');
      noZapatonesField.setText(this.datosTallas.calzado || '');
      noZapatonesField.updateAppearances(customFont);

      // No Botas MaterialRow1
      const noBotasMaterialField = form.getTextField('No Botas MaterialRow1');
      noBotasMaterialField.setText(this.datosTallas.calzado || '');
      noBotasMaterialField.updateAppearances(customFont);

      // Nombre Empresa 1Row1
      const nombreEmpresa1Field = form.getTextField('Nombre Empresa 1Row1');
      nombreEmpresa1Field.setText(this.datosExperienciaLaboral.nombre_expe_laboral1_empresa || '');
      nombreEmpresa1Field.updateAppearances(customFont);

      // Dirección EmpresaRow1
      const direccionEmpresa1Field = form.getTextField('Dirección EmpresaRow1');
      direccionEmpresa1Field.setText(this.datosExperienciaLaboral.direccion_empresa1 || '');
      direccionEmpresa1Field.updateAppearances(customFont);

      // TeléfonosRow1
      const telefonos1Field = form.getTextField('TeléfonosRow1');
      telefonos1Field.setText(this.datosExperienciaLaboral.telefonos_empresa1 || '');
      telefonos1Field.updateAppearances(customFont);

      // Jefe InmediatoRow1
      const jefeInmediato1Field = form.getTextField('Jefe InmediatoRow1');
      jefeInmediato1Field.setText(this.datosExperienciaLaboral.nombre_jefe_empresa1 || '');
      jefeInmediato1Field.updateAppearances(customFont);

      // CargoRow1
      const cargo1Field = form.getTextField('CargoRow1');
      cargo1Field.setText(this.datosExperienciaLaboral.cargo_empresa1 || '');
      cargo1Field.updateAppearances(customFont);

      // F de RetiroRow1
      const fechaRetiro1ISO = this.datosExperienciaLaboral.fecha_retiro_empresa1 || '';
      const fechaRetiro1 = fechaRetiro1ISO
        ? new Date(fechaRetiro1ISO).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        : '';
      const fechaRetiro1Field = form.getTextField('F de RetiroRow1');
      fechaRetiro1Field.setText(fechaRetiro1);
      fechaRetiro1Field.updateAppearances(customFont);

      // Motivo de RetiroRow1
      const motivoRetiro1Field = form.getTextField('Motivo de RetiroRow1');
      motivoRetiro1Field.setText(this.datosExperienciaLaboral.motivo_retiro_empresa1 || '');
      motivoRetiro1Field.updateAppearances(customFont);


      // Nombre Referencia 1Row1
      const nombreReferencia1Field = form.getTextField('Nombre Referencia 1Row1');
      nombreReferencia1Field.setText(this.datosReferencias.nombre_referencia_personal1 || '');
      nombreReferencia1Field.updateAppearances(customFont);

      // TeléfonosRow1_3
      const telefonosReferencia1Field = form.getTextField('TeléfonosRow1_3');
      telefonosReferencia1Field.setText(this.datosReferencias.telefono_referencia_personal1 || '');
      telefonosReferencia1Field.updateAppearances(customFont);

      // OcupaciónRow1_4
      const ocupacionReferencia1Field = form.getTextField('OcupaciónRow1_4');
      ocupacionReferencia1Field.setText(this.datosReferencias.ocupacion_referencia_personal1 || '');
      ocupacionReferencia1Field.updateAppearances(customFont);


      // Nombre Referencia 2Row1
      const nombreReferencia2Field = form.getTextField('Nombre Referencia 2Row1');
      nombreReferencia2Field.setText(this.datosReferencias.nombre_referencia_personal2 || '');
      nombreReferencia2Field.updateAppearances(customFont);

      // TeléfonosRow1_4
      const telefonosReferencia2Field = form.getTextField('TeléfonosRow1_4');
      telefonosReferencia2Field.setText(this.datosReferencias.telefono_referencia_personal2 || '');
      telefonosReferencia2Field.updateAppearances(customFont);

      // OcupaciónRow1_5
      const ocupacionReferencia2Field = form.getTextField('OcupaciónRow1_5');
      ocupacionReferencia2Field.setText(this.datosReferencias.ocupacion_referencia_personal2 || '');
      ocupacionReferencia2Field.updateAppearances(customFont);

      // Nombre Referencia 1Row1_2
      const nombreReferencia3Field = form.getTextField('Nombre Referencia 1Row1_2');
      nombreReferencia3Field.setText(this.datosReferencias.nombre_referencia_familiar1 || '');
      nombreReferencia3Field.updateAppearances(customFont);

      // TeléfonosRow1_5
      const telefonosReferencia3Field = form.getTextField('TeléfonosRow1_5');
      telefonosReferencia3Field.setText(this.datosReferencias.telefono_referencia_familiar1 || '');
      telefonosReferencia3Field.updateAppearances(customFont);

      // OcupaciónRow1_6
      const ocupacionReferencia3Field = form.getTextField('OcupaciónRow1_6');
      ocupacionReferencia3Field.setText(this.datosReferencias.ocupacion_referencia_familiar1 || '');
      ocupacionReferencia3Field.updateAppearances(customFont);

      // Nombre Referencia 1Row1_3
      const nombreReferencia4Field = form.getTextField('Nombre Referencia 1Row1_3');
      nombreReferencia4Field.setText(this.datosReferencias.nombre_referencia_familiar2 || '');
      nombreReferencia4Field.updateAppearances(customFont);

      // TeléfonosRow1_6
      const telefonosReferencia4Field = form.getTextField('TeléfonosRow1_6');
      telefonosReferencia4Field.setText(this.datosReferencias.telefono_referencia_familiar2 || '');
      telefonosReferencia4Field.updateAppearances(customFont);

      // OcupaciónRow1_7
      const ocupacionReferencia4Field = form.getTextField('OcupaciónRow1_7');
      ocupacionReferencia4Field.setText(this.datosReferencias.ocupacion_referencia_personal2 || '');
      ocupacionReferencia4Field.updateAppearances(customFont);

      // AutorizacionDeEstudiosSeguridad2
      const autorizacionEstudiosField = form.getTextField('AutorizacionDeEstudiosSeguridad2');
      autorizacionEstudiosField.setText("estudios de seguridad. De conformidad con lo dispuesto en la ley 1581 de 2012 y el decreto reglamentario 1377 de 2013 autorizo a  " + this.selecionparte2.centroCosto + " a consultar en cualquier momento a consultar en cualquier tiempo ante las centrales de riesgo datacredito, Cifin o cualquier otra entidad autorizada o central de información; el endeudamiento o información comercial disponible a mi nombre.");
      autorizacionEstudiosField.setFontSize(6);
      autorizacionEstudiosField.updateAppearances(customFont);

      // Image11_af_image -> ESTA EN BASE 64 EN firma
      // Decodificar la imagen Base64 en un Uint8Array
      const firmaBytes = this.base64ToUint8Array(this.firma);
      // Incrustar la imagen en el PDF
      const firmaImage = await pdfDoc.embedPng(firmaBytes); // Cambiar a embedJpg si la imagen es JPG
      // Obtener el campo de imagen específico
      const firmaField = form.getButton('Image11_af_image'); // Usa el nombre del campo correctamente
      // Asignar la imagen al campo de imagen
      firmaField.setImage(firmaImage);

      // CedulaAutorizacion
      const cedulaAutorizacionField = form.getTextField('CedulaAutorizacion');
      cedulaAutorizacionField.setText(this.datosPersonales.numero_documento);
      cedulaAutorizacionField.updateAppearances(customFont);

      // PersonaRefencia1P
      const personaReferencia1Field = form.getTextField('PersonaRefencia1P');
      personaReferencia1Field.setText(this.datosReferencias.nombre_referencia_personal1 || '');
      personaReferencia1Field.updateAppearances(customFont);

      // PersonaRefencia2P
      const personaReferencia2Field = form.getTextField('PersonaRefencia2P');
      personaReferencia2Field.setText(this.datosReferencias.nombre_referencia_personal2 || '');
      personaReferencia2Field.updateAppearances(customFont);

      // PersonaRefencia1F
      const personaReferencia3Field = form.getTextField('PersonaRefencia1F');
      personaReferencia3Field.setText(this.datosReferencias.nombre_referencia_familiar1 || '');
      personaReferencia3Field.updateAppearances(customFont);

      // PersonaRefencia2F
      const personaReferencia4Field = form.getTextField('PersonaRefencia2F');
      personaReferencia4Field.setText(this.datosReferencias.nombre_referencia_familiar2 || '');
      personaReferencia4Field.updateAppearances(customFont);

      // Comentarios de las Referencias Pesonales 1
      const comentariosReferencia1Field = form.getTextField('Comentarios de las Referencias Pesonales 1');
      comentariosReferencia1Field.setText(referenciaPersonal1);
      comentariosReferencia1Field.updateAppearances(customFont);

      // Comentarios de las Referencias Pesonales 2
      const comentariosReferencia2Field = form.getTextField('Comentarios de las Referencias Pesonales 2');
      comentariosReferencia2Field.setText(referenciaPersonal2);
      comentariosReferencia2Field.updateAppearances(customFont);

      // Comentario referencia Familiar
      const comentariosReferencia3Field = form.getTextField('Comentario referencia Familiar');
      comentariosReferencia3Field.setText(referenciaFamiliar);
      comentariosReferencia3Field.updateAppearances(customFont);

      // Comentario referencia Familiar 2
      const comentariosReferencia4Field = form.getTextField('Comentario referencia Familiar 2');
      comentariosReferencia4Field.setText(referenciaFamiliar2);
      comentariosReferencia4Field.updateAppearances(customFont);

      // Persona que firma
      const personaFirmaField = form.getTextField('Persona que firma');
      personaFirmaField.setText(personaVerificareferencias);
      personaFirmaField.updateAppearances(customFont);

      // Cargar la imagen desde la ruta y convertirla en un objeto PDFImage
      const firmaImageBytes = await fetch(firmaVerificareferencias).then((res) => {
        if (!res.ok) {
          throw new Error('No se pudo cargar el logo de la empresa.');
        }
        return res.arrayBuffer();
      });
      const fimraImage = await pdfDoc.embedPng(firmaImageBytes); // Convierte los bytes en un objeto PDFImage

      // Image15_af_image
      const firmaVerificacionReferenciasField = form.getButton('Image15_af_image');
      firmaVerificacionReferenciasField.setImage(fimraImage);

      // TEXTOCARNET
      const textoCarnetField = form.getTextField('TEXTOCARNET');
      textoCarnetField.setText("En Caso de perdida o daño, autorizo a " + nombreEmpresa + " , para descontar de mi sueldo o de mis prestaciones en caso de retiro, la suma eqivalente a MEDIO DÍA DE SALARIO MINIMO LEGAL VIGENTE (1/2 DSMLV) y me comprometo a presentar ante " + this.selecionparte2.centroCosto + "  fotocopia del denuncio correspondiente y en el caso de aparecer el carnet perdido lo devolveré a la empresa para su respectiva anulación.");
      textoCarnetField.setFontSize(6);
      textoCarnetField.updateAppearances(customFont);

      // TEXTOLOCKER5
      const textoLockerField = form.getTextField('TEXTOLOCKER5');
      textoLockerField.setText("Yo " + this.datosPersonales.primer_nombre + " " + this.datosPersonales.segundo_nombre + " " + this.datosPersonales.primer_apellido + " " + this.datosPersonales.segundo_apellido + " identificado(a) con cedula de ciudadanía No. " + this.datosPersonales.numerodeceduladepersona + " declaro haber recibido el Locker relacionado abajo y me comprometo a seguir las recomendaciones y politicas de uso y cuidado de estós, y a devolver el Locker en el mismo estado en que me fue asignado, al momento de la finalización de mi relación laboral y antes de la entrega de la liquidación de contrato");
      textoLockerField.setFontSize(6);
      textoLockerField.updateAppearances(customFont);

      // empresa
      const empresaField = form.getTextField('empresa');
      empresaField.setText(nombreEmpresa);
      empresaField.updateAppearances(customFont);

      // Image10_af_image
      // La imagen esta en base 64 con el prefijo data:image/png;base64, es huellaIndiceDerecha
      if (this.huellaIndiceDerecho) {
        const huellaBytes = this.base64ToUint8Array(this.huellaIndiceDerecho);
        const huellaImage = await pdfDoc.embedPng(huellaBytes);
        const huellaField = form.getButton('Image10_af_image');
        huellaField.setImage(huellaImage);
      }


      // Bloquear todos los campos del formulario para que sean solo lectura
      const fields = form.getFields();
      fields.forEach((field) => {
        field.enableReadOnly();
      });

      // Guardar el PDF modificado en un Uint8Array
      const pdfBytes = await pdfDoc.save();

      // Convertir el Uint8Array en un Blob con el contenido correcto
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Convertir el Blob en un File
      const file = new File([blob], 'Ficha tecnica.pdf', { type: 'application/pdf' });

      // Asignar el archivo generado al objeto uploadedFiles
      this.uploadedFiles['Ficha técnica'] = { file, fileName: 'Ficha tecnica.pdf' };

      // Mostrar el PDF generado
      this.verPDF({ titulo: 'Ficha técnica' });
    } catch (error) {
      console.error('Error al generar la ficha técnica:', error);
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






}
