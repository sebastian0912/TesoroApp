import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpInformationComponent } from './help-information.component';

describe('HelpInformationComponent', () => {
  let component: HelpInformationComponent;
  let fixture: ComponentFixture<HelpInformationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpInformationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HelpInformationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
