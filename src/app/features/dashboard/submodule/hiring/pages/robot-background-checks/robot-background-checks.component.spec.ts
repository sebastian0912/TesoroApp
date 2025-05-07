import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RobotBackgroundChecksComponent } from './robot-background-checks.component';

describe('RobotBackgroundChecksComponent', () => {
  let component: RobotBackgroundChecksComponent;
  let fixture: ComponentFixture<RobotBackgroundChecksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RobotBackgroundChecksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RobotBackgroundChecksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
