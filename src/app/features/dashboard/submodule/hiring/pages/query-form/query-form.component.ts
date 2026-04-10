import { SharedModule } from '@/app/shared/shared.module';
import {  Component, ViewChild , ChangeDetectionStrategy } from '@angular/core';
import Swal from 'sweetalert2';
import { HiringService } from '../../service/hiring.service';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-query-form',
  imports: [
    SharedModule,
    MatPaginatorModule
  ],
  templateUrl: './query-form.component.html',
  styleUrl: './query-form.component.css'
} )
export class QueryFormComponent {
  cedula: string = '';
  dataSource = new MatTableDataSource<any>([]); // MatTableDataSource
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'numerodeceduladepersona', 'primer_apellido', 'segundo_apellido', 'primer_nombre', 'segundo_nombre',
    'fecha_nacimiento', 'genero', 'estado_civil', 'direccion_residencia', 'barrio', 'celular',
    'primercorreoelectronico', 'municipio', 'fecha_expedicion_cc', 'municipio_expedicion_cc',
    'departamento_expedicion_cc', 'lugar_nacimiento_municipio', 'lugar_nacimiento_departamento', 'rh', 'zurdo_diestro',
    // crear 6 empty columns para los documentos vacios
    'empty1', 'empty2', 'empty3', 'empty4', 'empty5', 'empty6',

    'escolaridad',

    'empty56', 'empty57', 'empty58', 'empty59', 'empty60',

    'nombre_institucion', 'ano_finalizacion', 'titulo_obtenido', 'chaqueta', 'pantalon', 'camisa', 'calzado',
    'familiar_emergencia', 'parentesco_familiar_emergencia', 'direccion_familiar_emergencia', 'barrio_familiar_emergencia',
    'telefono_familiar_emergencia', 'ocupacion_familiar_emergencia', 'nombre_conyugue', 'vive_con_el_conyugue',
    'ocupacion_conyugue', 'direccion_laboral_conyugue', 'telefono_conyugue', 'barrio_municipio_conyugue',

    'num_hijos_dependen_economicamente',
    // crear 12 empty columns para los hijos vacios
    'empty7', 'empty8', 'empty9', 'empty10', 'empty11', 'empty12', 'empty13', 'empty14', 'empty15', 'empty16', 'empty17', 'empty18',

    'nombre_padre', 'vive_padre', 'ocupacion_padre', 'direccion_padre', 'telefono_padre', 'barrio_padre',
    'nombre_madre', 'vive_madre', 'ocupacion_madre', 'direccion_madre', 'telefono_madre', 'barrio_madre',

    'nombre_referencia_personal1', 'telefono_referencia_personal1', 'ocupacion_referencia_personal1',
    'nombre_referencia_personal2', 'telefono_referencia_personal2', 'ocupacion_referencia_personal2',
    'nombre_referencia_familiar1', 'telefono_referencia_familiar1', 'ocupacion_referencia_familiar1',
    'nombre_referencia_familiar2', 'telefono_referencia_familiar2', 'ocupacion_referencia_familiar2',

    'nombre_expe_laboral1_empresa', 'direccion_empresa1', 'telefonos_empresa1', 'nombre_jefe_empresa1', 'cargo_empresa1',
    'fecha_retiro_empresa1', 'motivo_retiro_empresa1',

    // crear 37 empty columns para las experiencias laborales vacias
    'empty20', 'empty21', 'empty22', 'empty23', 'empty24',
    'empty25', 'empty26', 'empty27', 'empty28', 'empty29', 'empty30',
    'empty31', 'empty32', 'empty33', 'empty34', 'empty35', 'empty36',
    'empty37', 'empty38', 'empty39', 'empty40', 'empty41', 'empty42',
    'empty43', 'empty44', 'empty45', 'empty46', 'empty47', 'empty48',
    'empty49', 'empty50', 'empty51', 'empty52', 'empty53', 'empty54',
    'empty55',

    'como_se_entero', 'tiene_experiencia_laboral',
    'empresas_laborado', 'area_experiencia', 'labores_realizadas', 'rendimiento', 'porqueRendimiento',
    'hacecuantoviveenlazona', 'tipo_vivienda', 'personas_con_quien_convive', 'estudia_actualmente',
    'personas_a_cargo', 'num_hijos_dependen_economicamente2',
    'quien_los_cuida', 'como_es_su_relacion_familiar', 'porqueLofelicitarian',
    'malentendido', 'actividadesDi', 'experienciaSignificativa', 'expectativas_de_vida', 'tipo_vivienda_2p', 'motivacion', 'marcaTemporal'
  ];

  constructor(
    private hiringService: HiringService
  ) { }

    // Captura el valor de la cédula ingresada
    onCedulaInput(event: Event) {
      const inputElement = event.target as HTMLInputElement;
      this.cedula = inputElement.value.trim(); // Guarda el valor de la cédula en la variable de clase
    }


    ngOnInit(): void {
      // Índice donde se deben insertar las columnas de los hijos
      const indexHijos = this.displayedColumns.indexOf('num_hijos_dependen_economicamente') + 1;

      // Añadir las columnas dinámicas para los hijos
      const hijosColumns = [];
      for (let i = 1; i <= 5; i++) { // Ajustar según cuántos hijos quieras mostrar, en este caso 5
        hijosColumns.push(`nombre_hijo_${i}`);
        hijosColumns.push(`sexo_hijo_${i}`);
        hijosColumns.push(`fecha_nacimiento_hijo_${i}`);
        hijosColumns.push(`no_documento_hijo_${i}`);
        hijosColumns.push(`estudia_o_trabaja_hijo_${i}`);
        hijosColumns.push(`curso_hijo_${i}`);
      }

      // Inserta las columnas de los hijos después de 'num_hijos_dependen_economicamente'
      this.displayedColumns.splice(indexHijos, 0, ...hijosColumns);


    }

    buscarPorCedula(){
      // Obtención de datos desde el servicio
      this.hiringService.buscarEncontratacion(this.cedula).subscribe(
        (data) => {
          this.dataSource.data = data.data;  // Asigna los datos a la fuente de la tabla
          this.dataSource.paginator = this.paginator;  // Vincula el paginador
          this.dataSource.sort = this.sort;  // Vincula la ordenación
        },
        (error) => {
          // "No se encontraron datos para la cédula ingresada: 78"
          if (error.status === 404) {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: `No se encontraron datos para la cédula ingresada: ${this.cedula}`,
            });
          }

        }
      );
    }


    async copyTableToClipboard(): Promise<void> {
      let copyText = '';

      // Definir los mapeos de columnas al principio del método
      const columnMappings: { [key: string]: string } = {
        'num_hijos_dependen_economicamente2': 'Número de hijos dependientes',
        // Otros mapeos necesarios
      };

      // Itera sobre los datos filtrados y genera las filas
      this.dataSource.filteredData.forEach(row => {
        const rowData = this.displayedColumns.map(column => {
          // Manejo de columnas dinámicas relacionadas con hijos
          if (column.startsWith('nombre_hijo') || column.startsWith('sexo_hijo') ||
            column.startsWith('fecha_nacimiento_hijo') || column.startsWith('no_documento_hijo') ||
            column.startsWith('estudia_o_trabaja_hijo') || column.startsWith('curso_hijo')) {

            const match = column.match(/\d+$/);
            const index = match ? parseInt(match[0], 10) - 1 : 0;

            if (row.hijos && row.hijos[index]) {
              if (column.startsWith('nombre_hijo')) return this.escapeForExcel(row.hijos[index].nombre || 'N/A');
              if (column.startsWith('sexo_hijo')) return this.escapeForExcel(row.hijos[index].sexo || 'N/A');
              if (column.startsWith('fecha_nacimiento_hijo')) return this.escapeForExcel(row.hijos[index].fecha_nacimiento || 'N/A');
              if (column.startsWith('no_documento_hijo')) return this.escapeForExcel(row.hijos[index].no_documento || 'N/A');
              if (column.startsWith('estudia_o_trabaja_hijo')) return this.escapeForExcel(row.hijos[index].estudia_o_trabaja || 'N/A');
              if (column.startsWith('curso_hijo')) return this.escapeForExcel(row.hijos[index].curso || 'N/A');
            } else {
              return 'N/A';
            }
          }

          // Manejo de columnas normales con mapeo
          const dataField = columnMappings[column] || column;
          return this.escapeForExcel(row[dataField] || '');
        }).join('\t');
        copyText += rowData + '\n';
      });

      // Copiar al portapapeles
      try {
        await navigator.clipboard.writeText(copyText);
        Swal.fire({
          icon: 'success',
          title: 'Tabla copiada al portapapeles',
          text: 'La tabla se ha copiado exitosamente al portapapeles.'
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error al copiar la tabla al portapapeles',
          text: 'Hubo un problema al intentar copiar la tabla al portapapeles.'
        });
      }
    }

    // Función para manejar caracteres especiales
    escapeForExcel(value: string): string {
      if (!value) return '';
      return value.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/"/g, '""');
    }


    // Función para retornar los encabezados amigables de las columnas
    getColumnHeader(column: string): string {
      const headers: { [key: string]: string } = {
        'numerodeceduladepersona': 'Número de Cédula',
        'primer_apellido': 'Primer Apellido',
        'segundo_apellido': 'Segundo Apellido',
        // Agregar el resto de las columnas
        'nombre_hijo_1': 'Nombre del Hijo 1',
        'sexo_hijo_1': 'Sexo del Hijo 1',
        'fecha_nacimiento_hijo_1': 'Fecha de Nacimiento del Hijo 1',
        'no_documento_hijo_1': 'N° Documento del Hijo 1',
        'estudia_o_trabaja_hijo_1': 'Estudia o Trabaja Hijo 1',
        'curso_hijo_1': 'Curso del Hijo 1',
        // Agregar encabezados hasta el número máximo de hijos
      };
      return headers[column] || column;
    }
}
