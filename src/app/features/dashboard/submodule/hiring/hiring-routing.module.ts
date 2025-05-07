import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AbsencesComponent } from './pages/absences/absences.component';
import { BannedManagementComponent } from './pages/banned-management/banned-management.component';
import { BannedReportComponent } from './pages/banned-report/banned-report.component';
import { HiringProcessComponent } from './pages/hiring-process/hiring-process.component';
import { HiringReportComponent } from './pages/hiring-report/hiring-report.component';
import { QueryFormComponent } from './pages/query-form/query-form.component';
import { RecruitmentPipelineComponent } from './pages/recruitment-pipeline/recruitment-pipeline.component';
import { RobotBackgroundChecksComponent } from './pages/robot-background-checks/robot-background-checks.component';
import { ViewReportsComponent } from './pages/view-reports/view-reports.component';

const routes: Routes = [
  { path: 'absences', component: AbsencesComponent },
  { path: 'hiring-report', component: HiringReportComponent },
  { path: 'view-reports', component: ViewReportsComponent },
  { path: 'recruitment-pipeline', component: RecruitmentPipelineComponent },
  { path: 'hiring-process', component: HiringProcessComponent },
  { path: 'query-form', component: QueryFormComponent },
  { path: 'robot-background-checks', component: RobotBackgroundChecksComponent },
  { path: 'banned-report', component: BannedReportComponent },
  { path: 'banned-management', component: BannedManagementComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HiringRoutingModule { }
