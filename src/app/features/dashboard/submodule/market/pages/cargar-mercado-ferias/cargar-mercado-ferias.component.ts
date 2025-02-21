import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, FormArray } from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { SharedModule } from '../../../../../../shared/shared.module';
import { MercadoService } from '../../service/mercado/mercado.service';
import { AutorizacionesService } from '../../../authorizations/services/autorizaciones/autorizaciones.service';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { ComercializadoraService } from '../../../merchandise/service/comercializadora/comercializadora.service';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-cargar-mercado-ferias',
  imports: [
    SharedModule, MatCheckboxModule
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
  selectedProducts: any[] = []; // Productos seleccionados con checkbox

  displayedColumnsInventario: string[] = [
    'select', 'cantidadSeleccionada',
    'concepto', 'cantidadEnvio',
    'cantidadRecibida', 'valorUnidad',
    'cantidadTotalVendida', 'PersonaEnvia',
    'PersonaRecibe', 'fechaRecibida'];

  dataSourceInventario = new MatTableDataSource<any>();

  concepto: string = '';
  comercio: string = '';

  historial_id: number = 0;
  usuario: any;
  conceptos: any

  datos2: string[] = [
    "Mercado",
    "Pollo Suba",
    "Pollo Luz Dary",
    "Embutidos Luz Dary",
    "Emb carmen",
    "Fruver",
    "Fruver Carmen",
    "Embutidos",
    "Carne",
    "Babuchas",
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


  currencyValidator(control: AbstractControl) {
    const value = control.value.replace(/\D/g, '');
    return value ? null : { required: true };
  }

  // Función para enviar el formulario
  async onSubmit() {
    // Variables para almacenar códigos y conceptos
    let codigoOH: string = '';
    let codigoMOH: string = '';
    let conceptoMOH: string = '';
    const concepto = 'Mercado'; // Puedes cambiarlo si necesitas otro valor por defecto

    // 1. Validar el formulario
    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    // 2. Mostrar Swal de carga antes de iniciar la lógica
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

    // 3. Iniciar bloque try-catch para capturar errores globales
    try {
      // 3.1 Obtener valores del formulario, quitando caracteres no numéricos de 'valor'
      const formValues = {
        ...this.myForm.value,
        valor: this.myForm.value.valor.replace(/\D/g, '')
      };

      // 3.2 Calcular saldo pendiente del operario (si aplica en tu lógica)
      this.sumaPrestamos = this.autorizacionesService.traerSaldoPendiente(this.datosOperario);

      // 3.3 Validar condiciones si no es GERENCIA ni "lola@gmail.com"
      if (this.correoUsuario !== 'lola@gmail.com' && this.rolUsuario !== 'GERENCIA') {
        const verifica = this.autorizacionesService.verificarCondiciones(
          this.datosOperario,
          parseInt(formValues.valor),
          this.sumaPrestamos,
          'mercado'
        );
        if (!verifica) {
          return;
        }
      }

      // 3.4 Generar código 'codigoOH' que no exista en base de datos
      while (true) {
        codigoOH = 'M' + Math.floor(Math.random() * 1000000);
        try {
          const data = await this.autorizacionesService.buscarCodigo(codigoOH);
          if (data.codigo.length === 0) {
            // Si el código no existe, salimos del bucle
            break;
          }
        } catch (error) {
          // Si hay error en la solicitud, salimos igual
          break;
        }
      }

      // 3.5 Generar segundo código 'codigoMOH'
      codigoMOH = 'MOH' + Math.floor(Math.random() * 1000000);

      // 4. Si el concepto seleccionado es "Mercado", manejar la lógica de la comercializadora
      if (formValues.concepto === 'Mercado') {
        const valorTotal = formValues.valor; // Ya está limpio de caracteres no numéricos

        // 4.1 Generar la descripción de los productos seleccionados (nombre + cantidad)
        const conceptoProductos = this.selectedProducts
          .map((p) => `${p.concepto} (x${p.cantidadSeleccionada})`)
          .join(', ');

        // 4.2 Construir el mensaje final del concepto
        conceptoMOH = `Compra tienda de Ferias respecto a: ${conceptoProductos} en ${this.utilityServiceService.getUser().sucursalde}`;

        // 4.3 Escribir en historial
        const historialData = await this.autorizacionesService.escribirHistorial(
          formValues.cedula,
          valorTotal,
          formValues.cuotas,
          'Autorizacion de Mercado',
          codigoOH,
          this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido
        );

        this.historial_id = historialData.historial_id;

        // 4.4 Escribir código
        await this.autorizacionesService.escribirCodigo(
          formValues.cedula,
          String(valorTotal),
          codigoOH,
          formValues.cuotas,
          'Autorizacion de Mercado',
          this.historial_id,
          this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido,
          this.usuario.numero_de_documento
        );

        // 4.5 Actualizar inventario para cada producto seleccionado
        for (const product of this.selectedProducts) {
          console.log('Actualizando inventario para', product);
          // cantidadSeleccionada tiene que ser string para la API
          product.cantidadSeleccionada = String(product.cantidadSeleccionada);
          await this.comercializadoraService
            .ActualizarInventario(product.cantidadSeleccionada, product.codigo)
            .catch(async (error) => {
              Swal.close();
              await Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: `Hubo un error al actualizar el inventario para ${product.concepto}, por favor intente de nuevo.`,
              });
              return;
            });
        }

        // 4.6 Ejecutar la lógica de mercado en la comercializadora
        const response = await this.mercadoService.ejecutarMercadoComercializadora(
          codigoOH,
          formValues.cedula,
          valorTotal,
          codigoMOH,
          conceptoMOH,
          this.historial_id
        );

        // 4.7 Cerrar el Swal de carga
        Swal.close();

        // 4.8 Verificar respuesta
        if (response.message === 'Actualización exitosa') {
          await Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: 'El préstamo ha sido cargado exitosamente',
            confirmButtonText: 'Aceptar',
          });
          // Redirección
          this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
            this.router.navigate(['/dashboard/market/load-fair-market']);
          });
        } else {
          await Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
          });
        }

        // 4.9 Generar PDF
        this.autorizacionesService.generatePdf(
          this.datosOperario,
          valorTotal,
          String(valorTotal),
          formValues.formaPago || '',
          formValues.celular || '',
          codigoOH,
          formValues.cuotas,
          'Mercado',
          this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido
        );

        return; // Termina la ejecución porque ya procesaste el caso de "Mercado"
      }

      // 5. Si NO es "Mercado", procesar la lógica estándar
      const valorNormal = parseInt(formValues.valor);

      // 5.1 Escribir en historial
      const historialData = await this.autorizacionesService.escribirHistorial(
        formValues.cedula,
        valorNormal,
        formValues.cuotas,
        'Autorizacion de Mercado',
        codigoOH,
        this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido
      );
      this.historial_id = historialData.historial_id;

      // 5.2 Escribir código
      await this.autorizacionesService.escribirCodigo(
        formValues.cedula,
        String(valorNormal),
        codigoOH,
        formValues.cuotas,
        'Autorizacion de Mercado',
        this.historial_id,
        this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido,
        this.usuario.numero_de_documento
      );

      // 5.3 Construir el mensaje para MOH
      conceptoMOH = `Compra tienda de Ferias respecto a : ${formValues.concepto} en ${this.utilityServiceService.getUser().sucursalde}`;
      if (formValues.concepto === 'Otro') {
        conceptoMOH = `Compra tienda de Ferias respecto a : ${formValues.otroConcepto} en ${this.utilityServiceService.getUser().sucursalde}`;
      }

      // 5.4 Ejecutar en tienda
      const responseTienda = await this.mercadoService.ejecutarMercadoTienda(
        codigoOH,
        formValues.cedula,
        valorNormal,
        codigoMOH,
        conceptoMOH,
        this.historial_id
      );

      // 5.5 Cerrar Swal de carga
      Swal.close();

      // 5.6 Validar respuesta
      if (responseTienda.message === 'Actualización exitosa') {
        await Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'El préstamo ha sido cargado exitosamente',
          confirmButtonText: 'Aceptar',
        });
        this.router.navigateByUrl('/dashboard', { skipLocationChange: true }).then(() => {
          this.router.navigate(['/dashboard/market/load-fair-market']);
        });
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
        });
      }

      // 5.7 Generar PDF
      this.autorizacionesService.generatePdf(
        this.datosOperario,
        valorNormal,
        String(valorNormal),
        formValues.formaPago || '',
        formValues.celular || '',
        codigoOH,
        formValues.cuotas,
        'Mercado',
        this.usuario.primer_nombre + ' ' + this.usuario.primer_apellido,
      );

    } catch (error) {
      // 6. Manejo de errores global
      Swal.close();
      await Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
      });
    }
  }


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


  applyFilterInventario(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceInventario.filter = filterValue.trim().toLowerCase();
  }

  incrementarCantidad(element: any) {
    if (!element.seleccionado) return; // Solo si está seleccionado

    if (!element.cantidadSeleccionada) {
      element.cantidadSeleccionada = 1; // La cantidad mínima es 1
    } else {
      element.cantidadSeleccionada++;
    }

    this.updateTotalValue();
  }

  decrementarCantidad(element: any) {
    if (!element.seleccionado) return; // Solo si está seleccionado

    if (element.cantidadSeleccionada && element.cantidadSeleccionada > 1) {
      element.cantidadSeleccionada--;
    }

    this.updateTotalValue();
  }

  // Método para manejar la selección del checkbox
  onProductSelectionChange(product: any, event: any) {
    product.seleccionado = event.checked;

    if (product.seleccionado) {
      product.cantidadSeleccionada = 1; // La cantidad mínima es 1
      if (!this.selectedProducts.includes(product)) {
        this.selectedProducts.push(product);
      }
    } else {
      product.cantidadSeleccionada = 0; // Resetear cantidad al desmarcar
      this.selectedProducts = this.selectedProducts.filter(p => p !== product);
    }

    this.updateTotalValue();
  }

  // Actualiza el total en el campo 'valor' y lo formatea con separadores de miles
  updateTotalValue() {
    const total = this.selectedProducts.reduce((sum, product) =>
      sum + (parseFloat(product.valorUnidad) * (product.cantidadSeleccionada || 0)), 0
    );
    // cuotas 2
    if (this.selectedProducts.length > 0) {
      this.myForm.get('cuotas')?.setValue(2);
    } else {
      this.myForm.get('cuotas')?.setValue('');
    }

    // Aplicar formato antes de asignar el valor
    this.formatCurrencyFromNumber(total);
  }

  // Formatea el número al escribir en el input
  formatCurrency(event: any) {
    let value = event.target.value.replace(/\D/g, ""); // Elimina caracteres no numéricos
    let numericValue = parseFloat(value) || 0;

    this.formatCurrencyFromNumber(numericValue);
  }

  // Formatea el número y lo asigna al campo "valor"
  formatCurrencyFromNumber(value: number) {
    let formattedValue = new Intl.NumberFormat("es-CO").format(value);
    this.myForm.get("valor")?.setValue(formattedValue, { emitEvent: false });
  }



}
