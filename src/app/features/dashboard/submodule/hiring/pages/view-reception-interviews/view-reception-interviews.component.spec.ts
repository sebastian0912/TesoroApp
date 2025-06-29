import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewReceptionInterviewsComponent } from './view-reception-interviews.component';

describe('ViewReceptionInterviewsComponent', () => {
  let component: ViewReceptionInterviewsComponent;
  let fixture: ComponentFixture<ViewReceptionInterviewsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewReceptionInterviewsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewReceptionInterviewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
