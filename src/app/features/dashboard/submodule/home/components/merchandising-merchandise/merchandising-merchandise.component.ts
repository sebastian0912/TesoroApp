import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../../../../shared/shared.module';
import { HomeService } from '../../service/home.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs/internal/observable/of';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-merchandising-merchandise',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './merchandising-merchandise.component.html',
  styleUrl: './merchandising-merchandise.component.css'
})
export class MerchandisingMerchandiseComponent implements OnInit {
  dataSourceInventarioGeneral = new MatTableDataSource<any>();
  dataSourceTraslados = new MatTableDataSource<any>();
  dataSourceInventario = new MatTableDataSource<any>();
  displayedColumnsInventario: string[] = ['codigo', 'concepto', 'destino', 'cantidadEnvio',
    'cantidadRecibida', 'valorUnidad', 'cantidadTotalVendida', 'PersonaEnvia', 'PersonaRecibe',
    'fechaEnviada', 'fechaRecibida', 'comentariosEnvio'];
  displayedColumnsInventarioGeneral: string[] = ['concepto', 'destino', 'cantidadEnvio',
    'cantidadRecibida', 'cantidadPendiente', 'valorUnidad', 'cantidadPorVender'];


  constructor(private homeService: HomeService) { }

  ngOnInit(): void {
    this.homeService.traerInventarioProductos().pipe(
      catchError(error => {
        return of({ comercio: [] }); // Se asegura de devolver un array vacío en caso de error
      })
    ).subscribe(inventarioProductos => {
      try {
        if (!inventarioProductos || !Array.isArray(inventarioProductos.comercio)) {
          inventarioProductos = { comercio: [] }; // Validación para evitar errores si la respuesta no es la esperada
        }

        const sortedData = inventarioProductos.comercio
          .filter((p: { fechaEnviada?: string | number | Date }) => p.fechaEnviada) // Evita valores nulos/undefined
          .sort((a: { fechaEnviada: string | number | Date }, b: { fechaEnviada: string | number | Date }) =>
            new Date(b.fechaEnviada).getTime() - new Date(a.fechaEnviada).getTime()
          );

        const filteredData = sortedData
          .map((p: { fechaRecibida?: any }) => ({
            ...p,
            fechaRecibida: p.fechaRecibida || '' // Asegura que fechaRecibida tenga un valor
          }))
          .filter((p: { cantidadRecibida?: number; cantidadTotalVendida?: number; cantidadEnvio?: number }) =>
            (p.cantidadRecibida ?? 0) !== (p.cantidadTotalVendida ?? 0) || (p.cantidadEnvio ?? 0) !== (p.cantidadRecibida ?? 0)
          );

        this.dataSourceInventario.data = filteredData;
        this.dataSourceInventarioGeneral.data = this.agruparDatos(filteredData);
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar los datos del inventario',
          text: 'Por favor, intenta de nuevo más tarde.'
        });
        this.dataSourceInventario.data = [];
        this.dataSourceInventarioGeneral.data = [];
      }
    });
  }



  applyFilterInventario(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceInventario.filter = filterValue.trim().toLowerCase();
    this.dataSourceInventarioGeneral.filter = filterValue.trim().toLowerCase();
  }

  agruparDatos(data: any[]): any[] {
    let agrupado = data.reduce((acumulador, item) => {
      let clave = `${item.concepto}-${item.destino}-${item.valorUnidad}`;

      if (!acumulador[clave]) {
        acumulador[clave] = { ...item, cantidadEnvio: 0, cantidadTotalVendida: 0, cantidadRecibida: 0 };
      }

      acumulador[clave].cantidadEnvio += Number(item.cantidadEnvio);
      acumulador[clave].cantidadTotalVendida += Number(item.cantidadTotalVendida);
      acumulador[clave].cantidadRecibida += Number(item.cantidadRecibida);

      return acumulador;
    }, {});

    let agrupadoArray = Object.values(agrupado);

    agrupadoArray.sort((a: any, b: any) => a.destino.localeCompare(b.destino));

    agrupadoArray.forEach((p: any) => {
      p.cantidadPendiente = Math.abs(p.cantidadEnvio - p.cantidadRecibida);
      p.cantidadPorVender = Math.abs(p.cantidadEnvio - (p.cantidadTotalVendida == 0 ? 0 : p.cantidadTotalVendida));
    });

    return agrupadoArray;
  }
}
