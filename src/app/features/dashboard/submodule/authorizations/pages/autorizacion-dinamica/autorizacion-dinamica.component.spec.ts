import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutorizacionDinamicaComponent } from './autorizacion-dinamica.component';

describe('AutorizacionDinamicaComponent', () => {
  let component: AutorizacionDinamicaComponent;
  let fixture: ComponentFixture<AutorizacionDinamicaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutorizacionDinamicaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutorizacionDinamicaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
