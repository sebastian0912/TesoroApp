import {  Component, EventEmitter, Input, Output , ChangeDetectionStrategy } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-info-card',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.css',
} )
export class InfoCardComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() imageUrl = '';
  @Input() matIcon = '';
  @Input() value: number | undefined;
  @Output() cardClicked = new EventEmitter<void>();

  onCardClick(): void {
    this.cardClicked.emit();
  }
}
