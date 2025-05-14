import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectionQuestionsComponent } from './selection-questions.component';

describe('SelectionQuestionsComponent', () => {
  let component: SelectionQuestionsComponent;
  let fixture: ComponentFixture<SelectionQuestionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectionQuestionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectionQuestionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
