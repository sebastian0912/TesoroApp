import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannedReportComponent } from './banned-report.component';

describe('BannedReportComponent', () => {
  let component: BannedReportComponent;
  let fixture: ComponentFixture<BannedReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannedReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannedReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
