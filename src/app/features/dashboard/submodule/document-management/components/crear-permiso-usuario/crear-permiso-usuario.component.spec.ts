import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearPermisoUsuarioComponent } from './crear-permiso-usuario.component';

describe('CrearPermisoUsuarioComponent', () => {
  let component: CrearPermisoUsuarioComponent;
  let fixture: ComponentFixture<CrearPermisoUsuarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearPermisoUsuarioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrearPermisoUsuarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
