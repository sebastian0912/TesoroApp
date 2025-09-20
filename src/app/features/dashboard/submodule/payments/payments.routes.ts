import { Routes } from '@angular/router';
import { PaySlipsComponent } from './pages/pay-slips/pay-slips.component';
import { PaymentMethodComponent } from './pages/payment-method/payment-method.component';

export const routes: Routes = [
  { path: 'payments-method', component: PaymentMethodComponent },
  { path: 'pay-slips', component: PaySlipsComponent },
];
