import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CargarMercadoFeriasComponent } from './cargar-mercado-ferias.component';

describe('CargarMercadoFeriasComponent', () => {
  let component: CargarMercadoFeriasComponent;
  let fixture: ComponentFixture<CargarMercadoFeriasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CargarMercadoFeriasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CargarMercadoFeriasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
