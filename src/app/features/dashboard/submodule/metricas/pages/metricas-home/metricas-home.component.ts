import { Component, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-metricas-home',
    standalone: true,
    imports: [
    RouterModule,
    MatIconModule
],
    templateUrl: './metricas-home.component.html',
    styleUrls: ['./metricas-home.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricasHomeComponent {

}
