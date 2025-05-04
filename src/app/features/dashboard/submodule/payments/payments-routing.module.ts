import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PaySlipsComponent } from './pages/pay-slips/pay-slips.component';
import { PaymentMethodComponent } from './pages/payment-method/payment-method.component';

const routes: Routes = [
  { path: 'payments-method', component: PaymentMethodComponent },
  { path: 'pay-slips', component: PaySlipsComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PaymentsRoutingModule { }
