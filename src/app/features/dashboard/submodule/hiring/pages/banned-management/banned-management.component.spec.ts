import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannedManagementComponent } from './banned-management.component';

describe('BannedManagementComponent', () => {
  let component: BannedManagementComponent;
  let fixture: ComponentFixture<BannedManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannedManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BannedManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
