import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import {
  AlertaValidacion,
  SoporteRequerido,
  TipoSoporte,
} from '../../../../models/incapacidad-v2.model';
import { IncapacidadV2Service } from '../../../../services/incapacidad-v2/incapacidad-v2.service';
import { calcularEdad, parsearFechaFlexible } from '../../../../utils/fechas';
import {
  CATALOGOS_RESPALDO,
  COLOR_ESTADO,
  COLOR_ESTADO_DOCUMENTO,
  COLOR_NIVEL_ALERTA,
  COLOR_RESPONSABLE_PAGO,
  ESTILO_CHIP_NEUTRO,
  EstiloChip,
  EventoHistorial,
  ICONO_NIVEL_ALERTA,
  ICONO_SOPORTE,
  IncapacidadResumenExtendido,
  IncapacidadV2Detalle,
  etiquetaDeCatalogo,
} from '../../consulta-incapacidades.model';
import { fechaHoraLegible, fechaLegible } from '../../exportacion-incapacidades';

/** Lo que recibe el dialogo. */
export interface DatosDialogoDetalle {
  id: number;
  /** Fila del listado: se pinta al instante mientras llega el detalle. */
  resumen?: IncapacidadResumenExtendido;
}

/** Lo que devuelve al cerrarse (la pagina ejecuta la accion). */
export interface ResultadoDialogoDetalle {
  accion: 'editar' | 'eliminar' | 'validar' | 'recargar';
}

/** Un dato de la ficha. */
export interface CampoFicha {
  etiqueta: string;
  valor: string;
  /** Ocupa dos columnas (observaciones, diagnostico largo...). */
  ancho?: boolean;
}

/** Un bloque de la ficha. */
export interface GrupoFicha {
  titulo: string;
  icono: string;
  campos: CampoFicha[];
}

/** Un soporte ya preparado para la lista. */
export interface SoporteVista {
  tipo: string;
  etiqueta: string;
  icono: string;
  cargado: boolean;
  obligatorio: boolean;
  nombreArchivo: string;
  url: string;
  subidoEn: string;
}

const VACIO = '—';

/**
 * Ficha completa de una incapacidad.
 *
 * Muestra los datos, la linea de tiempo del historico de estados, los soportes
 * con su enlace de descarga y las alertas del motor de reglas.
 *
 * Degrada con elegancia: mientras llega `GET /Incapacidades/v2/{id}` se pinta lo
 * que ya traia la fila del listado, y si esa peticion falla se sigue mostrando
 * el resumen con un aviso, en vez de dejar el dialogo en blanco.
 */
@Component({
  selector: 'app-dialogo-detalle-incapacidad',
  standalone: true,
  imports: [
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './dialogo-detalle-incapacidad.component.html',
  styleUrl: './dialogo-detalle-incapacidad.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoDetalleIncapacidadComponent implements OnInit, OnDestroy {
  private readonly srv = inject(IncapacidadV2Service);
  private readonly destroyRef = inject(DestroyRef);
  private readonly subs = new Subscription();

  readonly datos = inject<DatosDialogoDetalle>(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<DialogoDetalleIncapacidadComponent, ResultadoDialogoDetalle>>(
      MatDialogRef,
    );

  readonly detalle = signal<IncapacidadV2Detalle | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');

  private readonly catalogos = computed(
    () => this.srv.catalogosCache() ?? CATALOGOS_RESPALDO,
  );

  // ── Cabecera ──────────────────────────────────────────────────────────

  readonly consecutivo = computed(() => {
    const d = this.detalle();
    return d?.consecutivoSistema || this.datos.resumen?.consecutivoSistema || `#${this.datos.id}`;
  });

  readonly nombreTrabajador = computed(() => {
    const d = this.detalle();
    return d?.nombreCompleto || this.datos.resumen?.nombreCompleto || VACIO;
  });

  readonly cedulaTrabajador = computed(() => {
    const d = this.detalle();
    return d?.cedula || this.datos.resumen?.cedula || VACIO;
  });

  readonly chipEstado = computed(() => {
    const codigo = this.detalle()?.estado ?? this.datos.resumen?.estado ?? '';
    return {
      texto: etiquetaDeCatalogo(this.catalogos().estados, codigo) || VACIO,
      estilo: estiloDe(COLOR_ESTADO, codigo),
    };
  });

  readonly chipEstadoDocumento = computed(() => {
    const codigo = this.detalle()?.estadoDocumento ?? this.datos.resumen?.estadoDocumento ?? '';
    return {
      texto: etiquetaDeCatalogo(this.catalogos().estadosDocumento, codigo) || VACIO,
      estilo: estiloDe(COLOR_ESTADO_DOCUMENTO, codigo),
    };
  });

  readonly chipResponsable = computed(() => {
    const codigo = this.detalle()?.responsablePago ?? this.datos.resumen?.responsablePago ?? '';
    return {
      texto: etiquetaDeCatalogo(this.catalogos().responsablesPago, codigo) || VACIO,
      estilo: estiloDe(COLOR_RESPONSABLE_PAGO, codigo),
    };
  });

  /** Solo se puede promover a VALIDADA desde RECIBIDA. */
  readonly puedeValidar = computed(
    () => (this.detalle()?.estado ?? this.datos.resumen?.estado) === 'RECIBIDA',
  );

  // ── Ficha ─────────────────────────────────────────────────────────────

  readonly grupos = computed<GrupoFicha[]>(() => {
    const d = this.detalle();
    const r = this.datos.resumen;
    const cat = this.catalogos();
    if (!d && !r) return [];

    const edad =
      d?.edad ?? calcularEdad(d?.fechaNacimiento ?? null) ?? null;

    const diagnostico = [d?.codigoDiagnostico ?? r?.codigoDiagnostico, d?.descripcionDiagnostico]
      .filter((x) => !!x)
      .join(' · ');

    const ips = [d?.nitIps, d?.nombreIps].filter((x) => !!x).join(' · ');

    return [
      {
        titulo: 'Trabajador',
        icono: 'badge',
        campos: [
          { etiqueta: 'Cedula', valor: texto(d?.cedula ?? r?.cedula) },
          { etiqueta: 'Tipo de documento', valor: texto(d?.tipoDocumento) },
          { etiqueta: 'Nombre completo', valor: texto(d?.nombreCompleto ?? r?.nombreCompleto), ancho: true },
          { etiqueta: 'Fecha de nacimiento', valor: fechaLegible(d?.fechaNacimiento) || VACIO },
          { etiqueta: 'Edad', valor: edad === null ? VACIO : `${edad} anios` },
          { etiqueta: 'Genero', valor: texto(d?.genero) },
          { etiqueta: 'Celular', valor: texto(d?.celular) },
          { etiqueta: 'Correo', valor: texto(d?.correo), ancho: true },
        ],
      },
      {
        titulo: 'Vinculacion',
        icono: 'work',
        campos: [
          { etiqueta: 'Empresa', valor: texto(d?.empresa ?? r?.empresa) },
          { etiqueta: 'Centro de costo', valor: texto(d?.centroCosto ?? r?.centroCosto) },
          { etiqueta: 'Temporal', valor: texto(d?.temporal ?? r?.temporal) },
          { etiqueta: 'Numero de contrato', valor: texto(d?.numeroContrato ?? r?.numeroContrato) },
          { etiqueta: 'Fecha de ingreso', valor: fechaLegible(d?.fechaIngreso) || VACIO },
          { etiqueta: 'Oficina', valor: texto(d?.oficina ?? r?.oficina) },
          { etiqueta: 'EPS', valor: texto(d?.eps ?? r?.eps) },
          { etiqueta: 'Fondo de pension (AFP)', valor: texto(d?.afp ?? r?.afp) },
          { etiqueta: 'ARL', valor: texto(d?.arl) },
        ],
      },
      {
        titulo: 'Incapacidad',
        icono: 'medical_information',
        campos: [
          {
            etiqueta: 'Tipo',
            valor:
              etiquetaDeCatalogo(cat.tiposIncapacidad, d?.tipoIncapacidad ?? r?.tipoIncapacidad) ||
              VACIO,
          },
          { etiqueta: 'Numero de incapacidad', valor: texto(d?.numeroIncapacidad) },
          { etiqueta: 'Diagnostico (CIE-10)', valor: diagnostico || VACIO, ancho: true },
          { etiqueta: 'Fecha de inicio', valor: fechaLegible(d?.fechaInicio ?? r?.fechaInicio) || VACIO },
          { etiqueta: 'Fecha de fin', valor: fechaLegible(d?.fechaFin ?? r?.fechaFin) || VACIO },
          { etiqueta: 'Dias', valor: numero(d?.dias ?? r?.dias) },
          {
            etiqueta: 'Prorroga',
            valor:
              (d?.esProrroga ?? r?.esProrroga) === true
                ? d?.prorrogaDeId
                  ? `Si, de la incapacidad #${d.prorrogaDeId}`
                  : 'Si'
                : 'No',
          },
          { etiqueta: 'IPS', valor: ips || VACIO, ancho: true },
        ],
      },
      {
        titulo: 'Liquidacion',
        icono: 'calculate',
        campos: [
          { etiqueta: 'Dias a cargo de la empresa', valor: numero(d?.diasEmpresa ?? r?.diasEmpresa) },
          { etiqueta: 'Dias a cargo de la entidad', valor: numero(d?.diasEntidad ?? r?.diasEntidad) },
          { etiqueta: 'Entidad responsable', valor: texto(d?.entidadResponsable) },
          {
            etiqueta: 'Responsable de pago',
            valor: this.chipResponsable().texto,
          },
        ],
      },
      {
        titulo: 'Gestion y trazabilidad',
        icono: 'history_edu',
        campos: [
          { etiqueta: 'Estado', valor: this.chipEstado().texto },
          { etiqueta: 'Estado del documento', valor: this.chipEstadoDocumento().texto },
          { etiqueta: 'Recibido por', valor: texto(d?.nombreQuienRecibe) },
          { etiqueta: 'Registrado por', valor: texto(d?.creadoPor ?? r?.creadoPor) },
          { etiqueta: 'Fecha de registro', valor: fechaHoraLegible(d?.creadoEn ?? r?.creadoEn) || VACIO },
          { etiqueta: 'Ultima modificacion', valor: fechaHoraLegible(d?.actualizadoEn ?? r?.actualizadoEn) || VACIO },
          { etiqueta: 'Modificado por', valor: texto(d?.actualizadoPor ?? r?.actualizadoPor) },
          { etiqueta: 'Observaciones', valor: texto(d?.observaciones), ancho: true },
        ],
      },
    ];
  });

  // ── Linea de tiempo ───────────────────────────────────────────────────

  /**
   * Historico de estados. Si el backend no envia `historial`, se reconstruye la
   * traza minima con la auditoria (creado/actualizado) y se avisa en la UI para
   * no hacer pasar una reconstruccion por un historico real.
   */
  readonly historial = computed<EventoHistorial[]>(() => {
    const d = this.detalle();
    if (d?.historial?.length) {
      return [...d.historial].sort((a, b) => comparaFechas(a.fecha, b.fecha));
    }

    const eventos: EventoHistorial[] = [];
    const creado = d?.creadoEn ?? this.datos.resumen?.creadoEn;
    if (creado) {
      eventos.push({
        estado: 'RECIBIDA',
        etiqueta: 'Incapacidad registrada',
        fecha: creado,
        usuario: d?.creadoPor ?? this.datos.resumen?.creadoPor ?? '',
      });
    }
    const actualizado = d?.actualizadoEn ?? this.datos.resumen?.actualizadoEn;
    if (actualizado && actualizado !== creado) {
      eventos.push({
        etiqueta: 'Ultima modificacion',
        fecha: actualizado,
        usuario: d?.actualizadoPor ?? '',
      });
    }
    const estadoActual = d?.estado ?? this.datos.resumen?.estado;
    if (estadoActual) {
      eventos.push({
        estado: estadoActual,
        etiqueta: `Estado actual: ${etiquetaDeCatalogo(this.catalogos().estados, estadoActual)}`,
        fecha: actualizado ?? creado,
      });
    }
    return eventos;
  });

  /** `true` cuando la linea de tiempo es una reconstruccion, no el historico. */
  readonly historialReconstruido = computed(() => !this.detalle()?.historial?.length);

  historialEtiqueta(evento: EventoHistorial): string {
    if (evento.etiqueta) return evento.etiqueta;
    return etiquetaDeCatalogo(this.catalogos().estados, evento.estado) || VACIO;
  }

  historialFecha(evento: EventoHistorial): string {
    return fechaHoraLegible(evento.fecha) || VACIO;
  }

  historialColor(evento: EventoHistorial): string {
    return estiloDe(COLOR_ESTADO, evento.estado ?? '').color;
  }

  // ── Soportes ──────────────────────────────────────────────────────────

  readonly soportes = computed<SoporteVista[]>(() => {
    const d = this.detalle();
    const cat = this.catalogos();
    const adjuntos = d?.soportes ?? [];
    const exigidos: SoporteRequerido[] = (d?.validacion?.soportes ?? []).filter((s) => s.visible);

    // Union: lo exigido por las reglas + lo que este adjunto aunque ya no aplique.
    const tipos = new Set<string>();
    exigidos.forEach((s) => tipos.add(s.tipo));
    adjuntos.forEach((s) => tipos.add(s.tipo));

    const vista: SoporteVista[] = [];
    for (const tipo of tipos) {
      const requerido = exigidos.find((s) => s.tipo === tipo);
      const adjunto = adjuntos.find((s) => s.tipo === tipo);
      vista.push({
        tipo,
        etiqueta:
          requerido?.etiqueta ||
          etiquetaDeCatalogo(cat.tiposSoporte, tipo) ||
          tipo,
        icono: ICONO_SOPORTE[tipo as TipoSoporte] ?? 'insert_drive_file',
        cargado: !!adjunto?.fileUrl || requerido?.cargado === true,
        obligatorio: requerido?.obligatorio === true,
        nombreArchivo: adjunto?.nombreArchivo ?? '',
        url: this.srv.urlAbsolutaDocumento(adjunto?.fileUrl),
        subidoEn: fechaHoraLegible(adjunto?.subidoEn),
      });
    }

    return vista.sort((a, b) => Number(b.obligatorio) - Number(a.obligatorio));
  });

  readonly faltanSoportes = computed(() =>
    this.soportes().some((s) => s.obligatorio && !s.cargado),
  );

  // ── Alertas ───────────────────────────────────────────────────────────

  readonly alertas = computed<AlertaValidacion[]>(() => this.detalle()?.validacion?.alertas ?? []);

  colorAlerta(alerta: AlertaValidacion): EstiloChip {
    return COLOR_NIVEL_ALERTA[alerta.nivel] ?? ESTILO_CHIP_NEUTRO;
  }

  iconoAlerta(alerta: AlertaValidacion): string {
    return ICONO_NIVEL_ALERTA[alerta.nivel] ?? 'info';
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────

  ngOnInit(): void {
    this.subs.add(
      this.srv
        .obtener(this.datos.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (detalle) => {
            this.detalle.set(detalle as IncapacidadV2Detalle);
            this.cargando.set(false);
          },
          error: () => {
            this.cargando.set(false);
            this.error.set(
              'No se pudo cargar el detalle completo. Se muestra la informacion del listado.',
            );
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Acciones ──────────────────────────────────────────────────────────

  cerrar(): void {
    this.ref.close();
  }

  editar(): void {
    this.ref.close({ accion: 'editar' });
  }

  eliminar(): void {
    this.ref.close({ accion: 'eliminar' });
  }

  validar(): void {
    this.ref.close({ accion: 'validar' });
  }

  trackGrupo = (_: number, grupo: GrupoFicha) => grupo.titulo;
  trackCampo = (_: number, campo: CampoFicha) => campo.etiqueta;
  trackSoporte = (_: number, soporte: SoporteVista) => soporte.tipo;
}

// ── Utilidades ──────────────────────────────────────────────────────────

function texto(valor: unknown): string {
  const limpio = valor === null || valor === undefined ? '' : String(valor).trim();
  return limpio || VACIO;
}

function numero(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return VACIO;
  const n = typeof valor === 'number' ? valor : Number(valor);
  return isNaN(n) ? VACIO : String(n);
}

function estiloDe<C extends string>(
  mapa: Readonly<Record<C, EstiloChip>>,
  codigo: string,
): EstiloChip {
  const encontrado = (mapa as Record<string, EstiloChip>)[codigo];
  return encontrado ?? ESTILO_CHIP_NEUTRO;
}

function comparaFechas(a?: string, b?: string): number {
  const fa = parsearFechaFlexible(a)?.getTime() ?? new Date(a ?? '').getTime();
  const fb = parsearFechaFlexible(b)?.getTime() ?? new Date(b ?? '').getTime();
  const va = isNaN(fa) ? 0 : fa;
  const vb = isNaN(fb) ? 0 : fb;
  return va - vb;
}
