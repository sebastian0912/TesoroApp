import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
  FormControl
} from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil
} from 'rxjs/operators';
import { of, Observable, Subject } from 'rxjs';
import { ComercializadoraService } from '../../../merchandise/service/comercializadora/comercializadora.service';
import { MercadoService } from '../../service/mercado/mercado.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { SharedModule } from '../../../../../../shared/shared.module'; // si lo usas
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-mercado-comercializadora',
  templateUrl: './mercado-comercializadora.component.html',
  styleUrls: ['./mercado-comercializadora.component.css'],
  imports: [SharedModule, MatCheckboxModule] // si usas Standalone Components
})
export class MercadoComercializadoraComponent implements OnInit, OnDestroy {
  myForm: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  displayedColumns: string[] = ['seleccion', 'codigo', 'cuotas', 'monto'];
  dataSource = new MatTableDataSource<any>();
  // Columnas para la tabla "Inventario"
  displayedColumnsInventario: string[] = [
    'seleccion', 'cantidadSeleccionada',
    'concepto', 'cantidadEnvio',
    'cantidadRecibida', 'valorUnidad',
    'cantidadTotalVendida', 'PersonaEnvia',
    'PersonaRecibe', 'fechaRecibida'
  ];
  dataSourceInventario = new MatTableDataSource<any>();
  isInventarioVisible: boolean = false;
  concepto: string = '';
  historial_id: number = 0;
  rolUsuario: string = '';
  correoUsuario: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private autorizacionesService: AutorizacionesService,
    private mercadoService: MercadoService,
    private utilityServiceService: UtilityServiceService,
    private comercializadoraService: ComercializadoraService,
    private router: Router
  ) {
    // Creamos el FormGroup principal con dos FormArray vacíos (codigos e inventario)
    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
      codigos: this.fb.array([]),
      inventario: this.fb.array([]),
    });

    // Los dataSource se inicializan vacíos. Luego se llenan dinámicamente.
    this.dataSource = new MatTableDataSource<any>([]);
    this.dataSourceInventario = new MatTableDataSource<any>([]);
  }

  ngOnInit() {
    // Extraemos usuario actual
    const user = this.utilityServiceService.getUser();
    if (user) {
      this.rolUsuario = user.rol;
      this.correoUsuario = user.correo_electronico;
    }

    // Cargamos inventario de productos
    this.loadProductos();

    // Seteamos la suscripción a los cambios en el campo "cedula"
    this.setupFormValueChanges();
  }

  // Getters para acceder más fácil a los FormArray
  get codigosFormArray(): FormArray {
    return this.myForm.get('codigos') as FormArray;
  }
  get inventarioFormArray(): FormArray {
    return this.myForm.get('inventario') as FormArray;
  }

  private setupFormValueChanges() {
    this.myForm.get('cedula')?.valueChanges
      .pipe(
        debounceTime(1000),
        distinctUntilChanged(),
        switchMap(value => {
          this.trimField('cedula');
          return this.buscarOperario(value);
        }),
        catchError(() => of(null)),
        takeUntil(this.destroy$)
      )
      .subscribe((result: any) => {
        Swal.close(); // cierra la alerta de carga

        if (!result || result.datosbase === 'No se encontró el registro para el ID proporcionado') {
          this.datosOperario = null;
          this.mostrarError('No se encontró el empleado con la cédula proporcionada.');
          return;
        }

        // Si el resultado es correcto:
        this.datosOperario = result.datosbase[0];
        this.nombreOperario = `${this.datosOperario.nombre} `;

        // Validaciones extras
        if (!this.datosOperario.activo) {
          this.datosOperario = null;
          this.mostrarError('El empleado se encuentra retirado y no puede solicitar autorizaciones.');
          return;
        }

        if (this.datosOperario.bloqueado) {
          this.datosOperario = null;
          this.mostrarError('El empleado se encuentra bloqueado y no puede solicitar autorizaciones.');
          return;
        }

        // Cargamos las autorizaciones activas:
        this.autorizacionesService
          .traerAutorizacionesActivasOperario(this.datosOperario.numero_de_documento)
          .then((data: any) => {
            // "data.codigo" es un array con los objetos {codigo, cuotas, monto, ...}
            // Limpiamos el FormArray "codigos"
            this.codigosFormArray.clear();
            // Por cada item, creamos un FormGroup y lo añadimos al FormArray
            data.codigo.forEach((item: any) => {
              const grupo = this.fb.group({
                codigo: [item.codigo],
                cuotas: [item.cuotas],
                monto: [item.monto],
                seleccionado: [false], // checkbox
                historial_id: [item.historial_id],
              });
              this.codigosFormArray.push(grupo);
            });

            // Asignamos los controles al dataSource
            this.dataSource.data = this.codigosFormArray.controls;
          });

        // Si no es GERENCIA, verificamos saldo
        if (this.rolUsuario !== 'GERENCIA') {
          if (!this.autorizacionesService.verificarSaldo(this.datosOperario)) {
            this.datosOperario = null;
            this.mostrarError('El operario tiene saldos pendientes mayores a 175000.');
            return;
          }
        }
      });
  }

  private loadProductos() {
    this.utilityServiceService.traerInventarioProductos().subscribe(
      (data: any) => {
        const sedeUsuario = this.utilityServiceService.getUser().sucursalde;
        const userEmail = this.utilityServiceService.getUser().correo_electronico;

        // Filtramos según la lógica que tenías
        let productosFiltrados: any[] = [];
        if (userEmail === 'contaduria.rtc@gmail.com') {
          productosFiltrados = data.comercio.filter((producto: any) =>
            producto.cantidadRecibida !== producto.cantidadTotalVendida &&
            (producto.destino === 'ROSAL' || producto.destino === 'CARTAGENITA')
          );
        } else {
          productosFiltrados = data.comercio.filter((producto: any) =>
            producto.cantidadRecibida !== producto.cantidadTotalVendida &&
            producto.destino === sedeUsuario
          );
        }

        // Ordenar por fechaRecibida descendente
        productosFiltrados.sort(
          (a: any, b: any) =>
            new Date(b.fechaRecibida).getTime() - new Date(a.fechaRecibida).getTime()
        );

        // Limpiamos el FormArray "inventario"
        this.inventarioFormArray.clear();

        // Creamos un FormGroup por producto
        productosFiltrados.forEach(prod => {
          const g = this.fb.group({
            codigo: [prod.codigo],
            concepto: [prod.concepto],
            cantidadEnvio: [prod.cantidadEnvio],
            cantidadRecibida: [prod.cantidadRecibida],
            valorUnidad: [prod.valorUnidad],
            cantidadTotalVendida: [prod.cantidadTotalVendida],
            PersonaEnvia: [prod.PersonaEnvia],
            PersonaRecibe: [prod.PersonaRecibe],
            fechaRecibida: [prod.fechaRecibida],
            seleccionado: [false], // checkbox
            cantidadSeleccionada: new FormControl({ value: '1', disabled: true }) // Inicialmente deshabilitado
          });
          this.inventarioFormArray.push(g);
        });

        // Ahora "dataSourceInventario" mostrará cada control como una fila
        this.dataSourceInventario.data = this.inventarioFormArray.controls;
      },
      (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Hubo un error al cargar los productos',
        });
      }
    );
  }

  private trimField(fieldName: string) {
    const control = this.myForm.get(fieldName);
    if (control && control.value && typeof control.value === 'string') {
      control.setValue(control.value.trim());
    }
  }

  // Función para buscar operario
  buscarOperario(cedula: string): Observable<any> {
    if (!cedula) {
      return of(null);
    }
    // Mostrar Swal de carga
    Swal.fire({
      title: 'Buscando trabajador...',
      icon: 'info',
      text: 'Por favor, espera mientras se procesa la información.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    return this.autorizacionesService.traerOperarios(cedula).pipe(
      catchError(error => {
        Swal.close();
        this.mostrarError('Hubo un problema al buscar el operario. Intente nuevamente.');
        console.error('Error en la búsqueda:', error);
        return of(null);
      })
    );
  }

  mostrarError(mensaje: string) {
    Swal.fire({
      icon: 'error',
      title: 'Aviso',
      text: mensaje,
      showConfirmButton: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
  }

  applyFilterInventario(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceInventario.filterPredicate = (rowControl: any, filter: string) => {
      const rowValue = rowControl.value; // el objeto con {concepto, ...}
      // Busca coincidencia en los campos que desees:
      return (
        rowValue.concepto?.toLowerCase().includes(filter) ||
        rowValue.PersonaEnvia?.toLowerCase().includes(filter)
      );
    };
    this.dataSourceInventario.filter = filterValue.trim().toLowerCase();
  }

  async onSubmit() {
    try {
      // Extraer valores de los formularios
      const codigos = this.codigosFormArray.value;
      const inventario = this.inventarioFormArray.controls.map((control: any) => control.value);

      // Filtrar elementos seleccionados
      const codigosSeleccionados = codigos.filter((item: any) => item.seleccionado);
      const inventarioSeleccionados = this.inventarioFormArray.controls
        .filter((control: any) => control.get('seleccionado')?.value)
        .map((control: any) => ({
          ...control.value,
          cantidadSeleccionada: control.get('cantidadSeleccionada')?.value
            ? Math.max(1, parseInt(control.get('cantidadSeleccionada')?.value))
            : 1,
        }));

      // Validaciones iniciales
      if (codigosSeleccionados.length === 0) {
        this.mostrarError('Debe seleccionar al menos un código para continuar.');
        return;
      }

      if (inventarioSeleccionados.length === 0) {
        this.mostrarError('Debe seleccionar al menos un producto para continuar.');
        return;
      }

      this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);
      const codigoMOH = 'MOH' + Math.floor(Math.random() * 1000000);
      let valorTotal = 0;
      let concepto = 'Compra tienda respecto a: ';

      // Calcular el valor total teniendo en cuenta la cantidad seleccionada
      inventarioSeleccionados.forEach((item: any) => {
        valorTotal += parseFloat(item.valorUnidad) * item.cantidadSeleccionada;
        concepto += `${item.concepto} (x${item.cantidadSeleccionada}), `;
      });

      concepto = concepto.slice(0, -2) + ' en ' + this.utilityServiceService.getUser().sucursalde;

      // Calcular monto total de las autorizaciones seleccionadas
      const montoTotal = codigosSeleccionados.reduce((total: number, item: { monto: string; }) => total + parseFloat(item.monto), 0);

      // Validaciones de montos
      if (valorTotal > montoTotal) {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El valor total de los productos seleccionados supera el monto total de las autorizaciones.',
        });
        return;
      }

      if (this.rolUsuario != "GERENCIA") {
        if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, valorTotal, this.sumaPrestamos, "mercado")) {
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'No se cumplen las condiciones de verificación para el monto',
          });
          return;
        }

      }


      // ✅ Actualizar inventario de manera asincrónica
      try {
        await Promise.all(
          inventarioSeleccionados.map((item: any) =>
            this.comercializadoraService.ActualizarInventario(item.cantidadSeleccionada, item.codigo)
          )
        );
      } catch (error) {
        console.error('Error al actualizar inventario:', error);
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Hubo un error al realizar el cargue del inventario. Intente nuevamente.',
        });
        return;
      }

      // ✅ Ejecutar todas las autorizaciones de manera concurrente
      try {
        await Promise.all(
          codigosSeleccionados.map(async (codigo: { codigo: string; historial_id: number; }) => {
            const response = await this.mercadoService.ejecutarMercadoComercializadora(
              codigo.codigo,
              this.myForm.get('cedula')?.value,
              valorTotal,
              codigoMOH,
              concepto,
              codigo.historial_id
            );

            if (response.message !== "Actualización exitosa") {
              console.error(`Error en la ejecución del código ${codigo.codigo}:`, response);
              throw new Error(`Error en código ${codigo.codigo}`);
            }
          })
        );
        // ✅ Si todas las operaciones fueron exitosas, se muestra éxito y se espera la confirmación del usuario
        Swal.fire({
          icon: 'success',
          title: 'Proceso completado',
          text: 'Todas las autorizaciones y actualizaciones se han realizado con éxito.',
          confirmButtonText: 'Aceptar',
        }).then((result) => {
          if (result.isConfirmed) {
            this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
              this.router.navigate(["/dashboard/market/marketing-market"]);
            });
          }
        });
      } catch (error) {
        console.error('Error en la ejecución de las autorizaciones:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Hubo un problema con alguna autorización. Revise los detalles en consola.',
        });
      }

    } catch (error) {
      console.error('Error inesperado en onSubmit:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error inesperado',
        text: 'Ocurrió un error inesperado. Intente nuevamente.',
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  incrementarCantidad(index: number) {
    const formArray = this.myForm.get('inventario') as FormArray; // Cambiado a 'inventario'
    if (!formArray || index < 0 || index >= formArray.length) {
      console.error("Error: FormArray no existe o índice fuera de rango");
      return;
    }

    const row = formArray.at(index) as FormGroup;
    if (row.get('seleccionado')?.value) {
      let currentValue = row.get('cantidadSeleccionada')?.value || 0;
      row.get('cantidadSeleccionada')?.setValue(parseInt(currentValue) + 1);
    }
  }

  decrementarCantidad(index: number) {
    const formArray = this.myForm.get('inventario') as FormArray; // Cambiado a 'inventario'
    if (!formArray || index < 0 || index >= formArray.length) {
      console.error("Error: FormArray no existe o índice fuera de rango");
      return;
    }

    const row = formArray.at(index) as FormGroup;
    if (row.get('seleccionado')?.value) {
      let currentValue = row.get('cantidadSeleccionada')?.value || 0;
      if (currentValue > 1) { // Para evitar valores negativos
        row.get('cantidadSeleccionada')?.setValue(parseInt(currentValue) - 1);
      }
    }
  }

  toggleInventario() {
    this.isInventarioVisible = !this.isInventarioVisible;
  }

}
