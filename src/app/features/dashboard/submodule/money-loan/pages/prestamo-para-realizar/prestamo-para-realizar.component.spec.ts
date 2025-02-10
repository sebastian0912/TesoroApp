import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrestamoParaRealizarComponent } from './prestamo-para-realizar.component';

describe('PrestamoParaRealizarComponent', () => {
  let component: PrestamoParaRealizarComponent;
  let fixture: ComponentFixture<PrestamoParaRealizarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrestamoParaRealizarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrestamoParaRealizarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
