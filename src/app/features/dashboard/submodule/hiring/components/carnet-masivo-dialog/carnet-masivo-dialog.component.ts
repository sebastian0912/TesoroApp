/**
 * Generación MASIVA de carnets.
 *
 * Arma el mismo carnet que `generate-contracting-documents` (buildCarnetApoyoPdf)
 * pero para varias personas a la vez, aprovechando que la hoja ya trae una
 * grilla de 9: `buildCarnetApoyoLotePdf` llena las 9 celdas por hoja.
 *
 * Reglas:
 *  - Un candidato solo se genera si tiene TODOS los datos del carnet. Si le
 *    falta algo, la fila queda bloqueada y se dice exactamente qué falta.
 *  - Por defecto se preseleccionan solo los que NO tienen carnet generado: la
 *    idea es completar los que faltan, no re-imprimir lo que ya salió.
 *  - Un carnet ya generado se puede volver a marcar a mano para regenerarlo
 *    (uno o varios); queda advertido en la fila.
 *  - "Previsualizar" arma el PDF del lote sin escribir nada en el servidor.
 *  - "Generar" sube el carnet de cada persona al gestor documental y marca
 *    `carnet_generado`, además de descargar el lote para imprimir.
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { VacantesService } from '../../../vacancies/service/vacantes/vacantes.service';
import {
  CARNETS_POR_HOJA,
  DatosCarnet,
  buildCarnetApoyoLotePdf,
  buildCarnetApoyoPdf,
} from '../generate-contracting-documents/carnet-apoyo-fill';

/** type_id del carnet en el gestor documental. */
const TIPO_DOC_CARNET = 102;

export interface CarnetMasivoDialogData {
  /** Cédulas sugeridas al abrir (p. ej. las de la cola de turnos). */
  cedulas?: string[];
}

interface FilaCarnet {
  cedula: string;
  nombre: string;
  tipoDoc: string | null;
  /** Ya tenía carnet generado antes de esta corrida. */
  yaGenerado: boolean;
  /** Campos obligatorios que faltan; si hay alguno, no se puede generar. */
  faltantes: string[];
  datos: DatosCarnet | null;
  error: string | null;
  /** proceso al que hay que marcarle `carnet_generado`. */
  procesoId: number | null;
}

@Component({
  selector: 'app-carnet-masivo-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatTooltipModule,
  ],
  templateUrl: './carnet-masivo-dialog.component.html',
  styleUrl: './carnet-masivo-dialog.component.css',
})
export class CarnetMasivoDialogComponent {
  private readonly gc = inject(RegistroProcesoContratacion);
  private readonly docsSrv = inject(GestionDocumentalService);
  private readonly vacantesSrv = inject(VacantesService);

  /** Cédulas escritas/pegadas: una por línea, o separadas por coma/espacio. */
  cedulasTexto = '';

  cargando = signal(false);
  generando = signal(false);
  progreso = signal('');
  filas = signal<FilaCarnet[]>([]);
  private readonly marcadas = signal<Set<string>>(new Set<string>());

  /** Vacantes ya consultadas (varias personas comparten la misma). */
  private readonly vacantesCache = new Map<number, any>();

  readonly total = computed(() => this.filas().length);
  readonly seleccionadas = computed(() =>
    this.filas().filter(f => this.marcadas().has(f.cedula) && this.puedeGenerar(f)),
  );
  readonly hojas = computed(() => Math.ceil(this.seleccionadas().length / CARNETS_POR_HOJA));
  readonly bloqueadas = computed(() => this.filas().filter(f => !this.puedeGenerar(f)).length);
  readonly regenerando = computed(() =>
    this.seleccionadas().filter(f => f.yaGenerado).length,
  );

  constructor(
    public dialogRef: MatDialogRef<CarnetMasivoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CarnetMasivoDialogData,
  ) {
    const sugeridas = (data?.cedulas ?? []).map(c => String(c).trim()).filter(Boolean);
    if (sugeridas.length) this.cedulasTexto = sugeridas.join('\n');
  }

  /** Una fila es generable solo si no le falta ningún dato del carnet. */
  puedeGenerar(f: FilaCarnet): boolean {
    return !!f.datos && f.faltantes.length === 0 && !f.error;
  }

  estaMarcada(f: FilaCarnet): boolean {
    return this.marcadas().has(f.cedula);
  }

  marcar(f: FilaCarnet, checked: boolean): void {
    const s = new Set(this.marcadas());
    if (checked) s.add(f.cedula); else s.delete(f.cedula);
    this.marcadas.set(s);
  }

  marcarTodas(checked: boolean): void {
    this.marcadas.set(
      checked
        ? new Set(this.filas().filter(f => this.puedeGenerar(f)).map(f => f.cedula))
        : new Set<string>(),
    );
  }

  /** Vuelve a marcar solo los pendientes (el estado por defecto). */
  soloPendientes(): void {
    this.marcadas.set(
      new Set(this.filas().filter(f => this.puedeGenerar(f) && !f.yaGenerado).map(f => f.cedula)),
    );
  }

  // ───────── Carga y validación ─────────
  private parsearCedulas(): string[] {
    const crudas = String(this.cedulasTexto || '')
      .split(/[\s,;]+/)
      .map(c => c.replace(/\D/g, '').trim())
      .filter(Boolean);
    return [...new Set(crudas)];
  }

  async revisar(): Promise<void> {
    const cedulas = this.parsearCedulas();
    if (!cedulas.length) {
      Swal.fire({ icon: 'info', title: 'Sin cédulas', text: 'Escribe o pega al menos una cédula.', heightAuto: false });
      return;
    }

    this.cargando.set(true);
    this.filas.set([]);
    const acumulado: FilaCarnet[] = [];

    try {
      // Secuencial a propósito: son consultas pesadas (candidato completo +
      // vacante) y el backend no tiene por qué recibir 200 a la vez.
      for (let i = 0; i < cedulas.length; i++) {
        this.progreso.set(`Revisando ${i + 1} de ${cedulas.length}…`);
        acumulado.push(await this.construirFila(cedulas[i]));
        this.filas.set([...acumulado]);
      }
      this.soloPendientes();
    } finally {
      this.cargando.set(false);
      this.progreso.set('');
    }
  }

  private async construirFila(cedula: string): Promise<FilaCarnet> {
    const base: FilaCarnet = {
      cedula, nombre: '', tipoDoc: null, yaGenerado: false,
      faltantes: [], datos: null, error: null, procesoId: null,
    };

    let cand: any;
    try {
      cand = await firstValueFrom(this.gc.getCandidatoPorDocumento(cedula, true));
    } catch {
      return { ...base, error: 'No se encontró el candidato.' };
    }
    if (!cand?.numero_documento) return { ...base, error: 'No se encontró el candidato.' };

    // Misma elección de entrevista que generate-contracting-documents: la que
    // tiene publicación, si no la que tiene contrato, si no la más reciente.
    const entrevistas: any[] = Array.isArray(cand?.entrevistas) ? [...cand.entrevistas] : [];
    entrevistas.sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
    const ent = entrevistas.find(e => e?.proceso?.publicacion)
      || entrevistas.find(e => e?.proceso?.contrato_codigo || e?.proceso?.contrato?.codigo_contrato)
      || entrevistas[0];
    const proc = ent?.proceso ?? null;
    const contrato = proc?.contrato ?? null;

    const nombre = [cand.primer_nombre, cand.segundo_nombre, cand.primer_apellido, cand.segundo_apellido]
      .map((v: any) => String(v ?? '').trim()).filter(Boolean).join(' ');

    if (!contrato) {
      return { ...base, nombre, tipoDoc: cand.tipo_doc ?? null, error: 'No tiene contrato: primero Pago y Transporte.' };
    }

    const vacante = await this.vacante(proc?.publicacion ?? null);
    const antecedentes: any[] = Array.isArray(proc?.antecedentes) ? proc.antecedentes : [];
    const porNombre = (n: string) =>
      String(antecedentes.find(a => String(a?.nombre ?? '').toUpperCase() === n)?.observacion ?? '').trim();

    const familiares: any[] = Array.isArray(cand?.familiares) ? cand.familiares : [];
    const emerg = familiares.find(f => String(f?.tipo ?? '').toUpperCase().includes('EMERGENCIA')) ?? {};

    // El consecutivo del carnet ES el código de contrato (lo asigna el backend
    // por rango de oficina); carnet_codigo queda de respaldo para los viejos.
    const consecutivo = String(
      contrato.codigo_contrato || proc?.contrato_codigo || contrato.carnet_codigo || '',
    ).trim();

    const centroCostos = String(contrato.carnet_centro_costo || contrato.Ccentro_de_costos || '').trim();
    const fIng = String(contrato.carnet_fecha_ingreso || contrato.fecha_ingreso || '').trim();
    const fechaIngreso = /^\d{4}-\d{2}-\d{2}/.test(fIng)
      ? `${fIng.slice(8, 10)}/${fIng.slice(5, 7)}/${fIng.slice(0, 4)}`
      : fIng;

    const datos: DatosCarnet = {
      nombreCompleto: nombre,
      cedula: String(cand.numero_documento),
      centroCostos,
      cargo: String(vacante?.cargo ?? proc?.vacante_tipo ?? '').trim(),
      consecutivo,
      fechaIngreso,
      eps: porNombre('EPS'),
      afp: porNombre('AFP'),
      emergenciaNombre: String(emerg?.nombre ?? '').trim(),
      emergenciaTelefono: String(emerg?.telefono ?? '').trim(),
      logoDataUrl: null,   // se resuelve una sola vez al generar
      fotoDataUrl: String(cand?.biometria?.foto?.file_url ?? '') || null,
    };

    // Todo tiene que estar lleno: si falta algo, esta persona no se genera.
    const faltantes: string[] = [];
    if (!datos.nombreCompleto) faltantes.push('nombre');
    if (!datos.consecutivo) faltantes.push('código de contrato');
    if (!datos.centroCostos) faltantes.push('centro de costo');
    if (!datos.cargo) faltantes.push('cargo');
    if (!datos.fechaIngreso) faltantes.push('fecha de ingreso');
    if (!datos.eps) faltantes.push('EPS');
    if (!datos.afp) faltantes.push('AFP');
    if (!datos.emergenciaNombre) faltantes.push('contacto de emergencia');
    if (!datos.emergenciaTelefono) faltantes.push('teléfono de emergencia');
    if (!datos.fotoDataUrl) faltantes.push('foto');

    return {
      cedula: String(cand.numero_documento),
      nombre,
      tipoDoc: cand.tipo_doc ?? null,
      yaGenerado: contrato.carnet_generado === true,
      faltantes,
      datos,
      error: null,
      procesoId: proc?.id ?? null,
    };
  }

  private async vacante(id: number | null): Promise<any> {
    if (!id) return null;
    if (this.vacantesCache.has(id)) return this.vacantesCache.get(id);
    const vac = await firstValueFrom(
      this.vacantesSrv.obtenerVacante(id).pipe(take(1), catchError(() => of(null))),
    );
    this.vacantesCache.set(id, vac);
    return vac;
  }

  // ───────── Imágenes ─────────
  private async aDataUrl(url?: string | null): Promise<string | null> {
    if (!url) return null;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const buf = await resp.arrayBuffer();
      let bin = '';
      const u8 = new Uint8Array(buf);
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      return `data:image/png;base64,${btoa(bin)}`;
    } catch {
      return null;
    }
  }

  /** Descarga logo y fotos una sola vez y devuelve los datos listos para el PDF. */
  private async datosConImagenes(filas: FilaCarnet[]): Promise<DatosCarnet[]> {
    const logo = await this.aDataUrl('logos/Logo_AL.png');
    const out: DatosCarnet[] = [];
    for (const f of filas) {
      const d = f.datos!;
      out.push({ ...d, logoDataUrl: logo, fotoDataUrl: await this.aDataUrl(d.fotoDataUrl) });
    }
    return out;
  }

  // ───────── Previsualizar / generar ─────────
  async previsualizar(): Promise<void> {
    const sel = this.seleccionadas();
    if (!sel.length) {
      Swal.fire({ icon: 'info', title: 'Nada seleccionado', text: 'Marca al menos una persona con todos los datos completos.', heightAuto: false });
      return;
    }
    this.generando.set(true);
    this.progreso.set('Armando previsualización…');
    try {
      const blob = buildCarnetApoyoLotePdf(await this.datosConImagenes(sel));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error('[carnet masivo] previsualizar', e);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo armar la previsualización.', heightAuto: false });
    } finally {
      this.generando.set(false);
      this.progreso.set('');
    }
  }

  async generar(): Promise<void> {
    const sel = this.seleccionadas();
    if (!sel.length) {
      Swal.fire({ icon: 'info', title: 'Nada seleccionado', text: 'Marca al menos una persona con todos los datos completos.', heightAuto: false });
      return;
    }

    const regen = sel.filter(f => f.yaGenerado).length;
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      heightAuto: false,
      title: `Generar ${sel.length} carnet(s)`,
      html: `Se imprimirán en <b>${this.hojas()}</b> hoja(s) de 9.`
        + (regen ? `<br><br><b>${regen}</b> ya tenían carnet y se van a REGENERAR.` : ''),
      showCancelButton: true,
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#111827',
    });
    if (!isConfirmed) return;

    this.generando.set(true);
    const fallidas: string[] = [];
    try {
      this.progreso.set('Armando los carnets…');
      const datos = await this.datosConImagenes(sel);

      // 1) El lote para imprimir.
      const lote = buildCarnetApoyoLotePdf(datos);
      const url = URL.createObjectURL(lote);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      // 2) El carnet individual de cada quien al gestor documental + la marca.
      for (let i = 0; i < sel.length; i++) {
        const fila = sel[i];
        this.progreso.set(`Guardando ${i + 1} de ${sel.length} (${fila.cedula})…`);
        try {
          const individual = buildCarnetApoyoPdf(datos[i]);
          const archivo = new File([individual], `carnet_${fila.cedula}.pdf`, { type: 'application/pdf' });
          await firstValueFrom(this.docsSrv.guardarDocumento(
            `carnet_${fila.cedula}.pdf`, fila.cedula, TIPO_DOC_CARNET, archivo,
            datos[i].consecutivo || undefined, fila.tipoDoc ?? undefined,
          ));
          await firstValueFrom(this.gc.updateProcesoByDocumento({
            numero_documento: fila.cedula,
            contrato: {
              carnet_generado: true,
              carnet_codigo: datos[i].consecutivo,
              carnet_centro_costo: datos[i].centroCostos,
            },
          } as any, 'PATCH'));
        } catch (e) {
          console.error('[carnet masivo] falló', fila.cedula, e);
          fallidas.push(fila.cedula);
        }
      }

      // Refleja el nuevo estado sin volver a consultar todo.
      const okSet = new Set(sel.map(f => f.cedula).filter(c => !fallidas.includes(c)));
      this.filas.set(this.filas().map(f => (okSet.has(f.cedula) ? { ...f, yaGenerado: true } : f)));
      this.soloPendientes();
      this.cambios = true;

      await Swal.fire({
        heightAuto: false,
        icon: fallidas.length ? 'warning' : 'success',
        title: fallidas.length ? 'Generado con errores' : 'Carnets generados',
        html: `Se generaron <b>${sel.length - fallidas.length}</b> de ${sel.length}.`
          + (fallidas.length ? `<br><br>No se pudieron guardar: ${fallidas.join(', ')}` : ''),
        confirmButtonColor: '#111827',
      });
    } finally {
      this.generando.set(false);
      this.progreso.set('');
    }
  }

  /** Para que el pipeline sepa si debe refrescar al cerrar. */
  cambios = false;

  cerrar(): void {
    this.dialogRef.close(this.cambios);
  }
}
