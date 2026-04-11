import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { KanbanService } from '../../services/kanban.service';
import { KanbanProyecto } from '../../models/kanban.models';

@Component({
  selector: 'app-board-dialog',
  standalone: true,
  imports: [
    FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatSelectModule, MatIconModule, MatDividerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'create' ? 'Nuevo Tablero' : 'Editar Tablero' }}</h2>
    <mat-dialog-content>
      @if (data.mode === 'create') {
        @if (!creatingProyecto) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Proyecto</mat-label>
            <mat-select [(ngModel)]="proyectoId" required>
              @for (p of proyectos; track p.id) {
                <mat-option [value]="p.id">{{ p.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-button color="accent" (click)="creatingProyecto = true" class="new-proyecto-btn">
            <mat-icon>add</mat-icon> Crear proyecto nuevo
          </button>
          <mat-divider></mat-divider>
        } @else {
          <p class="section-label">Nuevo proyecto</p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nombre del proyecto</mat-label>
            <input matInput [(ngModel)]="nuevoProyectoNombre" required>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Descripción del proyecto</mat-label>
            <textarea matInput [(ngModel)]="nuevoProyectoDescripcion" rows="2"></textarea>
          </mat-form-field>
          <div class="btn-row">
            <button mat-raised-button color="primary" [disabled]="!nuevoProyectoNombre.trim() || savingProyecto"
                    (click)="crearProyecto()">
              {{ savingProyecto ? 'Creando...' : 'Crear proyecto' }}
            </button>
            <button mat-button (click)="creatingProyecto = false">Cancelar</button>
          </div>
          <mat-divider></mat-divider>
        }
      }

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Nombre del tablero</mat-label>
        <input matInput [(ngModel)]="nombre" required>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Descripción</mat-label>
        <textarea matInput [(ngModel)]="descripcion" rows="3"></textarea>
      </mat-form-field>
      <div class="color-row">
        <span class="color-label">Color acento:</span>
        @for (c of colorOptions; track c) {
          <button class="color-dot" [style.background]="c"
                  [class.selected]="colorAcento === c"
                  (click)="colorAcento = c"></button>
        }
        <input type="color" [(ngModel)]="colorAcento" class="color-custom">
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button mat-raised-button color="primary"
              [disabled]="!nombre.trim() || (data.mode === 'create' && !proyectoId)"
              (click)="save()">
        {{ data.mode === 'create' ? 'Crear tablero' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; }
    .new-proyecto-btn { margin-bottom: 12px; }
    .section-label { font-weight: 500; margin: 0 0 8px; color: rgba(0,0,0,.6); }
    .btn-row { display: flex; gap: 8px; margin-bottom: 12px; }
    mat-divider { margin: 12px 0; }
    .color-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .color-label { font-size: .85rem; color: rgba(0,0,0,.6); }
    .color-dot {
      width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; transition: border-color .15s;
    }
    .color-dot.selected { border-color: #333; }
    .color-custom { width: 28px; height: 28px; border: none; padding: 0; cursor: pointer; }
  `],
})
export class BoardDialogComponent implements OnInit {
  nombre = '';
  descripcion = '';
  colorAcento = '#1976d2';
  proyectoId: number | null = null;
  proyectos: KanbanProyecto[] = [];
  creatingProyecto = false;
  nuevoProyectoNombre = '';
  nuevoProyectoDescripcion = '';
  savingProyecto = false;

  colorOptions = ['#1976d2', '#38bdf8', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  constructor(
    public dialogRef: MatDialogRef<BoardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { mode: 'create' | 'edit'; board?: any },
    private kanbanService: KanbanService,
  ) {
    if (data.board) {
      this.nombre = data.board.nombre || '';
      this.descripcion = data.board.descripcion || '';
      this.colorAcento = data.board.color_acento || '#1976d2';
      this.proyectoId = data.board.proyecto || null;
    }
  }

  async ngOnInit(): Promise<void> {
    if (this.data.mode === 'create') {
      try {
        this.proyectos = await this.kanbanService.getProyectos();
        if (this.proyectos.length > 0 && !this.proyectoId) {
          this.proyectoId = this.proyectos[0].id;
        }
        if (this.proyectos.length === 0) {
          this.creatingProyecto = true;
        }
      } catch { /* ignore */ }
    }
  }

  async crearProyecto(): Promise<void> {
    if (!this.nuevoProyectoNombre.trim()) return;
    this.savingProyecto = true;
    try {
      const p = await this.kanbanService.createProyecto({
        nombre: this.nuevoProyectoNombre.trim(),
        descripcion: this.nuevoProyectoDescripcion.trim() || undefined,
      });
      this.proyectos = [...this.proyectos, p];
      this.proyectoId = p.id;
      this.creatingProyecto = false;
      this.nuevoProyectoNombre = '';
      this.nuevoProyectoDescripcion = '';
    } catch { /* ignore */ }
    this.savingProyecto = false;
  }

  save(): void {
    this.dialogRef.close({
      nombre: this.nombre.trim(),
      descripcion: this.descripcion.trim() || null,
      color_acento: this.colorAcento,
      proyecto: this.proyectoId,
    });
  }
}
