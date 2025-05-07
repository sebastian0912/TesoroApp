import { Component } from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatTabsModule} from '@angular/material/tabs';
import { SharedModule } from '../../../../../../shared/shared.module';

@Component({
  selector: 'app-recruitment-pipeline',
  imports: [
    MatIconModule,
    MatTabsModule,
    SharedModule
  ],
  templateUrl: './recruitment-pipeline.component.html',
  styleUrl: './recruitment-pipeline.component.css'
})
export class RecruitmentPipelineComponent {

}
