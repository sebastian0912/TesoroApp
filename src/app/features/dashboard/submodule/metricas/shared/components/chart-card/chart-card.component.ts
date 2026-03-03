import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressSpinnerModule],
  template: `
    <mat-card class="chart-card">
      <mat-card-header class="chart-header" *ngIf="title">
        <mat-card-title class="card-title">{{ title }}</mat-card-title>
        <mat-card-subtitle class="card-subtitle" *ngIf="subtitle">{{ subtitle }}</mat-card-subtitle>
        <div class="header-actions">
          <ng-content select="[actions]"></ng-content>
        </div>
      </mat-card-header>
      
      <mat-card-content class="chart-content">
        <!-- Overlay Loading -->
        <div class="loading-overlay" *ngIf="loading">
          <mat-spinner diameter="40" color="primary"></mat-spinner>
        </div>
        
        <!-- Contenido principal (ECharts component) -->
        <ng-content></ng-content>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .chart-card {
      height: 100%;
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(226, 232, 240, 0.8);
      background: #ffffff;
      overflow: hidden;
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }
    .chart-card:hover {
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    ::ng-deep .chart-card > .mat-mdc-card-header {
      padding: 1.5rem 1.5rem 0.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      position: relative;
    }
    .card-title {
      font-size: 1.125rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 0.25rem;
      letter-spacing: -0.015em;
    }
    .card-subtitle {
      font-size: 0.85rem;
      color: #64748b;
      font-weight: 400;
    }
    .header-actions {
      position: absolute;
      top: 1.25rem;
      right: 1.5rem;
    }
    .chart-content {
      flex: 1;
      position: relative;
      padding: 1rem 1.5rem 1.5rem 1.5rem !important;
      display: flex;
      flex-direction: column;
      min-height: 280px;
    }
    .loading-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(4px);
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: inherit;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartCardComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() loading: boolean = false;
}
