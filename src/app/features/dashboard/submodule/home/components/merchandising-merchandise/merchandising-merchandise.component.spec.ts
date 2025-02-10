import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MerchandisingMerchandiseComponent } from './merchandising-merchandise.component';

describe('MerchandisingMerchandiseComponent', () => {
  let component: MerchandisingMerchandiseComponent;
  let fixture: ComponentFixture<MerchandisingMerchandiseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MerchandisingMerchandiseComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MerchandisingMerchandiseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
