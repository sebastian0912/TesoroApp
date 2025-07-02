import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-orden-union-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    DragDropModule,
    CommonModule,
    MatButtonModule
  ],
  templateUrl: './orden-union-dialog.component.html',
  styleUrl: './orden-union-dialog.component.css'
})
export class OrdenUnionDialogComponent {
  antecedentes: { id: number, name: string }[] = [];

  constructor(
    public dialogRef: MatDialogRef<OrdenUnionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.antecedentes = [...data.antecedentes]; // copiar el array
  }

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.antecedentes, event.previousIndex, event.currentIndex);
  }

  confirmar() {
    const ordenIds = this.antecedentes.map(a => a.id);
    this.dialogRef.close(ordenIds);
  }

  cancelar() {
    this.dialogRef.close(null);
  }
}
