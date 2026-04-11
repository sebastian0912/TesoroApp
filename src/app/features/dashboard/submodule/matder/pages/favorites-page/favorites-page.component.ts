import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-favorites-page', standalone: true,
  imports: [MatCardModule, MatIconModule],
  template: `<h2>Favoritos</h2><mat-card class="empty"><mat-icon>star</mat-icon><p>Marca tableros o tarjetas como favoritos para verlos aquí.</p></mat-card>`,
  styles: [`h2{font-weight:500}.empty{text-align:center;padding:48px}.empty mat-icon{font-size:48px;width:48px;height:48px;color:#ff9800}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPageComponent {}
