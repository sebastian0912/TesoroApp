import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TerminatedTransfersComponent } from './terminated-transfers.component';

describe('TerminatedTransfersComponent', () => {
  let component: TerminatedTransfersComponent;
  let fixture: ComponentFixture<TerminatedTransfersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminatedTransfersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TerminatedTransfersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
