import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';

export interface PreviewDialogData {
  title: string;
  items: {
    name: string;
    valid: boolean;
    error?: string;
  }[];
}

@Component({
  selector: 'app-file-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule
  ],
  templateUrl: './file-preview-dialog.component.html',
  styleUrl: './file-preview-dialog.component.css'
})
export class FilePreviewDialogComponent {
  displayedColumns: string[] = ['name', 'status'];

  constructor(
    public dialogRef: MatDialogRef<FilePreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PreviewDialogData
  ) { }

  close(): void {
    this.dialogRef.close();
  }
}
