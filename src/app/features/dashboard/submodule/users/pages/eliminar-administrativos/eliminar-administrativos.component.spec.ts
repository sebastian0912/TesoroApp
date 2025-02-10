import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EliminarAdministrativosComponent } from './eliminar-administrativos.component';

describe('EliminarAdministrativosComponent', () => {
  let component: EliminarAdministrativosComponent;
  let fixture: ComponentFixture<EliminarAdministrativosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EliminarAdministrativosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EliminarAdministrativosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
