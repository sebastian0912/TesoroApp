import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { CommonModule } from '@angular/common';
import { NgFor, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-leer-adres',
  imports: [
    CommonModule,
    MatDialogModule,
    MatTableModule,
    MatButtonModule
  ],
  templateUrl: './leer-adres.component.html',
  styleUrl: './leer-adres.component.css'
})
export class LeerAdresComponent {
  displayedColumns: string[] = [
    'numero_cedula', 'tipo_documento', 'nombre', 'apellido',
    'departamento', 'municipio', 'estado', 'entidad', 'regimen',
    'fecha_afiliacion_efectiva', 'fecha_finalizacion_afiliacion',
    'tipo_afiliacion', 'pdf_documento', 'marca_temporal'
  ];

  constructor(@Inject(MAT_DIALOG_DATA) public data: any[]) {
  }
}
