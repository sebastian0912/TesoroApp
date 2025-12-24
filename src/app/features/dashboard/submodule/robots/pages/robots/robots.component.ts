import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import Swal from 'sweetalert2';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

import {
  RobotsService,
  PendientesResumenResponse,
  PendientesPorOficinaResponse,
} from '../../services/robots/robots.service';

// =========================
// ✅ PENDIENTES (lo que pides)
// 1) Resumen = 1 fila con columnas "Cantidad X Faltantes"
// 2) Oficinas = filas por módulo y columnas por oficina (en el orden del GET)
// =========================
type PendienteKey =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo_pension'
  | 'medidas_correctivas'
  | 'union'; // (si no viene del backend, queda en 0)

type PendientesResumenFlatRow = {
  adress: number;
  policivo: number;
  ofac: number;
  contraloria: number;
  sisben: number;
  procuraduria: number;
  fondo_pension: number;
  union: number;
};

type PendientesOficinasMatrixRow = {
  tipo: string; // "Adress", "Policivos", etc.
  key: PendienteKey;
  [k: string]: any; // o_<slugOficina> => number
};

@Component({
  selector: 'app-robots',
  imports: [CommonModule, StandardFilterTable, MatIconModule, MatCardModule, MatButtonModule],
  templateUrl: './robots.component.html',
  styleUrl: './robots.component.css',
})
export class RobotsComponent implements OnInit {
  constructor(private readonly robots: RobotsService) {}

  // =========================
  // ✅ PENDIENTES (RESUMEN + OFICINAS)
  // =========================
  isLoadingPendientesResumen = false;
  pendientesResumenRows: PendientesResumenFlatRow[] = [];
  pendientesResumenColumns: ColumnDefinition[] = [];

  isLoadingPendientesPorOficina = false;
  pendientesPorOficinaRows: PendientesOficinasMatrixRow[] = [];
  pendientesPorOficinaColumns: ColumnDefinition[] = [];

  pendientesGeneratedAt: string | null = null;

  private readonly pendientesKeys: Array<{ key: PendienteKey; label: string }> = [
    { key: 'adress', label: 'Adress' },
    { key: 'policivo', label: 'Policivos' },
    { key: 'ofac', label: 'OFAC' },
    { key: 'contraloria', label: 'Contraloría' },
    { key: 'sisben', label: 'Sisben' },
    { key: 'procuraduria', label: 'Procuraduría' },
    { key: 'fondo_pension', label: 'Fondo Pensión' },
    // { key: 'medidas_correctivas', label: 'Medidas Correctivas' }, // si la quieres en la tabla por oficina, descomenta
    { key: 'union', label: 'Unión' }, // si tu backend no lo manda, quedará 0
  ];

  ngOnInit(): void {
    this.buildColumns();
    void this.loadAllWithSwal();
  }

  // =========================
  // ACCIONES UI
  // =========================
  reloadAll(): void {
    void this.loadAllWithSwal();
  }

  // =========================
  // SWAL GLOBAL
  // =========================
  private async loadAllWithSwal(): Promise<void> {
    Swal.fire({
      icon: 'info',
      title: 'Cargando información...',
      text: 'Por favor espera un momento',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const results = await Promise.allSettled([
        this.loadPendientesResumen(true, false),
        this.loadPendientesPorOficina(true, false),
      ]);

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'Carga incompleta',
          text: `Se cargaron algunos datos, pero ${failed} sección(es) fallaron. Puedes intentar recargar.`,
        });
      }
    } finally {
      Swal.close();
    }
  }

  // =========================
  // ✅ 1) RESUMEN (1 fila con columnas "Cantidad X Faltantes")
  //    GET /EstadosRobots/pendientes/resumen/
  // =========================
  async loadPendientesResumen(silent = false, showLoadingSwal = true): Promise<void> {
    if (this.isLoadingPendientesResumen) return;

    this.isLoadingPendientesResumen = true;

    if (!silent && showLoadingSwal) {
      Swal.fire({
        icon: 'info',
        title: 'Actualizando resumen',
        text: 'Consultando faltantes...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
    }

    try {
      const resp: PendientesResumenResponse = await firstValueFrom(
        this.robots.getPendientesResumen({ soloPendientes: false }) as any
      );

      this.pendientesGeneratedAt = (resp as any)?.generated_at ?? null;

      const f: any = (resp as any)?.faltantes ?? {};

      const row: PendientesResumenFlatRow = {
        adress: Number(f.adress ?? 0),
        policivo: Number(f.policivo ?? 0),
        ofac: Number(f.ofac ?? 0),
        contraloria: Number(f.contraloria ?? 0),
        sisben: Number(f.sisben ?? 0),
        procuraduria: Number(f.procuraduria ?? 0),
        fondo_pension: Number(f.fondo_pension ?? 0),
        union: Number(f.union ?? 0), // si no existe, 0
      };

      this.pendientesResumenRows = [{ ...row }];
    } catch (e) {
      console.error(e);
      this.pendientesResumenRows = [];
      this.pendientesGeneratedAt = null;

      if (!silent) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar /EstadosRobots/pendientes/resumen/',
        });
      } else {
        throw e;
      }
    } finally {
      this.isLoadingPendientesResumen = false;
      if (!silent && showLoadingSwal) Swal.close();
    }
  }

  // =========================
  // ✅ 2) OFICINAS (matriz: filas=módulos, columnas=oficinas)
  //    GET /EstadosRobots/pendientes/por-oficina/
  // =========================
  async loadPendientesPorOficina(silent = false, showLoadingSwal = true): Promise<void> {
    if (this.isLoadingPendientesPorOficina) return;

    this.isLoadingPendientesPorOficina = true;

    if (!silent && showLoadingSwal) {
      Swal.fire({
        icon: 'info',
        title: 'Actualizando por oficina',
        text: 'Consultando faltantes por oficina...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
    }

    try {
      const resp: PendientesPorOficinaResponse = await firstValueFrom(
        this.robots.getPendientesPorOficina({ soloPendientes: false }) as any
      );

      const backendRows: any[] = Array.isArray((resp as any)?.rows) ? (resp as any).rows : [];

      // ✅ oficinas en el mismo orden del GET
      const oficinas = backendRows.map((r: any) => {
        const o = r?.oficina ?? r?.oficina_norm ?? null;
        const txt = String(o ?? '').trim();
        return txt ? txt : 'SIN_OFICINA';
      });

      // ✅ columnas dinámicas: "Oficinas/ Faltantes" + cada oficina
      const oficinaCols: ColumnDefinition[] = oficinas.map((of: string) => ({
        name: this.oficinaColKey(of),
        header: of,
        type: 'number' as const,
        width: '160px',
      }));

      this.pendientesPorOficinaColumns = [
        { name: 'tipo', header: 'Oficinas/ Faltantes', type: 'text' as const, width: '220px' },
        ...oficinaCols,
      ];

      // ✅ construir matriz (filas = módulos)
      const out: PendientesOficinasMatrixRow[] = [];

      for (const mod of this.pendientesKeys) {
        const row: PendientesOficinasMatrixRow = { tipo: mod.label, key: mod.key };

        for (let i = 0; i < backendRows.length; i++) {
          const oficinaName = oficinas[i];
          const colKey = this.oficinaColKey(oficinaName);

          const falt: any = backendRows[i]?.faltantes ?? {};
          row[colKey] = Number(falt?.[mod.key] ?? 0); // si no existe (ej union), 0
        }

        out.push(row);
      }

      this.pendientesPorOficinaRows = [...out];
    } catch (e) {
      console.error(e);
      this.pendientesPorOficinaRows = [];
      this.pendientesPorOficinaColumns = [
        { name: 'tipo', header: 'Oficinas/ Faltantes', type: 'text' as const, width: '220px' },
      ];

      if (!silent) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar /EstadosRobots/pendientes/por-oficina/',
        });
      } else {
        throw e;
      }
    } finally {
      this.isLoadingPendientesPorOficina = false;
      if (!silent && showLoadingSwal) Swal.close();
    }
  }

  // =========================
  // COLUMNAS
  // =========================
  private buildColumns(): void {
    // ✅ Resumen (1 fila)
    this.pendientesResumenColumns = [
      { name: 'adress', header: 'Cantidad Adres Faltantes', type: 'number' as const, width: '220px' },
      { name: 'policivo', header: 'Cantidad Policivo Faltantes', type: 'number' as const, width: '240px' },
      { name: 'ofac', header: 'Cantidad OFAC Faltantes', type: 'number' as const, width: '220px' },
      { name: 'contraloria', header: 'Cantidad Contraloria Faltantes', type: 'number' as const, width: '260px' },
      { name: 'sisben', header: 'Cantidad Sisben Faltantes', type: 'number' as const, width: '240px' },
      { name: 'procuraduria', header: 'Cantidad Procuraduria Faltantes', type: 'number' as const, width: '280px' },
      { name: 'fondo_pension', header: 'Cantidad Fondo Pension Faltantes', type: 'number' as const, width: '300px' },
      { name: 'union', header: 'Cantidad Union Faltantes', type: 'number' as const, width: '240px' },
    ];

    // ✅ Oficinas (se arma dinámico cuando llega el GET)
    this.pendientesPorOficinaColumns = [
      { name: 'tipo', header: 'Oficinas/ Faltantes', type: 'text' as const, width: '220px' },
    ];
  }

  // =========================
  // Helpers columnas dinámicas oficinas
  // =========================
  private oficinaColKey(oficina: string): string {
    return `o_${this.slugify(oficina)}`;
  }

  private slugify(input: string): string {
    const s = String(input ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const cleaned = s
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    return cleaned || 'sin_oficina';
  }
}
