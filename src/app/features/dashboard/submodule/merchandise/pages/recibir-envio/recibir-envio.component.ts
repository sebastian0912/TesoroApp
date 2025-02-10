import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidatorFn } from '@angular/forms';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { ComercializadoraService } from '../../service/comercializadora/comercializadora.service';
import { SharedModule } from '../../../../../../shared/shared.module';

@Component({
  selector: 'app-recibir-envio',
  standalone: true,
  imports: [
    SharedModule
  ],
  templateUrl: './recibir-envio.component.html',
  styleUrl: './recibir-envio.component.css'
})

export class RecibirEnvioComponent implements OnInit {

  myForm!: FormGroup;
  datosOperario: any;
  nombreOperario: string = '';
  sumaPrestamos: number = 0;
  productos: any[] = [];
  displayedColumnsInventario: string[] = [
    'codigo', 'concepto', 'destino', 'cantidadEnvio', 'cantidadRecibida',
    'valorUnidad', 'cantidadTotalVendida', 'PersonaEnvia', 'PersonaRecibe', 'fechaRecibida'
  ];
  dataSourceInventario = new MatTableDataSource<any>();
  concepto: string = '';
  historial_id: number = 0;
  rolUsuario: string = '';
  correoUsuario: string = '';

  constructor(
    private fb: FormBuilder,
    private utilityService: UtilityServiceService,
    private comercializadoraService: ComercializadoraService,

  ) {
    this.myForm = this.fb.group({
      codigoProducto: ['', Validators.required],
      cantidad: ['', Validators.required],
      comentariosEnvio: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.loadProductos();
  }

  async loadProductos() {
    try {
      // Obtener usuario primero
      const user = await this.utilityService.getUser();
      const sedeUsuario = user.sucursalde;
      const userEmail = user.correo_electronico;

      // Luego obtener productos
      this.utilityService.traerInventarioProductos().subscribe(
        (data: any) => {
          // Filtrar productos basados en el correo del usuario
          if (userEmail === 'contaduria.rtc@gmail.com') {
            this.productos = data.comercio.filter((producto: any) =>
              producto.cantidadRecibida === "0" &&
              (producto.destino === 'ROSAL' || producto.destino === 'CARTAGENITA')
            );
          } else {
            this.productos = data.comercio.filter((producto: any) =>
              producto.cantidadRecibida === "0" &&
              producto.destino.toLowerCase() === sedeUsuario.toLowerCase()
            );
          }

          // Ordenar productos por fecha de recibo
          this.productos.sort((a: any, b: any) => new Date(b.fechaRecibida).getTime() - new Date(a.fechaRecibida).getTime());

          // Actualizar la fuente de datos
          this.dataSourceInventario.data = this.productos;
        },
        (error: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Hubo un error al obtener los productos, por favor intente de nuevo',
          });
        }
      );
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Hubo un error al obtener los productos, por favor intente de nuevo',
      });
    }
  }


  private trimFormFields() {
    const trimControl = (control: AbstractControl) => {
      if (control && control.value && typeof control.value === 'string') {
        control.setValue(control.value.trim());
      }
    };

    const trimGroup = (group: FormGroup) => {
      Object.keys(group.controls).forEach(field => {
        const control = group.get(field);
        if (control) {
          if (control instanceof FormArray) {
            control.controls.forEach(arrayControl => {
              if (arrayControl instanceof FormGroup) {
                trimGroup(arrayControl);
              } else {
                trimControl(arrayControl);
              }
            });
          } else {
            trimControl(control);
          }
        }
      });
    };

    trimGroup(this.myForm);
  }

  async onSubmit() {
    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    const formValues = this.myForm.value;

    this.trimFormFields();

    this.comercializadoraService.recibirMercancia(formValues.codigoProducto, formValues.cantidad, formValues.comentariosEnvio)
    .then((response: any) => {
      if (response.message) {
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Se ha realizado el cargue de manera exitosa',
        });
        this.loadProductos();
      } else {
        this.showError();
      }
    })
  }


  private showError() {
    Swal.fire({
      icon: 'error',
      title: 'Oops...',
      text: 'Hubo un error al realizar el cargue, por favor intente de nuevo',
    });
  }

  applyFilterInventario(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceInventario.filter = filterValue.trim().toLowerCase();
  }


}
