import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { environment } from '../../../../../../../environments/environment';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

@Injectable({
  providedIn: 'root'
})
export class AutorizacionesService {

  private apiUrl = environment.apiUrl;

  // NUEVOS ENDPOINTS PARA TESORERIA
  private readonly TESORERIA_BASE_URL = `${this.apiUrl}/gestion_tesoreria`;
  private readonly URL_PERSONAS = `${this.TESORERIA_BASE_URL}/personas`;
  private readonly URL_TRANSACCIONES = `${this.TESORERIA_BASE_URL}/transacciones`;

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object, private utilityService: UtilityServiceService) { }

  private handleError(error: any): Observable<never> {
    throw error;
  }

  // Función de aviso para mostrar mensajes
  aviso(mensaje: string, tipo: 'success' | 'error' | 'warning' | 'info' | 'question') {
    Swal.fire({
      icon: tipo,
      title: 'Oops...',
      text: mensaje,
    });
  }

  normalizeDoc(doc: string): string {
    return doc ? doc.trim().toUpperCase() : '';
  }

  traerSaldoPendiente(operario: any): number {
    const campos = [
      'saldos',
      'fondos',
      'mercados',
      'prestamo_para_descontar',
      'casino',
      'valor_anchetas',
      'fondo',
      'carnet',
      'seguro_funerario',
      'prestamo_para_hacer',
      'anticipo_liquidacion',
      'cuentas',
    ];

    let sumaPrestamos = 0;

    for (const campo of campos) {
      const valor = parseFloat(operario[campo]) || 0;
      sumaPrestamos += valor;
    }

    return sumaPrestamos;
  }

  /**
   * Calcula el cupo disponible para mercado o préstamo,
   * usando la MISMA lógica de límites que verificarCondiciones.
   */
  calcularCupoDisponible(operario: any, tipo: 'prestamo' | 'mercado'): number {
    if (!operario) return 0;

    const sumaTotal = this.traerSaldoPendiente(operario);
    const user = this.utilityService.getUser?.() || {};

    if (tipo === 'mercado') {
      // Calcular días trabajados
      const parsed = this.parsearIngreso(operario?.ingreso);
      if (!parsed) return 0;
      const fechaIngreso = new Date(parsed.anio, parsed.mes - 1, parsed.dia);
      const hoy = new Date();
      const ms = Math.max(0, hoy.getTime() - fechaIngreso.getTime());
      const diasTrabajados = Math.ceil(ms / (1000 * 60 * 60 * 24));

      let limite = 0;
      if (diasTrabajados >= 8 && diasTrabajados <= 15) limite = 80000;
      else if (diasTrabajados <= 30) limite = 150000;
      else if (diasTrabajados <= 45) limite = 230000;
      else limite = 350000;

      const rol = user?.rol?.nombre ?? '';
      if (rol === 'TIENDA' || rol === 'ESPECIAL') {
        limite += 50000;
      }
      if (diasTrabajados > 60 && rol !== 'TIENDA' && rol !== 'ESPECIAL') {
        limite += 150000;
      }
      if (diasTrabajados > 90 && user?.correo_electronico === 'servicioalcliente.tuapo1@gmail.com') {
        limite = 400000;
      }

      return Math.max(0, limite - sumaTotal);
    }

    if (tipo === 'prestamo') {
      return Math.max(0, 250000 - sumaTotal);
    }

    return 0;
  }

  /**
   * Parsea la fecha de ingreso (helper extraído de verificarCondiciones)
   */
  private parsearIngreso(raw: any): { dia: number; mes: number; anio: number } | null {
    if (!raw) return null;
    const s = String(raw).trim();
    const toInt = (str: string) => Number.parseInt(str, 10);
    const isValidYMD = (y: number, m: number, d: number): boolean => {
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
      if (m < 1 || m > 12) return false;
      if (d < 1 || d > 31) return false;
      const dt = new Date(y, m - 1, d);
      return dt.getFullYear() === y && (dt.getMonth() + 1) === m && dt.getDate() === d;
    };

    const sep = s.includes('/') ? '/' : (s.includes('-') ? '-' : null);
    if (!sep) return null;
    const parts = s.split(sep);
    if (parts.length !== 3) return null;
    const [a, b, c] = parts.map(p => p.trim());

    if (a.length === 4) {
      const y = toInt(a), m = toInt(b), d = toInt(c);
      if (!isValidYMD(y, m, d)) return null;
      return { dia: d, mes: m, anio: y };
    }

    const yy = toInt(c);
    const y = (c.length <= 2) ? (2000 + yy) : yy;
    const n1 = toInt(a), n2 = toInt(b);

    if (sep === '/') {
      if (n1 <= 12 && n2 > 12) {
        if (!isValidYMD(y, n1, n2)) return null;
        return { dia: n2, mes: n1, anio: y };
      } else {
        if (!isValidYMD(y, n2, n1)) return null;
        return { dia: n1, mes: n2, anio: y };
      }
    } else {
      if (!isValidYMD(y, n2, n1)) return null;
      return { dia: n1, mes: n2, anio: y };
    }
  }

  // verificar fondos
  verificarFondos(operario: any): boolean {
    if (Number(operario.fondos ?? 0) <= 0) {
      return true;
    }
    else {
      this.aviso('Ups no se pueden generar prestamos perteneces al fondo', 'error');
    }
    return false;
  }

  // Verificar condiciones
  verificarCondiciones(
    operario: any,
    nuevovalor: number,
    sumaTotal: number,
    tipo: 'prestamo' | 'mercado'
  ): boolean {

    const user = this.utilityService.getUser?.() || {};

    // 1) Reglas básicas
    if (operario?.bloqueado) {
      this.aviso('Ups no se pueden generar préstamos ni mercado, el empleado está bloqueado', 'error');
      return false;
    }
    if (!operario?.activo) {
      this.aviso('Ups no se pueden generar préstamos ni mercado, el empleado está retirado', 'error');
      return false;
    }

    // ===== Helpers de fecha =====
    const toInt = (s: string) => Number.parseInt(s, 10);

    const isValidYMD = (y: number, m: number, d: number): boolean => {
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
      if (m < 1 || m > 12) return false;
      if (d < 1 || d > 31) return false;
      const dt = new Date(y, m - 1, d);
      return dt.getFullYear() === y && (dt.getMonth() + 1) === m && dt.getDate() === d;
    };

    const parseIngreso = (raw: any): { dia: number; mes: number; anio: number } | null => {
      if (!raw) return null;
      const s = String(raw).trim();

      // Normaliza separador
      const sep = s.includes('/') ? '/' : (s.includes('-') ? '-' : null);
      if (!sep) return null;

      const parts = s.split(sep);
      if (parts.length !== 3) return null;

      const [a, b, c] = parts.map(p => p.trim());

      // Caso YYYY/MM/DD o YYYY-MM-DD
      if (a.length === 4) {
        const y = toInt(a), m = toInt(b), d = toInt(c);
        if (!isValidYMD(y, m, d)) return null;
        return { dia: d, mes: m, anio: y };
      }

      // Dos dígitos de año => 20YY
      const yy = toInt(c);
      const y = (c.length <= 2) ? (2000 + yy) : yy;

      const n1 = toInt(a);
      const n2 = toInt(b);

      // Heurística:
      if (sep === '/') {
        if (n1 <= 12 && n2 > 12) {
          const m = n1, d = n2;
          if (!isValidYMD(y, m, d)) return null;
          return { dia: d, mes: m, anio: y };
        } else {
          const d = n1, m = n2;
          if (!isValidYMD(y, m, d)) return null;
          return { dia: d, mes: m, anio: y };
        }
      } else {
        const d = n1, m = n2;
        if (!isValidYMD(y, m, d)) return null;
        return { dia: d, mes: m, anio: y };
      }
    };

    const parsed = parseIngreso(operario?.ingreso);
    if (!parsed) {
      this.aviso('Formato de fecha inválido en ingreso', 'error');
      return false;
    }
    const { dia, mes, anio } = parsed;

    const fechaIngreso = new Date(anio, mes - 1, dia);
    const hoy = new Date();

    // Si la fecha de ingreso es futura, considera 0 días trabajados
    const ms = Math.max(0, hoy.getTime() - fechaIngreso.getTime());
    const diasTrabajados = Math.ceil(ms / (1000 * 60 * 60 * 24));

    const monthsDiff = (from: Date, to: Date): number => {
      // Diferencia en meses calendario (ignora días)
      return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    };
    const mesesTrabajados = monthsDiff(fechaIngreso, hoy);

    // ==============================
    //   REGLAS PARA MERCADO
    // ==============================
    if (tipo === 'mercado') {
      const hoyDia = hoy.getDate();

      // Ventana 1: ingreso del 11 al 15 del MISMO mes y hoy < 20  -> Bloquea
      const mismoMes = (fechaIngreso.getFullYear() === hoy.getFullYear()) &&
        (fechaIngreso.getMonth() === hoy.getMonth());
      if (mismoMes && dia >= 11 && dia <= 15 && hoyDia < 20) {
        this.aviso('No puedes solicitar mercado aún, debes esperar la fecha permitida', 'error');
        return false;
      }

      // Ventana 2: ingreso del 26 al 30 del MES ANTERIOR y hoy < 5 -> Bloquea
      const esMesAnterior =
        monthsDiff(fechaIngreso, new Date(hoy.getFullYear(), hoy.getMonth(), 1)) === 1; // ingreso en el mes anterior
      if (esMesAnterior && dia >= 26 && dia <= 30 && hoyDia < 5) {
        this.aviso('No puedes solicitar mercado aún, debes esperar la fecha permitida', 'error');
        return false;
      }

      // Límite por antigüedad
      let limite = 0;
      if (diasTrabajados >= 8 && diasTrabajados <= 15) limite = 80000;
      else if (diasTrabajados <= 30) limite = 150000;
      else if (diasTrabajados <= 45) limite = 230000;
      else limite = 350000;

      // Bonos por rol
      const rol = user?.rol?.nombre ?? '';
      if (rol === 'TIENDA' || rol === 'ESPECIAL') {
        limite += 50000;
      }
      if (diasTrabajados > 60 && rol !== 'TIENDA' && rol !== 'ESPECIAL') {
        limite += 150000;
      }
      if (diasTrabajados > 90 && user?.correo_electronico === 'servicioalcliente.tuapo1@gmail.com') {
        limite = 400000;
      }

      if (sumaTotal + nuevovalor > limite) {
        const disponible = Math.max(0, limite - sumaTotal);
        this.aviso(`Ups no se pueden generar mercado, puede sacar máximo ${disponible}`, 'error');
        return false;
      }

      return true;
    }

    // ==============================
    //   REGLAS PARA PRÉSTAMO
    // ==============================
    if (tipo === 'prestamo') {
      const mesActual = hoy.getMonth(); // 0-11

      // Bloqueo por periodos (dic-ene y jun-jul)
      if (mesActual === 11 || mesActual === 0 || mesActual === 5 || mesActual === 6) {
        this.aviso('Ups no se pueden generar préstamos en este período del año', 'error');
        return false;
      }

      // Antigüedad mínima 2 meses calendario
      if (mesesTrabajados < 2) {
        this.aviso('Ups no se pueden generar préstamos, el empleado no lleva más de 2 meses en la empresa', 'error');
        return false;
      }

      // Valor unitario máximo
      if (nuevovalor > 250000) {
        this.aviso('Ups no se puede generar el préstamo porque supera los 250.000 permitidos', 'error');
        return false;
      }

      // Sin deudas de mercado/anchetas
      if ((operario?.mercados ?? 0) > 0 || (operario?.valor_anchetas ?? 0) > 0) {
        this.aviso('Ups no se pueden generar préstamos si el operario tiene mercados o valor de anchetas pendiente', 'error');
        return false;
      }

      // Tope acumulado 250.000
      if (nuevovalor + (sumaTotal ?? 0) > 250000) {
        const disponible = Math.max(0, 250000 - (sumaTotal ?? 0));
        this.aviso('Ups no se pueden generar préstamos, el saldo pendiente supera los 250.000. Puede sacar ' + disponible, 'error');
        return false;
      }

      return true;
    }

    return false;
  }

  // ============================================
  // NUEVAS LLAMADAS AL BACKEND (GESTION TESORERIA)
  // ============================================

  async traerPersonaTesoreria(numeroDocumento: string): Promise<any> {
    const docNorm = this.normalizeDoc(numeroDocumento);
    return firstValueFrom(this.http.get(`${this.URL_PERSONAS}/${docNorm}/`).pipe(catchError(this.handleError)));
  }

  async traerAutorizacionesActivasOperario(numeroDocumento: string): Promise<any> {
    const docNorm = this.normalizeDoc(numeroDocumento);
    // Transacciones activas = pendientes
    return firstValueFrom(this.http.get(`${this.URL_TRANSACCIONES}/?numero_documento=${docNorm}&estado=PENDIENTE`).pipe(catchError(this.handleError)));
  }

  async buscarCodigo(codigo: string): Promise<any> {
    return firstValueFrom(this.http.get(`${this.URL_TRANSACCIONES}/buscar-codigo/?codigo=${codigo}`).pipe(catchError(this.handleError)));
  }

  async autorizarTransaccion(numeroDocumento: string, monto: number, cuotas: number, tipo: string, nombreAutorizador: string, sedeAutorizacion: string = ''): Promise<any> {
    const docNorm = this.normalizeDoc(numeroDocumento);
    const body = {
      numero_documento: docNorm,
      autorizacion_concepto: tipo,
      autorizacion_monto: monto,
      autorizacion_cuotas: cuotas,
      autorizado_por: nombreAutorizador,
      sede_autorizacion: sedeAutorizacion
    };

    return firstValueFrom(this.http.post(`${this.URL_TRANSACCIONES}/autorizar/`, body).pipe(catchError(this.handleError)));
  }

  async ejecutarTransaccion(codigoAutorizacion: string, monto: number, ejecutadoPor: string, sedeEjecucion: string = '', ejecucionConcepto: string = ''): Promise<any> {
    const body: any = {
      codigo_autorizacion: codigoAutorizacion,
      ejecucion_monto: monto,
      ejecutado_por: ejecutadoPor,
      sede_ejecucion: sedeEjecucion
    };
    if (ejecucionConcepto) {
      body.ejecucion_concepto = ejecucionConcepto;
    }
    return firstValueFrom(this.http.post(`${this.URL_TRANSACCIONES}/ejecutar/`, body).pipe(catchError(this.handleError)));
  }

  /**
   * Atomic endpoint: autorizar + ejecutar + vender lotes en una sola transacción.
   * Modo ferias (crear nueva auth):  enviar numero_documento + autorizacion_monto + ventas
   * Modo comercializadora (auth existentes): enviar codigos_autorizacion + ejecucion_monto + ventas
   */
  async ejecutarMercadoCompleto(data: {
    numero_documento?: string;
    autorizacion_monto?: number;
    autorizacion_cuotas?: number;
    autorizacion_concepto?: string;
    autorizado_por?: string;
    sede_autorizacion?: string;
    ejecucion_concepto?: string;
    ejecutado_por?: string;
    sede_ejecucion?: string;
    ejecucion_monto?: number;
    codigos_autorizacion?: string[];
    ventas?: { lote_id: number; cantidad: number }[];
  }): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.URL_TRANSACCIONES}/ejecutar-mercado-completo/`, data)
        .pipe(catchError(this.handleError))
    );
  }

  // ============================================
  // DEPRECATED: Llamadas legacy (mantener vacías/error)
  // ============================================

  /** @deprecated Usar traerPersonaTesoreria */
  traerOperarios(cedula: string): Observable<any> {
    return new Observable(obs => {
      obs.error(new Error("traerOperarios is deprecated. Usa traerPersonaTesoreria."));
    });
  }

  /** @deprecated Usar autorizarTransaccion */
  async escribirHistorial(cedulaEmpleado: string, nuevovalor: number, cuotas: number, tipo: string, codigo: string, nombre: string): Promise<any> {
    throw new Error("escribirHistorial está deprecado. Usa autorizarTransaccion.");
  }

  /** @deprecated Usar autorizarTransaccion */
  async escribirCodigo(cedula: string, nuevovalor: string, codigo: string, cuotasAux: string, tipo: string, historial_id: Number, nombre: string, cedulaLogin: string): Promise<any> {
    throw new Error("escribirCodigo está deprecado. Usa autorizarTransaccion.");
  }

  // ============================================
  // GENERACIÓN DE PDF
  // ============================================

  public async generatePdf(datos: any, valor: number, nuevovalor: string, formaPago: any, celular: any, codigoOH: string, cuotas: string, concepto: string, nombre: string): Promise<void> {
    const docPdf = new jsPDF({ format: 'letter' });
    const margin = 12;
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const usableWidth = pageWidth - 2 * margin;
    const lineHeight = 6;
    let y = margin;

    const empresas = {
      APOYO: {
        nombre: 'APOYO LABORAL TS SAS',
        nit: 'NIT 900814587',
        direccion: 'CRA 2 N 8-156 FACATATIVA'
      },
      TU: {
        nombre: 'TU ALIANZA SAS',
        nit: 'NIT 900864596',
        direccion: 'Calle 7 N 4-49 MADRID'
      },
      COMERCIALIZADORA: {
        nombre: 'COMERCIALIZADORA TS',
        nit: 'NIT 901602948',
        direccion: 'CRA 1 N 17-37 BRAZILIA'
      },
      DEFAULT: {
        nombre: 'TU ALIANZA SAS',
        nit: 'NIT 900864596',
        direccion: 'Calle 7 N 4-49 MADRID'
      }
    };

    const docNumero = datos.numero_documento || datos.numero_de_documento;

    const temporalValue = datos.temporal ? datos.temporal.toUpperCase() : '';
    const key = (Object.keys(empresas) as Array<keyof typeof empresas>).find(key => temporalValue.startsWith(key)) || 'DEFAULT';
    const empresaInfo = empresas[key];

    let imgElement: HTMLImageElement | null = null;
    try {
      const logoUrl = (key === 'APOYO') ? 'logos/Logo_AL.png' : 'logos/Logo_TA.png';
      imgElement = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject();
        img.src = logoUrl;
      });
    } catch (e) {
      console.warn("No se pudo cargar el logo", e);
    }

    // Title and header
    y += 2;
    docPdf.setDrawColor(0);
    docPdf.line(margin, y, pageWidth - margin, y);
    y += lineHeight - 3;
    y += lineHeight;

    if (imgElement) {
      docPdf.addImage(imgElement, 'PNG', margin, y - 8, 30, 12);
    } else {
      docPdf.setFont('Helvetica', 'bold');
      docPdf.setFontSize(14);
      docPdf.text(empresaInfo.nombre, margin, y);
    }

    // Right-aligned header info
    docPdf.setFontSize(8);
    docPdf.setFont('Helvetica', 'normal');
    docPdf.text('AUTORIZACION DE LIBRANZA', pageWidth / 2 + 10, y - 4);
    docPdf.text(empresaInfo.nit, pageWidth / 2 + 10, y);
    docPdf.text(empresaInfo.direccion, pageWidth / 2 + 10, y + 4);

    y += 8;
    docPdf.line(margin, y, pageWidth - margin, y);
    y += 1;
    docPdf.line(margin, y, pageWidth - margin, y);

    y += lineHeight + 2;

    // Body
    docPdf.setFontSize(8);
    docPdf.text('Fecha de Solicitud: ' + new Date().toLocaleDateString(), margin, y);
    y += lineHeight;
    docPdf.setFont('Helvetica', 'bold');
    docPdf.text('ASUNTO: CREDITO (PRESTAMO)', margin, y);
    y += lineHeight - 2;
    docPdf.setFont('Helvetica', 'normal');

    const bodyText = `Yo, ${datos.nombre || ''}, mayor de edad, identificado con la cédula de ciudadanía No. ${docNumero}, autorizo expresa e irrevocablemente para que del sueldo, salario, prestaciones sociales o de cualquier suma de la que sea acreedor; me sean descontados la cantidad de ${valor} (${this.NumeroALetras(parseInt(nuevovalor))}) por concepto de ${concepto}, en ${cuotas} cuota(s) quincenal del crédito del que soy deudor ante ${empresaInfo.nombre}, aún en el evento de encontrarme disfrutando de mis licencias o incapacidades.`;
    const lines = docPdf.splitTextToSize(bodyText, usableWidth);
    lines.forEach((line: string | string[]) => {
      docPdf.text(line, margin, y);
      y += lineHeight * 0.75;
    });

    y += 4;

    const ingresoFmt = datos.ingreso ? datos.ingreso.split(' ')[0] : 'No registrado';
    docPdf.text('Fecha de ingreso: ' + ingresoFmt, margin, y);
    docPdf.text('Centro de Costo: ' + (datos.finca || 'No registrado'), pageWidth / 2 + margin, y);

    const valFormaPago = (formaPago && formaPago !== 'N/A') ? formaPago : '';
    const valCelular = (celular && celular !== 'N/A') ? celular : '';

    y += lineHeight * 0.5;
    docPdf.text('Forma de pago: ' + valFormaPago, margin, y);
    docPdf.text('Teléfono: ' + valCelular, pageWidth / 2 + margin, y);

    y += lineHeight;

    docPdf.setFont('Helvetica', 'bold');
    docPdf.text('Cordialmente,', margin, y);
    y += lineHeight;
    docPdf.setFont('Helvetica', 'normal');

    // Almacenamos Y para que la firma y el cuadro se alineen bien
    const startYFirma = y;

    docPdf.text('Firma de Autorización', margin, y);
    y += lineHeight * 0.5;
    docPdf.text('C.C. ' + docNumero, margin, y);
    y += lineHeight * 0.5;

    docPdf.text('Código de autorización nómina: ' + codigoOH, margin, y);
    y += lineHeight * 0.5;
    docPdf.text('Responsable Administrativo: ' + nombre, margin, y);

    // Caja Huella Dactilar
    // la posicionamos a la derecha pero alineada con la coordenada Y de firma
    docPdf.rect(pageWidth - margin - 25, startYFirma, 20, 25);
    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(7);
    docPdf.text('Huella Índice', pageWidth - margin - 25 + 2, startYFirma + 28);

    y += lineHeight * 2.5;

    // Línea de firma
    docPdf.setDrawColor(0);
    docPdf.line(margin, y - 4, margin + 60, y - 4);
    docPdf.text(datos.nombre || '', margin, y);

    docPdf.save(`PrestamoDescontar_${datos.nombre || 'Desconocido'}_${codigoOH}.pdf`);
  }

  Unidades(num: number): string {
    switch (num) {
      case 1: return "UN";
      case 2: return "DOS";
      case 3: return "TRES";
      case 4: return "CUATRO";
      case 5: return "CINCO";
      case 6: return "SEIS";
      case 7: return "SIETE";
      case 8: return "OCHO";
      case 9: return "NUEVE";
      default: return "";
    }
  }

  Decenas(num: number): string {
    let decena = Math.floor(num / 10);
    let unidad = num - (decena * 10);

    switch (decena) {
      case 1:
        switch (unidad) {
          case 0: return "DIEZ";
          case 1: return "ONCE";
          case 2: return "DOCE";
          case 3: return "TRECE";
          case 4: return "CATORCE";
          case 5: return "QUINCE";
          default: return "DIECI" + this.Unidades(unidad);
        }
      case 2:
        switch (unidad) {
          case 0: return "VEINTE";
          default: return "VEINTI" + this.Unidades(unidad);
        }
      case 3: return this.DecenasY("TREINTA", unidad);
      case 4: return this.DecenasY("CUARENTA", unidad);
      case 5: return this.DecenasY("CINCUENTA", unidad);
      case 6: return this.DecenasY("SESENTA", unidad);
      case 7: return this.DecenasY("SETENTA", unidad);
      case 8: return this.DecenasY("OCHENTA", unidad);
      case 9: return this.DecenasY("NOVENTA", unidad);
      case 0: return this.Unidades(unidad);
      default: return "";
    }
  }

  DecenasY(strSin: string, numUnidades: number): string {
    if (numUnidades > 0) {
      return strSin + " Y " + this.Unidades(numUnidades);
    }
    return strSin;
  }

  Centenas(num: number): string {
    let centenas = Math.floor(num / 100);
    let decenas = num - (centenas * 100);

    switch (centenas) {
      case 1:
        if (decenas > 0) {
          return "CIENTO " + this.Decenas(decenas);
        }
        return "CIEN";
      case 2: return "DOSCIENTOS " + this.Decenas(decenas);
      case 3: return "TRESCIENTOS " + this.Decenas(decenas);
      case 4: return "CUATROCIENTOS " + this.Decenas(decenas);
      case 5: return "QUINIENTOS " + this.Decenas(decenas);
      case 6: return "SEISCIENTOS " + this.Decenas(decenas);
      case 7: return "SETECIENTOS " + this.Decenas(decenas);
      case 8: return "OCHOCIENTOS " + this.Decenas(decenas);
      case 9: return "NOVECIENTOS " + this.Decenas(decenas);
      default: return this.Decenas(decenas);
    }
  }

  Seccion(num: number, divisor: number, strSingular: string, strPlural: string): string {
    let cientos = Math.floor(num / divisor);
    let resto = num - (cientos * divisor);

    let letras = "";

    if (cientos > 0) {
      if (cientos > 1) {
        letras = this.Centenas(cientos) + " " + strPlural;
      } else {
        letras = strSingular;
      }
    }

    if (resto > 0) {
      letras += "";
    }

    return letras;
  }

  Miles(num: number): string {
    let divisor = 1000;
    let cientos = Math.floor(num / divisor);
    let resto = num - (cientos * divisor);

    let strMiles = this.Seccion(num, divisor, "MIL", "MIL");
    let strCentenas = this.Centenas(resto);

    if (strMiles === "") {
      return strCentenas;
    }

    return strMiles + " " + strCentenas;
  }

  Millones(num: number): string {
    let divisor = 1000000;
    let cientos = Math.floor(num / divisor);
    let resto = num - (cientos * divisor);

    let strMillones = this.Seccion(num, divisor, "UN MILLON DE", "MILLONES DE");
    let strMiles = this.Miles(resto);

    if (strMillones === "") {
      return strMiles;
    }

    return strMillones + " " + strMiles;
  }

  NumeroALetras(num: number): string {
    var data = {
      numero: num,
      enteros: Math.floor(num),
      centavos: (((Math.round(num * 100)) - (Math.floor(num) * 100))),
      letrasCentavos: "",
      letrasMonedaPlural: "Pesos", //"PESOS", 'Dólares', 'Bolívares', 'etc'
      letrasMonedaSingular: "Peso", //"PESO", 'Dólar', 'Bolivar', 'etc'

      letrasMonedaCentavoPlural: "CENTAVOS",
      letrasMonedaCentavoSingular: "CENTAVO"
    };

    if (data.centavos > 0) {
      data.letrasCentavos = "CON " + (() => {
        if (data.centavos === 1) {
          return this.Millones(data.centavos) + " " + data.letrasMonedaCentavoSingular;
        } else {
          return this.Millones(data.centavos) + " " + data.letrasMonedaCentavoPlural;
        }
      })();
    }

    if (data.enteros === 0) {
      return "CERO " + data.letrasMonedaPlural + " " + data.letrasCentavos;
    }
    if (data.enteros === 1) {
      return this.Millones(data.enteros) + " " + data.letrasMonedaSingular + " " + data.letrasCentavos;
    } else {
      return this.Millones(data.enteros) + " " + data.letrasMonedaPlural + " " + data.letrasCentavos;
    }
  }

}
