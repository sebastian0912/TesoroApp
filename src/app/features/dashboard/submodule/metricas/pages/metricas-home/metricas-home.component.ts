import { Component, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-metricas-home',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './metricas-home.component.html',
    styleUrls: ['./metricas-home.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricasHomeComponent {

}
