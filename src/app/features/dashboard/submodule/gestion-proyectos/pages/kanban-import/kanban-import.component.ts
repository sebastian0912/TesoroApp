import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { KanbanService } from '../../services/kanban.service';
import { KanbanImportLog, KanbanImportResult } from '../../models/kanban.models';
import Swal from 'sweetalert2';

interface ProyectoOption {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-kanban-import',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatTableModule, MatChipsModule,
    MatProgressSpinnerModule, MatProgressBarModule,
  ],
  templateUrl: './kanban-import.component.html',
  styleUrls: ['./kanban-import.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanImportComponent implements OnInit {
  importLogs = signal<KanbanImportLog[]>([]);
  loading = signal(false);
  importing = signal(false);
  result = signal<KanbanImportResult | null>(null);

  selectedFile: File | null = null;
  selectedProyecto: number | null = null;
  dragOver = false;
  proyectos = signal<ProyectoOption[]>([]);

  displayedColumns = ['nombre_archivo', 'estado', 'boards_creados', 'cards_creados', 'created_at'];

  constructor(private kanbanService: KanbanService) {}

  async ngOnInit(): Promise<void> {
    await this.loadLogs();
    await this.loadProyectos();
  }

  async loadProyectos(): Promise<void> {
    try {
      const boards = await this.kanbanService.getBoards();
      const proyectoMap = new Map<number, string>();
      boards.forEach(b => {
        if (!proyectoMap.has(b.proyecto)) {
          proyectoMap.set(b.proyecto, `Proyecto ${b.proyecto}`);
        }
      });
      this.proyectos.set(Array.from(proyectoMap, ([id, nombre]) => ({ id, nombre })));
    } catch { /* ignore */ }
  }

  async loadLogs(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.kanbanService.getImportLogs();
      this.importLogs.set(data);
    } catch {
      // silently fail
    } finally {
      this.loading.set(false);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.setFile(input.files[0]);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  private setFile(file: File): void {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      Swal.fire('Error', 'Solo se aceptan archivos Excel (.xlsx o .xls)', 'error');
      return;
    }
    this.selectedFile = file;
    this.result.set(null);
  }

  clearFile(): void {
    this.selectedFile = null;
    this.result.set(null);
  }

  downloadTemplate(): void {
    this.kanbanService.downloadImportTemplate();
  }

  async doImport(): Promise<void> {
    if (!this.selectedFile || !this.selectedProyecto) {
      Swal.fire('Atención', 'Selecciona un proyecto y un archivo Excel.', 'warning');
      return;
    }

    this.importing.set(true);
    this.result.set(null);
    try {
      const res = await this.kanbanService.importFile(this.selectedProyecto, this.selectedFile);
      this.result.set(res);
      this.selectedFile = null;
      await this.loadLogs();

      if (res.errores.length === 0) {
        Swal.fire('Importación exitosa',
          `Se crearon ${res.boards_creados} boards y ${res.cards_creados} cards.`, 'success');
      } else {
        Swal.fire('Importación parcial',
          `${res.cards_creados} cards creados, pero hubo ${res.errores.length} error(es).`, 'warning');
      }
    } catch {
      Swal.fire('Error', 'Error al procesar el archivo.', 'error');
    } finally {
      this.importing.set(false);
    }
  }

  getEstadoColor(estado: string): string {
    const colors: Record<string, string> = {
      completado: '#388e3c', fallido: '#d32f2f', procesando: '#f57c00', pendiente: '#616161',
    };
    return colors[estado] ?? '#616161';
  }
}
