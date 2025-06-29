import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransferQueryComponent } from './transfer-query.component';

describe('TransferQueryComponent', () => {
  let component: TransferQueryComponent;
  let fixture: ComponentFixture<TransferQueryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransferQueryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransferQueryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
