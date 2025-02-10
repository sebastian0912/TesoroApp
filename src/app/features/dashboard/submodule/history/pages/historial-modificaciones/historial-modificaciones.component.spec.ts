import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistorialModificacionesComponent } from './historial-modificaciones.component';

describe('HistorialModificacionesComponent', () => {
  let component: HistorialModificacionesComponent;
  let fixture: ComponentFixture<HistorialModificacionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialModificacionesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistorialModificacionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
