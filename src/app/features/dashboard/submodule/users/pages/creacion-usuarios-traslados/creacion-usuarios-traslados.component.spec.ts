import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreacionUsuariosTrasladosComponent } from './creacion-usuarios-traslados.component';

describe('CreacionUsuariosTrasladosComponent', () => {
  let component: CreacionUsuariosTrasladosComponent;
  let fixture: ComponentFixture<CreacionUsuariosTrasladosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreacionUsuariosTrasladosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreacionUsuariosTrasladosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
