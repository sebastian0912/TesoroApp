import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActiveAuthorizationsComponent } from './active-authorizations.component';

describe('ActiveAuthorizationsComponent', () => {
  let component: ActiveAuthorizationsComponent;
  let fixture: ComponentFixture<ActiveAuthorizationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveAuthorizationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActiveAuthorizationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
