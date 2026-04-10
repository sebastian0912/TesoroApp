import { Component, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';

import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from '@/app/shared/shared.module';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import * as _moment from 'moment';
// @ts-ignore
const moment = _moment.default || _moment;
import { MetricasDateRange } from '../../../models/tesoreria-metricas.models';

@Component({
  selector: 'app-metricas-filters-bar',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatMomentDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    SharedModule
],
  template: `
    <div class="filters-bar" [formGroup]="dateForm">
      
      <div class="filter-group">
        <mat-icon class="filter-icon">filter_list</mat-icon>
        <span class="filter-title">Filtros:</span>
      </div>

      <mat-form-field appearance="outline" class="dense-form-field date-range-field">
        <mat-label>Rango de Fechas</mat-label>
        <mat-date-range-input [rangePicker]="picker" [max]="today">
          <input matStartDate formControlName="start" placeholder="Inicio">
          <input matEndDate formControlName="end" placeholder="Fin" (dateChange)="onDateChange()">
        </mat-date-range-input>
        <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-date-range-picker #picker></mat-date-range-picker>
      </mat-form-field>

      <div class="spacer"></div>

      <div class="quick-ranges">
        <button mat-button class="quick-btn" (click)="setQuickRange(7)">Últimos 7 días</button>
        <button mat-button class="quick-btn" (click)="setQuickRange(30)">Últimos 30 días</button>
        <button mat-button class="quick-btn" (click)="setQuickRange(90)">Últimos 90 días</button>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .filters-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: white;
      padding: 0.75rem 1.25rem;
      border-radius: 12px;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #475569;
    }
    .filter-icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }
    .filter-title {
      font-weight: 600;
      font-size: 0.875rem;
    }
    .dense-form-field {
      margin-bottom: -1.25em; /* Compensate for mat-form-field bottom padding */
    }
    .date-range-field {
      width: 250px;
    }
    .spacer {
      flex: 1;
    }
    .quick-ranges {
      display: flex;
      gap: 0.5rem;
    }
    .quick-btn {
      color: #3b82f6;
      font-weight: 500;
      border-radius: 20px;
      font-size: 0.8125rem;
      padding: 0 16px;
      height: 32px;
      line-height: 32px;
      background: #f1f5f9;
    }
    .quick-btn:hover {
      background: #e2e8f0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricasFiltersBarComponent {
  @Output() rangeChanged = new EventEmitter<MetricasDateRange>();

  today = moment().toDate();

  dateForm = new FormGroup({
    start: new FormControl<Date>(moment().subtract(30, 'days').toDate()),
    end: new FormControl<Date>(moment().toDate())
  });

  onDateChange() {
    if (this.dateForm.valid && this.dateForm.value.start && this.dateForm.value.end) {
      this.rangeChanged.emit({
        start: this.dateForm.value.start,
        end: this.dateForm.value.end
      });
    }
  }

  setQuickRange(days: number) {
    const end = moment().toDate();
    const start = moment().subtract(days, 'days').toDate();
    this.dateForm.setValue({ start, end });
    this.rangeChanged.emit({ start, end });
  }
}
