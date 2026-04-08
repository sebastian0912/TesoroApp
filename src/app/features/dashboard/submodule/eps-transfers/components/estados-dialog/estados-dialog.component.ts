import {  Component, Inject , ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table'; // Importa MatTableModule

import { MatButtonModule } from '@angular/material/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-estados-dialog',
  imports: [
    MatDialogModule,
    MatTableModule,
    MatButtonModule
],
  templateUrl: './estados-dialog.component.html',
  styleUrl: './estados-dialog.component.css'
} )
export class EstadosDialogComponent {
  displayedColumns: string[] = ['fecha', 'estado'];
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) { }
}
