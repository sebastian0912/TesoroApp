import { Component, OnInit } from '@angular/core';
import { PaymentsService } from '../../services/payments.service';
import { SharedModule } from '@/app/shared/shared.module';
import { MatTableDataSource } from '@angular/material/table';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { FormsModule } from '@angular/forms';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-pay-slips',
  imports: [
    SharedModule,
    InfoCardComponent,
    FormsModule
  ],
  templateUrl: './pay-slips.component.html',
  styleUrl: './pay-slips.component.css'
})

export class PaySlipsComponent implements OnInit {
  cedula: string = '';
  displayedColumns: string[] = [
    'no', 'cedula', 'nombre', 'ingreso', 'retiro', 'finca', 'telefono',
    'concepto', 'desprendibles', 'certificaciones', 'cartas_retiro',
    'carta_cesantias', 'entrevista_retiro', 'correo', 'confirmacion_envio'
  ];
  dataSource = new MatTableDataSource<any>();
  originalData: any[] = [];
  user: any
  correo: any;

  claves = ["No", "Cedula", "Nombre", "Ingreso",
    "Retiro", "Finca", "Telefono", "CONCEPTO",
    "Desprendibles", "Certificaciones", "Cartas_Retiro",
    "Carta_Cesantias", "Entrevista_Retiro", "Correo",
    "Confirmacion_Envio"];

  constructor(
    private paymentsService: PaymentsService,
    private utilityService: UtilityServiceService,
  ) { }

  async ngOnInit(): Promise<void> {
    this.user = await this.utilityService.getUser();
    if (this.user) {
      this.correo = this.user.correo_electronico;
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  isValidLink(url: string): boolean {
    return typeof url === 'string' && url.startsWith('https://');
  }


  public buscarDesprendibles(cedula: string): void {
    // Mantener la primera letra (si existe) y limpiar el resto
    let cleanedCedula: string;

    if (/^[A-Za-z]/.test(cedula)) {
      cleanedCedula = cedula[0].toUpperCase() + cedula.slice(1).replace(/[^\d]/g, '');
    } else {
      cleanedCedula = cedula.replace(/[^\d]/g, '');
    }

    // Convertir todo en mayúsculas
    cleanedCedula = cleanedCedula.toUpperCase();

    this.paymentsService.buscarDesprendibles(cleanedCedula).subscribe(
      (response: any) => {
        if (response.message == 'No se encontró el número de cédula') {
          Swal.fire({
            icon: 'info',
            title: 'Información',
            text: 'No se encontraron formas de pago para la cédula ingresada'
          });
          return;
        }

        const desprendibles = response.desprendibles
          .sort((a: any, b: any) => b.id - a.id);

        this.originalData = JSON.parse(JSON.stringify(desprendibles));
        this.dataSource.data = desprendibles;
      },
      (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ha ocurrido un error al buscar la información'
        });
      }
    );
  }


  triggerFileInput(tipo: 'desprendibles' | 'correos'): void {
    const id = tipo === 'desprendibles' ? 'fileInput' : 'fileInputEmails';
    const fileInput = document.getElementById(id) as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = ''; // reinicia para permitir recargar el mismo archivo
      fileInput.click();
    }
  }

  cargarExcel(event: any): void {
    const file = event.target.files[0];
    const reader = new FileReader();

    // Mostrar modal de carga
    Swal.fire({
      title: 'Procesando archivo...',
      text: 'Por favor espera mientras se carga la información.',
      icon: 'info',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "dd/mm/yyyy" });

        const modifiedRows = this.asignarClaves(rows);

        // Validar que tenga exactamente 15 columnas
        if (
          modifiedRows.length === 0 ||
          Object.keys(modifiedRows[0]).length !== 15
        ) {
          Swal.fire({
            icon: 'error',
            title: 'Error de formato',
            text: 'El archivo no tiene el formato correcto. Verifique que tenga exactamente 15 columnas válidas.'
          });
          return;
        }

        // Eliminar fila de encabezados
        modifiedRows.shift();

        this.resetFileInput('fileInput');

        this.paymentsService.subirExcelDesprendibles(modifiedRows).then((response: any) => {
          if (response.message === 'success') {
            Swal.fire({
              icon: 'success',
              title: 'Éxito',
              text: 'Los datos han sido cargados correctamente.'
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ocurrió un problema al cargar los datos. Inténtalo nuevamente.'
            });
          }
        }).catch((error: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Error inesperado',
            text: 'Ha ocurrido un error durante la carga del archivo.'
          });
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error de lectura',
          text: 'No se pudo procesar el archivo. Asegúrese de que sea un archivo válido.'
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }


  asignarClaves(data: any[]): any[] {
    return data.map((row: any) => {
      let modifiedRow: any = {};
      this.claves.forEach((clave: string, index: number) => {
        modifiedRow[clave] = row[index] !== undefined && row[index] !== null ? row[index] : '-';
      });
      return modifiedRow;
    });
  }

  resetFileInput(id: 'fileInput' | 'fileInputEmails'): void {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = '';
  }



  // ============================================
  // NUEVO: CARGA MASIVA DE CORREOS (FILA 2 = DATA)
  // ============================================
  cargarCorreosMasivos(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    const validExtensions = ['xlsx', 'xls'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !validExtensions.includes(ext)) {
      Swal.fire({ icon: 'error', title: 'Archivo no válido', text: 'Selecciona un Excel (.xlsx o .xls)' });
      input.value = '';
      return;
    }

    Swal.fire({
      title: 'Leyendo Excel...',
      html: 'Procesando correos y cédulas desde la fila 2.',
      icon: 'info',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(reader.result as ArrayBuffer), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!rows.length || rows.length < 2) {
          Swal.fire({ icon: 'error', title: 'Sin datos', text: 'El archivo debe tener encabezados en la fila 1 y datos desde la fila 2.' });
          return;
        }

        // Detectar columnas por encabezado (flexible) o fallback [0]=cedula, [1]=correo
        const headers = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
        const cedCandidates = ['cedula', 'cédula', 'documento', 'doc', 'numero de documento', 'numerodeceduladepersona', 'num_doc'];
        const mailCandidates = ['correo', 'email', 'e-mail', 'primercorreoelectronico'];

        const findIndex = (list: string[]) => {
          for (const key of list) {
            const idx = headers.findIndex(h => h === key || h.includes(key));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        let cedIdx = findIndex(cedCandidates);
        let mailIdx = findIndex(mailCandidates);

        if (cedIdx === -1 || mailIdx === -1) {
          // fallback simple si no hay encabezados claros
          cedIdx = 0;
          mailIdx = 1;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

        const seen = new Map<string, string>(); // doc -> email (último valor gana)
        const invalidRows: number[] = [];
        const invalidEmails: Array<{ row: number, email: string }> = [];
        const incompleteRows: number[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] || [];
          const rawDoc = String(row[cedIdx] ?? '').replace(/\u00A0/g, '').trim();
          const rawMail = String(row[mailIdx] ?? '').trim();

          const emptyRow = !rawDoc && !rawMail;
          if (emptyRow) continue; // salta filas vacías

          if (!rawDoc || !rawMail) {
            incompleteRows.push(i + 1); // +1 por base 1 de Excel
            continue;
          }
          if (!emailRegex.test(rawMail)) {
            invalidEmails.push({ row: i + 1, email: rawMail });
            continue;
          }
          // Guarda (último valor gana)
          seen.set(rawDoc, rawMail);
        }

        const payload = Array.from(seen.entries()).map(([numerodeceduladepersona, primercorreoelectronico]) => ({
          numerodeceduladepersona,
          primercorreoelectronico
        }));

        if (!payload.length) {
          Swal.fire({
            icon: 'error',
            title: 'Nada para enviar',
            html: 'No se encontraron filas válidas.<br>Revisa encabezados y datos desde la fila 2.'
          });
          this.resetFileInput('fileInputEmails');
          return;
        }

        // Confirmación previa con resumen
        const resumenHtml = `
          <div style="text-align:left">
            <p><b>Registros válidos:</b> ${payload.length}</p>
            ${invalidRows.length ? `<p><b>Filas inválidas (formato):</b> ${invalidRows.join(', ')}</p>` : ''}
            ${incompleteRows.length ? `<p><b>Filas incompletas (faltan columnas):</b> ${incompleteRows.join(', ')}</p>` : ''}
            ${invalidEmails.length ? `<p><b>Correos no válidos:</b> ${invalidEmails.map(i => `F${i.row}(${i.email})`).join(', ')}</p>` : ''}
          </div>
        `;
        Swal.fire({
          title: '¿Enviar actualización masiva?',
          html: resumenHtml,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, enviar',
          cancelButtonText: 'Cancelar'
        }).then((res) => {
          if (!res.isConfirmed) {
            this.resetFileInput('fileInputEmails');
            return;
          }

          Swal.fire({
            title: 'Actualizando correos...',
            html: 'Procesando en el servidor.',
            icon: 'info',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
          });

          this.paymentsService.actualizarCorreosMasivos(payload)
            .then((response: any) => {
              // El backend devuelve summary y details (según lo que hicimos)
              const s = response?.summary || {};
              const d = response?.details || {};
              const html = `
                <div style="text-align:left">
                  <p><b>Recibidos:</b> ${s.received ?? '-'}</p>
                  <p><b>Documentos únicos:</b> ${s.unique_docs ?? '-'}</p>
                  <p><b>Actualizados:</b> ${s.updated ?? '-'}</p>
                  <p><b>Sin cambio:</b> ${s.unchanged ?? '-'}</p>
                  <p><b>No encontrados:</b> ${s.not_found ?? '-'}</p>
                  <p><b>Duplicados en archivo:</b> ${s.duplicates_in_payload ?? '-'}</p>
                </div>`;
              Swal.fire({ icon: 'success', title: 'Actualización completada', html });
            })
            .catch((err: any) => {
              const msg = err?.error?.detail || 'Error al actualizar correos.';
              Swal.fire({ icon: 'error', title: 'Error', text: msg });
            })
            .finally(() => this.resetFileInput('fileInputEmails'));
        });

      } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error de lectura', text: 'No se pudo procesar el archivo Excel.' });
        this.resetFileInput('fileInputEmails');
      }
    };

    reader.readAsArrayBuffer(file);
  }

}
