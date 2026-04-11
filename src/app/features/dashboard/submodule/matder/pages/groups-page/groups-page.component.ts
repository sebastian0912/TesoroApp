import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatderDashboardService } from '../../services/dashboard.service';
import { UserGroupResponse } from '../../models/dashboard.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-groups-page', standalone: true,
  imports: [FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatTableModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule],
  template: `
    <div class="header"><h2>Grupos</h2><button mat-raised-button color="primary" (click)="showForm.set(true)"><mat-icon>group_add</mat-icon> Nuevo</button></div>
    @if (showForm()) { <mat-card class="form"><mat-form-field appearance="outline" class="fw"><mat-label>Nombre</mat-label><input matInput [(ngModel)]="fn"></mat-form-field><mat-form-field appearance="outline" class="fw"><mat-label>Descripción</mat-label><input matInput [(ngModel)]="fd"></mat-form-field><div class="fa"><button mat-raised-button color="primary" [disabled]="!fn.trim()" (click)="create()">Crear</button><button mat-button (click)="showForm.set(false)">Cancelar</button></div></mat-card> }
    @if (loading()) { <div class="center"><mat-spinner diameter="40"></mat-spinner></div> }
    @else if (groups().length > 0) {
      <table mat-table [dataSource]="groups()" class="tbl">
        <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let g">{{ g.name }}</td></ng-container>
        <ng-container matColumnDef="desc"><th mat-header-cell *matHeaderCellDef>Descripción</th><td mat-cell *matCellDef="let g">{{ g.description || '—' }}</td></ng-container>
        <ng-container matColumnDef="members"><th mat-header-cell *matHeaderCellDef>Miembros</th><td mat-cell *matCellDef="let g">{{ g.member_count }}</td></ng-container>
        <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let g"><button mat-icon-button color="warn" (click)="del(g)"><mat-icon>delete</mat-icon></button></td></ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let row; columns: cols;"></tr>
      </table>
    } @else { <mat-card class="empty"><mat-icon>group_off</mat-icon><p>No hay grupos.</p></mat-card> }
  `,
  styles: [`.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}h2{margin:0;font-weight:500}.form{padding:20px;margin-bottom:16px}.fw{width:100%}.fa{display:flex;gap:8px}.center{display:flex;justify-content:center;padding:48px}.empty{text-align:center;padding:48px}.empty mat-icon{font-size:48px;width:48px;height:48px;color:#9e9e9e}.tbl{width:100%}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsPageComponent implements OnInit {
  groups = signal<UserGroupResponse[]>([]); loading = signal(true); showForm = signal(false); fn = ''; fd = '';
  cols = ['name', 'desc', 'members', 'actions'];
  constructor(private ds: MatderDashboardService) {}
  async ngOnInit(): Promise<void> { await this.load(); }
  async load(): Promise<void> { this.loading.set(true); try { this.groups.set(await this.ds.getGroups()); } catch {} finally { this.loading.set(false); } }
  async create(): Promise<void> { if (!this.fn.trim()) return; try { await this.ds.createGroup({ name: this.fn.trim(), description: this.fd.trim() || undefined }); this.fn = ''; this.fd = ''; this.showForm.set(false); await this.load(); } catch {} }
  async del(g: UserGroupResponse): Promise<void> { const c = await Swal.fire({ title: `¿Eliminar "${g.name}"?`, icon: 'warning', showCancelButton: true }); if (c.isConfirmed) { try { await this.ds.deleteGroup(g.id); await this.load(); } catch {} } }
}
