import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import Swal from 'sweetalert2';
import { MatTableDataSource } from '@angular/material/table';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { ComercializadoraService } from '../../service/comercializadora/comercializadora.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-recibir-envio',
  imports: [SharedModule, MatCheckboxModule],
  templateUrl: './recibir-envio.component.html',
  styleUrl: './recibir-envio.component.css'
})
export class RecibirEnvioComponent implements OnInit {

  displayedColumnsInventario: string[] = [
    'select',
    'codigo',
    'concepto',
    'cantidadEnvio',
    'cantidadRecibida',
    'valorUnidad',
    'PersonaEnvia',
    'PersonaRecibe',
    'comentariosEnvio'
  ];

  dataSourceInventario = new MatTableDataSource<any>();
  productos: any[] = [];

  // Objeto para saber si un producto está seleccionado o no
  seleccionados: { [key: string]: boolean } = {};

  // FormGroup para controlar las cantidades recibidas
  cantidadForm = new FormGroup({});

  constructor(
    private utilityService: UtilityServiceService,
    private comercializadoraService: ComercializadoraService
  ) { }

  ngOnInit() {
    this.loadProductos();
  }

  async loadProductos() {
    try {
      const user = await this.utilityService.getUser();
      const sedeUsuario = user.sede.nombre;
      const userEmail = user.correo_electronico;

      let sede_filtro = sedeUsuario;
      if (userEmail === 'contaduria.rtc@gmail.com') {
        // Si es admin, puede que queramos ver todos, dejamos vacío
        sede_filtro = '';
      }

      const response = await this.comercializadoraService.listarPendientesRecepcion(sede_filtro);

      this.productos = response.map((item: any) => ({
        codigo: item.id.toString(), // usamos id como el código único del envío (como string para FormControl)
        concepto: item.producto_nombre,
        cantidadEnvio: item.cantidad,
        valorUnidad: item.valor_unitario,
        PersonaEnvia: item.realizado_por,
        comentariosEnvio: item.comentario,
        PersonaRecibe: '',
        fechaRecibida: item.realizado_en // usamos la fecha de salida como orden
      }));

      // Ordenar por fecha descendente
      this.productos.sort(
        (a: any, b: any) => new Date(b.fechaRecibida).getTime() - new Date(a.fechaRecibida).getTime()
      );

      // Inicializamos selección y FormControl por cada producto
      this.productos.forEach((producto: any) => {
        this.seleccionados[producto.codigo] = false;
        this.cantidadForm.addControl(
          producto.codigo.toString(),
          new FormControl({
            value: producto.cantidadEnvio,
            disabled: true
          })
        );
      });

      this.dataSourceInventario.data = this.productos;

    } catch (error) {
      console.error('Error cargando productos pendientes:', error);
      this.showError('Hubo un error al obtener los envíos pendientes, por favor intente de nuevo');
    }
  }

  /**
   * Manejar selección del checkbox
   */
  toggleSelection(event: any, codigo: string) {
    const isChecked = event.checked;
    this.seleccionados[codigo] = isChecked;

    const control = this.cantidadForm.get(codigo);
    if (control) {
      if (isChecked) {
        // Habilitamos y ponemos la cantidad por defecto (por ejemplo, la misma cantidad que se envió)
        control.enable();
      } else {
        // Deshabilitamos y opcionalmente ponemos en 0
        control.setValue(0);
        control.disable();
      }
    }
  }

  /**
   * Incrementar la cantidad recibida
   */
  incrementarCantidad(codigo: string) {
    const control = this.cantidadForm.get(codigo);
    if (control) {
      const currentValue = control.value || 0;
      control.setValue(parseInt(currentValue) + 1);
    }
  }

  /**
   * Decrementar la cantidad recibida
   */
  decrementarCantidad(codigo: string) {
    const control = this.cantidadForm.get(codigo);
    if (control) {
      const currentValue = control.value || 0;
      if (currentValue > 0) {
        control.setValue(parseInt(currentValue) - 1);
      }
    }
  }

  /**
   * Confirmar la recepción
   */
  async confirmarRecepcion() {
    // Obtener solo los productos seleccionados
    const seleccionados = this.productos.filter(
      producto => this.seleccionados[producto.codigo]
    );

    if (seleccionados.length === 0) {
      Swal.fire('Aviso', 'Debe seleccionar al menos un producto para recibir.', 'warning');
      return;
    }

    const user = this.utilityService.getUser();
    const personaRecibe = user ? `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}` : 'Usuario';

    try {
      let successCount = 0;
      for (const producto of seleccionados) {
        const cantidad = this.cantidadForm.get(producto.codigo.toString())?.value;
        const payload = {
          envio_id: producto.codigo,
          cantidad: cantidad,
          persona_recibe: personaRecibe,
          comentario: 'Recibido correctamente'
        };
        await this.comercializadoraService.recibirMercanciaNuevo(payload);
        successCount++;
      }

      Swal.fire('¡Éxito!', `Se han recibido ${successCount} envíos correctamente.`, 'success');
      this.loadProductos();
    } catch (error) {
      console.error('Error al recibir envíos:', error);
      this.showError('Hubo un error al recibir la mercancía, por favor intente de nuevo');
    }
  }

  applyFilterInventario(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceInventario.filter = filterValue.trim().toLowerCase();
  }

  private showError(message: string) {
    Swal.fire('Oops...', message, 'error');
  }
}
