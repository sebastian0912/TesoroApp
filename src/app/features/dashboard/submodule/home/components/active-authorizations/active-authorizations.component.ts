import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../../../../shared/shared.module';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { DateRangeDialogComponent } from '../../../../../../shared/components/date-rang-dialog/date-rang-dialog.component';
import { HomeService } from '../../service/home.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs/internal/observable/of';

@Component({
  selector: 'app-active-authorizations',
  imports: [
    SharedModule,
    MatTableModule,
    MatDialogModule
  ],
  templateUrl: './active-authorizations.component.html',
  styleUrl: './active-authorizations.component.css'
})
export class ActiveAuthorizationsComponent implements OnInit {
  dataSource = new MatTableDataSource();
  displayedColumns: string[] = ['cedulaQuienPide', 'codigo', 'cuotas', 'monto'];

  constructor(
    private dialog: MatDialog,
    private utilityServiceService: UtilityServiceService,
    private homeService: HomeService
  ) { }

  ngOnInit(): void {
    this.homeService.traerAutorizacionesPorUsuario().pipe(
      catchError(error => of({ codigos: [] }))
    ).subscribe(autorizacionesPorUsuario => {
      this.dataSource.data = autorizacionesPorUsuario.codigos;
    });
  }


  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  openDateRangeDialog(): void {
    const dialogRef = this.dialog.open(DateRangeDialogComponent, { width: '550px' });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        let user = this.utilityServiceService.getUser();
        this.homeService.traerHistorialInformePersona(result.start, result.end, user.primer_nombre + ' ' + user.primer_apellido)
          .pipe(
            catchError(error => {
              return of({ historial: {} });
            })
          )
          .subscribe(data => {
            this.exportAsExcelFile(data.historial, 'Historial_Informe_Personal');
          });
      }
    });
  }

  private exportAsExcelFile(historial: any, fileName: string): void {
    const registrosData: any[] = [];
    const conceptosData = [];

    for (const fecha in historial) {
      if (historial.hasOwnProperty(fecha)) {
        const dayData = historial[fecha];

        // Add date to each registro
        if (dayData.registros && Array.isArray(dayData.registros)) {
          dayData.registros.forEach((registro: any) => {
            registrosData.push({ fecha, ...registro });
          });
        }

        // Flatten conceptos for each day
        if (dayData.conceptos) {
          for (const concepto in dayData.conceptos) {
            if (dayData.conceptos.hasOwnProperty(concepto)) {
              conceptosData.push({
                fecha,
                concepto,
                ...dayData.conceptos[concepto]
              });
            }
          }
        }
      }
    }
  }
}
