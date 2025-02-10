import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrestamoCalamidadComponent } from './prestamo-calamidad.component';

describe('PrestamoCalamidadComponent', () => {
  let component: PrestamoCalamidadComponent;
  let fixture: ComponentFixture<PrestamoCalamidadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrestamoCalamidadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrestamoCalamidadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
