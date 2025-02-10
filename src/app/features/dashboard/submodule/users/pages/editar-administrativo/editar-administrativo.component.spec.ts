import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditarAdministrativoComponent } from './editar-administrativo.component';

describe('EditarAdministrativoComponent', () => {
  let component: EditarAdministrativoComponent;
  let fixture: ComponentFixture<EditarAdministrativoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarAdministrativoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditarAdministrativoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
