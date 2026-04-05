import {  Component, Input , ChangeDetectionStrategy } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface TrasladoPreviewItem {
    nombreArchivo: string;
    documento: string;
    eps: string;
    esValido: boolean;
    error?: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-traslados-preview',
    standalone: true,
    imports: [
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
],
    templateUrl: './traslados-preview.component.html',
    styleUrls: ['./traslados-preview.component.css']
} )
export class TrasladosPreviewComponent {
    @Input() data: TrasladoPreviewItem[] = [];

    displayedColumns: string[] = ['status', 'documento', 'eps', 'archivo'];

    get totalItems(): number { return this.data.length; }
    get validItems(): number { return this.data.filter(i => i.esValido).length; }
    get invalidItems(): number { return this.data.filter(i => !i.esValido).length; }
}
