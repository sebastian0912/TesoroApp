import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import moment from 'moment';

@Component({
  selector: 'app-date-rang-dialog',
  standalone: true,
  imports: [
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDividerModule,
    MatButtonModule,
  ],
  templateUrl: './date-rang-dialog.component.html',
  styleUrls: ['./date-rang-dialog.component.css'],
  providers: [provideNativeDateAdapter()], // Se usa la función recomendada por Angular Material
  changeDetection: ChangeDetectionStrategy.OnPush, // Optimización de rendimiento
})
export class DateRangeDialogComponent {
  range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  constructor(public dialogRef: MatDialogRef<DateRangeDialogComponent>) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    const formattedRange = {
      start: this.range.value.start ? moment(this.range.value.start).format('YYYY-MM-DD') : null,
      end: this.range.value.end ? moment(this.range.value.end).format('YYYY-MM-DD') : null,
    };
    this.dialogRef.close(formattedRange);
  }
}
