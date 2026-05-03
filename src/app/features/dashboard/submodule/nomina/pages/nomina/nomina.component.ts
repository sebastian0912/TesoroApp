import { Component, ChangeDetectionStrategy } from '@angular/core';

import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { ImportExcelComponent } from '../../components/import-excel/import-excel.component';
import { EmpleadosListaComponent } from '../../components/empleados-lista/empleados-lista.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-nomina',
  standalone: true,
  imports: [MatTabsModule, MatIconModule, ImportExcelComponent, EmpleadosListaComponent],
  templateUrl: './nomina.component.html',
  styleUrl: './nomina.component.css',
})
export class NominaComponent { }
