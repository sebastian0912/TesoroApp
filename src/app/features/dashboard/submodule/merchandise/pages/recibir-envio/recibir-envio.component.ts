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
      const sedeUsuario = user.sucursalde;
      const userEmail = user.correo_electronico;

      this.utilityService.traerInventarioProductos().subscribe(
        (data: any) => {
          // Filtramos la data según tu lógica
          this.productos = data.comercio.filter((producto: any) =>
            producto.cantidadRecibida === "0" &&
            (
              userEmail === 'contaduria.rtc@gmail.com'
                ? ['ROSAL', 'CARTAGENITA'].includes(producto.destino)
                : producto.destino.toLowerCase() === sedeUsuario.toLowerCase()
            )
          );

          // Ordenar por fecha descendente, por ejemplo
          this.productos.sort(
            (a: any, b: any) => new Date(b.fechaRecibida).getTime() - new Date(a.fechaRecibida).getTime()
          );

          // Inicializamos selección y FormControl por cada producto
          this.productos.forEach((producto: any) => {
            // Inicialmente sin seleccionar
            this.seleccionados[producto.codigo] = false;

            // Creamos un control con la cantidad enviada y lo deshabilitamos
            this.cantidadForm.addControl(
              producto.codigo,
              new FormControl({
                value: producto.cantidadEnvio,
                disabled: true
              })
            );
          });

          this.dataSourceInventario.data = this.productos;
        },
        () => this.showError('Hubo un error al obtener los productos, por favor intente de nuevo')
      );
    } catch {
      this.showError('Hubo un error al obtener los productos, por favor intente de nuevo');
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
  confirmarRecepcion() {
    // Obtener solo los productos seleccionados
    const seleccionados = this.productos.filter(
      producto => this.seleccionados[producto.codigo]
    );

    if (seleccionados.length === 0) {
      Swal.fire('Aviso', 'Debe seleccionar al menos un producto para recibir.', 'warning');
      return;
    }

    // Por cada producto seleccionado, llamar a tu servicio
    seleccionados.forEach(producto => {
      const cantidad = this.cantidadForm.get(producto.codigo)?.value;
      this.comercializadoraService.recibirMercancia(producto.codigo, cantidad, 'Recibido correctamente')
        .then(() => {
          Swal.fire('¡Éxito!', 'Se ha recibido la mercancía correctamente.', 'success');
          // Recargamos los productos
          this.loadProductos();
        })
        .catch(() =>
          this.showError('Hubo un error al recibir la mercancía, por favor intente de nuevo')
        );
    });
  }

  applyFilterInventario(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceInventario.filter = filterValue.trim().toLowerCase();
  }

  private showError(message: string) {
    Swal.fire('Oops...', message, 'error');
  }
}
