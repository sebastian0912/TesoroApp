import { SharedModule } from '@/app/shared/shared.module';
import { Component } from '@angular/core';
import { MatTreeModule, MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { FlatTreeControl } from '@angular/cdk/tree';
import { DocumentacionService } from '../../service/documentacion/documentacion.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import { DocumentModalComponent, ModalData } from '../../components/document-modal/document-modal.component';

interface FlatNode {
  id: number;
  name: string;
  estado: boolean;
  level: number;
  expandable: boolean;
  tags: string[];
}

/** Nodo de entrada basado en tu JSON */
interface DocumentType {
  id: number;
  name: string;
  estado: boolean;
  tags: string[];
  subtypes: DocumentType[];
}

@Component({
  selector: 'app-create-doc-structure',
  imports: [
    SharedModule,
    MatTreeModule,
    MatDialogModule
  ],
  templateUrl: './create-doc-structure.component.html',
  styleUrl: './create-doc-structure.component.css'
})
export class CreateDocStructureComponent {
  documentTypes: DocumentType[] = [];
  treeControl: FlatTreeControl<FlatNode>;
  dataSource: MatTreeFlatDataSource<DocumentType, FlatNode>;
  treeFlattener: MatTreeFlattener<DocumentType, FlatNode>;
  /** Almacena nodos agregados o editados */
  changes: { id: number; changes: Partial<DocumentType> }[] = [];


  constructor(
    private documentacionService: DocumentacionService,
    private dialog: MatDialog
  ) {
    this.treeFlattener = new MatTreeFlattener(
      this.transformer,
      (node) => node.level,
      (node) => node.expandable,
      (node) => node.subtypes
    );

    this.treeControl = new FlatTreeControl<FlatNode>(
      (node) => node.level,
      (node) => node.expandable
    );

    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
  }

    /** Transformar un nodo jerárquico en un nodo plano */
    transformer = (node: DocumentType, level: number): FlatNode => {
      return {
        id: node.id,
        name: node.name,
        estado: node.estado,
        level,
        expandable: !!node.subtypes && node.subtypes.length > 0,
        tags: node.tags,
      };
    };

    ngOnInit() {
      this.loadData();
    }

    loadData() {
      this.documentacionService.mostrar_jerarquia_gestion_documental().subscribe((data) => {
        this.dataSource.data = data;
        this.documentTypes = data;
      });
    }

    /** Agregar un nuevo nodo raíz */
    addRootNode(): void {
      const dialogRef = this.dialog.open(DocumentModalComponent, {
        width: '600px',
        data: {
          id: null, // Sin ID porque es un nuevo nodo
          name: '',
          expandable: false,
          estado: true, // Estado inicial
          tags: [],
          isEdit: false, // Indica que es creación
        },
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          console.log('Creando nuevo nodo:', result);
          
        }
      });
    }


    openModal(node: FlatNode | null, isEdit: boolean): void {
      // Configuración de datos iniciales para el modal
      const data: ModalData = node
        ? {
            id: node.id,
            name: node.name,
            estado: node.estado,
            expandable: node.expandable,
            tags: node.tags || [], // Asegura que los tags sean un array
            isEdit,
          }
        : {
            id: null, // Aquí aseguramos que no se intenta acceder a node.id cuando node es null
            name: '',
            expandable: false,
            tags: [], // Tags iniciales vacíos
            estado: true,
            isEdit,
          };

      // Abrir el modal con los datos proporcionados
      const dialogRef = this.dialog.open(DocumentModalComponent, {
        minWidth: '50vw',
        minHeight: '30vh',
        data,
      });

      // Procesar el resultado del modal
      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          if (isEdit && node) {
            // Caso de edición
            this.documentacionService.editar_tipo_documento(node.id, result).subscribe(
              () => {
                this.loadData(); // Recargar los datos
              },
              (error) => {
                Swal.fire({
                  icon: 'error',
                  title: 'Error al editar el tipo documental',
                  text: 'Hubo un problema al intentar editar el tipo documental.'
                });
              }
            );
          } else if (!isEdit) {
            if(data.id !== null){
              result.parent = data.id;
            }
            this.documentacionService.crear_tipo_documento(result).subscribe(
              () => {
                this.loadData(); // Recargar los datos
              },
              (error) => {
                Swal.fire({
                  icon: 'error',
                  title: 'Error al crear el tipo documental',
                  text: 'Hubo un problema al intentar crear el tipo documental.'
                });
              }
            );
          }
        }
      });
    }







    /** Agregar un subtipo a un nodo */
    addSubtype(event: MouseEvent, parentNode: DocumentType) {
      // Detener propagación del evento para evitar que afecte la expansión
      event.stopPropagation();
    }



    /** Determina si el nodo tiene hijos */
    hasChild = (_: number, node: FlatNode) => node.expandable;

    /** Rastrear cambios realizados en nodos */
    private trackChange(id: number, changes: Partial<DocumentType>) {
      const existingChange = this.changes.find((change) => change.id === id);
      if (existingChange) {
        Object.assign(existingChange.changes, changes);
      } else {
        this.changes.push({ id, changes });
      }
    }

    /** Obtener los cambios realizados */
    getChanges() {
      return this.changes;
    }


}
