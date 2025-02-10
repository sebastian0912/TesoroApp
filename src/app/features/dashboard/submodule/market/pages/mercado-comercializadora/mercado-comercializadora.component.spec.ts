import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MercadoComercializadoraComponent } from './mercado-comercializadora.component';

describe('MercadoComercializadoraComponent', () => {
  let component: MercadoComercializadoraComponent;
  let fixture: ComponentFixture<MercadoComercializadoraComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MercadoComercializadoraComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MercadoComercializadoraComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
