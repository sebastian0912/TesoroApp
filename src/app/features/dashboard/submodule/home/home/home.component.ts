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
    InfoCardComponent
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

  private readonly claves = ['cedula', 'tipo_documento', 'paquete'];


  constructor(
    private utilityService: UtilityServiceService,
    private homeService: HomeService,
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

  /* ---------- INPUT FILE (EXCEL) ---------- */
  triggerFileInput(): void {
    (document.getElementById('fileInput') as HTMLInputElement).click();
  }

  /** ---------- CARGAR EXCEL (sin cambios funcionales) ---------- */
  cargarExcel(evt: any): void {
    const file = evt.target.files[0];
    if (!file) { Swal.fire({ icon: 'error', title: 'Error', text: 'Seleccione un archivo' }); return; }

    Swal.fire({ title: 'Cargando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
        if (!rows.length) { Swal.fire({ icon: 'error', title: 'Archivo vacío' }); return; }
        const mod = this.asignarClaves(rows);
        if (Object.keys(mod[0]).length !== this.claves.length) {
          Swal.fire({ icon: 'error', title: 'Formato incorrecto' }); return;
        }
        this.homeService.enviarEstadosRobots(mod).subscribe({
          next: r => Swal.fire(r.message === 'success' ? { icon: 'success', title: 'Éxito' } : { icon: 'error', title: 'Error' }),
          error: () => Swal.fire({ icon: 'error', title: 'Error' }), complete: () => Swal.close()
        });
      } catch (_) { Swal.fire({ icon: 'error', title: 'Error al procesar' }); }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------- UTIL ---------- */
  private asignarClaves(data: any[]): any[] {
    return data
      .filter(r => r.some((c: any) => c !== null && c !== undefined && c !== ''))
      .map(r => {
        const obj: any = {};
        r.forEach((c: any, i: number) => { if (i < this.claves.length) { obj[this.claves[i]] = c || 'N/A'; } });
        return obj;
      });
  }

}
