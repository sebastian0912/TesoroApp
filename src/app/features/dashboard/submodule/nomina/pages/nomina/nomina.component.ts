import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ImportExcelComponent } from '../../components/import-excel/import-excel.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-nomina',
  standalone: true,
  imports: [ImportExcelComponent],
  templateUrl: './nomina.component.html',
  styleUrl: './nomina.component.css'
})
export class NominaComponent { }
