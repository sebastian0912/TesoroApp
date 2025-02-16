import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table'; // Importa MatTableModule
import { NgFor, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-estados-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatTableModule,
    MatButtonModule
  ],
  templateUrl: './estados-dialog.component.html',
  styleUrl: './estados-dialog.component.css'
})
export class EstadosDialogComponent {
  displayedColumns: string[] = ['fecha', 'estado'];
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) { }
}
