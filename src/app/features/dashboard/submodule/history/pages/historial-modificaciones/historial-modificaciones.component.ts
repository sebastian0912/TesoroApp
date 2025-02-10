import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { HistorialService } from '../../service/historial/historial.service';


@Component({
  selector: 'app-historial-modificaciones',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatInputModule,
  ],
  templateUrl: './historial-modificaciones.component.html',
  styleUrl: './historial-modificaciones.component.css'
})
export class HistorialModificacionesComponent implements OnInit {
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = ['concepto', 'fechaEfectuado', 'horaEfectuado', 'username' ];

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
        this.dataSource.data = data.historialModificaciones;
      },
      (error: any) => {
      }
    );

  }


  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }


}
