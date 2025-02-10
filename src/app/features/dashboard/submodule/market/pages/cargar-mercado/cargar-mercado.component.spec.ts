import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CargarMercadoComponent } from './cargar-mercado.component';

describe('CargarMercadoComponent', () => {
  let component: CargarMercadoComponent;
  let fixture: ComponentFixture<CargarMercadoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CargarMercadoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CargarMercadoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
