import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HiringQuestionsComponent } from './hiring-questions.component';

describe('HiringQuestionsComponent', () => {
  let component: HiringQuestionsComponent;
  let fixture: ComponentFixture<HiringQuestionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HiringQuestionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HiringQuestionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
