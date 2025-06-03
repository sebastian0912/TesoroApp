import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearEditarVacanteComponent } from './crear-editar-vacante.component';

describe('CrearEditarVacanteComponent', () => {
  let component: CrearEditarVacanteComponent;
  let fixture: ComponentFixture<CrearEditarVacanteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearEditarVacanteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrearEditarVacanteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
