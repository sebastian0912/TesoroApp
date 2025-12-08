import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';

import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

import { UtilityServiceService } from '../../../../../shared/services/utilityService/utility-service.service';
import { MerchandisingMerchandiseComponent } from '../components/merchandising-merchandise/merchandising-merchandise.component';
import { RobotTrackingComponent } from '../components/robot-tracking/robot-tracking.component';
import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { HomeService } from '../service/home.service';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';



@Component({
  selector: 'app-home', imports: [
    CommonModule,
    // Angular Material
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatSortModule,
    // Componentes hijos
    MerchandisingMerchandiseComponent,
    RobotTrackingComponent,
    InfoCardComponent,
    MatDialogModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  /** Usuario actual */
  user: any;

  /** Flags de vista según rol */
  general = false;
  comercializadora = false;
  admin = false;
  traslado = false;

  /** UI */
  @ViewChild(MatSort) sort!: MatSort;
  isSidebarHidden = false;
  robotsHome = false;

  private readonly HEADER_ALIASES: Record<string, string[]> = {
    'Identificación': [
      'identificación', 'identificacion', 'cédula', 'cedula', 'documento',
      'numero_documento', 'número de documento', 'numero de documento', 'id'
    ],
    'Tipo documento': ['tipo documento', 'tipo_documento', 'tipo doc', 'tipo'],
    'PAQUETE': ['paquete', 'oficina', 'sede'],
    'Nombre Y Apellidos': [
      'nombre y apellidos', 'nombres y apellidos', 'nombre y apellido', 'nombres y apellido'
    ],
    'Primer Nombre': ['primer nombre', 'pn'],
    'Segundo Nombre': ['segundo nombre', 'sn'],
    'Primer Apellido': ['primer apellido', 'pa'],
    'Segundo Apellido': ['segundo apellido', 'sa'],
  };

  constructor(
    private utilityService: UtilityServiceService,
    private homeService: HomeService,
    private dialog: MatDialog,
  ) { }

  // ========== Ciclo de vida ==========
  ngOnInit(): void {
    this.initializeUserRoles();
  }

  // ========== Roles ==========
  private initializeUserRoles(): void {
    this.user = this.utilityService.getUser();

    const rol = this.user?.rol?.nombre ?? 'SIN-ASIGNAR';
    const correo = (this.user?.correo_electronico ?? '').toString().toLowerCase();

    if (!this.user || rol === 'SIN-ASIGNAR') {
      this.general = false;
      this.comercializadora = false;
      this.traslado = false;
      this.admin = false;
      return;
    }

    const isAdmin = rol === 'ADMIN';
    const isGerencia = rol === 'GERENCIA';
    const isTraslados = rol === 'TRASLADOS';
    const isComercial = rol === 'COMERCIALIZADORA';
    const isAliasTuAfiliacion = correo === 'tuafiliacion@tsservicios.co';

    this.general = !(isGerencia || isTraslados);
    this.comercializadora = isComercial || isAdmin || isAliasTuAfiliacion;
    this.traslado = isTraslados || isAdmin || isAliasTuAfiliacion;
    this.admin = isGerencia || isAdmin;
  }

  extraerHistorialBeneficios(): void {
    console.log('Iniciando descarga de historial de beneficios...');
    // usuario
    console.log('Usuario:', this.user);
    if (this.user?.rol?.nombre !== 'ADMIN' || this.user?.rol?.nombre !== 'GERENCIA' || this.user?.correo_electronico !== 'mercarflorats@gmail.com') {
      console.log('Descarga de historial de beneficios no autorizada para este usuario.');
      this.dialog.open(DateRangeDialogComponent, {
        width: '400px',
        data: { title: 'Seleccionar rango de fechas' }
      }).afterClosed().subscribe(result => {
        if (result) {
          const { start, end } = result;
          this.homeService.traerHistorialInformeSoloFecha(start, end, true).subscribe({
            next: (blob) => {
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `historial_beneficios_${start}_a_${end}.xlsx`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }
          });
        }
      });
      return;
    }
    else {
      this.dialog.open(DateRangeDialogComponent, {
        width: '400px',
        data: { title: 'Seleccionar rango de fechas' }
      }).afterClosed().subscribe(result => {
        if (result) {
          const { start, end } = result;
          this.homeService.traerHistorialInformePersona(start, end, this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos, true).subscribe({
            next: (blob) => {
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `historial_beneficios_${this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos}_${start}_a_${end}.xlsx`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }
          });
        }
      });
    }
  }

  /* ---------- INPUT FILE (EXCEL) ---------- */
  triggerFileInput(): void {
    (document.getElementById('fileInput') as HTMLInputElement).click();
  }

  /** ---------- CARGAR EXCEL (sin cambios funcionales) ---------- */
  // Normaliza: quita acentos, colapsa espacios, a minúsculas
  private normalizeKey(s: string): string {
    return (s || '')
      .replace(/\u00A0|\u2007|\u202F/g, ' ')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .trim().replace(/\s+/g, ' ')
      .toLowerCase();
  }

  // Devuelve el canónico si el header coincide con algún alias
  private toCanonical(h: string): string {
    const nk = this.normalizeKey(String(h || ''));
    for (const canonical of Object.keys(this.HEADER_ALIASES)) {
      const aliases = this.HEADER_ALIASES[canonical].map(a => this.normalizeKey(a));
      if (aliases.includes(nk) || this.normalizeKey(canonical) === nk) return canonical;
    }
    return String(h || '').trim(); // fallback, se envía tal cual
  }

  /** ---------- CARGAR EXCEL (por encabezados) ---------- */
  cargarExcel(evt: any): void {
    const file: File | undefined = evt?.target?.files?.[0];
    if (!file) {
      void Swal.fire({ icon: 'error', title: 'Selecciona un archivo' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

        if (!rows.length) {
          void Swal.fire({ icon: 'error', title: 'Archivo vacío' });
          return;
        }

        const headerRow = (rows[0] || []).map(h => String(h || ''));
        const canonicalHeaders = headerRow.map(h => this.toCanonical(h));

        // Validar mínimo: Identificación
        if (!canonicalHeaders.some(h => h === 'Identificación')) {
          void Swal.fire({
            icon: 'error',
            title: 'Formato incorrecto',
            text: 'Falta la columna "Identificación" en el encabezado.'
          });
          return;
        }

        // Construir objetos por fila usando los encabezados
        const datos = rows.slice(1)
          .map((r) => {
            const o: any = {};
            canonicalHeaders.forEach((key, idx) => {
              if (!key) return;
              const val = r[idx];
              // Convertir todo a string “limpia” (evita NaN/undefined)
              const sv = (val === null || val === undefined) ? '' : String(val).trim();
              if (sv !== '') o[key] = sv;
            });
            return o;
          })
          // Filtra filas sin Identificación
          .filter(o => !!o && typeof o === 'object' && String(o['Identificación'] || '').trim() !== '');

        if (!datos.length) {
          void Swal.fire({ icon: 'warning', title: 'No hay filas válidas', text: 'Todas las filas carecen de Identificación.' });
          return;
        }

        // Defaults útiles:
        datos.forEach(o => {
          if (!o['Tipo documento']) o['Tipo documento'] = 'CC';
          // Si no hay PN/PA pero sí “Nombre Y Apellidos”, el backend lo parte: no tocamos aquí.
        });

        // Recomendado: solo tocar Candidato para los “nuevos” (coincide con tu backend)
        const payload = {
          candidatos_scope: 'nuevos' as 'nuevos' | 'todos' | 'ninguno',
          datos
        };

        // Lanza petición (tu interceptor de loader puede mostrar el spinner si quieres)
        this.homeService.enviarEstadosRobots(payload)
          .subscribe({
            next: (r: any) => {
              const ok = r?.message === 'success';
              const detalle = [
                r?.estado_robot_creados != null ? `Estados creados: ${r.estado_robot_creados}` : null,
                r?.candidatos_creados != null ? `Candidatos creados: ${r.candidatos_creados}` : null,
                r?.candidatos_actualizados != null ? `Candidatos actualizados: ${r.candidatos_actualizados}` : null,
                Array.isArray(r?.omitidos_por_15d) ? `Omitidos 15d: ${r.omitidos_por_15d.length}` : null
              ].filter(Boolean).join('\n');

              void Swal.fire({
                icon: ok ? 'success' : 'error',
                title: ok ? 'Carga exitosa' : 'Carga con errores',
                text: detalle || (ok ? 'OK' : 'Revisa los mensajes del servidor')
              });
            },
            error: (err) => {
              const msg = err?.error?.message || 'No se pudo cargar el Excel.';
              void Swal.fire({ icon: 'error', title: 'Error', text: msg });
            }
          });

      } catch (err) {
        void Swal.fire({ icon: 'error', title: 'Error al procesar', text: 'Verifica el formato del archivo.' });
      } finally {
        // Limpia el input para permitir cargar el mismo archivo otra vez si es necesario
        try { (evt.target as HTMLInputElement).value = ''; } catch { }
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // ---- helper: guardar en Descargas (FS Access si existe; fallback <a download>)
  private async saveToDownloads(blob: Blob, filename: string): Promise<void> {
    // Detecta tipo por extensión para el diálogo nativo
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const mime =
      ext === 'zip' ? 'application/zip' :
        ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
          'application/octet-stream';

    try {
      // @ts-ignore - File System Access API (Chromium)
      if (window.showSaveFilePicker) {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          startIn: 'downloads',
          types: [{ description: ext.toUpperCase(), accept: { [mime]: ['.' + ext] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }
    } catch (_) {
      // si el usuario cancela o falla, caemos al fallback
    }

    // Fallback: descarga directa
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename; // fuerza nombre en Descargas
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- NUEVO: descarga el Excel de links (cedula, link)
  async descargarLinksExcel(onlyDrive: 1 | 0 = 1, offset = 0, limit = 0): Promise<void> {
    Swal.fire({
      title: 'Generando Excel de links',
      html: `Solicitando al servidor...`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // Si tu método está en CedulasService, cámbialo aquí.
      // Debe devolver HttpResponse<Blob> con header X-Total y Content-Disposition
      const res = await firstValueFrom(
        this.homeService.exportarLinksExcel(onlyDrive, offset, limit) // <-- ajusta al servicio real
      );

      if (!res.body) throw new Error('Respuesta vacía');

      // Nombre desde Content-Disposition o fallback
      const cd = res.headers.get('Content-Disposition') || '';
      let filename = 'cedulas_links.xlsx';
      const m = cd.match(/filename\*?=(?:UTF-8''|")?([^;"']+)/i);
      if (m) {
        try { filename = decodeURIComponent(m[1].replace(/"/g, '')); } catch { filename = m[1]; }
      }

      // Guardar
      await this.saveToDownloads(res.body, filename);

      const total = res.headers.get('X-Total') || '0';
      Swal.fire({
        icon: 'success',
        title: 'Excel descargado',
        text: `Filas exportadas: ${total}`
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err?.status === 0 ? 'CORS o red: no se pudo contactar el servidor.' : 'Falló la descarga del Excel.'
      });
    }
  }


}
