import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-empty-state',
    standalone: true,
    imports: [CommonModule, MatIconModule],
    template: `
    <div class="empty-state">
      <mat-icon class="icon">{{ icon }}</mat-icon>
      <h4 class="title">{{ title }}</h4>
      <p class="description" *ngIf="description">{{ description }}</p>
      <ng-content></ng-content>
    </div>
  `,
    styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1.5rem;
      text-align: center;
      height: 100%;
      box-sizing: border-box;
    }
    .icon {
      font-size: 3rem;
      width: 3rem;
      height: 3rem;
      color: #cbd5e1;
      margin-bottom: 1rem;
    }
    .title {
      font-size: 1rem;
      font-weight: 600;
      color: #475569;
      margin: 0 0 0.5rem 0;
    }
    .description {
      font-size: 0.875rem;
      color: #94a3b8;
      max-width: 300px;
      margin: 0;
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
    @Input() icon: string = 'inbox';
    @Input({ required: true }) title!: string;
    @Input() description?: string;
}
