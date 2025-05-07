import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecruitmentPipelineComponent } from './recruitment-pipeline.component';

describe('RecruitmentPipelineComponent', () => {
  let component: RecruitmentPipelineComponent;
  let fixture: ComponentFixture<RecruitmentPipelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecruitmentPipelineComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecruitmentPipelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
