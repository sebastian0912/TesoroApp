import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateRangDialogComponent } from './date-rang-dialog.component';

describe('DateRangDialogComponent', () => {
  let component: DateRangDialogComponent;
  let fixture: ComponentFixture<DateRangDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateRangDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DateRangDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
