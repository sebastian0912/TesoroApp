import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { SharedModule } from '../../../../../../shared/shared.module';
import { MercadoService } from '../../service/mercado/mercado.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { ComercializadoraService } from '../../../merchandise/service/comercializadora/comercializadora.service';

@Component({
  selector: 'app-cargar-mercado-ferias',
  imports: [
    SharedModule
  ],
  templateUrl: './cargar-mercado-ferias.component.html',
  styleUrl: './cargar-mercado-ferias.component.css'
})
export class CargarMercadoFeriasComponent implements OnInit {
  myForm!: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  showValor = false;
  showCuotas = false;
  celularLabel = 'Número';
  productos: any[] = [];

  displayedColumnsInventario: string[] = ['codigo', 'concepto', 'destino', 'cantidadEnvio',
    'cantidadRecibida', 'valorUnidad', 'cantidadTotalVendida', 'PersonaEnvia', 'PersonaRecibe',
    'fechaRecibida'];

  dataSourceInventario = new MatTableDataSource<any>();

  concepto: string = '';
  comercio: string = '';

  historial_id: number = 0;
  usuario: any;

  datos2: string[] = [
    "Pollo Suba",
    "Pollo Luz Dary",
    "Embutidos Luz Dary",
    "Emb carmen",
    "Fruver",
    "Fruver Carmen",
    "Embutidos",
    "Carne",
    "Babuchas",
    "Otro"
  ];

  rolUsuario: string = '';
  correoUsuario: string = '';

  constructor(
    private fb: FormBuilder,
    private autorizacionesService: AutorizacionesService,
    private mercadoService: MercadoService,
    private comercializadoraService: ComercializadoraService,
    private utilityServiceService: UtilityServiceService,
    private router: Router
  ) {

    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
      cuotas: ['', [Validators.min(1), Validators.max(2)]],
      valor: ['', [Validators.required, this.currencyValidator]],
      concepto: [''],
      otroConcepto: [''],
      formaPago: ['', Validators.required],
      celular: [''],
      comercio: [''],
      codigoComercio: [''],
      cantidad: [''],
    });

    this.myForm.get('concepto')?.valueChanges.subscribe(value => {
      this.concepto = value;
      if (value !== 'Otro') {
        this.myForm.get('otroConcepto')?.setValue('');
      }
    });

    this.myForm.get('comercio')?.valueChanges.subscribe(value => {
      this.comercio = value;
      this.updateValidators(value);
    });

  }

  async ngOnInit() {
    try {
      // Mostrar swal de carga
      Swal.fire({
        title: 'Cargando datos...',
        text: 'Por favor, espera un momento.',
        icon: 'info',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Obtener usuario desde el servicio
      this.usuario = this.utilityServiceService.getUser();
      if (this.usuario) {
        this.rolUsuario = this.usuario.rol;
        this.correoUsuario = this.usuario.correo;
      }

      // Suscribirse a los cambios de "formaPago"
      this.myForm.get('formaPago')?.valueChanges.subscribe(value => {
        const celularControl = this.myForm.get('celular');
        if (value === 'Daviplata' || value === 'Master') {
          celularControl?.setValidators([Validators.required, Validators.pattern(/^\d{10}$/)]);
        } else {
          celularControl?.clearValidators();
        }
        celularControl?.updateValueAndValidity();
      });

      // Llamar datos de la comercializadora
      const data: any = await this.utilityServiceService.traerInventarioProductos().toPromise();
      const sedeUsuario = this.utilityServiceService.getUser().sucursalde;

      if (data && data.comercio) {
        // Filtrar productos según sede y disponibilidad
        this.productos = data.comercio.filter((producto: any) =>
          producto.cantidadRecibida !== producto.cantidadTotalVendida &&
          producto.destino === sedeUsuario
        );

        // Ordenar de mayor a menor por fechaRecibida
        this.productos.sort((a: any, b: any) =>
          new Date(b.fechaRecibida).getTime() - new Date(a.fechaRecibida).getTime()
        );

        // Asignar datos al dataSource
        this.dataSourceInventario.data = this.productos;
      }

      // Cerrar swal de carga al finalizar exitosamente
      Swal.close();
    } catch (error) {
      // Mostrar error con Swal
      Swal.fire({
        title: 'Error',
        text: 'No se pudieron cargar los datos. Inténtalo de nuevo.',
        icon: 'error'
      });
    }
  }



  formatCurrency(event: any) {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    value = Number(value).toLocaleString();
    input.value = value;
  }

  currencyValidator(control: AbstractControl) {
    const value = control.value.replace(/\D/g, '');
    return value ? null : { required: true };
  }

  // Función para enviar el formulario
  async onSubmit() {
    let codigoOH: string = '';
    let codigoMOH: string = '';
    let concepto: string = 'Mercado';
    let conceptoMOH: string = '';

    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    // 🔵 Mostrar Swal de carga antes de iniciar la lógica
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

    // Usamos un try-catch para manejar cualquier error global
    try {
      const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };
      this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

      // Validar condiciones si el usuario no es GERENCIA y no es lola@gmail.com
      if (this.correoUsuario !== "lola@gmail.com" && this.rolUsuario !== "GERENCIA") {
        if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, parseInt(formValues.valor), this.sumaPrestamos, "mercado")) {
          Swal.close();
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'No se cumplen las condiciones de verificación para el monto',
          });
          return;
        }
      }

      let cuotasAux = formValues.cuotas;

      // Generar código que no exista
      while (true) {
        codigoOH = 'M' + Math.floor(Math.random() * 1000000);
        try {
          const data = await this.autorizacionesService.buscarCodigo(codigoOH);
          if (data.codigo.length === 0) {
            break; // Salir del bucle si el código no existe
          }
        } catch (error) {
          break; // Salir del bucle si hay un error en la solicitud
        }
      }

      // Creamos un segundo código
      codigoMOH = 'MOH' + Math.floor(Math.random() * 1000000);

      // Si el comercio es "si", se maneja la lógica de comercializadora
      if (formValues.comercio === "si") {
        const producto = this.comercializadoraService.traerComercializadoraPorCodigo(this.productos, formValues.codigoComercio);

        // Validar que el producto exista
        if (!producto) {
          Swal.close();
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Producto no encontrado',
          });
          return;
        }

        const valorTotal = parseInt(producto.valorUnidad) * parseInt(formValues.cantidad);

        conceptoMOH = "Compra tienda de Ferias respecto a : " + producto.concepto + " en " + this.utilityServiceService.getUser().sucursalde;

        // Escritura en historial
        const historialData = await this.autorizacionesService.escribirHistorial(
          formValues.cedula,
          valorTotal,
          cuotasAux,
          "Autorizacion de Mercado",
          codigoOH,
          this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido
        );

        // Asignar historial_id a la variable de clase (o local, según tu lógica)
        this.historial_id = historialData.historial_id;

        // Escritura de código
        await this.autorizacionesService.escribirCodigo(
          formValues.cedula,
          String(valorTotal),
          codigoOH,
          cuotasAux,
          "Autorizacion de Mercado",
          this.historial_id,
          this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido,
          this.usuario.numero_de_documento
        );

        // Actualizar inventario
        await this.comercializadoraService.ActualizarInventario(
          formValues.cantidad,
          formValues.codigoComercio
        ).catch(async error => {
          Swal.close();
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
          return; // Importante para no continuar la ejecución en caso de error
        });

        // Ejecutar mercado en comercializadora
        const response = await this.mercadoService.ejecutarMercadoComercializadora(
          codigoOH,
          formValues.cedula,
          valorTotal,
          codigoMOH,
          conceptoMOH,
          this.historial_id
        );

        Swal.close();

        if (response.message === "Actualización exitosa") {
          await Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: 'El préstamo ha sido cargado exitosamente',
            confirmButtonText: 'Aceptar'
          });
          // Redirección
          this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
            this.router.navigate(["/dashboard/market/load-fair-market"]);
          });
        } else {
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
        }

        // Generar PDF
        this.autorizacionesService.generatePdf(
          this.datosOperario,
          valorTotal,
          String(valorTotal),
          formValues.formaPago || '',
          formValues.celular || '',
          codigoOH,
          cuotasAux,
          "Mercado",
          this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido,
        );
        return; // Sale de la función, porque ya terminaste el caso "comercio = si"
      }

      // Escritura en historial
      const historialData = await this.autorizacionesService.escribirHistorial(
        formValues.cedula,
        parseInt(formValues.valor),
        cuotasAux,
        "Autorizacion de Mercado",
        codigoOH,
        this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido
      );

      this.historial_id = historialData.historial_id;

      // Escritura de código
      await this.autorizacionesService.escribirCodigo(
        formValues.cedula,
        formValues.valor,
        codigoOH,
        cuotasAux,
        "Autorizacion de Mercado",
        this.historial_id,
        this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido,
        this.usuario.numero_de_documento
      );

      // Se crea un concepto para MOH
      conceptoMOH = "Compra tienda de Ferias respecto a : " + formValues.concepto + " en " + this.utilityServiceService.getUser().sucursalde;
      if (formValues.concepto === 'Otro') {
        conceptoMOH = "Compra tienda de Ferias respecto a : " + formValues.otroConcepto + " en " + this.utilityServiceService.getUser().sucursalde;
      }

      // Ejecutar mercado en tienda
      const responseTienda = await this.mercadoService.ejecutarMercadoTienda(
        codigoOH,
        formValues.cedula,
        parseInt(formValues.valor),
        codigoMOH,
        conceptoMOH,
        this.historial_id
      );

      Swal.close();

      if (responseTienda.message === "Actualización exitosa") {
        await Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'El préstamo ha sido cargado exitosamente',
          confirmButtonText: 'Aceptar'
        });
        this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
          this.router.navigate(["/dashboard/market/load-fair-market"]);
        });
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
        });
      }

      // Generar PDF
      this.autorizacionesService.generatePdf(
        this.datosOperario,
        formValues.valor,
        formValues.valor,
        formValues.formaPago || '',
        formValues.celular || '',
        codigoOH,
        cuotasAux,
        "Mercado",
        this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido,
      );

    } catch (error) {
      Swal.close();
      await Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
      });
    }
  }




  // Función para buscar operario
  // Función para buscar operario
  buscarOperario() {
    // si cedula no es válida
    if (this.myForm.value.cedula === '') {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, ingrese una cédula válida.',
      });
      this.myForm.markAllAsTouched();
      return;
    }

    Swal.fire({
      title: 'Buscando trabajador...',
      icon: 'info',
      text: 'Por favor, espera mientras se procesa la información.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.autorizacionesService.traerOperarios(this.myForm.value.cedula).subscribe(
      (data: any) => {
        Swal.close();

        // Validar si el operario existe
        if (data.datosbase === "No se encontró el registro para el ID proporcionado") {
          this.datosOperario = null;
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'No se encontró el empleado con la cédula proporcionada',
            showConfirmButton: true, // Muestra un botón para cerrar
            allowOutsideClick: false, // Evita que se cierre al hacer clic fuera
            allowEscapeKey: false, // Evita que se cierre con la tecla Esc
          });
          return;
        }
        // 🔵 Función para mostrar errores sin permitir que el usuario cierre el Swal fuera de él


        this.datosOperario = data.datosbase[0];
        this.nombreOperario = `${this.datosOperario.nombre} `;

        if (!this.datosOperario.activo) {
          this.datosOperario = null;
          Swal.fire({
            icon: 'error',
            title: 'Empleado retirado',
            text: 'El empleado con la cédula proporcionada se encuentra retirado y no puede solicitar autorizaciones.',
            showConfirmButton: true, // Muestra un botón para cerrar
            allowOutsideClick: false, // Evita que se cierre al hacer clic fuera
            allowEscapeKey: false, // Evita que se cierre con la tecla Esc
          });
          return;
        }

        if (this.datosOperario.bloqueado) {
          this.datosOperario = null;
          Swal.fire({
            icon: 'error',
            title: 'Empleado bloqueado',
            text: 'El empleado con la cédula proporcionada se encuentra bloqueado y no puede solicitar autorizaciones.',
            showConfirmButton: true, // Muestra un botón para cerrar
            allowOutsideClick: false, // Evita que se cierre al hacer clic fuera
            allowEscapeKey: false, // Evita que se cierre con la tecla Esc
          });
          return;
        }

        if (this.rolUsuario !== "GERENCIA") {
          // Validar si el operario tiene saldos pendientes mayores a 175000
          if (!this.autorizacionesService.verificarSaldo(this.datosOperario)) {
            this.datosOperario = null;
            Swal.fire({
              icon: 'error',
              title: 'Saldo pendiente',
              text: 'El empleado con la cédula proporcionada tiene saldos pendientes mayores a $175.000 y no puede solicitar autorizaciones.',
              showConfirmButton: true, // Muestra un botón para cerrar
              allowOutsideClick: false, // Evita que se cierre al hacer clic fuera
              allowEscapeKey: false, // Evita que se cierre con la tecla Esc
            });
            return;
          }
        }
      },
      (error: any) => {
        Swal.close();

        Swal.fire({
          icon: 'error',
          title: 'Error de conexión',
          text: 'Hubo un problema al buscar el operario. Intente nuevamente.',
        });
      }
    );
  }

  onFormaPagoChange(event: any) {
    const formaPago = event.value;
    if (formaPago === "Daviplata") {
      this.celularLabel = "Número de Daviplata";
    } else if (formaPago === "Master") {
      this.celularLabel = "Número de tarjeta Master";
    } else if (formaPago === "Efectivo") {
      this.celularLabel = "Número";
    } else {
      this.celularLabel = "Número de cuenta";
    }
  }


  updateValidators(comercio: string) {
    const codigoComercioControl = this.myForm.get('codigoComercio');
    const cantidadControl = this.myForm.get('cantidad');
    const valorControl = this.myForm.get('valor');

    if (comercio === 'si') {
      codigoComercioControl?.setValidators([Validators.required]);
      cantidadControl?.setValidators([Validators.required]);
      valorControl?.clearValidators();
      valorControl?.setValue('');
    } else if (comercio === 'no') {
      cantidadControl?.clearValidators();
      codigoComercioControl?.clearValidators();
      valorControl?.setValidators([Validators.required, this.currencyValidator]);
    } else {
      codigoComercioControl?.clearValidators();
      cantidadControl?.clearValidators();
      valorControl?.setValidators([Validators.required, this.currencyValidator]);
    }

    codigoComercioControl?.updateValueAndValidity();
    cantidadControl?.updateValueAndValidity();
    valorControl?.updateValueAndValidity();
  }




  applyFilterInventario(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceInventario.filter = filterValue.trim().toLowerCase();
  }

}
