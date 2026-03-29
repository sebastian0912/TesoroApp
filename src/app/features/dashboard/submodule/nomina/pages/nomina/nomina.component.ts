import { Component } from '@angular/core';
import { ImportExcelComponent } from '../../components/import-excel/import-excel.component';

@Component({
  selector: 'app-nomina',
  standalone: true,
  imports: [ImportExcelComponent],
  templateUrl: './nomina.component.html',
  styleUrl: './nomina.component.css'
})
export class NominaComponent { }
