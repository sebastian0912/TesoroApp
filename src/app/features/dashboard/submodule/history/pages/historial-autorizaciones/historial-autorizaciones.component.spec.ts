import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistorialAutorizacionesComponent } from './historial-autorizaciones.component';

describe('HistorialAutorizacionesComponent', () => {
  let component: HistorialAutorizacionesComponent;
  let fixture: ComponentFixture<HistorialAutorizacionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialAutorizacionesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistorialAutorizacionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
