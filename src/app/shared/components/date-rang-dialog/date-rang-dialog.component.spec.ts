import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateRangeDialogComponent } from './date-rang-dialog.component';

describe('DateRangeDialogComponent', () => {
  let component: DateRangeDialogComponent;
  let fixture: ComponentFixture<DateRangeDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateRangeDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DateRangeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
