import { SharedModule } from '@/app/shared/shared.module';
import { Component, Inject } from '@angular/core';
import { FormGroup, FormArray, FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogActions } from '@angular/material/dialog';
import { DocumentacionService } from '../../service/documentacion/documentacion.service';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ReactiveFormsModule } from '@angular/forms';


export interface ModalData {
  id: any;
  name: string;
  expandable: boolean;
  estado: boolean;
  tags?: string[];
  isEdit: boolean;
}


@Component({
  selector: 'app-document-modal',
  imports: [
    SharedModule,
    MatDividerModule,
    MatCheckboxModule,
    ReactiveFormsModule,
    MatDialogActions
  ],
  templateUrl: './document-modal.component.html',
  styleUrl: './document-modal.component.css'
})
export class DocumentModalComponent {
  form: FormGroup;
  nuevosDocumentos: FormArray<FormGroup>;
  availableTags: { id: number; name: string }[] = [];
  isAddingNewTag: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<DocumentModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalData,
    private fb: FormBuilder,
    private documentacionService: DocumentacionService
  ) {
    this.form = this.fb.group({
      id: [data.id || null],
      name: [data.name || '', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      expandable: [data.expandable || false],
      estado: [data.estado !== undefined ? data.estado : true],
      tags: [data.tags || []],
      newTagName: [''],
    });

    this.nuevosDocumentos = this.fb.array<FormGroup>([]); // Para crear múltiples documentos
  }

  ngOnInit(): void {
    this.documentacionService.mostrar_tags().subscribe({
      next: (tags: any) => {
        this.availableTags = tags.map((tag: any) => ({ id: tag.id, name: tag.name }));
        this.availableTags.push({ id: -1, name: 'NUEVO' });

        // Detectar la selección de un tag NUEVO
        this.form.get('tags')?.valueChanges.subscribe((tags) => {
          this.isAddingNewTag = tags.includes(-1);
        });

        if (this.data.tags) {
          const selectedTagIds = this.data.tags.map((tagName) =>
            this.availableTags.find((tag) => tag.name === tagName)?.id
          ).filter((id) => id !== undefined);

          this.form.patchValue({ tags: selectedTagIds });

          if (selectedTagIds.includes(-1)) {
            this.isAddingNewTag = true;
            this.form.get('newTagName')?.setValidators([Validators.required, Validators.minLength(3)]);
          }
        }
      },
    });
  }

  agregarNuevoDocumento(): void {
    const nuevoDocumento = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      estado: [true],
      tags: [[]],
      newTagName: [''],
    });
    this.nuevosDocumentos.push(nuevoDocumento);
  }

  eliminarDocumento(index: number): void {
    this.nuevosDocumentos.removeAt(index);
  }

  onTagSelection(event: any): void {
    const selectedTags = Array.isArray(event.value) ? event.value : [];
    this.isAddingNewTag = selectedTags.includes(-1);
    const newTagNameControl = this.form.get('newTagName');

    if (this.isAddingNewTag) {
      newTagNameControl?.setValidators([Validators.required, Validators.minLength(3)]);
    } else {
      newTagNameControl?.clearValidators();
      newTagNameControl?.reset();
    }
    newTagNameControl?.updateValueAndValidity();

    this.form.patchValue({
      tags: selectedTags.filter((id: number) => id !== -1 || this.isAddingNewTag),
    });
  }

  save(): void {
    const formData = { ...this.form.value };
    if (this.data.isEdit) {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.nuevosDocumentos.controls.forEach((control) => control.markAllAsTouched());
        return;
      }
      formData.tags = this.mapTagsToNames(formData.tags, formData);
      delete formData.newTagName; // Si no se utiliza el nuevo tag, eliminarlo
      this.editData(formData);
    } else {
      this.createData(formData);
    }
  }

  private editData(formData: any): void {
    this.dialogRef.close({ type: 'edit', data: formData });
  }

  private createData(formData: any): void {
    const nuevosDocumentosData = this.nuevosDocumentos.controls.map((control) => {
      const documentoTags = this.mapTagsToNames(control.value.tags, control.value);
      return { ...control.value, tags: documentoTags };
    });
    this.dialogRef.close({ type: 'create', data: nuevosDocumentosData });
  }

  private mapTagsToNames(tagIds: (number | string)[], formData: any): string[] {
    return tagIds.map((tagId: number | string) => {
      if (tagId === -1 && this.isAddingNewTag && formData.newTagName) {
        return formData.newTagName.trim();
      }
      const tag = this.availableTags.find((t) => t.id === tagId);
      return tag ? tag.name : tagId;
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
