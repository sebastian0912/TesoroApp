import { Routes } from '@angular/router';
import { CompanyDocsAccessComponent } from './pages/company-docs-access/company-docs-access.component';
import { CreateDocStructureComponent } from './pages/create-doc-structure/create-doc-structure.component';
import { SearchDocumentsComponent } from './pages/search-documents/search-documents.component';
import { UploadDocumentsComponent } from './pages/upload-documents/upload-documents.component';

export const routes: Routes = [
  { path: 'company-docs-access', component: CompanyDocsAccessComponent },
  { path: 'create-doc-structure', component: CreateDocStructureComponent },
  { path: 'search-documents', component: SearchDocumentsComponent },
  { path: 'upload-documents', component: UploadDocumentsComponent },
];
