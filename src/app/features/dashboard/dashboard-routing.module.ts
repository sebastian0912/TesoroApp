import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { HomeComponent } from './submodule/home/home/home.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'authorizations', loadChildren: () => import('./submodule/authorizations/authorizations.module').then(m => m.AuthorizationsModule) },
      { path: 'eps-transfers', loadChildren: () => import('./submodule/eps-transfers/eps-transfers.module').then(m => m.EpsTransfersModule) },
      { path: 'history', loadChildren: () => import('./submodule/history/history.module').then(m => m.HistoryModule) },
      { path: 'market', loadChildren: () => import('./submodule/market/market.module').then(m => m.MarketModule) },
      { path: 'merchandise', loadChildren: () => import('./submodule/merchandise/merchandise.module').then(m => m.MerchandiseModule) },
      { path: 'money-loan', loadChildren: () => import('./submodule/money-loan/money-loan.module').then(m => m.MoneyLoanModule) },
      { path: 'users', loadChildren: () => import('./submodule/users/users.module').then(m => m.UsersModule) },
      { path: 'treasury', loadChildren: () => import('./submodule/treasury/treasury.module').then(m => m.TreasuryModule) },
    ],
  },
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule { }
