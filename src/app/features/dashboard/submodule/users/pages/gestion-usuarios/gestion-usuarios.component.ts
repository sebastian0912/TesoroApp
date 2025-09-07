import { Component, Input, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { StandardFilterTable, ColumnDefinition } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-gestion-usuarios',
  imports: [
    StandardFilterTable,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatButtonModule,
    MatDialogModule,
  ],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.css'
})
export class GestionUsuariosComponent implements OnInit {

  private _items: any[] = [];
  @Input() set items(value: any[]) {
    this._items = value ?? [];
    this.refreshRows();
  }
  get items(): any[] {
    return this._items;
  }

  rows: any[] = [];

  /** Columnas base */
  private readonly columns: ColumnDefinition[] = [
    { name: 'correo',    header: 'Correo',    type: 'text', width: '260px' },
    { name: 'cedula',    header: 'Cédula',    type: 'text', width: '140px' },
    { name: 'nombres',   header: 'Nombres',   type: 'text' },
    { name: 'apellidos', header: 'Apellidos', type: 'text' },
    { name: 'sede',      header: 'Sede',      type: 'text', width: '140px' },
    { name: 'rol',       header: 'Rol',       type: 'text', width: '120px' },
  ];

  /** Columnas + acciones para la tabla dinámica */
  get columnsWithActions(): ColumnDefinition[] {
    return [
      ...this.columns,
      { name: 'actions', header: 'Acciones', type: 'custom', width: '112px', stickyEnd: true },
    ];
  }

  constructor(
    private adminService: AdminService,
    private utilityService: UtilityServiceService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.reloadUsers();
    // (opcionales)
    this.utilityService.traerSucursales2().subscribe();
    this.utilityService.traerRoles().subscribe();
  }

  /** Carga/recarga usuarios desde backend */
  private reloadUsers(): void {
    this.utilityService.traerUsuarios2().subscribe({
      next: (usuarios) => { this.items = usuarios ?? []; }, // setter -> refreshRows()
      error: (e) => console.error('Error traerUsuarios2:', e),
    });
  }

  /** Reconstruye filas planas para la tabla */
  private refreshRows(): void {
    this.rows = (this.items ?? []).map(u => ({
      id: u?.id,
      correo: u?.correo_electronico ?? '—',
      cedula: u?.numero_de_documento ?? '—',
      nombres: u?.datos_basicos?.nombres ?? '—',
      apellidos: u?.datos_basicos?.apellidos ?? '—',
      sede: u?.sede?.nombre ?? '—',
      rol: u?.rol?.nombre ?? '—',
    }));
  }

  /** Crear */
  openCreateDialog(): void {
    /*const ref = this.dialog.open(UserUpsertDialogComponent, {
      width: '720px',
      data: { mode: 'create' },
      disableClose: true,
    });
    ref.afterClosed().subscribe(res => {
      if (res?.ok) this.reloadUsers();
    });
    */
  }

  /** Editar */
  openEditDialog(row: { id: string }): void {
    /*
    const user = this.items.find(u => u.id === row.id);
    const ref = this.dialog.open(UserUpsertDialogComponent, {
      width: '720px',
      data: { mode: 'edit', user },
      disableClose: true,
    });
    ref.afterClosed().subscribe(res => {
      if (res?.ok) this.reloadUsers();
    });
    */
  }

  /** Eliminar */
  deleteUser(row: { id: string }): void {
    const ok = confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.');
    if (!ok) return;

    this.adminService.eliminar(row.id).subscribe({
      next: () => this.reloadUsers(),
      error: (e) => console.error('Error al eliminar usuario:', e),
    });
  }
}
