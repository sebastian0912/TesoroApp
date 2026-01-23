import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface CedulaPreviewItem {
    nombreArchivo: string;
    documento: string;
    nombre: string;
    esValido: boolean;
    error?: string;
}

@Component({
    selector: 'app-cedulas-preview',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatTableModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule
    ],
    templateUrl: './cedulas-preview.component.html',
    styleUrls: ['./cedulas-preview.component.css']
})
export class CedulasPreviewComponent {
    @Input() data: CedulaPreviewItem[] = [];

    displayedColumns: string[] = ['status', 'documento', 'nombre', 'archivo'];

    get totalItems(): number { return this.data.length; }
    get validItems(): number { return this.data.filter(i => i.esValido).length; }
    get invalidItems(): number { return this.data.filter(i => !i.esValido).length; }
}
