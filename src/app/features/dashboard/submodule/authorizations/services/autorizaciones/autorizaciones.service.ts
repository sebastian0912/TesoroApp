import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { environment } from '../../../../../../../environments/environment.development';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

@Injectable({
  providedIn: 'root'
})

export class AutorizacionesService {

  private apiUrl = environment.apiUrl;

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

  traerSaldoPendiente(operario: any): number {
    const campos = [
      'saldos',
      'fondos',
      'mercados',
      'prestamoParaDescontar',
      'casino',
      'valoranchetas',
      'fondo',
      'carnet',
      'seguroFunerario',
      'prestamoParaHacer',
      'anticipoLiquidacion',
      'cuentas',
    ];

    let sumaPrestamos = 0;

    for (const campo of campos) {
      const valor = parseFloat(operario[campo]) || 0;
      sumaPrestamos += valor;
    }

    return sumaPrestamos;
  }

  // verificar fondos
  verificarFondos(operario: any): boolean {
    if (parseInt(operario.fondos) <= 0) {
      return true;
    }
    else {
      this.aviso('Ups no se pueden generar prestamos perteneces al fondo', 'error');
    }
    return false;
  }

  // Verificar condiciones
  verificarCondiciones(operario: any, nuevovalor: number, sumaTotal: number, tipo: 'prestamo' | 'mercado'): boolean {
    let user = this.utilityService.getUser() || 'null';

    if (operario.bloqueado) {
      this.aviso('Ups no se pueden generar préstamos ni mercado, el empleado está bloqueado', 'error');
      return false;
    }

    if (!operario.activo) {
      this.aviso('Ups no se pueden generar préstamos ni mercado, el empleado está retirado', 'error');
      return false;
    }

    if (!operario.ingreso || !/^(\d{4}\/\d{2}\/\d{2}|\d{1,2}-\d{1,2}-\d{2})$/.test(operario.ingreso)) {
      this.aviso('Formato de fecha inválido en ingreso', 'error');
      return false;
    }

    let dia: number, mes: number, anio: number;
    if (operario.ingreso.includes('/')) {
      const [anioStr, mesStr, diaStr] = operario.ingreso.split('/');
      anio = parseInt(anioStr, 10);
      mes = parseInt(mesStr, 10);
      dia = parseInt(diaStr, 10);
    } else {
      const [diaStr, mesStr, anioStr] = operario.ingreso.split('-');
      dia = parseInt(diaStr, 10);
      mes = parseInt(mesStr, 10);
      anio = parseInt(anioStr, 10);
      anio = anio < 100 ? 2000 + anio : anio; // Convertir YY a YYYY
    }

    const fechaIngreso = new Date(anio, mes - 1, dia);
    const fechaActual = new Date();

    const diferenciaEnMilisegundos = fechaActual.getTime() - fechaIngreso.getTime();
    const diasTrabajados = Math.ceil(diferenciaEnMilisegundos / (1000 * 60 * 60 * 24));
    const mesesTrabajados = (fechaActual.getFullYear() - fechaIngreso.getFullYear()) * 12 + fechaActual.getMonth() - fechaIngreso.getMonth();

    if (tipo === 'mercado') {
      if ((dia >= 11 && dia <= 15 && fechaActual.getDate() < 20 && mes == fechaActual.getMonth() + 1) ||
        (dia >= 26 && dia <= 30 && fechaActual.getDate() < 5 && mes == fechaActual.getMonth())) {
        this.aviso('No puedes solicitar mercado aún, debes esperar la fecha permitida', 'error');
        return false;
      }

      let limite = 0;
      if (diasTrabajados >= 8 && diasTrabajados <= 15) {
        limite = 80000;
      } else if (diasTrabajados >= 16 && diasTrabajados <= 30) {
        limite = 150000;
      } else if (diasTrabajados >= 31 && diasTrabajados <= 45) {
        limite = 230000;
      } else if (diasTrabajados >= 46) {
        limite = 350000;
      }

      // Si el rol del usuario es TIENDA, se permite un extra de 50,000
      if (user.rol.nombre === 'TIENDA' || user.rol.nombre === 'ESPECIAL') {
        limite += 50000; // Añadimos 50,000 al límite para usuarios de rol "TIENDA"
      }

      // si tiene mas de 60 días puedo aumentar 150.000
      if (diasTrabajados > 60 && user.rol.nombre !== 'TIENDA' && user.rol.nombre !== 'ESPECIAL') {
        limite += 150000;
      }

      // si el correo logueado es servicioalcliente.tuapo1@gmail.com y lleva 90 dias puede sacar 400.000
      if (diasTrabajados > 90 && user.correo_electronico === 'servicioalcliente.tuapo1@gmail.com') {
        limite = 400000;
      }

      if (sumaTotal + nuevovalor > limite) {
        this.aviso(`Ups no se pueden generar mercado, puede sacar máximo ${limite - sumaTotal}`, 'error');
        return false;
      }
      return true;
    }

    if (tipo === 'prestamo') {
      if (
        (fechaActual.getMonth() === 11 || fechaActual.getMonth() === 0) ||
        (fechaActual.getMonth() === 5 || fechaActual.getMonth() === 6)
      ) {
        this.aviso('Ups no se pueden generar préstamos en este período del año', 'error');
        return false;
      }

      if (mesesTrabajados < 2) {
        this.aviso('Ups no se pueden generar préstamos, el empleado no lleva más de 2 meses en la empresa', 'error');
        return false;
      }

      if (nuevovalor > 250000) {
        this.aviso('Ups no se pueden generar el préstamo porque supera los 250.000 permitidos', 'error');
        return false;
      }

      if (operario.mercados > 0 || operario.valoranchetas > 0) {
        this.aviso('Ups no se pueden generar préstamos si el operario tiene mercados o valor de anchetas pendiente', 'error');
        return false;
      }

      if (nuevovalor + sumaTotal > 250000) {
        this.aviso('Ups no se pueden generar préstamos, el saldo pendiente supera los 250.000 puede sacar ' + (250000 - sumaTotal), 'error');
        return false;
      }
      return true;
    }
    return false;
  }







  // buscarOperario
  traerOperarios(cedula: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/Datosbase/tesoreria/${cedula}`,)
      .pipe(catchError(this.handleError));
  }

  // buscarCodigo
  async buscarCodigo(codigo: string): Promise<any> {
    return firstValueFrom(this.http.get(`${this.apiUrl}/Codigo/jefedearea/leercodigo/${codigo}`)
      .pipe(catchError(this.handleError)));
  }

  // escribirHistorial
  async escribirHistorial(cedulaEmpleado: string, nuevovalor: number, cuotas: number, tipo: string, codigo: string, nombre: string): Promise<any> {

    const fecha = new Date().toISOString().split('T')[0]; // Obtiene la fecha en formato yyyy-mm-dd

    const urlcompleta = `${this.apiUrl}/Historial/jefedearea/crearHistorialPrestamo/${cedulaEmpleado}`;


    const requestBody = {
      codigo: codigo,
      cedula: cedulaEmpleado,
      nombreQuienEntrego: '',
      generadopor: nombre,
      valor: nuevovalor,
      cuotas: cuotas,
      fechaEfectuado: fecha,
      concepto: tipo,
    };

    try {
      const response = await firstValueFrom(this.http.post(urlcompleta, requestBody).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // escribir codigo
  async escribirCodigo(cedula: string, nuevovalor: string, codigo: string, cuotasAux: string, tipo: string, historial_id: Number, nombre: string, cedulaLogin: string): Promise<any> {
    const fecha = new Date().toISOString().split('T')[0]; // Obtiene la fecha en formato yyyy-mm-dd

    const urlcompleta = `${this.apiUrl}/Codigo/crearCodigoNuevo`;

    const requestBody = {
      codigo: codigo,
      monto: nuevovalor,
      cuotas: cuotasAux,
      estado: true,
      Concepto: tipo + ' Autorizacion',
      cedulaQuienPide: cedula,
      generadoPor: nombre,
      ceduladelGenerador: cedulaLogin,
      formasdepago: 'none',
      numerodepago: 'none',
      historial_id: historial_id,
    };

    try {
      const response = await firstValueFrom(this.http.post(urlcompleta, requestBody).pipe(
        catchError(this.handleError)
      ));
      return response;
    } catch (error) {
      throw error;
    }
  }

  // activos/<str:cedula>/
  async traerAutorizacionesActivasOperario(cedula: string): Promise<any> {
    return firstValueFrom(this.http.get(`${this.apiUrl}/Codigo/activos/${cedula}/`)
      .pipe(catchError(this.handleError)));
  }




  //

  public generatePdf(datos: any, valor: number, nuevovalor: string, formaPago: any, celular: any, codigoOH: string, cuotas: string, concepto: string, nombre: string): void {
    const docPdf = new jsPDF();
    const margin = 15;
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const usableWidth = pageWidth - 2 * margin;
    const lineHeight = 10;
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

    const key = (Object.keys(empresas) as Array<keyof typeof empresas>).find(key => datos.temporal.toUpperCase().startsWith(key)) || 'DEFAULT';
    const empresaInfo = empresas[key];

    // Title and header
    docPdf.setFontSize(9);
    docPdf.text('_________________________________________________________________________________________________', margin, y);
    y += lineHeight - 6;
    y += lineHeight;

    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(18);
    docPdf.text(empresaInfo.nombre, margin, y);
    docPdf.setFontSize(9);
    docPdf.setFont('Helvetica', 'normal');
    docPdf.text('AUTORIZACION DE LIBRANZA', pageWidth / 2 + margin, y - 5);
    docPdf.text(empresaInfo.nit, pageWidth / 2 + margin, y);
    docPdf.text(empresaInfo.direccion, pageWidth / 2 + margin, y + 5);
    y += lineHeight;
    docPdf.text('_________________________________________________________________________________________________', margin, y);
    y += 1;

    docPdf.text('_________________________________________________________________________________________________', margin, y);

    y += lineHeight;

    // Body
    docPdf.setFontSize(9);
    docPdf.text('Fecha de Solicitud: ' + new Date().toLocaleDateString(), margin, y);
    y += lineHeight;
    docPdf.setFont('Helvetica', 'bold');
    docPdf.text('ASUNTO: CREDITO (PRESTAMO)', margin, y);
    y += lineHeight;
    docPdf.setFont('Helvetica', 'normal');

    const bodyText = `Yo, ${datos.nombre}, mayor de edad, identificado con la cédula de ciudadanía No. ${datos.numero_de_documento}, autorizo expresa e irrevocablemente para que del sueldo, salario, prestaciones sociales o de cualquier suma de la que sea acreedor; me sean descontados la cantidad de ${valor} (${this.NumeroALetras(parseInt(nuevovalor))}) por concepto de ${concepto}, en ${cuotas} cuota(s) quincenal del crédito del que soy deudor ante ${empresaInfo.nombre}, aún en el evento de encontrarme disfrutando de mis licencias o incapacidades.`;
    const lines = docPdf.splitTextToSize(bodyText, usableWidth);
    lines.forEach((line: string | string[]) => {
      docPdf.text(line, margin, y);
      y += lineHeight * 0.6;
    });

    y += 4;

    docPdf.text('Fecha de ingreso: ' + datos.ingreso, margin, y);
    docPdf.text('Centro de Costo: ' + datos.finca, pageWidth / 2 + margin, y);
    y += lineHeight * 0.5;
    docPdf.text('Forma de pago: ' + (formaPago), margin, y);
    docPdf.text('Teléfono: ' + (celular), pageWidth / 2 + margin, y);
    y += lineHeight;

    docPdf.setFont('Helvetica', 'bold');
    docPdf.text('Cordialmente,', margin, y);
    y += lineHeight * 1.2;
    docPdf.setFont('Helvetica', 'normal');
    docPdf.text('Firma de Autorización', margin, y);
    y += lineHeight * 0.5;
    docPdf.text('C.C. ' + datos.numero_de_documento, margin, y);
    y += lineHeight;

    docPdf.rect(pageWidth - margin - 40 - 20, y - lineHeight - 20, 25, 30);
    docPdf.text('Código de autorización nómina: ' + codigoOH, margin, y);
    y += lineHeight * 0.5;
    docPdf.text('Responsable Administrativo: ' + nombre, margin, y);

    y += lineHeight * 1.5;
    docPdf.text('___________________________________', margin, y);
    y += lineHeight * 0.5;
    docPdf.text(datos.nombre, margin, y);
    y += lineHeight * 1.5;

    docPdf.setFont('Helvetica', 'bold');
    docPdf.setFontSize(8);
    docPdf.text('Huella Índice Derecho', pageWidth - margin - 40 - 20, y - lineHeight - 15);

    docPdf.save(`PrestamoDescontar_${datos.nombre}_${codigoOH}.pdf`);
  }








  //


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
