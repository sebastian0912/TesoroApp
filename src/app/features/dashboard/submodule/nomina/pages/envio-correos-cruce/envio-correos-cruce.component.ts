import {
  ChangeDetectionStrategy, Component, OnInit, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import {
  CruceRespuesta, EnvioCorreosService, FilaCruce, PeriodoDisponible, TipoRef,
} from '../../service/envio-correos/envio-correos.service';
import {
  VisorDocumentoComponent, VisorDocumentoData,
} from '../../components/visor-documento/visor-documento.component';

/**
 * Nómina → Envío de correos (modelo antiguo) → Cruce por quincena.
 *
 * Responde la pregunta que hoy se contesta a ojo sobre la hoja de cálculo:
 * de la gente que va en este corte, ¿a quién le falta el archivo?
 *
 * Junta la hoja (`tabla_desprendibles`, ms-payroll) con los archivos ya
 * cargados por carpeta (ms-documents). Donde antes había un link de Drive, si
 * el documento ya está en la plataforma se muestra el interno; el enlace legacy
 * queda como respaldo para el histórico que no se va a migrar.
 */
@Component({
  selector: 'app-envio-correos-cruce',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatCardModule, MatDialogModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule,
    MatSelectModule, MatTableModule, MatTooltipModule,
  ],
  templateUrl: './envio-correos-cruce.component.html',
  styleUrl: './envio-correos-cruce.component.css',
})
export class EnvioCorreosCruceComponent implements OnInit {
  private srv = inject(EnvioCorreosService);
  private titulo = inject(Title);
  private dialog = inject(MatDialog);

  readonly cargando = signal(false);
  readonly periodos = signal<PeriodoDisponible[]>([]);
  readonly tipos = signal<TipoRef[]>([]);
  readonly datos = signal<CruceRespuesta | null>(null);

  // Filtros
  readonly periodoSel = signal<string | null>(null);
  readonly tipoSel = signal<number | null>(null);
  readonly empresaSel = signal<string | null>(null);
  readonly estadoSel = signal<string>('TODOS');
  readonly busqueda = signal<string>('');
  readonly pagina = signal(0);
  readonly tamanoPagina = signal(50);

  readonly filas = computed<FilaCruce[]>(() => this.datos()?.content ?? []);
  readonly resumen = computed(() => this.datos()?.resumen ?? null);
  readonly advertencias = computed<string[]>(() => this.datos()?.advertencias ?? []);

  readonly columnas = ['cedula', 'nombre', 'finca', 'correo', 'archivo', 'enviado'];

  async ngOnInit(): Promise<void> {
    this.titulo.setTitle('Cruce por quincena | Envío de correos (modelo antiguo)');
    this.cargando.set(true);
    try {
      const [periodos, tipos] = await Promise.all([
        firstValueFrom(this.srv.periodos()),
        firstValueFrom(this.srv.tiposDisponibles()),
      ]);
      this.periodos.set(periodos.content);
      this.tipos.set(tipos);
      // La lista viene de la más reciente a la más antigua: arrancar en la
      // primera es lo que quiere ver quien entra a revisar el corte del día.
      if (periodos.content.length) {
        this.periodoSel.set(periodos.content[0].clave);
        await this.consultar();
      }
    } catch (e: any) {
      this.error(e?.error?.error ?? 'No se pudieron cargar las quincenas disponibles.');
    } finally {
      this.cargando.set(false);
    }
  }

  async consultar(reiniciarPagina = false): Promise<void> {
    const periodo = this.periodoSel();
    if (!periodo) return;
    if (reiniciarPagina) this.pagina.set(0);

    this.cargando.set(true);
    try {
      this.datos.set(await firstValueFrom(this.srv.cruce({
        periodoClave: periodo,
        typeId: this.tipoSel(),
        empresa: this.empresaSel(),
        estado: this.estadoSel(),
        q: this.busqueda().trim() || undefined,
        page: this.pagina(),
        size: this.tamanoPagina(),
      })));
    } catch (e: any) {
      this.error(e?.error?.error ?? 'No se pudo consultar el cruce.');
    } finally {
      this.cargando.set(false);
    }
  }

  onPagina(e: PageEvent): void {
    this.pagina.set(e.pageIndex);
    this.tamanoPagina.set(e.pageSize);
    this.consultar();
  }

  /**
   * Abre el documento interno en un visor.
   *
   * NO usa `window.open(url)`: `/api/v1/documents/**` exige JWT en el gateway y
   * una navegación directa responde 401. El visor lo descarga por HttpClient
   * (con token) y lo muestra desde un object URL.
   */
  verDocumento(fila: FilaCruce): void {
    if (!fila.document_id) return;
    this.dialog.open<VisorDocumentoComponent, VisorDocumentoData>(VisorDocumentoComponent, {
      data: {
        documentId: fila.document_id,
        nombreArchivo: fila.nombre_archivo,
        cedula: fila.cedula,
        titulo: fila.nombre,
      },
      width: '900px',
      maxWidth: '95vw',
    });
  }

  porcentaje(parte: number, total: number): number {
    return total === 0 ? 0 : Math.round((parte / total) * 100);
  }

  tamanoLegible(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private error(mensaje: string): void {
    Swal.fire({ icon: 'error', title: 'Error', text: mensaje });
  }
}
