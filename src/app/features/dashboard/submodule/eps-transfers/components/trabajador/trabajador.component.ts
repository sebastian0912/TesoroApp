import {  Component, Inject , ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table'; // Importa MatTableModule

import { MatButtonModule } from '@angular/material/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-trabajador',
  imports: [
    MatDialogModule,
    MatTableModule,
    MatButtonModule
],
  templateUrl: './trabajador.component.html',
  styleUrl: './trabajador.component.css'
} )
export class TrabajadorComponent {
  displayedColumns: string[] = [
    'numerodeceduladepersona', 'primer_apellido', 'segundo_apellido',
    'primer_nombre', 'segundo_nombre', 'fecha_nacimiento', 'genero',
    'estado_civil', 'direccion_residencia', 'barrio', 'celular',
    'primercorreoelectronico', 'municipio', 'fecha_expedicion_cc',
    'municipio_expedicion_cc', 'departamento_expedicion_cc',
    'lugar_nacimiento_municipio', 'lugar_nacimiento_departamento', 'rh',
    'zurdo_diestro', 'eps13'
  ];

  constructor(@Inject(MAT_DIALOG_DATA) public data: any[]) { }
}
