import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-info-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.css',
})
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
