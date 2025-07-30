import { SharedModule } from '@/app/shared/shared.module';
import { Component, LOCALE_ID, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { filter, forkJoin, take } from 'rxjs';
import Swal from 'sweetalert2';
import { VetadosService } from '../../service/vetados/vetados.service';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { MatTableDataSource } from '@angular/material/table';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { EventEmitter, Output } from '@angular/core';
import { HiringService } from '../../service/hiring.service';
import { NavigationEnd, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';

interface Usuario {
  primer_nombre : string;
  primer_apellido: string;
  rol           : string;
  sucursalde    : string;
}

interface CandidatoTabla {
  cedula         : string;
  nombre_completo: string;
  created_at     : string | Date;
}

@Component({
  selector: 'app-search-for-candidate',
  imports: [
    SharedModule,
    FormsModule,
    MatButtonModule
  ],
  templateUrl: './search-for-candidate.component.html',
  styleUrl: './search-for-candidate.component.css',
})
export class SearchForCandidateComponent implements OnInit {
  /* ──────────  Outputs  ────────── */
  @Output() codigoContratoChange = new EventEmitter<string>();
  @Output() cedulaSeleccionada   = new EventEmitter<string>();
  @Output() nombreCompletoChange = new EventEmitter<string>();

  /* ──────────  Propiedades  ────────── */
  cedula               = '';
  observacion          = '';
  mostrarObservacion   = false;
  procesoValido        = false;

  sede             = '';
  abreviacionSede  = '';
  codigoContratoActual = '';

  /* tablas */
  simpleDisplayedColumns = ['cedula', 'nombre_completo', 'created_at', 'acciones'];
  simpleDataSource = new MatTableDataSource<CandidatoTabla>([]);
  displayedColumns : string[] = [
    'cedula','nombre_completo','clasificacion',
    'descripcion','observacion','estado','sede'
  ];
  dataSource = new MatTableDataSource<any>([]);
  showTable  = false;
  filtroCedula: string = '';

  /* diccionario de abreviaciones */
  private readonly abreviaciones: Record<string, string> = {
    ADMINISTRATIVOS: 'ADM', ANDES: 'AND', BOSA: 'BOS', CARTAGENITA: 'CAR',
    FACA_PRIMERA: 'FPR', FACA_PRINCIPAL: 'FPC', FONTIBÓN: 'FON', FORANEOS: 'FOR',
    FUNZA: 'FUN', MADRID: 'MAD', MONTE_VERDE: 'MV', ROSAL: 'ROS',
    SOACHA: 'SOA', SUBA: 'SUB', TOCANCIPÁ: 'TOC', USME: 'USM',
  };

  constructor(
    private vetadosService      : VetadosService,
    private seleccionService    : SeleccionService,
    private utilityService      : UtilityServiceService,
    private hiringService       : HiringService,
    private infoVacantesService : InfoVacantesService,
    private router              : Router,
  ) {}

  /* ──────────  Ciclo de vida  ────────── */
  ngOnInit(): void {
    this.initUsuarioYAbreviacion();
    this.loadCandidatos();
  }

  private initUsuarioYAbreviacion(): void {
    const user = this.utilityService.getUser() as Usuario | null;
    if (!user) { return; }

    this.sede            = user.sucursalde;
    this.abreviacionSede = this.abreviaciones[this.sede] || this.sede;
  }

  /* ──────────  Escucha de ruta y carga tabla  ────────── */


  /* ──────────  Tabla candidatos  ────────── */
  private loadCandidatos(): void {
    this.seleccionService.getCandidatos().pipe(take(1)).subscribe({
      next : (candidatos: any[] = []) => {
        const sedeLower = this.sede.toLowerCase().trim();
        const filtrados = candidatos
          .filter(c => (c.oficina ?? '').toLowerCase().trim() === sedeLower)
          .map(c => ({
            cedula : c.numero ?? '',
            created_at : c.created_at,
            nombre_completo: [
              c.primer_nombre, c.segundo_nombre,
              c.primer_apellido, c.segundo_apellido
            ].filter(Boolean).join(' ').trim()
          }));
        this.simpleDataSource.data = filtrados;
      },
      error: () => Swal.fire('Error','No se pudieron cargar los candidatos.','error')
    });
  }

  aplicarFiltroCedula(valor: string): void {
    this.simpleDataSource.filterPredicate = (d,f) =>
      d.cedula?.toString().trim() === f.trim();
    this.simpleDataSource.filter = valor.trim();
  }

  /* ──────────  Acciones sobre cédula  ────────── */
  seleccionarCedula(cedula: string, nombre: string): void {
    this.cedula = cedula;
    this.nombreCompletoChange.emit(nombre);
    this.buscarCedula();
  }

  buscarCedula(): void {
    if (!this.cedula) return;
    this.cedulaSeleccionada.emit(this.cedula);

    forkJoin({
      candidato : this.infoVacantesService.getVacantesPorNumero(this.cedula),
      seleccion : this.hiringService.traerDatosSeleccion(this.cedula),
      vetado    : this.vetadosService.listarReportesVetadosPorCedula(this.cedula)
    })
    .pipe(take(1))
    .subscribe({
      next : ({ vetado, seleccion, candidato }) => {
        this.procesarVetado(vetado);
        this.procesarSeleccion(seleccion);
        console.log('Candidato:', candidato);
        // colocar nombre completo 
        this.nombreCompletoChange.emit(candidato[0].primer_nombre + ' ' + candidato[0].segundo_nombre + ' ' + candidato[0].primer_apellido + ' ' + candidato[0].segundo_apellido);
      },
      error: e => this.procesarError(e)
    });
  }

  /* vetados */
  private procesarVetado(vetado: any[]|null): void {
    if (!vetado?.length) return;
    this.procesoValido = true;
    this.dataSource.data = vetado
      .filter(v => v.categoria)
      .map(v => ({
        cedula : v.cedula,
        nombre_completo : v.nombre_completo,
        clasificacion : v.categoria.clasificacion ?? '',
        descripcion   : v.categoria.descripcion   ?? '',
        observacion   : v.observacion,
        estado        : v.estado,
        sede          : v.sede,
        autorizado_por: v.autorizado_por
      }));
  }

  /* selección */
  private procesarSeleccion(sel: any): void {
    const procs = sel?.procesoSeleccion ?? [];
    if (!procs.length) return;
    const ultimo = procs.reduce((a: { id: number; },b: { id: number; })=>b.id>a.id?b:a);
    const codigoExistente = ultimo.codigo_contrato;

    Swal.fire({
      title: '¡Atención!',
      html : 'Este usuario ya tiene un proceso.<br>¿Deseas crear otro o continuar con este?',
      icon : 'warning', showCancelButton: true,
      confirmButtonText: 'Crear otro',
      cancelButtonText : 'Continuar con este'
    }).then(r=>{
      if (r.isConfirmed) this.generarNuevoCodigoContrato();
      else {
        this.codigoContratoActual = codigoExistente;
        this.codigoContratoChange.emit(codigoExistente);
        this.procesoValido = true;
      }
    });
  }

  private generarNuevoCodigoContrato(): void {
    this.seleccionService.generarCodigoContratacion(this.abreviacionSede, this.cedula)
      .pipe(take(1))
      .subscribe({
        next : r=>{
          this.codigoContratoActual = r.nuevo_codigo;
          this.codigoContratoChange.emit(r.nuevo_codigo);
          this.procesoValido = true;
        },
        error: ()=>Swal.fire('Error','No se pudo generar el código','error')
      });
  }

  /* errores */
  private procesarError(err:any): void {
    const m = err?.error?.message ?? '';
    if (m.includes('No se encontró el proceso de selección')) {
      Swal.fire('Info','El usuario no tiene procesos','info')
        .then(()=>this.generarNuevoCodigoContrato());
    } else {
      Swal.fire('Atención','No se encontró la cédula ingresada','warning');
    }
  }

  /* ──────────  Observación  ────────── */
  mostrarCampoObservacion(): void { this.mostrarObservacion = true; }

  enviarObservacion(): void {
    if (!this.observacion.trim()) {
      Swal.fire('Error','Debe escribir una observación.','error'); return;
    }

    const u = this.utilityService.getUser() as Usuario | null;
    if (!u) { Swal.fire('Error','No hay usuario en sesión','error'); return; }

    const nombre = `${u.primer_nombre} ${u.primer_apellido} - ${u.rol}`;
    const sedeAbrev = this.abreviaciones[u.sucursalde] || u.sucursalde;

    const reporte = {
      cedula: this.cedula,
      observacion: this.observacion,
      centro_costo_carnet: '',
      reportadoPor: nombre
    };

    this.vetadosService.enviarReporte(reporte, sedeAbrev).pipe(take(1)).subscribe({
      next : ()=> {
        Swal.fire('Éxito','Observación enviada.','success');
        this.mostrarObservacion = false;
        this.observacion = '';
      },
      error: ()=>Swal.fire('Error','No se pudo enviar la observación.','error')
    });
  }

  /* filtro en tabla vetados */
  applyFilter(ev: Event): void {
    const val = (ev.target as HTMLInputElement).value;
    this.dataSource.filter = val.trim().toLowerCase();
  }



}
