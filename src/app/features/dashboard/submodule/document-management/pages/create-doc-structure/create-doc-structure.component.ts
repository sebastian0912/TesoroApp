import { SharedModule } from '@/app/shared/shared.module';
import { Component, OnInit } from '@angular/core';
import { DocumentacionService } from '../../service/documentacion/documentacion.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import { DocumentModalComponent, ModalData } from '../../components/document-modal/document-modal.component';
import { CommonModule } from '@angular/common'; // Important for ngFor/ngIf
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { animate, style, transition, trigger, query, stagger } from '@angular/animations';
import { MatTreeModule, MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';


/** Interface based on your JSON model */
export interface DocumentType {
  id: number;
  name: string;
  estado: boolean;
  tags: string[];
  subtypes: DocumentType[];
}

/** Flat node with expandable and level information */
interface FlatNode {
  expandable: boolean;
  name: string;
  level: number;
  data: DocumentType; // Keep reference to original data
}

@Component({
  selector: 'app-create-doc-structure',
  standalone: true,
  imports: [
    CommonModule,
    SharedModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatInputModule,
    FormsModule,
    MatChipsModule,
    MatTreeModule,
    MatSlideToggleModule
  ],
  templateUrl: './create-doc-structure.component.html',
  styleUrl: './create-doc-structure.component.css',
  animations: [
    trigger('listAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(50, [
            animate('300ms cubic-bezier(0.35, 0, 0.25, 1)', style({ opacity: 1, transform: 'none' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class CreateDocStructureComponent implements OnInit {

  // Data Source
  allDocuments: DocumentType[] = [];

  // Navigation Stack (Breadcrumbs)
  // Stack of PARENTS. Empty = Root level.
  viewStack: DocumentType[] = [];

  // Local Filter
  searchQuery: string = '';

  // Tree View State
  isTreeView: boolean = false;

  private _transformer = (node: DocumentType, level: number) => {
    return {
      expandable: !!node.subtypes && node.subtypes.length > 0,
      name: node.name,
      level: level,
      data: node
    };
  };

  treeControl = new FlatTreeControl<FlatNode>(
    node => node.level,
    node => node.expandable,
  );

  treeFlattener = new MatTreeFlattener(
    this._transformer,
    node => node.level,
    node => node.expandable,
    node => node.subtypes,
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  constructor(
    private documentacionService: DocumentacionService,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    this.loadData();
  }

  hasChild = (_: number, node: FlatNode) => node.expandable;

  loadData() {
    this.documentacionService.mostrar_jerarquia_gestion_documental().subscribe({
      next: (data) => {
        this.allDocuments = data;
        this.dataSource.data = this.allDocuments; // Update Tree Data
        // If we are deep in stack, we need to refresh the current stack node reference to get updated children
        this.refreshStackReferences();
      },
      error: () => Swal.fire('Error', 'No se pudo cargar la estructura.', 'error')
    });
  }

  /** Refreshes objects in stack with fresh data from API to update children lists */
  private refreshStackReferences() {
    if (this.viewStack.length === 0) return;

    // Traverse down to find current path again
    let currentLevel = this.allDocuments;
    const newStack: DocumentType[] = [];

    for (const oldNode of this.viewStack) {
      const found = currentLevel.find(n => n.id === oldNode.id);
      if (found) {
        newStack.push(found);
        currentLevel = found.subtypes || [];
      } else {
        // Path broken/deleted
        break;
      }
    }
    this.viewStack = newStack;
  }

  // --- GETTERS FOR VIEW ---

  get currentLevelNodes(): DocumentType[] {
    let nodes: DocumentType[] = [];

    if (this.viewStack.length === 0) {
      nodes = this.allDocuments;
    } else {
      const parent = this.viewStack[this.viewStack.length - 1];
      nodes = parent.subtypes || [];
    }

    // Apply Filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      return nodes.filter(n => n.name.toLowerCase().includes(q));
    }

    return nodes;
  }

  get currentLevelTitle(): string {
    if (this.viewStack.length === 0) return 'Raíz';
    return this.viewStack[this.viewStack.length - 1].name;
  }

  // --- NAVIGATION ---

  drillDown(node: DocumentType) {
    this.viewStack.push(node);
    this.searchQuery = ''; // Reset search on nav
  }

  navigateUpTo(index: number) {
    if (index === -1) {
      this.viewStack = []; // Go Root
    } else {
      // Go to specific parent (slice keeps 0..index inclusive if we want to BE at index, wait slice is exclusive end)
      // If index is 0 (first item), we want to be INSIDE that item, so stack should be length 1.
      this.viewStack = this.viewStack.slice(0, index + 1);
    }
    this.searchQuery = '';
  }

  goBack() {
    this.viewStack.pop();
  }

  // --- CRUD ACTIONS ---

  openModal(node: DocumentType | null, isEdit: boolean, parentForNew: DocumentType | null = null): void {
    // If we're creating a new root or child
    // parentForNew is used if we click "Add" in a specific context
    // BUT the modal logic in this specific component (based on previous code) 
    // seems to infer parent from context or takes it in result.

    // Previous code logic:
    // node? -> edit
    // !node -> create (parent = data.id if exist? wait, previous code passed `result.parent = data.id` logic was weird)

    // Let's adapt:
    // If Creating: node is null.
    // If we are currently inside a parent (viewStack > 0), that parent ID is the parent.
    // unless we explicitly ask to create a root (special case?). 
    // The previous UI allowed creating child OF a specific node. 
    // In explorer view, usually you create child IN current view.

    // Determines 'parent' id for the NEW node
    let currentParentId: number | null = null;

    if (!isEdit) {
      // We are adding.
      // If parentForNew is passed (e.g. from context menu of a folder to add child without entering), use it.
      if (parentForNew) {
        currentParentId = parentForNew.id;
      } else {
        // Default to current View context
        if (this.viewStack.length > 0) {
          currentParentId = this.viewStack[this.viewStack.length - 1].id;
        }
      }
    }

    const data: ModalData = node
      ? {
        id: node.id,
        name: node.name,
        estado: node.estado,
        expandable: !!(node.subtypes?.length), // or just allow expandable option
        tags: node.tags || [],
        isEdit,
      }
      : {
        id: currentParentId, // Pass parent ID here so `result.parent` logic works? 
        // Actually the previous code used `data.id` as parent for new items. 
        // See: `if(data.id !== null){ result.parent = data.id; }`
        name: '',
        expandable: false,
        tags: [],
        estado: true,
        isEdit,
      };

    const dialogRef = this.dialog.open(DocumentModalComponent, {
      minWidth: '50vw',
      minHeight: '30vh',
      data,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;

      if (isEdit && node) {
        this.documentacionService.editar_tipo_documento(node.id, result).subscribe({
          next: () => {
            this.loadData();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Actualizado', showConfirmButton: false, timer: 1500 });
          },
          error: () => Swal.fire('Error', 'No se pudo editar.', 'error')
        });
      } else {
        // Create
        // Previous logic: `if(data.id !== null){ result.parent = data.id; }`
        // So we just need to ensure `data.id` was the parent ID.
        if (data.id) {
          result.parent = data.id;
        }

        this.documentacionService.crear_tipo_documento(result).subscribe({
          next: () => {
            this.loadData();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Creado', showConfirmButton: false, timer: 1500 });
          },
          error: () => Swal.fire('Error', 'No se pudo crear.', 'error')
        });
      }
    });
  }

  // Helper for "Add" button in main toolbar
  addCurrentLevel() {
    // Adds a child to the current active level
    this.openModal(null, false, null); // null parentForNew implies use ViewStack
  }

  /**
   * Adds a child to a specific node (used in context menu).
   * Drills down into that node first, then opens the add modal.
   */
  addChildToNode(node: DocumentType) {
    this.drillDown(node);
    // Slight delay to allow view update or just open modal immediately
    // Since drillDown updates viewStack synchronously, we can just open modal.
    // The modal logic uses viewStack to determine parent if parentForNew is null.
    // SO:
    this.openModal(null, false, null);
  }
}
