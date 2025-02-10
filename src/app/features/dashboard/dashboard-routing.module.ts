import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AuthorizationsModule } from './submodule/authorizations/authorizations.module';
import { EpsTransfersModule } from './submodule/eps-transfers/eps-transfers.module';
import { HistoryModule } from './submodule/history/history.module';
import { MarketModule } from './submodule/market/market.module';
import { MerchandiseModule } from './submodule/merchandise/merchandise.module';
import { MoneyLoanModule } from './submodule/money-loan/money-loan.module';
import { UsersModule } from './submodule/users/users.module';
import { HomeComponent } from './submodule/home/home/home.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      {
        path: '',
        component: HomeComponent,
      },
      {
        path: 'authorizations',
        loadChildren: () => AuthorizationsModule,
      },
      {
        path: 'eps-transfers',
        loadChildren: () => EpsTransfersModule,
      },
      {
        path: 'history',
        loadChildren: () => HistoryModule,
      },
      {
        path: 'market',
        loadChildren: () => MarketModule,
      },
      {
        path: 'merchandise',
        loadChildren: () => MerchandiseModule,
      },
      {
        path: 'money-loan',
        loadChildren: () => MoneyLoanModule,
      },
      {
        path: 'users',
        loadChildren: () => UsersModule,
      },
    ],
  },

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule {}
