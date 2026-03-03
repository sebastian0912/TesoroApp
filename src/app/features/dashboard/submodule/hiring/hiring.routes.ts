import { Routes } from '@angular/router';
import { AbsencesComponent } from './pages/absences/absences.component';
import { BannedManagementComponent } from './pages/banned-management/banned-management.component';
import { BannedReportComponent } from './pages/banned-report/banned-report.component';
import { HiringReportComponent } from './pages/hiring-report/hiring-report.component';
import { QueryFormComponent } from './pages/query-form/query-form.component';
import { RecruitmentPipelineComponent } from './pages/recruitment-pipeline/recruitment-pipeline.component';
import { ViewReportsComponent } from './pages/view-reports/view-reports.component';
import { GenerateContractingDocumentsComponent } from './components/generate-contracting-documents/generate-contracting-documents.component';
import { ViewReceptionInterviewsComponent } from './pages/view-reception-interviews/view-reception-interviews.component';
import { ErrorListingComponent } from './pages/error-listing/error-listing.component';
import { ConsultContractingDocumentationComponent } from './pages/consult-contracting-documentation/consult-contracting-documentation.component';
import { TarjetasComponent } from './pages/tarjetas/tarjetas.component';

export const routes: Routes = [
  { path: 'absences', component: AbsencesComponent },
  { path: 'hiring-report', component: HiringReportComponent },
  { path: 'recruitment-pipeline', component: RecruitmentPipelineComponent },
  { path: 'generate-contracting-documents/:numeroDocumento', component: GenerateContractingDocumentsComponent },
  { path: 'query-form', component: QueryFormComponent },
  { path: 'banned-report', component: BannedReportComponent },
  { path: 'banned-management', component: BannedManagementComponent },
  { path: 'view-reports', component: ViewReportsComponent },
  { path: 'view-reception-interviews', component: ViewReceptionInterviewsComponent },
  { path: 'error-listing', component: ErrorListingComponent },
  { path: 'consult-contracting-documentation', component: ConsultContractingDocumentationComponent },
  { path: 'tarjetas', component: TarjetasComponent }
];
