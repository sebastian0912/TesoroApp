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
  standalone: true,
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




    const formValues = { ...this.myForm.value, valor: this.myForm.value.valor.replace(/\D/g, '') };

    this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

    if (this.correoUsuario !== "lola@gmail.com" && this.rolUsuario !== "GERENCIA") {
      if (!this.autorizacionesService.verificarCondiciones(this.datosOperario, parseInt(formValues.valor), this.sumaPrestamos, "mercado")) {
        return;
      }
    }

    let cuotasAux = formValues.cuotas;

    // Generar codigo que no exista
    while (true) {
      codigoOH = 'M' + Math.floor(Math.random() * 1000000);

      try {
        const data = await this.autorizacionesService.buscarCodigo(codigoOH);
        if (data.codigo.length === 0) {
          break;  // Salir del bucle si el código no existe
        }
      } catch (error) {
        break;  // Salir del bucle si hay un error en la solicitud
      }
    }

    try {
      codigoMOH = 'MOH' + Math.floor(Math.random() * 1000000);

      if (formValues.comercio === "si") {
        const producto = this.comercializadoraService.traerComercializadoraPorCodigo(this.productos, formValues.codigoComercio);

        conceptoMOH = "Compra tienda de Ferias respecto a : " + producto.concepto + " en " + this.utilityServiceService.getUser().sucursalde;
        let valorTotal = parseInt(producto.valorUnidad) * parseInt(formValues.cantidad);

        const historialData = await this.autorizacionesService.escribirHistorial(
          formValues.cedula,
          valorTotal,
          cuotasAux,
          "Autorizacion de Mercado",
          codigoOH,
          this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido
        );

        // Asegúrate de que `this.historial_id` se asigne correctamente
        this.historial_id = historialData.historial_id;

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
        ).then(response => {
        }).catch(error => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
        });


        // Actualiza los datos del codigo, los datos del historial y los datos de datos
        await this.mercadoService.ejecutarMercadoComercializadora(
          codigoOH,
          formValues.cedula,
          valorTotal,
          codigoMOH,
          conceptoMOH,
          this.historial_id
        )
          .then(response => {
            if (response.message == "Actualización exitosa") {
              // Termino el proceso
              Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: 'El préstamo ha sido cargado exitosamente',
                confirmButtonText: 'Aceptar'
              }).then(() => {
                this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
                  this.router.navigate(["/dashboard/market/load-fair-market"]);
                });
              });
            } else {
              Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
              });
            }
          })
          .catch(error => {

            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
            });
          });

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

        return;

      }

      // cuando el comercio es no
      const historialData = await this.autorizacionesService.escribirHistorial(
        formValues.cedula,
        parseInt(formValues.valor),
        cuotasAux,
        "Autorizacion de Mercado",
        codigoOH,
        this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido
      );

      this.historial_id = historialData.historial_id;

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

      conceptoMOH = "Compra tienda de Ferias respecto a : " + formValues.concepto + " en " + this.utilityServiceService.getUser().sucursalde;
      if (formValues.concepto === 'Otro') {
        conceptoMOH = "Compra tienda de Ferias respecto a : " + formValues.otroConcepto + " en " + this.utilityServiceService.getUser().sucursalde;
      }

      await this.mercadoService.ejecutarMercadoTienda(
        codigoOH,
        formValues.cedula,
        parseInt(formValues.valor),
        codigoMOH,
        conceptoMOH,
        this.historial_id
      )
        .then(response => {
          if (response.message == "Actualización exitosa") {
            // Termino el proceso
            Swal.fire({
              icon: 'success',
              title: '¡Éxito!',
              text: 'El préstamo ha sido cargado exitosamente',
              confirmButtonText: 'Aceptar'
            }).then(() => {
              this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
                this.router.navigate(["/dashboard/market/load-fair-market"]);
              });
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
            });
          }
        })
        .catch(error => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
        });
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
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
      });
    }
  }



  // Función para buscar operario
  buscarOperario() {
    this.autorizacionesService.traerOperarios(this.myForm.value.cedula).subscribe(
      (data: any) => {
        if (data.datosbase === "No se encontró el registro para el ID proporcionado") {
          this.datosOperario = null;
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'No se encontró el empleado con la cedula proporcionado',
          });
          return;
        }

        this.datosOperario = data.datosbase[0];
        this.nombreOperario = `${this.datosOperario.nombre} `;

        if (this.rolUsuario != "GERENCIA") {
          // Validar si el operario tiene saldos pendientes mayores a 175000
          if (!this.autorizacionesService.verificarSaldo(this.datosOperario) == true) {
            this.datosOperario = null;
          }
        }

      },
      (error: any) => {
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
