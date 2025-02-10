import { Component, OnInit } from '@angular/core';
import { ActiveAuthorizationsComponent } from '../components/active-authorizations/active-authorizations.component';
import { TerminatedTransfersComponent } from '../components/terminated-transfers/terminated-transfers.component';
import { MerchandisingMerchandiseComponent } from '../components/merchandising-merchandise/merchandising-merchandise.component';
import { HomeService } from '../service/home.service';
import { MatDialog } from '@angular/material/dialog';
import { UtilityServiceService } from '../../../../../shared/services/utilityService/utility-service.service';
import { catchError, forkJoin, of } from 'rxjs';
import Swal from 'sweetalert2';
import { NgIf } from '@angular/common';
import { InfoCardComponent } from '../../../../../shared/components/info-card/info-card.component';

@Component({
  selector: 'app-home',
  imports: [
    ActiveAuthorizationsComponent,
    TerminatedTransfersComponent,
    MerchandisingMerchandiseComponent,
    InfoCardComponent,
    NgIf
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  user: any;
  numeroempleados = 0;
  numeroautorizaciones_sin_efectuar = 0;
  numeroCoordinadores = 0;
  numeroTiendas = 0;
  general = false;
  comercializadora = false;
  admin = false;
  traslado = false;

  constructor(
    private dialog: MatDialog,
    private utilityService: UtilityServiceService,
    private homeService: HomeService
  ) {}

  ngOnInit(): void {
    this.initializeUserRoles();
    this.fetchInitialData();
  }

  private initializeUserRoles(): void {
    this.user = this.utilityService.getUser();
    if (!this.user) return;

    this.general = this.user.rol !== 'GERENCIA' && this.user.rol !== 'TRASLADOS';
    this.comercializadora = this.user.rol === 'COMERCIALIZADORA' || this.user.rol === 'ADMIN';
    this.traslado = this.user.rol === 'TRASLADOS' || this.user.rol === 'ADMIN';
    this.admin = this.user.rol === 'GERENCIA' || this.user.rol === 'ADMIN';
  }

  private async fetchInitialData(): Promise<void> {
    if (!this.general) return;

    Swal.fire({
      title: 'Cargando...',
      text: 'Por favor, espere',
      icon: 'info',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    this.fetchGeneralData();
  }

  private fetchGeneralData(): void {
    forkJoin({
      empleados: this.homeService.traerEmpleados().pipe(catchError(() => of({ datosbase: [] }))),
      usuarios: this.homeService.traerUsuarios().pipe(catchError(() => of([]))),
    }).subscribe(
      ({ empleados, usuarios }) => {
        this.numeroempleados = empleados.datosbase.length;
        this.numeroCoordinadores = this.homeService.contarRol(usuarios, 'COORDINADOR');
        this.numeroTiendas = this.homeService.contarRol(usuarios, 'TIENDA');
        Swal.close();
      },
      () => {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'No se pudo cargar la información',
        });
      }
    );
  }
}
