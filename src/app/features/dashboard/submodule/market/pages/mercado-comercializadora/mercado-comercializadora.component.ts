import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidatorFn } from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { ComercializadoraService } from '../../../merchandise/service/comercializadora/comercializadora.service';
import { MercadoService } from '../../service/mercado/mercado.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { of, Observable, Subject } from 'rxjs';

@Component({
  selector: 'app-mercado-comercializadora',
  imports: [
    SharedModule
  ],
  templateUrl: './mercado-comercializadora.component.html',
  styleUrls: ['./mercado-comercializadora.component.css']
})
export class MercadoComercializadoraComponent implements OnInit {

  myForm!: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  productos: any[] = [];
  displayedColumnsInventario: string[] = [
    'codigo', 'concepto', 'destino', 'cantidadEnvio', 'cantidadRecibida',
    'valorUnidad', 'cantidadTotalVendida', 'PersonaEnvia', 'PersonaRecibe', 'fechaRecibida'
  ];
  dataSourceInventario = new MatTableDataSource<any>();
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
    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
      numProductos: ['', Validators.required],
      productos: this.fb.array([]),
      codigoAutorizacion: ['', Validators.required],
    });
  }

  ngOnInit() {
    let user = this.utilityServiceService.getUser();
    if (user) {
      this.rolUsuario = user.rol;
      this.correoUsuario = user.correo_electronico;
    }

    this.setupFormValueChanges();
    this.loadProductos();
  }

  private setupFormValueChanges() {
    this.myForm.get('cedula')?.valueChanges
      .pipe(
        debounceTime(1000), // Espera 1 segundo después del último cambio
        distinctUntilChanged(), // Evita búsquedas innecesarias si el usuario escribe el mismo valor
        switchMap(value => {
          this.trimField('cedula');
          return this.buscarOperario(value);
        }),
        catchError(() => of(null)), // Si hay error, simplemente no hace nada
        takeUntil(this.destroy$) // Limpia la suscripción cuando se destruye el componente
      )
      .subscribe(result => {
        Swal.close(); // 🔴 Cierra Swal de carga antes de mostrar cualquier error

        if (!result || result.datosbase === "No se encontró el registro para el ID proporcionado") {
          this.datosOperario = null;
          this.mostrarError('No se encontró el empleado con la cédula proporcionada.');
          return;
        }

        this.datosOperario = result.datosbase[0];
        this.nombreOperario = `${this.datosOperario.nombre} `;

        // 🔴 Validar si el operario está inactivo (retirado)
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

        if (this.rolUsuario !== "GERENCIA") {
          if (!this.autorizacionesService.verificarSaldo(this.datosOperario)) {
            this.datosOperario = null;
            this.mostrarError('El operario tiene saldos pendientes mayores a 175000.');
            return;
          }
        }
      });

    this.myForm.get('numProductos')?.valueChanges.subscribe(num => this.updateProductos(num));
  }

  private loadProductos() {
    this.utilityServiceService.traerInventarioProductos().subscribe(
      (data: any) => {
        const sedeUsuario = this.utilityServiceService.getUser().sucursalde;
        const userEmail = this.utilityServiceService.getUser().correo_electronico;

        // Filter products based on the user's email
        if (userEmail === 'contaduria.rtc@gmail.com') {
          this.productos = data.comercio.filter((producto: any) =>
            producto.cantidadRecibida !== producto.cantidadTotalVendida &&
            (producto.destino === 'ROSAL' || producto.destino === 'CARTAGENITA')
          );
        } else {
          this.productos = data.comercio.filter((producto: any) =>
            producto.cantidadRecibida !== producto.cantidadTotalVendida &&
            producto.destino === sedeUsuario
          );
        }

        // Sort products by received date
        this.productos.sort((a: any, b: any) => new Date(b.fechaRecibida).getTime() - new Date(a.fechaRecibida).getTime());

        // Update the data source
        this.dataSourceInventario.data = this.productos;
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

  private trimFormFields() {
    const trimControl = (control: AbstractControl) => {
      if (control && control.value && typeof control.value === 'string') {
        control.setValue(control.value.trim());
      }
    };

    const trimGroup = (group: FormGroup) => {
      Object.keys(group.controls).forEach(field => {
        const control = group.get(field);
        if (control) {
          if (control instanceof FormArray) {
            control.controls.forEach(arrayControl => {
              if (arrayControl instanceof FormGroup) {
                trimGroup(arrayControl);
              } else {
                trimControl(arrayControl);
              }
            });
          } else {
            trimControl(control);
          }
        }
      });
    };

    trimGroup(this.myForm);
  }

  async onSubmit() {
    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    const formValues = this.myForm.value;

    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espera mientras se realiza la operación.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

      const codigoMOH = 'MOH' + Math.floor(Math.random() * 1000000);
      let valorTotal = 0;
      let concepto = 'Compra tienda respecto a: ';

      // Recorrer productos y acumular el valor total
      for (let i = 0; i < formValues.productos.length; i++) {
        const codigoComercioLimpio = formValues.productos[i].codigoComercio.replace(/\s+/g, '');
        const producto = this.comercializadoraService.traerComercializadoraPorCodigo(this.productos, codigoComercioLimpio);

        if (!producto) {
          Swal.close();
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Producto no encontrado',
          });
          return;
        }

        valorTotal += parseInt(producto.valorUnidad) * parseInt(formValues.productos[i].cantidad);
        concepto += producto.concepto + ', ';

        if ((parseInt(producto.cantidadTotalVendida) + parseInt(formValues.productos[i].cantidad)) > parseInt(producto.cantidadRecibida)) {
          Swal.close();
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: `La cantidad de productos a comprar supera la cantidad disponible en inventario del producto ${producto.codigoComercio}`,
          });
          return;
        }
      }

      concepto = concepto.slice(0, -2) + ' en ' + this.utilityServiceService.getUser().sucursalde;

      const codigoAutorizacionLimpio = formValues.codigoAutorizacion.replace(/\s+/g, '');
      const data = await this.autorizacionesService.buscarCodigo(codigoAutorizacionLimpio);

      if (data.codigo.length === 0) {
        Swal.close();
        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El código no existe',
        });
        return;
      }

      if (data.codigo[0].estado === false) {
        Swal.close();
        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El código ya ha sido utilizado',
        });
        return;
      }

      const cedulaValida = await this.utilityServiceService.verificarCedulaCodigo(formValues.codigoAutorizacion, formValues.cedula).toPromise();
      if (cedulaValida === "false") {
        Swal.close();
        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'El código no pertenece a la cédula proporcionada',
        });
        return;
      }

      if (this.rolUsuario != "GERENCIA") {
        if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, parseInt(formValues.valor), this.sumaPrestamos, "mercado")) {
          Swal.close();
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'No se cumplen las condiciones de verificación para el monto',
          });
          return;
        }

        if (!this.utilityServiceService.verificarMontoCodigo(data, parseInt(formValues.valor))) {
          Swal.close();
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'El monto escrito supera el monto del código',
          });
          return;
        }
      }

      // Actualizar inventario
      for (let i = 0; i < formValues.productos.length; i++) {
        await this.comercializadoraService.ActualizarInventario(
          formValues.productos[i].cantidad,
          formValues.productos[i].codigoComercio
        ).catch(async (error) => {
          Swal.close();
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
          return;
        });
      }

      const response = await this.mercadoService.ejecutarMercadoComercializadora(
        formValues.codigoAutorizacion,
        formValues.cedula,
        valorTotal,
        codigoMOH,
        concepto,
        data.codigo[0].historial
      );

      Swal.close();

      if (response.message === "Actualización exitosa") {
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Se ha cargado el mercado exitosamente',
          confirmButtonText: 'Aceptar'
        }).then(() => {
          this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
            this.router.navigate(["/dashboard/market/marketing-market"]);
          });
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Error en la actualización',
        });
      }
    } catch (error) {
      Swal.close();

      await Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Ocurrió un error inesperado. Intente nuevamente.',
      });
    }
  }


  // Función para buscar operario
  // Función para buscar operario
  buscarOperario(cedula: string): Observable<any> {
    if (!cedula) {
      return of(null); // Evita hacer la solicitud si la cédula está vacía
    }

    // 🔵 Mostrar Swal de carga
    Swal.fire({
      title: 'Buscando trabajador...',
      text: 'Por favor, espera mientras se procesa la información.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    return this.autorizacionesService.traerOperarios(cedula).pipe(
      catchError(error => {
        Swal.close(); // 🔴 Cierra Swal en caso de error
        this.mostrarError('Hubo un problema al buscar el operario. Intente nuevamente.');
        console.error('Error en la búsqueda:', error);
        return of(null); // Evita que la aplicación falle
      })
    );
  }

  // 🔵 Función para mostrar errores sin bloquear la interfaz
  mostrarError(mensaje: string) {
    Swal.fire({
      icon: 'error',
      title: 'Aviso',
      text: mensaje,
      showConfirmButton: true, // Muestra un botón para cerrar
      allowOutsideClick: false, // Evita que se cierre al hacer clic fuera
      allowEscapeKey: false, // Evita que se cierre con la tecla Esc
    });
  }


  // 🔹 Limpieza de suscripción al destruir el componente
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }


  applyFilterInventario(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceInventario.filter = filterValue.trim().toLowerCase();
  }

  get productosForm(): FormArray {
    return this.myForm.get('productos') as FormArray;
  }

  addProducto() {
    const productoForm = this.fb.group({
      codigoComercio: ['', [Validators.required, this.noWhitespaceValidator()]],
      cantidad: ['', [Validators.required]],
    });
    this.productosForm.push(productoForm);
  }

  updateProductos(num: number) {
    while (this.productosForm.length !== 0) {
      this.productosForm.removeAt(0);
    }
    for (let i = 0; i < num; i++) {
      this.addProducto();
    }
  }

  noWhitespaceValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const isWhitespace = (control.value || '').trim().length === 0;
      const isValid = !isWhitespace;
      return isValid ? null : { 'whitespace': true };
    };
  }

  trackByIndex(index: number, item: any): any {
    return index;
  }

}
