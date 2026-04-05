import {  Component, OnInit , ChangeDetectionStrategy } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { HistorialService } from '../../service/historial/historial.service';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-historial-modificaciones',
  imports: [
    MatCardModule,
    StandardFilterTable
],
  templateUrl: './historial-modificaciones.component.html',
  styleUrl: './historial-modificaciones.component.css'
} )
export class HistorialModificacionesComponent implements OnInit {

  columns: ColumnDefinition[] = [
    { name: 'concepto', header: 'Concepto', type: 'text', filterable: true },
    { name: 'fechaEfectuado', header: 'Fecha Efectuado', type: 'text', filterable: true },
    { name: 'horaEfectuado', header: 'Hora Efectuado', type: 'text', filterable: true },
    { name: 'username', header: 'Nombre de usuario', type: 'text', filterable: true }
  ];

  dataList: any[] = [];

  constructor(
    private historialService: HistorialService,
  ) { }

  ngOnInit(): void {
    this.historialService.getHistorialComercializadoraTesorero().subscribe(
      (data: any) => {
        // ordenar por fechaEfectuado de mayor a menor
        data.historialModificaciones.sort((a: any, b: any) => {
          return new Date(b.fechaEfectuado).getTime() - new Date(a.fechaEfectuado).getTime();
        });
        this.dataList = data.historialModificaciones;
      },
      (error: any) => {
      }
    );

  }
}
